"""Download Open-Meteo archive data and train one global XGBoost per horizon.

Run from the project directory with: python -m ml.train_model
"""

import argparse
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import joblib
import numpy as np
import pandas as pd
import requests
from sklearn.metrics import mean_absolute_error, mean_squared_error
from xgboost import XGBRegressor

from cities import CITIES
from config import ARCHIVE_API_URL, REQUEST_TIMEOUT_SECONDS, TIMEZONE
from ml.features import FEATURE_COLUMNS, build_features

PROJECT_DIR = Path(__file__).resolve().parents[1]
DATA_PATH = PROJECT_DIR / "data" / "hourly_weather.csv"
MODEL_PATH = PROJECT_DIR / "models" / "temperature_models.joblib"
START_DATE = "2023-01-01"
TRAINING_CITY_NAMES = [
    "Delhi", "Mumbai", "Kolkata", "Chennai", "Bengaluru", "Hyderabad",
    "Ahmedabad", "Jaipur", "Srinagar", "Leh", "Guwahati", "Bhopal",
    "Patna", "Kochi", "Port Blair",
]
VARIABLES = [
    "temperature_2m", "relative_humidity_2m", "surface_pressure", "wind_speed_10m",
]
HORIZONS = (1, 6, 12, 24)
SPATIAL_TEST_CITY_NAMES = ("Srinagar", "Guwahati", "Patna")
INTERVAL_LEVEL = 0.90


def recent_archive_end_date():
    """Use a seven-day safety buffer for the archive's recent-data delay."""
    today = datetime.now(ZoneInfo(TIMEZONE)).date()
    return (today - timedelta(days=7)).isoformat()


def download_archive_data(start_date=START_DATE, end_date=None, output_path=DATA_PATH):
    """Fetch 15 cities together, then save a tidy hourly CSV for reuse."""
    end_date = end_date or recent_archive_end_date()
    city_by_name = {city["name"]: city for city in CITIES}
    selected = [city_by_name[name] for name in TRAINING_CITY_NAMES]
    params = {
        "latitude": ",".join(str(city["lat"]) for city in selected),
        "longitude": ",".join(str(city["lon"]) for city in selected),
        "start_date": start_date,
        "end_date": end_date,
        "hourly": ",".join(VARIABLES),
        "timezone": TIMEZONE,
        # ERA5 has a known recent-data buffer; the end date above stays outside it.
        "models": "era5",
    }
    response = requests.get(
        ARCHIVE_API_URL, params=params, timeout=max(REQUEST_TIMEOUT_SECONDS, 120)
    )
    response.raise_for_status()
    payload = response.json()
    locations = payload if isinstance(payload, list) else [payload]
    if len(locations) != len(selected):
        raise RuntimeError(
            f"Expected data for {len(selected)} cities, received {len(locations)} locations"
        )

    frames = []
    for city, location in zip(selected, locations):
        hourly = location.get("hourly", {})
        if not hourly.get("time"):
            raise RuntimeError(f"Open-Meteo returned no hourly rows for {city['name']}")
        row_count = len(hourly["time"])
        frame = pd.DataFrame({"time": hourly["time"]})
        for variable in VARIABLES:
            values = hourly.get(variable)
            if values is None or len(values) != row_count:
                raise RuntimeError(f"Open-Meteo returned incomplete {variable} data for {city['name']}")
            frame[variable] = values
        frame["city"] = city["name"]
        frame["state"] = city["state"]
        frame["lat"] = city["lat"]
        frame["lon"] = city["lon"]
        frames.append(frame)

    result = pd.concat(frames, ignore_index=True)
    result["time"] = pd.to_datetime(result["time"])
    result = result.sort_values(["city", "time"]).reset_index(drop=True)
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    result.to_csv(output_path, index=False)
    print(f"Saved {len(result):,} hourly rows for {len(selected)} cities to {output_path}")
    print(f"Archive dates: {result['time'].min()} through {result['time'].max()}")
    return result


