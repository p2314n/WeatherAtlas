"""Shared feature builder used by training and live prediction.

Every temperature lag and rolling value is calculated from earlier hours only.
Keep feature names and ordering here so both model paths stay consistent.
"""

import math

import pandas as pd

TEMPERATURE_COLUMN = "temperature_2m"
FEATURE_COLUMNS = [
    "temperature_2m_lag_1",
    "temperature_2m_lag_2",
    "temperature_2m_lag_3",
    "temperature_2m_lag_6",
    "temperature_2m_lag_12",
    "temperature_2m_lag_24",
    "temperature_2m_rolling_mean_6",
    "temperature_2m_rolling_mean_24",
    "hour_sin",
    "hour_cos",
    "month",
    "relative_humidity_2m",
    "surface_pressure",
    "wind_speed_10m",
    "lat",
    "lon",
]


def build_features(weather: pd.DataFrame) -> pd.DataFrame:
    """Return model inputs aligned to weather rows, without looking forward.

    `weather` must contain a `time` column and the four Open-Meteo hourly
    variables. It should describe one city, sorted by time. The returned rows
    with early missing lags remain NaN so callers can drop them consistently.
    """
    required = {
        "time", TEMPERATURE_COLUMN, "relative_humidity_2m",
        "surface_pressure", "wind_speed_10m", "lat", "lon",
    }
    missing = required.difference(weather.columns)
    if missing:
        raise ValueError(f"Weather data is missing required columns: {sorted(missing)}")

    frame = weather.copy()
    frame["time"] = pd.to_datetime(frame["time"])
    frame = frame.sort_values("time").reset_index(drop=True)
    temperature = pd.to_numeric(frame[TEMPERATURE_COLUMN], errors="coerce")
    features = pd.DataFrame(index=frame.index)

    for lag in (1, 2, 3, 6, 12, 24):
        features[f"temperature_2m_lag_{lag}"] = temperature.shift(lag)

    # Shift first so the rolling mean at hour t uses only hours before t.
    previous_temperature = temperature.shift(1)
    features["temperature_2m_rolling_mean_6"] = previous_temperature.rolling(
        window=6, min_periods=6
    ).mean()
    features["temperature_2m_rolling_mean_24"] = previous_temperature.rolling(
        window=24, min_periods=24
    ).mean()

    hour = frame["time"].dt.hour
    angle = 2 * math.pi * hour / 24
    features["hour_sin"] = angle.map(math.sin)
    features["hour_cos"] = angle.map(math.cos)
    features["month"] = frame["time"].dt.month
    for column in ("relative_humidity_2m", "surface_pressure", "wind_speed_10m", "lat", "lon"):
        features[column] = pd.to_numeric(frame[column], errors="coerce")

    return features[FEATURE_COLUMNS]
