# WeatherAtlas - India

WeatherAtlas is a Flask web app for exploring current weather across Indian cities. It includes a state-boundary map, three-day city forecasts, XGBoost temperature predictions, model evaluation, forecast alerts, and a Maharashtra crop-screening pilot.

## Features

- Current temperature, humidity, and precipitation for 107 monitored locations, fetched from Open-Meteo.
- Leaflet state map and city markers. State colors summarize monitored city readings; they are not a gridded or area-weighted temperature field.
- Three-day hourly temperature and precipitation-probability charts.
- One global XGBoost model per horizon (1, 6, 12, and 24 hours), compared with Open-Meteo forecast guidance and a persistence baseline.
- Time-based holdout scores (MAE/RMSE), a separate three-city spatial holdout, and calibrated prediction ranges.
- Heat, cold, and heavy-rain forecast screening, regional summaries, shareable alert cards, and a limited rule-based assistant.
- English, Hindi, and Tamil interface labels, plus a separate Maharashtra crop-screening page.
- Thirty-minute in-memory weather caching.

## Project structure

```text
weather-india/
  app.py                 Flask routes and API integration
  config.py              API URLs, paths, thresholds, and settings
  cities.py              Monitored Indian locations
  crop_advisor.py        Transparent Maharashtra crop screening rules
  verification.py        Stores and scores later forecast checks
  ml/features.py         Shared past-only feature builder
  ml/train_model.py      Historical download and model training
  ml/predict.py          Live prediction using the same features
  models/                 Trained model bundle and report
  data/                   Downloaded weather history and local SQLite database
  static/                 HTML, CSS, JavaScript, map boundaries
```

## Run locally

Use Python 3.11 or newer. From this project directory:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
PORT=5001 python app.py
```

Open <http://localhost:5001/>. Farmer tools are at <http://localhost:5001/farmers>.

On Windows PowerShell, activate with `.venv\Scripts\Activate.ps1` and start with `$env:PORT=5001; python app.py`.

The app serves both pages and their static assets from the same Flask process. If the page appears unstyled, confirm that you opened the correct project server and that `/static/style.css` and `/static/app.js` return successfully.

## Train or retrain the ML model

The repository includes `models/temperature_models.joblib`, so live model predictions are available without retraining. The bundle stores the four trained estimators and their evaluation report.

To download historical data for 15 cities from Open-Meteo and train all models:

```bash
python -m ml.train_model
```

To download first and train later:

```bash
python -m ml.train_model --download-only
python -m ml.train_model --train-only
```

The archive CSV is saved to `data/hourly_weather.csv`; the trained models and metrics are saved together in `models/temperature_models.joblib`. Training uses a chronological final 20% test window, past-only lag and rolling features, and a persistence baseline. The program prints MAE and RMSE for each horizon. Do not describe the model as accurate unless its saved scores support that conclusion.

## API routes

| Method and path | Purpose |
| --- | --- |
| `GET /api/current` | Current readings for monitored cities |
| `GET /api/forecast?lat=...&lon=...` | Three-day hourly forecast for one location |
| `GET /api/predict?lat=...&lon=...` | 1/6/12/24-hour predictions and comparison values |
| `GET /api/model-report` | Saved time and spatial holdout metrics |
| `GET /api/alerts` | Heat, cold, and rainfall forecast screens |
| `GET /api/verification` | Accumulated predictions checked against delayed archive observations |
| `GET /api/crop-cities` | Maharashtra pilot locations |
| `GET /api/crop-advice?...` | Crop-screening results for a selected city and inputs |

The app also exposes `/api/imd-warnings`. In-app IMD data requires an API key issued by IMD; without one, the page links to the official district warning map. To configure a key locally:

```bash
export IMD_API_KEY="your-issued-key"
PORT=5001 python app.py
```

Never commit the key or share it in screenshots.

## Deploy to Render

1. Push this project directory to a Git repository. Include `models/temperature_models.joblib`; the deployed app needs it for predictions.
2. In Render, create a **Blueprint** using this directory's `render.yaml`, or create a Python Web Service manually.
3. The build command is `pip install -r requirements.txt`; the start command is `gunicorn app:app --bind 0.0.0.0:$PORT --workers 1 --threads 4 --timeout 120`.
4. Deploy and open the generated `onrender.com` address.
5. Add `IMD_API_KEY` in Render environment settings only if you have a key issued by IMD.

The SQLite forecast-verification history is stored locally. On a host with an ephemeral filesystem, it can reset after a redeploy or restart. The app remains useful without this accumulated history. Free hosting may also sleep while idle and take time to wake.

## Final review checklist

- Start the app and verify both `/` and `/farmers` load with styling.
- Check current city readings, choose a map marker, and inspect the hourly chart.
- Confirm all four prediction horizons and compare model scores with persistence in `/api/model-report`.
- Try the alert lists, language selector, and farmer form.
- Check the browser console and Flask terminal for errors.
- Record actual measured model scores and limitations in the project presentation; do not invent results.

## Limitations

- City-centre points do not represent every district. State shading and the national mean are summaries of monitored city samples, not area-weighted averages.
- Open-Meteo threshold alerts are informational and are not official IMD warnings.
- The crop tool is a Maharashtra pilot using broad transparent rules. It does not estimate yield, profit, pests, or seed suitability and is not a replacement for local KVK or IMD Agromet guidance.
- Training holdout scores are historical evaluation, not a guarantee of future performance. Live verification scores accumulate separately as the app is used.

## Credits

- Weather data: [Open-Meteo](https://open-meteo.com/)
- Mapping: [Leaflet](https://leafletjs.com/) and the state boundary GeoJSON attribution in the dashboard footer
- Charts: [Chart.js](https://www.chartjs.org/)
- Agricultural context: Maharashtra Gazetteers, ICAR advisories, and IMD Agromet resources linked from the farmer page