def make_supervised_rows(data, horizon):
    """Build one horizon's samples while preserving true hourly alignment."""
    samples = []
    for _city, raw_group in data.groupby("city", sort=False):
        group = raw_group.sort_values("time").drop_duplicates("time").copy()
        group["time"] = pd.to_datetime(group["time"])
        # Reindex to hourly timestamps: a missing archive hour cannot masquerade
        # as a one-hour lag or as an h-hour target.
        group = group.set_index("time")
        full_hours = pd.date_range(group.index.min(), group.index.max(), freq="h")
        group = group.reindex(full_hours)
        group.index.name = "time"
        group = group.reset_index()
        group["city"] = _city
        for column in ("state", "lat", "lon"):
            group[column] = group[column].ffill().bfill()

        features = build_features(group)
        target = pd.to_numeric(group["temperature_2m"], errors="coerce").shift(-horizon)
        target_time = group["time"].shift(-horizon)
        current_temperature = pd.to_numeric(group["temperature_2m"], errors="coerce")
        sample = features.copy()
        sample["time"] = group["time"]
        sample["target_time"] = target_time
        sample["target"] = target
        sample["baseline"] = current_temperature
        sample["city"] = _city
        sample = sample.dropna(subset=FEATURE_COLUMNS + ["target", "baseline", "target_time"])
        samples.append(sample)
    return pd.concat(samples, ignore_index=True)


def chronological_cutoffs(data):
    """Use a calibration window, followed by a strict final 20% test window."""
    timestamps = pd.Series(pd.to_datetime(data["time"]).drop_duplicates().sort_values())
    calibration_index = min(int(len(timestamps) * 0.7), len(timestamps) - 2)
    test_index = min(int(len(timestamps) * 0.8), len(timestamps) - 1)
    return timestamps.iloc[calibration_index], timestamps.iloc[test_index]


def new_model():
    """Create a reproducible global gradient-boosted tree regressor."""
    return XGBRegressor(
        objective="reg:squarederror",
        n_estimators=300,
        max_depth=6,
        learning_rate=0.05,
        subsample=0.85,
        colsample_bytree=0.9,
        reg_lambda=1.0,
        n_jobs=-1,
        random_state=42,
    )


def scores(expected, predicted):
    """Calculate standard absolute and squared-error scores in Celsius."""
    return {
        "mae": float(mean_absolute_error(expected, predicted)),
        "rmse": float(np.sqrt(mean_squared_error(expected, predicted))),
    }


