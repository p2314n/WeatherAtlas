"""Flask API for current weather across India and a city's 3-day forecast."""

from threading import Lock
from datetime import datetime, timedelta
import time
from zoneinfo import ZoneInfo

import requests
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

from cities import CITIES
from crop_advisor import make_recommendations, SOIL_LABELS, WATER_LABELS
from config import (
    APP_HOST,
    APP_PORT,
    ALERT_FORECAST_HOURS,
    CACHE_TTL_SECONDS,
    COLD_ALERT_THRESHOLD_C,
    EXTREME_RAINFALL_THRESHOLD_MM,
    FORECAST_API_URL,
    HEAT_ALERT_THRESHOLD_C,
    HEAVY_RAINFALL_THRESHOLD_MM,
    IMD_API_KEY,
    IMD_WARNING_API_URL,
    REQUEST_TIMEOUT_SECONDS,
    TIMEZONE,
    VERY_HEAVY_RAINFALL_THRESHOLD_MM,
)
from ml.predict import load_model_bundle, predict_temperature
from verification import record_predictions, verification_report, verify_location

app = Flask(__name__)
CORS(app)  # Allows the plain-JS frontend to call this API during development.


@app.get("/")
def home():
    """Serve the single-page dashboard from the static directory."""
    return send_from_directory(app.static_folder, "index.html")


@app.get("/farmers")
def farmers_page():
    """Serve the dedicated farmer crop-screening page in this same app."""
    return send_from_directory(app.static_folder, "farmers.html")

# Cache entries are: key -> (time_added, response_data). The lock prevents two
# simultaneous requests from both making the same slow Open-Meteo call.
_cache = {}
_cache_lock = Lock()
_imd_warning_cache = {"expires": 0, "data": None}


def cached_json(cache_key, params):
    """Return a cached API payload, fetching and caching it when it has expired."""
    now = time.monotonic()
    with _cache_lock:
        entry = _cache.get(cache_key)
        if entry and now - entry[0] < CACHE_TTL_SECONDS:
            return entry[1]

        response = requests.get(
            FORECAST_API_URL, params=params, timeout=REQUEST_TIMEOUT_SECONDS
        )
        response.raise_for_status()
        data = response.json()
        _cache[cache_key] = (time.monotonic(), data)
        return data


def open_meteo_error(error):
    """Turn upstream/network errors into a stable, friendly JSON response."""
    app.logger.warning("Open-Meteo request failed: %s", error)
    return jsonify({"error": "Weather data is temporarily unavailable. Please try again shortly."}), 502


def extract_current(payload, city, index=0):
    """Normalize either a single-location or multi-location API response."""
    location = payload[index] if isinstance(payload, list) else payload
    current = location.get("current", {})
    return {
        **city,
        "temperature": current.get("temperature_2m"),
        "humidity": current.get("relative_humidity_2m"),
        "rainfall": current.get("precipitation"),
        "time": current.get("time"),
    }


@app.get("/api/current")
def current_weather():
    """Get current weather for all configured cities in one batched request."""
    latitudes = ",".join(str(city["lat"]) for city in CITIES)
    longitudes = ",".join(str(city["lon"]) for city in CITIES)
    params = {
        "latitude": latitudes,
        "longitude": longitudes,
        "current": "temperature_2m,relative_humidity_2m,precipitation",
        "timezone": TIMEZONE,
    }
    try:
        payload = cached_json("current-india", params)
        if isinstance(payload, list) and len(payload) != len(CITIES):
            raise ValueError("Open-Meteo returned an unexpected number of locations")
        cities = [extract_current(payload, city, i) for i, city in enumerate(CITIES)]
        return jsonify({"cities": cities, "timezone": TIMEZONE})
    except (requests.RequestException, ValueError, KeyError, TypeError) as error:
        return open_meteo_error(error)


