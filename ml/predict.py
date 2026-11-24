"""Live, multi-horizon temperature prediction using the shared feature builder."""

from datetime import datetime, timedelta
from threading import Lock
import time
from zoneinfo import ZoneInfo

import joblib
import pandas as pd
import requests

from config import (
    CACHE_TTL_SECONDS,
    FORECAST_API_URL,
    MODEL_ARTIFACT_PATH,
    REQUEST_TIMEOUT_SECONDS,
    TIMEZONE,
)
from ml.features import FEATURE_COLUMNS, build_features

HORIZONS = (1, 6, 12, 24)
HOURLY_VARIABLES = (
    "temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m"
)

_artifact_cache = {"mtime": None, "artifact": None}
_artifact_lock = Lock()
_weather_cache = {}
_weather_lock = Lock()


def load_model_bundle():
    """Load the trained artifact once, and reload it if the file changes."""
    if not MODEL_ARTIFACT_PATH.exists():
        raise FileNotFoundError(
            "Temperature models are not trained yet. Run `python -m ml.train_model` first."
        )
    modified = MODEL_ARTIFACT_PATH.stat().st_mtime
    with _artifact_lock:
        if _artifact_cache["mtime"] != modified:
            _artifact_cache["artifact"] = joblib.load(MODEL_ARTIFACT_PATH)
            _artifact_cache["mtime"] = modified
        return _artifact_cache["artifact"]


def get_recent_weather(lat, lon):
    """Fetch two past days plus two forecast days; reuse each response for 30 min."""
    cache_key = (round(float(lat), 4), round(float(lon), 4))
    now = time.monotonic()
    with _weather_lock:
        cached = _weather_cache.get(cache_key)
        if cached and now - cached[0] < CACHE_TTL_SECONDS:
            return cached[1]

        params = {
            "latitude": cache_key[0],
            "longitude": cache_key[1],
            "hourly": HOURLY_VARIABLES,
            "past_days": 2,
            "forecast_days": 2,
            "timezone": TIMEZONE,
        }
        response = requests.get(
            FORECAST_API_URL, params=params, timeout=REQUEST_TIMEOUT_SECONDS
        )
        response.raise_for_status()
        payload = response.json()
        _weather_cache[cache_key] = (time.monotonic(), payload)
        return payload


def predict_temperature(lat, lon):
    """Predict temperatures 1, 6, 12, and 24 hours after the latest full hour.

    The returned `open_meteo_temperature` comes from the forecast in the same
    API response, making it easy for the UI to compare the model and forecast.
    """
    artifact = load_model_bundle()
    feature_columns = artifact.get("feature_columns", FEATURE_COLUMNS)
    if list(feature_columns) != FEATURE_COLUMNS:
        raise ValueError(
            "The trained model uses a different feature schema. Retrain with `python -m ml.train_model`."
        )

    payload = get_recent_weather(lat, lon)
    hourly = payload.get("hourly", {})
    times = hourly.get("time", [])
    if not times:
        raise ValueError("Open-Meteo returned no recent hourly weather for this location.")

    weather = pd.DataFrame({"time": pd.to_datetime(times)})
    for column in (
        "temperature_2m", "relative_humidity_2m", "surface_pressure", "wind_speed_10m",
    ):
        values = hourly.get(column)
        if values is None or len(values) != len(weather):
            raise ValueError(f"Open-Meteo did not return hourly {column} values.")
        weather[column] = values
    weather["lat"] = float(lat)
    weather["lon"] = float(lon)

    current_hour = datetime.now(ZoneInfo(TIMEZONE)).replace(
        minute=0, second=0, microsecond=0, tzinfo=None
    )
    # The API also returns later hours. Exclude those from feature construction.
    history = weather[weather["time"] <= pd.Timestamp(current_hour)].copy()
    if history.empty:
        raise ValueError("No observations are available up to the current India hour.")
    history = history.sort_values("time").reset_index(drop=True)
    latest = history.iloc[-1]

    features = build_features(history).iloc[[-1]][FEATURE_COLUMNS]
    if features.isna().any(axis=None):
        raise ValueError(
            "Not enough complete hourly history to build prediction features; try again shortly."
        )

    six_hours_ago = history.iloc[-7]["temperature_2m"] if len(history) >= 7 else None
    six_hour_change = (
        float(latest["temperature_2m"]) - float(six_hours_ago)
        if six_hours_ago is not None and pd.notna(six_hours_ago) else None
    )

    predictions = []
    for horizon in HORIZONS:
        model = artifact["models"].get(horizon)
        if model is None:
            model = artifact["models"].get(str(horizon))
        if model is None:
            raise ValueError(f"The trained artifact is missing the {horizon}-hour model.")

        target_time = pd.Timestamp(latest["time"]) + timedelta(hours=horizon)
        target_row = weather.loc[weather["time"] == target_time]
        official_temperature = None
        if not target_row.empty:
            value = target_row.iloc[0]["temperature_2m"]
            official_temperature = None if pd.isna(value) else float(value)

        model_temperature = float(model.predict(features)[0])
        interval = artifact.get("accuracy_report", {}).get(horizon, {}).get(
            "prediction_interval", {}
        )
        if not interval:
            interval = artifact.get("accuracy_report", {}).get(str(horizon), {}).get(
                "prediction_interval", {}
            )
        interval_radius = interval.get("half_width_c")
        predictions.append({
            "horizon_hours": horizon,
            "target_time": target_time.strftime("%Y-%m-%dT%H:%M"),
            "model_temperature": model_temperature,
            "interval_lower": (
                model_temperature - float(interval_radius)
                if interval_radius is not None else None
            ),
            "interval_upper": (
                model_temperature + float(interval_radius)
                if interval_radius is not None else None
            ),
            "interval_level": interval.get("level"),
            "persistence_temperature": float(latest["temperature_2m"]),
            "open_meteo_temperature": official_temperature,
        })

    return {
        "latitude": float(lat),
        "longitude": float(lon),
        "timezone": TIMEZONE,
        "current_time": pd.Timestamp(latest["time"]).strftime("%Y-%m-%dT%H:%M"),
        "current_temperature": float(latest["temperature_2m"]),
        "explanation": {
            "six_hour_temperature_change_c": six_hour_change,
            "previous_six_hour_mean_c": float(features.iloc[0]["temperature_2m_rolling_mean_6"]),
            "humidity_percent": float(latest["relative_humidity_2m"]),
            "wind_speed_kmh": float(latest["wind_speed_10m"]),
            "note": "Context from recent inputs; not a causal feature-attribution explanation.",
        },
        "forecast_source": "Open-Meteo forecast",
        "predictions": predictions,
    }