def fit_and_report(data):
    """Train, time-test, calibrate intervals, and test on unseen cities."""
    calibration_cutoff, cutoff = chronological_cutoffs(data)
    models = {}
    report = {}
    all_city_names = set(data["city"].dropna().unique())
    missing_spatial = set(SPATIAL_TEST_CITY_NAMES) - all_city_names
    if missing_spatial:
        raise RuntimeError(f"Spatial test cities missing from archive data: {sorted(missing_spatial)}")
    print(
        f"Time split: fit/calibration before {calibration_cutoff}; "
        f"final test from {cutoff}"
    )
    print(f"Unseen-city test locations: {', '.join(SPATIAL_TEST_CITY_NAMES)}")

    for horizon in HORIZONS:
        samples = make_supervised_rows(data, horizon)
        fit_rows = samples[
            (samples["time"] < calibration_cutoff)
            & (samples["target_time"] < calibration_cutoff)
        ]
        calibration = samples[
            (samples["time"] >= calibration_cutoff)
            & (samples["target_time"] >= calibration_cutoff)
            & (samples["target_time"] < cutoff)
        ]
        train = samples[(samples["time"] < cutoff) & (samples["target_time"] < cutoff)]
        test = samples[(samples["time"] >= cutoff) & (samples["target_time"] >= cutoff)]
        if fit_rows.empty or calibration.empty or train.empty or test.empty:
            raise RuntimeError(f"Not enough samples to train and test the {horizon}-hour model")

        # Calibrate an empirical 90% error range on a later window that the
        # calibration model has never seen.
        calibration_model = new_model()
        calibration_model.fit(fit_rows[FEATURE_COLUMNS], fit_rows["target"])
        calibration_prediction = calibration_model.predict(calibration[FEATURE_COLUMNS])
        interval_radius = float(np.quantile(
            np.abs(calibration["target"].to_numpy() - calibration_prediction),
            INTERVAL_LEVEL,
        ))

        # The production model can use all history before the final test window.
        model = new_model()
        model.fit(train[FEATURE_COLUMNS], train["target"])
        prediction = model.predict(test[FEATURE_COLUMNS])
        actual = test["target"].to_numpy()
        baseline = test["baseline"].to_numpy()
        model_scores = scores(actual, prediction)
        baseline_scores = scores(actual, baseline)
        interval_coverage = float(np.mean(np.abs(actual - prediction) <= interval_radius))

        # Spatial generalization: none of these three locations are included
        # while fitting the spatial model; only future test dates are scored.
        spatial_train = samples[
            (~samples["city"].isin(SPATIAL_TEST_CITY_NAMES))
            & (samples["time"] < cutoff)
            & (samples["target_time"] < cutoff)
        ]
        spatial_test = samples[
            samples["city"].isin(SPATIAL_TEST_CITY_NAMES)
            & (samples["time"] >= cutoff)
            & (samples["target_time"] >= cutoff)
        ]
        if spatial_train.empty or spatial_test.empty:
            raise RuntimeError(f"Not enough spatial holdout samples for {horizon} hours")
        spatial_model = new_model()
        spatial_model.fit(spatial_train[FEATURE_COLUMNS], spatial_train["target"])
        spatial_prediction = spatial_model.predict(spatial_test[FEATURE_COLUMNS])

        per_city = {}
        for city, city_test in test.assign(prediction=prediction).groupby("city"):
            per_city[city] = {
                **scores(city_test["target"], city_test["prediction"]),
                "test_samples": int(len(city_test)),
            }

        models[horizon] = model
        report[horizon] = {
            "xgboost": model_scores,
            "persistence": baseline_scores,
            "test_samples": int(len(test)),
            "temporal_by_city": per_city,
            "spatial_holdout": {
                "xgboost": scores(spatial_test["target"], spatial_prediction),
                "persistence": scores(spatial_test["target"], spatial_test["baseline"]),
                "test_cities": list(SPATIAL_TEST_CITY_NAMES),
                "test_samples": int(len(spatial_test)),
            },
            "prediction_interval": {
                "level": INTERVAL_LEVEL,
                "half_width_c": interval_radius,
                "calibration_samples": int(len(calibration)),
                "test_coverage": interval_coverage,
            },
        }
        print(
            f"{horizon:>2}h | XGBoost MAE {model_scores['mae']:.2f}°C, "
            f"RMSE {model_scores['rmse']:.2f}°C | Persistence MAE "
            f"{baseline_scores['mae']:.2f}°C, RMSE {baseline_scores['rmse']:.2f}°C | "
            f"unseen-city MAE {report[horizon]['spatial_holdout']['xgboost']['mae']:.2f}°C | "
            f"90% interval test coverage {interval_coverage:.0%}"
        )

    artifact = {
        "models": models,
        "accuracy_report": report,
        "feature_columns": FEATURE_COLUMNS,
        "horizons": HORIZONS,
        "training_cities": TRAINING_CITY_NAMES,
        "spatial_test_cities": list(SPATIAL_TEST_CITY_NAMES),
        "calibration_cutoff": str(calibration_cutoff),
        "cutoff": str(cutoff),
        "data_start": str(pd.to_datetime(data["time"]).min()),
        "data_end": str(pd.to_datetime(data["time"]).max()),
        "timezone": TIMEZONE,
    }
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(artifact, MODEL_PATH)
    print(f"Saved models and accuracy report together to {MODEL_PATH}")
    return artifact


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--download-only", action="store_true", help="Download the hourly CSV and stop")
    parser.add_argument("--train-only", action="store_true", help="Train from the existing CSV without downloading")
    parser.add_argument("--start-date", default=START_DATE, help="Archive start date (YYYY-MM-DD)")
    parser.add_argument("--end-date", default=None, help="Archive end date; defaults to seven days ago")
    args = parser.parse_args()

    if args.download_only and args.train_only:
        parser.error("Use only one of --download-only or --train-only")
    if args.train_only:
        if not DATA_PATH.exists():
            parser.error(f"Training CSV not found: {DATA_PATH}. Run without --train-only first.")
        data = pd.read_csv(DATA_PATH, parse_dates=["time"])
    else:
        data = download_archive_data(args.start_date, args.end_date)
    if not args.download_only:
        fit_and_report(data)


if __name__ == "__main__":
    main()
