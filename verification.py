"""Small SQLite store for issued forecasts and their later verification."""

import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import requests

from config import (
    ARCHIVE_API_URL, DATABASE_PATH, REQUEST_TIMEOUT_SECONDS, TIMEZONE,
    VERIFICATION_DELAY_DAYS,
)


@contextmanager
def connect():
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(DATABASE_PATH)
    db.row_factory = sqlite3.Row
    db.execute("""CREATE TABLE IF NOT EXISTS predictions (
        id INTEGER PRIMARY KEY,
        city TEXT NOT NULL,
        lat REAL NOT NULL,
        lon REAL NOT NULL,
        issued_at TEXT NOT NULL,
        target_time TEXT NOT NULL,
        horizon INTEGER NOT NULL,
        model REAL NOT NULL,
        persistence REAL NOT NULL,
        guidance REAL,
        actual REAL,
        verified_at TEXT,
        UNIQUE(lat, lon, target_time, horizon)
    )""")
    db.commit()
    try:
        yield db
        db.commit()
    finally:
        db.close()


def record_predictions(city, lat, lon, predictions, issued_at):
    """Store each horizon once per location and target hour."""
    with connect() as db:
        for prediction in predictions:
            db.execute("""INSERT OR IGNORE INTO predictions
                (city, lat, lon, issued_at, target_time, horizon, model, persistence, guidance)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""", (
                    city, float(lat), float(lon),
                    issued_at, prediction["target_time"], int(prediction["horizon_hours"]),
                    float(prediction["model_temperature"]),
                    float(prediction["persistence_temperature"]),
                    prediction.get("open_meteo_temperature"),
                ))


def verify_location(lat, lon):
    """Use delayed archive observations to score mature stored predictions."""
    now = datetime.now(ZoneInfo(TIMEZONE)).replace(tzinfo=None)
    ready_before = now - timedelta(days=VERIFICATION_DELAY_DAYS)
    with connect() as db:
        pending = db.execute("""SELECT DISTINCT date(target_time) AS day FROM predictions
            WHERE actual IS NULL AND target_time < ? AND abs(lat-?) < 0.001 AND abs(lon-?) < 0.001
            ORDER BY day LIMIT 8""", (ready_before.isoformat(timespec="minutes"), lat, lon)).fetchall()
        completed = 0
        for row in pending:
            day = row["day"]
            response = requests.get(ARCHIVE_API_URL, params={
                "latitude": lat, "longitude": lon, "start_date": day, "end_date": day,
                "hourly": "temperature_2m", "timezone": TIMEZONE,
            }, timeout=REQUEST_TIMEOUT_SECONDS)
            response.raise_for_status()
            hourly = response.json().get("hourly", {})
            observed = dict(zip(hourly.get("time", []), hourly.get("temperature_2m", [])))
            for target, value in observed.items():
                if value is None:
                    continue
                with db:
                    result = db.execute("""UPDATE predictions SET actual=?, verified_at=?
                        WHERE actual IS NULL AND target_time=? AND abs(lat-?)<0.001 AND abs(lon-?)<0.001""",
                        (float(value), now.isoformat(timespec="minutes"), target, lat, lon))
                    completed += result.rowcount
        return completed


def verification_report():
    """Return per-horizon MAE/RMSE and recent scored rows."""
    with connect() as db:
        rows = db.execute("SELECT * FROM predictions WHERE actual IS NOT NULL ORDER BY target_time DESC").fetchall()
        pending = db.execute("SELECT COUNT(*) AS n FROM predictions WHERE actual IS NULL").fetchone()["n"]
    report = {}
    for horizon in (1, 6, 12, 24):
        group = [row for row in rows if row["horizon"] == horizon]
        metrics = {}
        for key, column in (("model", "model"), ("persistence", "persistence"), ("open_meteo", "guidance")):
            errors = [float(row[column]) - float(row["actual"]) for row in group if row[column] is not None]
            metrics[key] = {
                "mae": sum(abs(error) for error in errors) / len(errors) if errors else None,
                "rmse": (sum(error * error for error in errors) / len(errors)) ** 0.5 if errors else None,
                "samples": len(errors),
            }
        report[str(horizon)] = metrics
    latest = [{key: row[key] for key in ("city", "target_time", "horizon", "model", "actual")}
              for row in rows[:15]]
    with connect() as db:
        total = db.execute("SELECT COUNT(*) AS n FROM predictions").fetchone()["n"]
    return {"report": report, "latest": latest, "verified_count": len(rows),
            "pending_count": pending, "total_count": total,
            "verification_delay_days": VERIFICATION_DELAY_DAYS}