@app.get("/api/crop-advice")
def crop_advice():
    """Return transparent starter crop-fit scores for the Maharashtra pilot."""
    city_name = request.args.get("city", "")
    city = next((item for item in CITIES if item["name"].casefold() == city_name.casefold()), None)
    if city is None:
        return jsonify({"error": "Choose a monitored city from the location list."}), 400
    if city["state"] != "Maharashtra":
        return jsonify({"error": "The crop-screening prototype currently covers Maharashtra only. Use the official district advisory for other states."}), 400

    try:
        month = int(request.args.get("month", ""))
    except (TypeError, ValueError):
        return jsonify({"error": "Choose a valid sowing month."}), 400
    soil = request.args.get("soil", "unknown")
    irrigation = request.args.get("irrigation", "")
    if not 1 <= month <= 12:
        return jsonify({"error": "Month must be between 1 and 12."}), 400
    if soil not in SOIL_LABELS or irrigation not in WATER_LABELS:
        return jsonify({"error": "Choose a listed soil type and irrigation option."}), 400

    latitude, longitude = round(city["lat"], 4), round(city["lon"], 4)
    params = {
        "latitude": latitude, "longitude": longitude,
        "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum",
        "forecast_days": 7, "timezone": TIMEZONE,
    }
    try:
        payload = cached_json(f"crop-weather:{latitude}:{longitude}", params)
        daily = payload.get("daily", {})
        highs = [float(value) for value in daily.get("temperature_2m_max", []) if value is not None]
        lows = [float(value) for value in daily.get("temperature_2m_min", []) if value is not None]
        rainfall = [float(value) for value in daily.get("precipitation_sum", []) if value is not None]
        if not rainfall:
            raise ValueError("Open-Meteo returned no 7-day rainfall forecast.")
        forecast = {
            "days": len(rainfall),
            "rainfall_total_mm": round(sum(rainfall), 1),
            "minimum_temperature_c": round(min(lows), 1) if lows else None,
            "maximum_temperature_c": round(max(highs), 1) if highs else None,
        }
        return jsonify({
            "location": {"city": city["name"], "state": city["state"]},
            "selected_month": month,
            "soil": SOIL_LABELS[soil],
            "irrigation": WATER_LABELS[irrigation],
            "forecast": forecast,
            "recommendations": make_recommendations(
                month, soil, irrigation, forecast["rainfall_total_mm"],
                datetime.now(ZoneInfo(TIMEZONE)).month,
            ),
            "disclaimer": "Prototype screening based on broad sowing windows and your inputs. Not agronomic, yield, profit, or official sowing advice.",
            "official_advisory_url": "https://imdagrimet.gov.in/cropAdvisory_3.php",
        })
    except (requests.RequestException, ValueError, KeyError, TypeError) as error:
        return open_meteo_error(error)


@app.get("/api/crop-cities")
def crop_cities():
    """List locations available to the Maharashtra crop-screening pilot."""
    return jsonify({
        "cities": [
            {"name": city["name"], "state": city["state"]}
            for city in CITIES if city["state"] == "Maharashtra"
        ]
    })


def parse_coordinate(parameter):
    """Read and validate a latitude/longitude query parameter."""
    try:
        value = float(request.args[parameter])
    except (KeyError, TypeError, ValueError):
        raise ValueError(f"Please provide a valid {parameter} query parameter")
    lower, upper = (-90, 90) if parameter == "lat" else (-180, 180)
    if not lower <= value <= upper:
        raise ValueError(f"{parameter} must be between {lower} and {upper}")
    return value


@app.get("/api/forecast")
def city_forecast():
    """Get 3 days of hourly temperature and precipitation probability."""
    try:
        latitude = parse_coordinate("lat")
        longitude = parse_coordinate("lon")
    except ValueError as error:
        return jsonify({"error": str(error)}), 400

    # Rounded coordinates produce consistent cache keys for equivalent requests.
    latitude, longitude = round(latitude, 4), round(longitude, 4)
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "hourly": "temperature_2m,precipitation_probability",
        "forecast_days": 3,
        "timezone": TIMEZONE,
    }
    try:
        payload = cached_json(f"forecast:{latitude}:{longitude}", params)
        hourly = payload.get("hourly", {})
        return jsonify({
            "latitude": latitude,
            "longitude": longitude,
            "timezone": TIMEZONE,
            "hourly": {
                "time": hourly.get("time", []),
                "temperature_2m": hourly.get("temperature_2m", []),
                "precipitation_probability": hourly.get("precipitation_probability", []),
            },
        })
    except (requests.RequestException, ValueError, KeyError, TypeError) as error:
        return open_meteo_error(error)


@app.get("/api/predict")
def temperature_prediction():
    """Return model predictions and Open-Meteo's forecast at the same hours."""
    try:
        latitude = parse_coordinate("lat")
        longitude = parse_coordinate("lon")
    except ValueError as error:
        return jsonify({"error": str(error)}), 400

    try:
        result = predict_temperature(latitude, longitude)
        city_name = request.args.get("city", "Selected location")[:80]
        record_predictions(city_name, latitude, longitude, result["predictions"], result["current_time"])
        return jsonify(result)
    except FileNotFoundError as error:
        return jsonify({"error": str(error)}), 503
    except requests.RequestException as error:
        return open_meteo_error(error)
    except (ValueError, KeyError, TypeError) as error:
        app.logger.warning("Prediction could not be built: %s", error)
        return jsonify({"error": str(error)}), 503


