/* WeatherAtlas Phase 3: current conditions, map, and selected-city forecast. */

const INDIA_BOUNDS = L.latLngBounds([6.0, 67.0], [37.5, 98.5]);
const map = L.map("map", { zoomControl: true, scrollWheelZoom: false });
map.fitBounds(INDIA_BOUNDS, { padding: [16, 16] });

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 12,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);

// Put state fills above map tiles and city stations above the state fills.
map.createPane("statePolygons");
map.getPane("statePolygons").style.zIndex = 410;
map.createPane("cityMarkers");
map.getPane("cityMarkers").style.zIndex = 650;

// State polygons are filled by each state's mean sampled city temperature.
let statesLayer = null;
let stateStats = new Map();
const markerLayer = L.layerGroup().addTo(map);

let cityRows = [];
let chart = null;
let selectedCity = null;
let selectionId = 0;
let selectedHourly = null;
let selectedPredictions = [];
let latestAlertData = null;
let latestAccuracyReport = null;
let indiaStateCount = 36;

const translations = {
  en: { regionalEyebrow: "STATE-LEVEL SNAPSHOT", regionalTitle: "Regional coverage & temperatures", alerts: "Weather alerts", heat: "High heat", cold: "Cold alert", rain: "Heavy rainfall", cityForecast: "CITY FORECAST", predictions: "WeatherAtlas predictions", accuracy: "Model accuracy" },
  hi: { regionalEyebrow: "राज्य-स्तरीय जानकारी", regionalTitle: "क्षेत्रीय कवरेज और तापमान", alerts: "मौसम अलर्ट", heat: "अत्यधिक गर्मी", cold: "ठंड का अलर्ट", rain: "भारी बारिश", cityForecast: "शहर का पूर्वानुमान", predictions: "WeatherAtlas पूर्वानुमान", accuracy: "मॉडल सटीकता" },
  ta: { regionalEyebrow: "மாநில அளவிலான பார்வை", regionalTitle: "பிராந்திய கவரேஜ் மற்றும் வெப்பநிலை", alerts: "வானிலை எச்சரிக்கைகள்", heat: "அதிக வெப்பம்", cold: "குளிர் எச்சரிக்கை", rain: "கனமழை", cityForecast: "நகர முன்னறிவிப்பு", predictions: "WeatherAtlas கணிப்புகள்", accuracy: "மாதிரி துல்லியம்" },
};

const $ = (id) => document.getElementById(id);
const pageError = $("page-error");

function showError(message) {
  pageError.textContent = message;
  pageError.hidden = false;
}

function clearError() {
  pageError.hidden = true;
  pageError.textContent = "";
}

function colorForTemperature(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "#8b9690";
  // Fixed 5–45°C scale keeps colors comparable across refreshes and seasons.
  const stops = [
    [5, [52, 159, 208]], [15, [81, 183, 138]], [25, [185, 201, 78]],
    [35, [237, 170, 61]], [45, [216, 75, 62]],
  ];
  const temp = Math.max(5, Math.min(45, Number(value)));
  let lower = stops[0], upper = stops[stops.length - 1];
  for (let i = 1; i < stops.length; i += 1) {
    if (temp <= stops[i][0]) { lower = stops[i - 1]; upper = stops[i]; break; }
  }
  const amount = (temp - lower[0]) / (upper[0] - lower[0]);
  const rgb = lower[1].map((channel, i) => Math.round(channel + (upper[1][i] - channel) * amount));
  return `rgb(${rgb.join(",")})`;
}

function normalizeStateName(name) {
  return String(name || "").toLocaleLowerCase("en").replaceAll("&", "and").replace(/[^a-z]/g, "");
}

function stateStyle(feature) {
  const name = feature.properties.name;
  const stats = stateStats.get(normalizeStateName(name));
  return {
    color: "#ffffff", weight: 1.5, opacity: 1,
    fillColor: stats ? colorForTemperature(stats.average) : "#c9d1cb",
    fillOpacity: stats ? 0.79 : 0.5,
  };
}

async function loadStateBoundaries() {
  try {
    const response = await fetch("/static/india-states.geojson");
    if (!response.ok) throw new Error("State boundary file could not be loaded.");
    const geojson = await response.json();
    indiaStateCount = geojson.features?.length || 36;
    statesLayer = L.geoJSON(geojson, {
      pane: "statePolygons",
      style: stateStyle,
      onEachFeature: (feature, layer) => {
        const name = feature.properties.name;
        const stats = stateStats.get(normalizeStateName(name));
        const detail = stats
          ? `${name} · ${stats.average.toFixed(1)}°C average · ${stats.count} ${stats.count === 1 ? "city" : "cities"}`
          : `${name} · no current city reading`;
        layer.bindTooltip(detail, { sticky: true, className: "state-tooltip" });
        layer.on({
          mouseover: (event) => event.target.setStyle({ weight: 2.5, color: "#425b4d", fillOpacity: 0.95 }),
          mouseout: (event) => statesLayer.resetStyle(event.target),
        });
      },
    }).addTo(map);
  } catch (error) {
    showError(`${error.message} City markers will still work.`);
  }
}

