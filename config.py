"""Application settings and external API URLs live in this file."""

import os
from pathlib import Path

FORECAST_API_URL = "https://api.open-meteo.com/v1/forecast"
ARCHIVE_API_URL = "https://archive-api.open-meteo.com/v1/archive"
IMD_WARNING_API_URL = "https://api.imd.gov.in/api/v1/districtwarning"
IMD_API_KEY = os.environ.get("IMD_API_KEY", "")
TIMEZONE = "Asia/Kolkata"
CACHE_TTL_SECONDS = 30 * 60
REQUEST_TIMEOUT_SECONDS = 20
APP_HOST = "0.0.0.0"
APP_PORT = int(os.environ.get("PORT", "5000"))
MODEL_ARTIFACT_PATH = Path(__file__).resolve().parent / "models" / "temperature_models.joblib"
HEAT_ALERT_THRESHOLD_C = 40.0
COLD_ALERT_THRESHOLD_C = 5.0
HEAVY_RAINFALL_THRESHOLD_MM = 64.5
VERY_HEAVY_RAINFALL_THRESHOLD_MM = 115.6
EXTREME_RAINFALL_THRESHOLD_MM = 204.5
ALERT_FORECAST_HOURS = 24
VERIFICATION_DELAY_DAYS = 5
DATABASE_PATH = Path(__file__).resolve().parent / "data" / "weatheratlas.sqlite3"