@app.get("/api/model-report")
def model_report():
    """Expose the saved chronological holdout metrics for the dashboard."""
    try:
        artifact = load_model_bundle()
    except FileNotFoundError as error:
        return jsonify({"error": str(error)}), 503
    except (OSError, ValueError, KeyError) as error:
        app.logger.exception("Could not read the trained model report")
        return jsonify({"error": "The saved model report could not be read. Retrain the model."}), 500

    return jsonify({
        "accuracy_report": artifact.get("accuracy_report", {}),
        "horizons": artifact.get("horizons", [1, 6, 12, 24]),
        "cutoff": artifact.get("cutoff"),
        "calibration_cutoff": artifact.get("calibration_cutoff"),
        "spatial_test_cities": artifact.get("spatial_test_cities", []),
        "timezone": artifact.get("timezone", TIMEZONE),
        "evaluation_note": "Time scores use a final chronological holdout; spatial scores use cities excluded from model fitting.",
    })


def rainfall_category(amount_mm):
    """Use IMD's 24-hour station-rainfall categories as a screening threshold."""
    if amount_mm >= EXTREME_RAINFALL_THRESHOLD_MM:
        return "Extremely heavy"
    if amount_mm >= VERY_HEAVY_RAINFALL_THRESHOLD_MM:
        return "Very heavy"
    if amount_mm >= HEAVY_RAINFALL_THRESHOLD_MM:
        return "Heavy"
    return None


@app.get("/api/alerts")
def weather_alerts():
    """Screen city forecasts for extreme heat, cold, and heavy rainfall."""
    latitudes = ",".join(str(city["lat"]) for city in CITIES)
    longitudes = ",".join(str(city["lon"]) for city in CITIES)
    params = {
        "latitude": latitudes,
        "longitude": longitudes,
        "hourly": "temperature_2m,precipitation",
        "forecast_days": 3,
        "timezone": TIMEZONE,
    }
    try:
        payload = cached_json("alerts-india-24h", params)
        locations = payload if isinstance(payload, list) else [payload]
        if len(locations) != len(CITIES):
            raise ValueError("Open-Meteo returned an unexpected number of locations")

        now = datetime.now(ZoneInfo(TIMEZONE)).replace(
            minute=0, second=0, microsecond=0, tzinfo=None
        )
        end = now + timedelta(hours=ALERT_FORECAST_HOURS)
        heat_alerts = []
        cold_alerts = []
        rainfall_alerts = []
        for city, location in zip(CITIES, locations):
            hourly = location.get("hourly", {})
            times = hourly.get("time", [])
            temperatures = hourly.get("temperature_2m", [])
            rainfall = hourly.get("precipitation", [])
            if not times or len(temperatures) != len(times) or len(rainfall) != len(times):
                continue

            rows = []
            for time_text, temperature, rain in zip(times, temperatures, rainfall):
                forecast_time = datetime.fromisoformat(time_text[:16])
                if now <= forecast_time < end:
                    rows.append((forecast_time, temperature, rain))
            # Skip partial windows rather than understate 24-hour rainfall totals.
            if len(rows) < ALERT_FORECAST_HOURS:
                continue

            valid_temperatures = [(at, float(value)) for at, value, _ in rows if value is not None]
            if valid_temperatures:
                peak_time, peak_temperature = max(valid_temperatures, key=lambda row: row[1])
                if peak_temperature >= HEAT_ALERT_THRESHOLD_C:
                    heat_alerts.append({
                        "city": city["name"],
                        "state": city["state"],
                        "max_temperature": peak_temperature,
                        "forecast_time": peak_time.isoformat(timespec="minutes"),
                    })

                cold_time, minimum_temperature = min(valid_temperatures, key=lambda row: row[1])
                if minimum_temperature <= COLD_ALERT_THRESHOLD_C:
                    cold_alerts.append({
                        "city": city["name"],
                        "state": city["state"],
                        "min_temperature": minimum_temperature,
                        "forecast_time": cold_time.isoformat(timespec="minutes"),
                    })

            valid_rain = [float(rain) for _, _, rain in rows if rain is not None]
            if len(valid_rain) != ALERT_FORECAST_HOURS:
                continue
            total_rain = sum(valid_rain)
            category = rainfall_category(total_rain)
            if category:
                peak_rain_time, peak_rain_amount = max(
                    ((at, float(rain)) for at, _, rain in rows if rain is not None),
                    key=lambda row: row[1],
                )
                rainfall_alerts.append({
                    "city": city["name"],
                    "state": city["state"],
                    "total_mm_next_24h": total_rain,
                    "category": category,
                    "peak_hourly_mm": peak_rain_amount,
                    "peak_hour": peak_rain_time.isoformat(timespec="minutes"),
                })

        heat_alerts.sort(key=lambda item: item["max_temperature"], reverse=True)
        cold_alerts.sort(key=lambda item: item["min_temperature"])
        rainfall_alerts.sort(key=lambda item: item["total_mm_next_24h"], reverse=True)
        return jsonify({
            "checked_at": now.isoformat(timespec="minutes"),
            "forecast_hours": ALERT_FORECAST_HOURS,
            "heat_threshold_c": HEAT_ALERT_THRESHOLD_C,
            "cold_threshold_c": COLD_ALERT_THRESHOLD_C,
            "heavy_rain_threshold_mm": HEAVY_RAINFALL_THRESHOLD_MM,
            "heat_alerts": heat_alerts,
            "cold_alerts": cold_alerts,
            "rainfall_alerts": rainfall_alerts,
            "source": "Open-Meteo forecast; informational screening, not an official warning",
        })
    except (requests.RequestException, ValueError, KeyError, TypeError) as error:
        return open_meteo_error(error)