function calculateStateStats(cities) {
  const grouped = new Map();
  cities.forEach((city) => {
    if (city.temperature === null || city.temperature === undefined) return;
    const temperature = Number(city.temperature);
    if (!Number.isFinite(temperature)) return;
    const key = normalizeStateName(city.state);
    const group = grouped.get(key) || { total: 0, count: 0 };
    group.total += temperature;
    group.count += 1;
    grouped.set(key, group);
  });
  stateStats = new Map([...grouped.entries()].map(([key, group]) => [key, {
    average: group.total / group.count,
    count: group.count,
  }]));
  if (statesLayer) {
    statesLayer.setStyle(stateStyle);
    statesLayer.eachLayer((layer) => {
      const name = layer.feature.properties.name;
      const stats = stateStats.get(normalizeStateName(name));
      layer.setTooltipContent(stats
        ? `${name} · ${stats.average.toFixed(1)}°C average · ${stats.count} ${stats.count === 1 ? "city" : "cities"}`
        : `${name} · no current city reading`);
    });
  }
}

function renderRegionalSummary(cities) {
  const groups = [...stateStats.entries()].map(([key, stats]) => {
    const feature = statesLayer?.getLayers().find((layer) => normalizeStateName(layer.feature.properties.name) === key);
    return { name: feature?.feature.properties.name || cities.find((city) => normalizeStateName(city.state) === key)?.state || key, ...stats };
  }).sort((a, b) => a.average - b.average);
  const valid = cities.filter((city) => city.temperature !== null && city.temperature !== undefined)
    .map((city) => Number(city.temperature)).filter(Number.isFinite);
  const average = valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
  const covered = groups.length;
  $("regional-coverage").textContent = `${covered} of ${indiaStateCount} states/UTs · ${valid.length} cities`;
  const warm = [...groups].reverse().slice(0, 3);
  const cool = groups.slice(0, 3);
  const formatList = (rows) => rows.length ? rows.map((row) => `<li><span>${row.name}</span><strong>${row.average.toFixed(1)}°C</strong><small>${row.count} ${row.count === 1 ? "city" : "cities"}</small></li>`).join("") : '<li>No readings yet</li>';
  $("regional-summary").innerHTML = `
    <article class="regional-stat"><span>National monitored-city mean</span><strong>${average === null ? "—" : `${average.toFixed(1)}°C`}</strong><small>Unweighted mean of available city readings</small></article>
    <article class="regional-stat"><span>Warmest sampled states/UTs</span><ol>${formatList(warm)}</ol></article>
    <article class="regional-stat"><span>Coolest sampled states/UTs</span><ol>${formatList(cool)}</ol></article>`;
}

function applyLanguage(language) {
  const dictionary = translations[language] || translations.en;
  document.documentElement.lang = language;
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const translation = dictionary[element.dataset.i18n];
    if (translation) element.textContent = translation;
  });
  localStorage.setItem("weatheratlas-language", language);
}

function loadImdWarnings() {
  fetch("/api/imd-warnings").then(async (response) => {
    const data = await response.json();
    if (!response.ok && !data.message) throw new Error("Official IMD warning feed is temporarily unavailable.");
    $("imd-warning-message").textContent = data.message || (data.warnings?.length
      ? `Official district warning feed · updated ${data.updated_at || "recently"}`
      : "No district warnings are listed in the available IMD feed.");
    const list = $("imd-warning-list");
    list.replaceChildren();
    (data.warnings || []).slice(0, 12).forEach((warning) => {
      const card = document.createElement("article");
      card.className = "imd-warning-item";
      const name = document.createElement("strong");
      name.textContent = `${warning.district}${warning.state ? `, ${warning.state}` : ""}`;
      const detail = document.createElement("span");
      detail.textContent = warning.days.map((day) => `Day ${day.day}: ${day.text}`).join(" · ");
      card.append(name, detail);
      list.appendChild(card);
    });
  }).catch((error) => { $("imd-warning-message").textContent = error.message; });
}

async function loadVerification(city) {
  try {
    const query = city ? `?${new URLSearchParams({ lat: city.lat, lon: city.lon })}` : "";
    const response = await fetch(`/api/verification${query}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Verification history unavailable.");
    $("verification-count").textContent = `${data.verified_count} verified · ${data.pending_count} waiting`;
    $("verification-rows").innerHTML = [1, 6, 12, 24].map((hours) => {
      const scores = data.report?.[String(hours)] || {};
      const model = scores.model || {}, persistence = scores.persistence || {}, open = scores.open_meteo || {};
      const show = (value) => value !== null && value !== undefined && Number.isFinite(Number(value)) ? `${Number(value).toFixed(2)}°C` : "—";
      return `<tr><td>${hours}h</td><td>${show(model.mae)}</td><td>${show(persistence.mae)}</td><td>${show(open.mae)}</td><td>${model.samples || 0}</td></tr>`;
    }).join("");
    $("verification-note").textContent = `Predictions logged: ${data.total_count}. Archive verification waits ${data.verification_delay_days} days for observations to become available.`;
  } catch (error) { $("verification-note").textContent = error.message; }
}

function updateTimeLabels(value) {
  const date = value ? new Date(value) : new Date();
  const formatted = new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata",
  }).format(date);
  $("top-time").textContent = `India · ${formatted} IST`;
  $("updated-at").textContent = `Today, ${formatted} IST`;
}

async function loadCurrentWeather() {
  clearError();
  $("map-loading").classList.remove("hidden");
  $("refresh-button").disabled = true;
  try {
    const response = await fetch("/api/current");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load current weather.");
    cityRows = data.cities || [];
    renderCities(cityRows);
    renderRegionalSummary(cityRows);
    const mostRecent = cityRows.find((city) => city.time)?.time;
    updateTimeLabels(mostRecent);
    $("map-loading").classList.add("hidden");
    if (!selectedCity && cityRows.length) {
      const defaultCity = cityRows.find((city) => city.name === "Delhi") || cityRows[0];
      selectCity(defaultCity);
    }
  } catch (error) {
    showError(`${error.message} Check your connection and refresh to try again.`);
    $("map-loading").classList.add("hidden");
    $("city-count").textContent = "Weather data unavailable";
  } finally {
    $("refresh-button").disabled = false;
  }
}

function renderCities(cities) {
  markerLayer.clearLayers();
  const usable = cities.filter((city) => city.temperature !== null && city.temperature !== undefined && Number.isFinite(Number(city.temperature)));
  calculateStateStats(usable);

  usable.forEach((city) => {
    const temperature = Number(city.temperature);
    // Compact circles retain city selection while letting state fills stand out.
    const marker = L.circleMarker([city.lat, city.lon], {
      pane: "cityMarkers",
      radius: 5, color: "#fff", weight: 1.5,
      fillColor: colorForTemperature(temperature), fillOpacity: 1,
    });
    marker.bindTooltip(`${city.name} · ${temperature.toFixed(1)}°C`, { direction: "top", offset: [0, -12] });
    marker.bindPopup(`<strong>${city.name}</strong><br>${temperature.toFixed(1)} °C`);
    marker.on("click", () => selectCity(city));
    marker.addTo(markerLayer);
  });

  $("city-count").textContent = `${usable.length} cities reporting`;
}

function selectCity(city) {
  selectionId += 1;
  selectedCity = city;
  selectedHourly = null;
  selectedPredictions = [];
  $("selected-city").textContent = city.name;
  $("forecast-caption").textContent = `${city.state} · Current temperature ${Number(city.temperature).toFixed(1)}°C`;
  $("prediction-rows").innerHTML = '<tr><td colspan="4">Loading predictions…</td></tr>';
  $("prediction-message").textContent = "";
  const requestId = selectionId;
  loadForecast(city, requestId);
  loadPredictions(city, requestId);
}

function makeChart(labels, temperatures, rain, modelTemperatures) {
  if (chart) chart.destroy();
  chart = new Chart($("forecast-chart"), {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Temperature (°C)", data: temperatures, yAxisID: "temperature",
          borderColor: "#27845f", backgroundColor: "rgba(39,132,95,.10)",
          borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.32, fill: true,
          spanGaps: true,
        },
        {
          label: "Precipitation probability (%)", data: rain, yAxisID: "rain",
          borderColor: "#8dbbc7", backgroundColor: "rgba(141,187,199,.12)",
          borderWidth: 1.5, pointRadius: 0, pointHoverRadius: 4, tension: 0.3,
          spanGaps: true,
        },
        {
          label: "WeatherAtlas ML prediction (°C)", data: modelTemperatures,
          yAxisID: "temperature", showLine: false, borderWidth: 0,
          pointRadius: 6, pointHoverRadius: 8, pointBackgroundColor: "#d96a4f",
          pointBorderColor: "#fff", pointBorderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: "#17241f", padding: 11, titleFont: { family: "DM Sans" }, bodyFont: { family: "DM Sans" } },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: "#89938d", maxTicksLimit: 9, maxRotation: 0, font: { family: "DM Sans", size: 9 } },
          border: { display: false },
        },
        temperature: {
          position: "left", grid: { color: "#edf1ed" },
          ticks: { color: "#89938d", font: { family: "DM Sans", size: 9 } },
          title: { display: true, text: "°C", color: "#89938d", font: { family: "DM Sans", size: 10 } },
          border: { display: false },
        },
        rain: {
          position: "right", min: 0, max: 100, grid: { drawOnChartArea: false },
          ticks: { color: "#89938d", callback: (value) => `${value}%`, font: { family: "DM Sans", size: 9 } },
          border: { display: false },
        },
      },
    },
  });
}

function hourKey(value) {
  return String(value || "").slice(0, 16);
}

function formatHourLabel(value, index) {
  const date = new Date(`${value}:00+05:30`);
  const day = new Intl.DateTimeFormat("en-IN", {
    day: "numeric", month: "short", timeZone: "Asia/Kolkata",
  }).format(date);
  const hour = new Intl.DateTimeFormat("en-IN", {
    hour: "numeric", hour12: true, timeZone: "Asia/Kolkata",
  }).format(date);
  return index === 0 || value.endsWith("T00:00") ? `${day} ${hour}` : hour;
}

function renderForecastChart() {
  if (!selectedHourly) return;
  const times = selectedHourly.time || [];
  const modelTemperatures = times.map(() => null);
  selectedPredictions.forEach((prediction) => {
    const index = times.findIndex((time) => hourKey(time) === hourKey(prediction.target_time));
    if (index >= 0) modelTemperatures[index] = prediction.model_temperature;
  });
  makeChart(
    times.map(formatHourLabel),
    selectedHourly.temperature_2m || [],
    selectedHourly.precipitation_probability || [],
    modelTemperatures,
  );
}

function displayTemperature(value) {
  return value === null || value === undefined || !Number.isFinite(Number(value))
    ? "—" : `${Number(value).toFixed(1)}°C`;
}

function renderPredictions(predictions) {
  $("prediction-rows").innerHTML = predictions.map((item) => `
    <tr>
      <td>${item.horizon_hours} hour${item.horizon_hours === 1 ? "" : "s"}</td>
      <td>${displayTemperature(item.model_temperature)}<br><small>${displayTemperature(item.interval_lower)}–${displayTemperature(item.interval_upper)}</small></td>
      <td>${displayTemperature(item.open_meteo_temperature)}</td>
      <td>${displayTemperature(item.persistence_temperature)}</td>
    </tr>`).join("");
}

async function loadPredictions(city, requestId) {
  try {
    const params = new URLSearchParams({ lat: city.lat, lon: city.lon, city: city.name });
    const response = await fetch(`/api/predict?${params}`);
    const data = await response.json();
    if (requestId !== selectionId) return;
    if (!response.ok) throw new Error(data.error || "Could not load model predictions.");
    selectedPredictions = data.predictions || [];
    renderPredictions(selectedPredictions);
    renderForecastChart();
    const explanation = data.explanation || {};
    const change = explanation.six_hour_temperature_change_c;
    const trendText = change === null || change === undefined ? "six-hour trend unavailable" : `temperature changed ${change >= 0 ? "up" : "down"} ${Math.abs(change).toFixed(1)}°C over the last 6 hours`;
    $("prediction-explanation").textContent = `Prediction context: ${trendText}; previous 6-hour mean ${displayTemperature(explanation.previous_six_hour_mean_c)}, humidity ${Number(explanation.humidity_percent).toFixed(0)}%, wind ${Number(explanation.wind_speed_kmh).toFixed(0)} km/h. These are model inputs for context, not a causal explanation.`;
    $("prediction-message").textContent = `Predictions start from ${data.current_time.replace("T", " ")} IST. Open-Meteo values are forecast guidance, not an India Meteorological Department (IMD) forecast.`;
    loadVerification(city);
  } catch (error) {
    if (requestId !== selectionId) return;
    $("prediction-rows").innerHTML = '<tr><td colspan="4">Predictions unavailable</td></tr>';
    $("prediction-message").textContent = error.message;
  }
}

async function loadModelReport() {
  try {
    const response = await fetch("/api/model-report");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load the model accuracy report.");
    const report = data.accuracy_report || {};
    latestAccuracyReport = report;
    const cityRows = [];
    $("accuracy-rows").innerHTML = [1, 6, 12, 24].map((horizon) => {
      const item = report[horizon] || report[String(horizon)];
      if (!item) return `<tr><td>${horizon} hours</td><td>—</td><td>—</td><td>—</td><td>—</td></tr>`;
      Object.entries(item.temporal_by_city || {}).forEach(([city, scores]) => {
        cityRows.push(`<tr><td>${city}</td><td>${horizon}h</td><td>${displayTemperature(scores.mae)}</td><td>${displayTemperature(scores.rmse)}</td><td>${scores.test_samples}</td></tr>`);
      });
      const spatial = item.spatial_holdout?.xgboost;
      const interval = item.prediction_interval || {};
      return `<tr>
        <td>${horizon} hour${horizon === 1 ? "" : "s"}</td>
        <td>${displayTemperature(item.xgboost.mae)} / ${displayTemperature(item.xgboost.rmse)}</td>
        <td>${displayTemperature(item.persistence.mae)} / ${displayTemperature(item.persistence.rmse)}</td>
        <td>${spatial ? `${displayTemperature(spatial.mae)} / ${displayTemperature(spatial.rmse)}` : "—"}</td>
        <td>${Number.isFinite(Number(interval.test_coverage)) ? `${(Number(interval.test_coverage) * 100).toFixed(0)}%` : "—"}</td>
      </tr>`;
    }).join("");
    $("city-accuracy-rows").innerHTML = cityRows.join("");
    const unseen = (data.spatial_test_cities || []).join(", ") || "not available";
    $("accuracy-message").textContent = `Time test: ${String(data.cutoff || "").slice(0, 10)} onward · unseen-city test: ${unseen} · temporal MAE / RMSE shown in °C.`;
  } catch (error) {
    $("accuracy-rows").innerHTML = '<tr><td colspan="5">Saved accuracy report unavailable</td></tr>';
    $("city-accuracy-rows").innerHTML = "";
    $("accuracy-message").textContent = error.message;
  }
}

function fillAlertList(containerId, alerts, type) {
  const container = $(containerId);
  container.replaceChildren();
  if (!alerts.length) {
    const empty = document.createElement("p");
    empty.className = "alert-empty";
    empty.textContent = "No threshold-crossing forecasts in monitored cities.";
    container.appendChild(empty);
    return;
  }

  alerts.forEach((alert) => {
    const row = document.createElement("div");
    row.className = `alert-item ${type}-item`;
    const location = document.createElement("strong");
    location.textContent = `${alert.city}, ${alert.state}`;
    const detail = document.createElement("span");
    detail.className = "alert-detail";
    if (type === "heat") {
      const time = alert.forecast_time ? formatAlertTime(alert.forecast_time) : "next 24h";
      detail.textContent = `${Number(alert.max_temperature).toFixed(1)}°C · ${time}`;
    } else if (type === "cold") {
      const time = alert.forecast_time ? formatAlertTime(alert.forecast_time) : "next 24h";
      detail.textContent = `${Number(alert.min_temperature).toFixed(1)}°C · ${time}`;
    } else {
      const time = alert.peak_hour ? formatAlertTime(alert.peak_hour) : "next 24h";
      detail.textContent = `${alert.category} · ${Number(alert.total_mm_next_24h).toFixed(1)} mm · ${time}`;
    }
    row.append(location, detail);
    container.appendChild(row);
  });
}

function formatAlertTime(value) {
  const date = new Date(`${value}+05:30`);
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric", month: "short", hour: "numeric", hour12: true,
    timeZone: "Asia/Kolkata",
  }).format(date);
}

async function loadAlerts() {
  try {
    const response = await fetch("/api/alerts");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load weather alerts.");
    fillAlertList("heat-alert-list", data.heat_alerts || [], "heat");
    fillAlertList("cold-alert-list", data.cold_alerts || [], "cold");
    fillAlertList("rain-alert-list", data.rainfall_alerts || [], "rain");
    latestAlertData = data;
    $("alerts-updated").textContent = `Checked ${String(data.checked_at || "").slice(11, 16)} IST`;
  } catch (error) {
    latestAlertData = null;
    fillAlertList("heat-alert-list", [], "heat");
    fillAlertList("cold-alert-list", [], "cold");
    fillAlertList("rain-alert-list", [], "rain");
    $("alerts-updated").textContent = "Forecast unavailable";
    $("heat-alert-list").firstChild.textContent = error.message;
    $("cold-alert-list").firstChild.textContent = error.message;
    $("rain-alert-list").firstChild.textContent = error.message;
  }
}

function alertSummaryText() {
  if (!latestAlertData) return "WeatherAtlas alert forecast is not available yet.";
  const summary = [`WeatherAtlas forecast alerts · next ${latestAlertData.forecast_hours || 24} hours`];
  const add = (label, rows, detail) => {
    if (rows?.length) rows.forEach((item) => summary.push(`${label}: ${item.city}, ${item.state} — ${detail(item)}`));
    else summary.push(`${label}: no threshold crossings in monitored cities`);
  };
  add("Heat", latestAlertData.heat_alerts, (item) => `${Number(item.max_temperature).toFixed(1)}°C`);
  add("Cold", latestAlertData.cold_alerts, (item) => `${Number(item.min_temperature).toFixed(1)}°C`);
  add("Rain", latestAlertData.rainfall_alerts, (item) => `${item.category}, ${Number(item.total_mm_next_24h).toFixed(1)} mm / 24h`);
  summary.push("Informational Open-Meteo screening, not an official warning.");
  return summary.join("\n");
}

async function shareAlertSummary() {
  const text = alertSummaryText();
  try {
    if (navigator.share) await navigator.share({ title: "WeatherAtlas alerts", text });
    else { await navigator.clipboard.writeText(text); $("share-message").textContent = "Alert summary copied."; }
  } catch (error) { $("share-message").textContent = error.name === "AbortError" ? "Share cancelled." : "Could not share; try downloading the alert card."; }
}

function downloadAlertCard() {
  const canvas = document.createElement("canvas");
  canvas.width = 1200; canvas.height = 760;
  const context = canvas.getContext("2d");
  context.fillStyle = "#f4f7f2"; context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#ffffff"; context.beginPath(); context.moveTo(73, 45); context.arcTo(1155, 45, 1155, 715, 28);
  context.arcTo(1155, 715, 45, 715, 28); context.arcTo(45, 715, 45, 45, 28); context.arcTo(45, 45, 1155, 45, 28); context.fill();
  context.fillStyle = "#1d563d"; context.font = "700 42px sans-serif"; context.fillText("WeatherAtlas · India", 85, 115);
  context.fillStyle = "#68776d"; context.font = "24px sans-serif"; context.fillText("Forecast alerts · next 24 hours", 85, 160);
  const data = latestAlertData || {};
  const blocks = [
    ["HIGH HEAT", data.heat_alerts || [], (x) => `${Number(x.max_temperature).toFixed(1)}°C`],
    ["COLD", data.cold_alerts || [], (x) => `${Number(x.min_temperature).toFixed(1)}°C`],
    ["HEAVY RAIN", data.rainfall_alerts || [], (x) => `${x.category} · ${Number(x.total_mm_next_24h).toFixed(1)} mm`],
  ];
  let y = 215;
  blocks.forEach(([title, rows, detail]) => {
    context.fillStyle = "#eaf2ec"; context.beginPath(); context.moveTo(102, y); context.arcTo(1115, y, 1115, y + 125, 17);
    context.arcTo(1115, y + 125, 85, y + 125, 17); context.arcTo(85, y + 125, 85, y, 17);
    context.arcTo(85, y, 1115, y, 17); context.fill();
    context.fillStyle = "#1d563d"; context.font = "700 23px sans-serif"; context.fillText(title, 112, y + 38);
    context.fillStyle = "#27342c"; context.font = "22px sans-serif";
    const text = rows.length ? rows.slice(0, 2).map((item) => `${item.city}: ${detail(item)}`).join("   ·   ") : "No threshold crossings in monitored cities";
    context.fillText(text.slice(0, 90), 112, y + 82);
    y += 145;
  });
  context.fillStyle = "#7b877f"; context.font = "18px sans-serif";
  context.fillText("Informational forecast screening · not an official warning · weather data by Open-Meteo", 85, 675);
  const link = document.createElement("a"); link.download = "weatheratlas-alerts.png"; link.href = canvas.toDataURL("image/png"); link.click();
  $("share-message").textContent = "Alert card downloaded.";
}

function addChatMessage(message, sender) {
  const bubble = document.createElement("div");
  bubble.className = `chat-bubble ${sender}-bubble`;
  bubble.textContent = message;
  $("chat-messages").appendChild(bubble);
  $("chat-messages").scrollTop = $("chat-messages").scrollHeight;
}

function answerWeatherQuestion(question) {
  const text = question.toLocaleLowerCase("en").trim();
  const available = cityRows.filter((city) => city.temperature !== null && city.temperature !== undefined && Number.isFinite(Number(city.temperature)));
  if (/\b(hello|hi|hey)\b/.test(text)) {
    return "Hello! I can look up monitored city readings, summarize alerts, or explain the model report. Try asking “weather in Delhi” or “which city is hottest?”";
  }
  if (/\b(hottest|warmest|highest temperature)\b/.test(text)) {
    if (!available.length) return "Current city readings are still loading. Please try again in a moment.";
    const city = available.reduce((best, item) => Number(item.temperature) > Number(best.temperature) ? item : best);
    return `The hottest monitored city right now is ${city.name}, ${city.state}, at ${Number(city.temperature).toFixed(1)}°C.`;
  }
  if (/\b(coldest|coolest|lowest temperature)\b/.test(text)) {
    if (!available.length) return "Current city readings are still loading. Please try again in a moment.";
    const city = available.reduce((best, item) => Number(item.temperature) < Number(best.temperature) ? item : best);
    return `The coolest monitored city right now is ${city.name}, ${city.state}, at ${Number(city.temperature).toFixed(1)}°C.`;
  }
  if (/\b(average|national mean|india average)\b/.test(text)) {
    if (!available.length) return "Current city readings are still loading. Please try again in a moment.";
    const mean = available.reduce((sum, city) => sum + Number(city.temperature), 0) / available.length;
    return `The mean across ${available.length} monitored city readings is ${mean.toFixed(1)}°C. It is a simple city average, not an area-weighted average for India.`;
  }
  if (/\b(alert|alerts|heat wave|rainfall warning|cold warning)\b/.test(text)) {
    if (!latestAlertData) return "The alert forecast is still loading. Please try again in a moment.";
    const groups = [
      ["Heat", latestAlertData.heat_alerts || [], (item) => `${item.city} ${Number(item.max_temperature).toFixed(1)}°C`],
      ["Cold", latestAlertData.cold_alerts || [], (item) => `${item.city} ${Number(item.min_temperature).toFixed(1)}°C`],
      ["Heavy rain", latestAlertData.rainfall_alerts || [], (item) => `${item.city} ${Number(item.total_mm_next_24h).toFixed(1)} mm`],
    ];
    const hits = groups.flatMap(([label, items, format]) => items.slice(0, 3).map((item) => `${label}: ${format(item)}`));
    return hits.length ? `Forecast threshold alerts for the next 24 hours:\n${hits.join("\n")}\nThese are informational Open-Meteo screenings, not official warnings.` : "No heat, cold, or heavy-rain threshold crossings are forecast for the monitored cities in the next 24 hours.";
  }
  if (/\b(accuracy|accurate|mae|rmse|model score)\b/.test(text)) {
    if (!latestAccuracyReport) return "The saved model accuracy report is still loading.";
    const horizonMatch = text.match(/\b(1|6|12|24)\s*(?:h|hour)/);
    if (!horizonMatch) return "The model report compares XGBoost with a persistence baseline at 1, 6, 12, and 24 hours. Ask, for example, “1 hour model accuracy”.";
    const horizon = horizonMatch[1];
    const scores = latestAccuracyReport[horizon];
    if (!scores) return `There is no saved accuracy score for ${horizon} hours.`;
    return `${horizon}-hour holdout MAE: WeatherAtlas ${Number(scores.xgboost.mae).toFixed(2)}°C; persistence ${Number(scores.persistence.mae).toFixed(2)}°C. Lower MAE is better. This is a historical test score, not a guarantee for the next forecast.`;
  }
  if (/\b(model|xgboost|machine learning|prediction)\b/.test(text)) {
    return "WeatherAtlas uses one XGBoost temperature model per horizon (1, 6, 12, and 24 hours). The prediction table also shows Open-Meteo guidance, a persistence baseline, and a calibrated range.";
  }
  if (/\b(crop|grow|sowing|sow|plant)\b/.test(text)) {
    return "Open Farmer tools from the top navigation to compare crop fits by nearby city, sowing month, soil, and irrigation. It is a starter screening for Maharashtra; confirm choices with your local KVK or IMD Agromet advisory.";
  }
  if (/\b(imd|official warning|district warning)\b/.test(text)) {
    return "See the IMD district warnings panel on this page for official alerts and the link to IMD’s warning map. WeatherAtlas’s own threshold alerts are separate and informational.";
  }
  const city = [...cityRows].sort((a, b) => b.name.length - a.name.length)
    .find((item) => text.includes(item.name.toLocaleLowerCase("en")));
  if (city && /\b(rain|raining|rainfall)\b/.test(text) && !/\b(forecast|tomorrow|probability)\b/.test(text)) {
    return city.rainfall === null || city.rainfall === undefined
      ? `Current rainfall data is unavailable for ${city.name}.`
      : `${city.name}: the latest current-condition precipitation reading is ${Number(city.rainfall).toFixed(1)} mm. For rain probability, select the city to open its hourly chart.`;
  }
  if (city && /\b(weather|temperature|temp|now|current|humidity)\b/.test(text) && !/\b(forecast|tomorrow|hourly)\b/.test(text)) {
    if (city.temperature === null || city.temperature === undefined) return `There is no current reading for ${city.name} right now.`;
    const humidity = city.humidity === null || city.humidity === undefined ? "humidity unavailable" : `humidity ${Number(city.humidity).toFixed(0)}%`;
    return `${city.name}, ${city.state}: ${Number(city.temperature).toFixed(1)}°C, ${humidity}. Select its map marker to view the 3-day hourly forecast.`;
  }
  if (/\b(rain probability|forecast|tomorrow|hourly)\b/.test(text)) {
    if (city && selectedCity?.name !== city.name) {
      selectCity(city);
      return `I selected ${city.name}. Its 3-day hourly forecast is loading in the chart.`;
    }
    if (selectedCity) return `The chart is showing ${selectedCity.name}’s hourly forecast. It plots temperature and precipitation probability; choose another city marker to switch locations.`;
    return "Select a city marker on the map to load its 3-day hourly temperature and precipitation-probability chart.";
  }
  if (/\b(help|what can you|questions)\b/.test(text)) {
    return "I can answer current temperature for a monitored city, hottest/coldest city, monitored-city average, 24-hour alert summary, model type, and 1/6/12/24-hour accuracy. I use only information already loaded in WeatherAtlas.";
  }
  return "I’m a small rule-based helper and didn’t recognize that. Try “weather in Mumbai”, “which city is coldest?”, “any alerts?”, or “6 hour model accuracy”.";
}

function submitChatQuestion(question) {
  const trimmed = question.trim();
  if (!trimmed) return;
  addChatMessage(trimmed, "user");
  addChatMessage(answerWeatherQuestion(trimmed), "bot");
}

function setChatOpen(open) {
  $("chat-panel").hidden = !open;
  $("chat-toggle").setAttribute("aria-expanded", String(open));
  if (open) $("chat-input").focus();
}

async function loadForecast(city, requestId) {
  const message = $("forecast-message");
  message.textContent = "Loading hourly forecast…";
  message.classList.add("visible");
  try {
    const params = new URLSearchParams({ lat: city.lat, lon: city.lon });
    const response = await fetch(`/api/forecast?${params}`);
    const data = await response.json();
    if (requestId !== selectionId) return;
    if (!response.ok) throw new Error(data.error || "Could not load this forecast.");
    const hourly = data.hourly || {};
    const times = hourly.time || [];
    if (!times.length) throw new Error("No hourly forecast is available for this city.");
    selectedHourly = hourly;
    renderForecastChart();
    message.classList.remove("visible");
  } catch (error) {
    if (requestId !== selectionId) return;
    message.textContent = `${error.message} Select the city again or retry shortly.`;
    message.classList.add("visible");
  }
}

$("refresh-button").addEventListener("click", loadCurrentWeather);
$("share-alerts").addEventListener("click", shareAlertSummary);
$("download-alert-card").addEventListener("click", downloadAlertCard);
$("chat-toggle").addEventListener("click", () => setChatOpen($("chat-panel").hidden));
$("chat-close").addEventListener("click", () => setChatOpen(false));
$("chat-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const input = $("chat-input");
  submitChatQuestion(input.value);
  input.value = "";
  input.focus();
});
document.querySelectorAll(".chat-suggestions [data-question]").forEach((button) => {
  button.addEventListener("click", () => submitChatQuestion(button.dataset.question));
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !$("chat-panel").hidden) setChatOpen(false);
});
$("language-select").value = localStorage.getItem("weatheratlas-language") || "en";
applyLanguage($("language-select").value);
$("language-select").addEventListener("change", (event) => applyLanguage(event.target.value));
loadStateBoundaries();
loadCurrentWeather();
loadModelReport();
loadAlerts();
loadImdWarnings();
loadVerification();

// Refresh current conditions every 30 minutes, matching the backend cache TTL.
window.setInterval(loadCurrentWeather, 30 * 60 * 1000);
window.setInterval(loadAlerts, 30 * 60 * 1000);
window.setInterval(() => { if (selectedCity) loadVerification(selectedCity); }, 30 * 60 * 1000);