@app.get("/api/verification")
def forecast_verification():
    """Verify mature predictions for a selected point and report accumulated skill."""
    updated = 0
    if "lat" in request.args or "lon" in request.args:
        try:
            latitude = parse_coordinate("lat")
            longitude = parse_coordinate("lon")
            updated = verify_location(latitude, longitude)
        except ValueError as error:
            return jsonify({"error": str(error)}), 400
        except requests.RequestException as error:
            app.logger.info("Forecast verification archive unavailable: %s", error)
    return jsonify({**verification_report(), "newly_verified": updated})


@app.get("/api/imd-warnings")
def imd_warnings():
    """Fetch official IMD district warnings when an authorized API key is configured."""
    official_url = "https://mausam.imd.gov.in/responsive/districtWiseWarningGIS.php"
    if not IMD_API_KEY:
        return jsonify({
            "configured": False,
            "source_url": official_url,
            "message": "In-app IMD data needs an API key issued by IMD. Open the official warning map meanwhile.",
            "warnings": [],
        })
    if _imd_warning_cache["data"] is not None and time.monotonic() < _imd_warning_cache["expires"]:
        return jsonify(_imd_warning_cache["data"])
    try:
        response = requests.get(
            IMD_WARNING_API_URL,
            headers={"x-api-key": IMD_API_KEY},
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        payload = response.json()
        rows = payload.get("data", payload) if isinstance(payload, dict) else payload
        warnings = []
        warning_labels = {
            "1": "No warning", "2": "Heavy rain", "3": "Heavy snow",
            "4": "Thunderstorm / lightning / squall", "5": "Hailstorm",
            "6": "Dust storm", "7": "Dust-raising winds", "8": "Strong surface winds",
            "9": "Heat wave", "10": "Hot day", "11": "Warm night",
            "12": "Cold wave", "13": "Cold day", "14": "Ground frost",
            "15": "Fog", "16": "Very heavy rain", "17": "Extremely heavy rain",
        }
        for row in rows if isinstance(rows, list) else []:
            day_items = []
            for day in range(1, 6):
                text = row.get(f"Day_{day}", row.get(f"day{day}_warning", ""))
                if text and str(text).strip().lower() not in {"1", "no warning", "none", "nan"}:
                    labels = [warning_labels.get(code.strip(), code.strip()) for code in str(text).split(",")]
                    day_items.append({"day": day, "text": ", ".join(labels),
                                      "color": row.get(f"Day{day}_Color", row.get(f"day{day}_color", ""))})
            if day_items:
                warnings.append({"district": row.get("District", row.get("district", "District")),
                                 "state": row.get("State", row.get("state", "")), "days": day_items})
        result = {"configured": True, "source_url": official_url, "warnings": warnings,
                  "updated_at": datetime.now(ZoneInfo(TIMEZONE)).isoformat(timespec="minutes")}
        _imd_warning_cache.update({"data": result, "expires": time.monotonic() + CACHE_TTL_SECONDS})
        return jsonify(result)
    except (requests.RequestException, ValueError) as error:
        app.logger.warning("Official IMD warning feed unavailable: %s", error)
        return jsonify({"configured": True, "source_url": official_url, "warnings": [],
                        "message": "The IMD feed is unavailable or rejected the configured key."}), 502


if __name__ == "__main__":
    # Debug is convenient for local learning; use a production WSGI server later.
    app.run(host=APP_HOST, port=APP_PORT, debug=True)
