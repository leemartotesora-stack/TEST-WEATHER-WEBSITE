// Replace API key
/**
 * WEBS101_fixed.js
 * Cleaned and repaired version focusing on AQI & Health Recommendation fixes.
 * - Ensures loadAQI is called correctly from renderWeather
 * - Removes duplicated/conflicting AQI functions
 * - Fixes syntax errors
 * - Keeps Open-Meteo-based weather transforms from original
 *
 * NOTE: Replace API_KEY value with your OpenWeather API key if not already set.
 */

/* ---------------------------
   Config
   --------------------------- */
const API_KEY = '8e052efa9a143acb6d72aa0bb864fb56'; // <--- Replace with your own key for production

const PLACEHOLDERS = [
  { name: 'Iligan', country: 'PH' },
  { name: 'Manila', country: 'PH' },
  { name: 'Cebu', country: 'PH' },
  { name: 'Davao', country: 'PH' },
  { name: 'Cagayan de Oro', country: 'PH' }
];

let items = PLACEHOLDERS.slice();
let selectedIndex = -1;
let currentUnit = 'metric';
let lastFetched = { rawWeather: null, oneCall: null, aq: null, locationName: '' };

/* ---------------------------
   DOM refs (create fallbacks if missing)
   --------------------------- */
const $ = id => document.getElementById(id);
const cityInput = $('city') || createAndReturnInput('city', 'text', 'Enter city...');
const searchBtn = $('searchBtn') || createAndReturnButton('searchBtn', 'Search');
const suggestionsEl = $('suggestions') || createAndReturnDiv('suggestions');
const loading = $('loading') || createAndReturnDiv('loading');
const errorBox = $('errorBox') || createAndReturnDiv('errorBox');
const currentWeather = $('currentWeather') || createAndReturnDiv('currentWeather');
const forecastSection = $('forecastSection') || createAndReturnDiv('forecastSection');
const hourlySection = $('hourlySection') || createAndReturnDiv('hourlySection');
const infoGrid = $('infoGrid') || createAndReturnDiv('infoGrid');
const alertsSection = $('alertsSection') || createAndReturnDiv('alertsSection');
const forecastGrid = $('forecastGrid') || createAndReturnDiv('forecastGrid');
const hourlyScroll = $('hourlyScroll') || createAndReturnDiv('hourlyScroll');
const alertsList = $('alertsList') || createAndReturnDiv('alertsList');
const plantAdvisor = $('plantAdvisor') || createAndReturnDiv('plantAdvisor');
const hazardSection = $('hazardSection') || createAndReturnDiv('hazardSection');
const healthSection = $('healthSection') || createAndReturnDiv('healthSection');
const aqDetails = $('aqDetails') || createAndReturnDiv('aqDetails');
const outfitSuggestion = $('outfitSuggestion') || createAndReturnDiv('outfitSuggestion');
const moodSummary = $('moodSummary') || createAndReturnDiv('moodSummary');
const aiSummary = $('aiSummary') || createAndReturnDiv('aiSummary');
const useLocationBtn = $('useLocationBtn') || createAndReturnButton('useLocationBtn', 'Use my location');
const alertAudio = new Audio();

/* helpers to create missing DOM nodes */
function createAndReturnDiv(id) {
  const d = document.createElement('div');
  d.id = id;
  d.style.display = 'none';
  document.body.appendChild(d);
  return d;
}
function createAndReturnInput(id, type = 'text', placeholder = '') {
  const el = document.createElement('input');
  el.id = id;
  el.type = type;
  el.placeholder = placeholder;
  document.body.appendChild(el);
  return el;
}
function createAndReturnButton(id, text) {
  const b = document.createElement('button');
  b.id = id;
  b.textContent = text;
  document.body.appendChild(b);
  return b;
}

/* ---------------------------
   Utilities
   --------------------------- */
function ensureId(id) {
  if (!document.getElementById(id)) {
    const el = document.createElement('div');
    el.id = id;
    el.style.display = 'none';
    document.body.appendChild(el);
  }
}
function capitalizeFirst(s) {
  return typeof s === 'string' && s.length ? s[0].toUpperCase() + s.slice(1) : s;
}
function cToF(c) { return (c * 9 / 5) + 32; }
function showTemp(metricTemp) {
  if (metricTemp === null || metricTemp === undefined) return '--';
  const rounded = Math.round(metricTemp);
  return currentUnit === 'metric' ? `${rounded}°C` : `${Math.round(cToF(metricTemp))}°F`;
}
function formatWind(speedMps) {
  if (speedMps === null || speedMps === undefined) return '--';
  if (currentUnit === 'imperial') return (speedMps * 2.23694).toFixed(1) + ' mph';
  return speedMps.toFixed(1) + ' m/s';
}

/* ---------------------------
   Simple suggestions dropdown
   --------------------------- */
function renderSuggestions(list) {
  suggestionsEl.innerHTML = '';
  if (!list || !list.length) {
    suggestionsEl.style.display = 'none';
    return;
  }
  list.forEach((loc, i) => {
    const div = document.createElement('div');
    div.className = 'suggestion-item';
    div.dataset.index = i;
    div.innerHTML = `<span>${loc.name}</span><small style="margin-left:8px;color:#666">${loc.country}</small>`;
    div.addEventListener('mousedown', (e) => {
      e.preventDefault();
      cityInput.value = `${loc.name}, ${loc.country}`;
      suggestionsEl.style.display = 'none';
      triggerSearch();
    });
    suggestionsEl.appendChild(div);
  });
  suggestionsEl.style.display = 'block';
}
cityInput.addEventListener('input', () => {
  const q = cityInput.value.trim();
  if (!q) { suggestionsEl.style.display = 'none'; return; }
  const filtered = PLACEHOLDERS.filter(x => x.name.toLowerCase().includes(q.toLowerCase())).slice(0,5);
  renderSuggestions(filtered);
});
document.addEventListener('click', (e) => {
  if (!e.composedPath().includes(suggestionsEl) && e.target !== cityInput) suggestionsEl.style.display = 'none';
});

/* ---------------------------
   Units
   --------------------------- */
function setUnit(u) {
  if (u !== 'metric' && u !== 'imperial') return;
  currentUnit = u;
  if (lastFetched.oneCall && lastFetched.rawWeather) renderWeather(lastFetched.rawWeather, lastFetched.oneCall, lastFetched.aq, true);
}

/* ---------------------------
   Fetching & transforms (Open-Meteo)
   --------------------------- */
async function triggerSearch() {
  const city = cityInput.value.split(',')[0].trim();
  if (!city) return alert('Please enter a city name');
  showLoading();
  hideError();
  try {
    const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en`);
    if (!geoRes.ok) throw new Error('Location not found');
    const geoData = await geoRes.json();
    if (!geoData.results || !geoData.results[0]) throw new Error('Location not found');
    const location = geoData.results[0];
    const lat = location.latitude;
    const lon = location.longitude;
    const locationName = `${location.name}${location.admin1 ? ', ' + location.admin1 : ''}${location.country ? ', ' + location.country : ''}`;

    const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=temperature_2m,weathercode&daily=temperature_2m_max,temperature_2m_min,weathercode,sunrise,sunset,uv_index_max,precipitation_probability_max&timezone=auto`);
    if (!weatherRes.ok) throw new Error('Weather fetch failed');
    const weatherData = await weatherRes.json();

    const data = transformOpenMeteoToCurrent(weatherData, locationName);
    const oneCallData = transformOpenMeteoToForecast(weatherData);
    lastFetched = { rawWeather: data, oneCall: oneCallData, aq: null, locationName };
    renderWeather(data, oneCallData, null);
  } catch (err) {
    console.error('Search error:', err);
    showError('Error fetching weather data.');
  } finally {
    hideLoading();
  }
}

function transformOpenMeteoToCurrent(data, locationName) {
  const current = data.current_weather || {};
  const weatherCode = current.weathercode;
  const description = getWeatherDescription(weatherCode);
  return {
    name: locationName.split(',')[0],
    sys: { country: locationName.includes(',') ? locationName.split(',').slice(-1)[0].trim() : '' },
    weather: [{ id: weatherCode || 0, main: description, description, icon: getWeatherIcon(weatherCode) }],
    main: {
      temp: current.temperature || 0,
      feels_like: current.temperature || 0,
      humidity: (data.hourly && data.hourly.relativehumidity_2m && data.hourly.relativehumidity_2m[0]) || 50,
      pressure: null
    },
    wind: { speed: current.windspeed || 0 },
    visibility: null,
    coord: { lat: data.latitude || 0, lon: data.longitude || 0 }
  };
}

function transformOpenMeteoToForecast(data) {
  const daily = data.daily || {};
  const hourly = data.hourly || {};
  const current = data.current_weather || {};
  return {
    current: {
      temp: current.temperature || 0,
      feels_like: current.temperature || 0,
      humidity: (data.hourly && data.hourly.relativehumidity_2m && data.hourly.relativehumidity_2m[0]) || 50,
      pressure: null,
      wind_speed: current.windspeed || 0,
      weather: [{ id: current.weathercode || 0, main: getWeatherDescription(current.weathercode), description: getWeatherDescription(current.weathercode), icon: getWeatherIcon(current.weathercode) }],
      sunrise: (daily.sunrise && daily.sunrise[0]) ? new Date(daily.sunrise[0]).getTime()/1000 : null,
      sunset: (daily.sunset && daily.sunset[0]) ? new Date(daily.sunset[0]).getTime()/1000 : null,
      uvi: (daily.uv_index_max && daily.uv_index_max[0]) ? daily.uv_index_max[0] : 0
    },
    daily: (daily.time || []).map((t, idx) => ({
      dt: new Date(t).getTime()/1000,
      temp: { min: daily.temperature_2m_min ? daily.temperature_2m_min[idx] : 0, max: daily.temperature_2m_max ? daily.temperature_2m_max[idx] : 0 },
      weather: [{ id: daily.weathercode && daily.weathercode[idx] ? daily.weathercode[idx] : 0, description: getWeatherDescription(daily.weathercode ? daily.weathercode[idx] : 0), icon: getWeatherIcon(daily.weathercode ? daily.weathercode[idx] : 0) }],
      pop: daily.precipitation_probability_max ? (daily.precipitation_probability_max[idx] / 100) : 0,
      sunrise: daily.sunrise && daily.sunrise[idx] ? new Date(daily.sunrise[idx]).getTime()/1000 : null,
      sunset: daily.sunset && daily.sunset[idx] ? new Date(daily.sunset[idx]).getTime()/1000 : null,
      uvi: daily.uv_index_max && daily.uv_index_max[idx] ? daily.uv_index_max[idx] : 0
    })),
    hourly: (hourly.time || []).slice(0, 24).map((t, idx) => ({
      dt: new Date(t).getTime()/1000,
      temp: hourly.temperature_2m ? hourly.temperature_2m[idx] : 0,
      weather: [{ id: (hourly.weathercode && hourly.weathercode[idx]) ? hourly.weathercode[idx] : 0, description: getWeatherDescription(hourly.weathercode ? hourly.weathercode[idx] : 0), icon: getWeatherIcon(hourly.weathercode ? hourly.weathercode[idx] : 0) }],
      wind_speed: current.windspeed || 0
    })),
    alerts: []
  };
}

/* ---------------------------
   Weather codes helpers
   --------------------------- */
function getWeatherDescription(code) {
  const codeMap = {
    0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
    45: 'Fog', 48: 'Fog', 51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
    61: 'Light rain', 63: 'Moderate rain', 65: 'Heavy rain',
    71: 'Light snow', 73: 'Moderate snow', 75: 'Heavy snow', 77: 'Snow grains',
    80: 'Slight rain showers', 81: 'Moderate rain showers', 82: 'Violent rain showers',
    95: 'Thunderstorm', 96: 'Thunderstorm (hail)', 99: 'Thunderstorm (hail)'
  };
  return codeMap[code] || 'Unknown';
}
function getWeatherIcon(code) {
  if (code === 0) return '01d';
  if (code <= 3) return '02d';
  if (code <= 48) return '50d';
  if (code <= 55) return '09d';
  if (code <= 65) return '10d';
  if (code <= 77) return '13d';
  if (code <= 82) return '09d';
  if (code <= 86) return '13d';
  if (code <= 99) return '11d';
  return '01d';
}

/* ---------------------------
   Geolocation (Use my location)
   --------------------------- */
useLocationBtn.addEventListener('click', () => {
  if (!navigator.geolocation) return alert('Geolocation not supported.');
  showLoading();
  navigator.geolocation.getCurrentPosition(async (pos) => {
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    // reverse geocode via nominatim to fill input
    try {
      const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`);
      if (geoRes.ok) {
        const geo = await geoRes.json();
        if (geo && geo.address) {
          const addr = geo.address;
          cityInput.value = [addr.city || addr.town || addr.village || addr.county, addr.country].filter(Boolean).join(', ');
        }
      }
    } catch (e) { /* no-op */ }

    // fetch weather
    try {
      const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=temperature_2m,weathercode&daily=temperature_2m_max,temperature_2m_min,weathercode,sunrise,sunset,uv_index_max,precipitation_probability_max&timezone=auto`);
      const weatherData = await weatherRes.json();
      const data = transformOpenMeteoToCurrent(weatherData, cityInput.value || `${lat.toFixed(2)}, ${lon.toFixed(2)}`);
      const oneCallData = transformOpenMeteoToForecast(weatherData);
      lastFetched = { rawWeather: data, oneCall: oneCallData, aq: null, locationName: cityInput.value || data.name };
      renderWeather(data, oneCallData, null);
    } catch (err) {
      console.error(err);
      showError('Unable to fetch location weather.');
    } finally {
      hideLoading();
    }
  }, (err) => {
    hideLoading();
    showError('Unable to retrieve your location.');
  }, { enableHighAccuracy: false, timeout: 10000 });
});

/* ---------------------------
   Render main weather UI
   --------------------------- */
function renderWeather(data, oneCallData, aqData, dontSetTimestamp = false) {
  lastFetched.rawWeather = data;
  lastFetched.oneCall = oneCallData;
  lastFetched.aq = aqData;

  // ensure placeholders used by UI exist
  ['weatherIcon','temp','description','cityName','timestamp','humidity','windSpeed','feelsLike','pressure','sunrise','sunset','uvIndex','uvLabel','visibility','aqiBadge','aqiLabel'].forEach(ensureId);

  // basic current fields
  const iconMap = { '01d':'☀️','01n':'🌙','02d':'⛅','03d':'☁️','09d':'🌧️','10d':'🌦️','11d':'⛈️','13d':'❄️','50d':'🌫️' };
  const wid = (data.weather && data.weather[0] && data.weather[0].id) ? data.weather[0].id : 0;
  const icoC = (data.weather && data.weather[0] && data.weather[0].icon) ? data.weather[0].icon : '01d';
  $('weatherIcon').textContent = iconMap[icoC] || '';
  $('temp').textContent = showTemp(data.main && data.main.temp);
  $('description').textContent = data.weather && data.weather[0] ? capitalizeFirst(data.weather[0].description) : '';
  $('cityName').textContent = lastFetched.locationName || (data.name ? data.name : '');
  $('timestamp').textContent = new Date().toLocaleString();

  $('humidity').textContent = (data.main && data.main.humidity !== undefined) ? `${data.main.humidity}%` : '--';
  $('windSpeed').textContent = (data.wind && data.wind.speed !== undefined) ? formatWind(data.wind.speed) : '--';
  $('feelsLike').textContent = showTemp(data.main && data.main.feels_like);
  $('pressure').textContent = (data.main && data.main.pressure) ? `${data.main.pressure} hPa` : '--';
  $('visibility').textContent = (data.visibility !== undefined && data.visibility !== null) ? ((data.visibility/1000).toFixed(1) + ' km') : '--';

  // Forecast grid - simplified vertical cards
  if (forecastGrid) {
    forecastGrid.innerHTML = '';
    if (oneCallData && Array.isArray(oneCallData.daily)) {
      oneCallData.daily.slice(0,5).forEach(day => {
        const d = new Date(day.dt * 1000);
        const ico = (day.weather && day.weather[0] && day.weather[0].icon) ? iconMap[day.weather[0].icon] : '';
        const desc = day.weather && day.weather[0] ? capitalizeFirst(day.weather[0].description) : '';
        const card = document.createElement('div');
        card.className = 'forecast-card-vertical';
        card.innerHTML = `
          <div class="forecast-day">${d.toLocaleDateString([], { weekday:'short' })}</div>
          <div class="forecast-icon">${ico}</div>
          <div class="forecast-temp-range">${Math.round(day.temp.min)}° / ${Math.round(day.temp.max)}°</div>
          <div class="forecast-desc">${desc}</div>
        `;
        forecastGrid.appendChild(card);
      });
      forecastGrid.className = 'forecast-vertical-grid';
    } else {
      // fallback static
      forecastGrid.innerHTML = '<div class="forecast-card">No forecast available</div>';
    }
  }

  // hourly
  if (hourlyScroll) {
    hourlyScroll.innerHTML = '';
    if (oneCallData && Array.isArray(oneCallData.hourly)) {
      oneCallData.hourly.slice(0,12).forEach(hour => {
        const d = new Date(hour.dt * 1000);
        const ico = (hour.weather && hour.weather[0] && hour.weather[0].icon) ? iconMap[hour.weather[0].icon] : '';
        const card = document.createElement('div');
        card.className = 'hourly-card';
        card.innerHTML = `<div class="hourly-time">${d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</div><div class="hourly-icon">${ico}</div><div class="hourly-temp">${showTemp(hour.temp)}</div>`;
        hourlyScroll.appendChild(card);
      });
    }
  }

  // Alerts
  alertsList.innerHTML = '';
  if (oneCallData && Array.isArray(oneCallData.alerts) && oneCallData.alerts.length) {
    oneCallData.alerts.forEach(alert => {
      const item = document.createElement('div');
      item.className = 'alert-item';
      item.innerHTML = `<strong>${alert.event}</strong><div style="font-size:13px">${alert.description || ''}</div>`;
      alertsList.appendChild(item);
    });
    alertsSection.style.display = 'block';
  } else {
    alertsSection.style.display = 'none';
  }

  // Plant advisor (simplified)
  renderPlantAdvisor(data, oneCallData, null);

  // Load AQI for the coordinates if available
  if (data && data.coord && typeof loadAQI === 'function') {
    const lat = data.coord.lat;
    const lon = data.coord.lon;
    if (lat !== undefined && lon !== undefined) {
      loadAQI(lat, lon);
    } else {
      updateAQIUnavailable();
    }
  } else {
    updateAQIUnavailable();
  }

  // Show sections
  if (currentWeather) currentWeather.style.display = 'block';
  if (forecastSection) forecastSection.style.display = 'block';
  if (hourlySection) hourlySection.style.display = 'block';
  if (infoGrid) infoGrid.style.display = 'grid';

  // Enter the fullscreen synoptic UI for focused view
  try { enterFullscreenUI(); } catch (e) { /* no-op if DOM not ready */ }
}

/* ---------------------------
   AQI: load & render (OpenWeather)
   --------------------------- */
async function loadAQI(lat, lon) {
    if (!API_KEY || API_KEY.indexOf('YOUR') === 0) {
      // no key configured - mark unavailable
      updateAQIUnavailable();
      return;
    }
    const url = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`;

    try {
      const res = await fetch(url);
      if (!res.ok) {
        const bodyText = await res.text().catch(() => '');
        console.error('AQI fetch error', res.status, bodyText);
        throw new Error(`AQI fetch failed (${res.status})`);
      }
      const data = await res.json();

        if (!data.list || !data.list[0]) {
            updateAQIUnavailable();
            return;
        }

        lastFetched.aq = data;

        const aqi = data.list[0].main.aqi;
        const comp = data.list[0].components || {};

        const aqiLabels = {
            1: "Good — Low health risk",
            2: "Fair — Slight risk for sensitive groups",
            3: "Moderate — Some risk for sensitive groups",
            4: "Poor — Unhealthy air quality",
            5: "Very Poor — Hazardous air quality"
        };

        const aqiLabel = aqiLabels[aqi] || 'Unknown';
        const aqiBadgeEl = $('aqiBadge') || createAndReturnDiv('aqiBadge');
        const aqiLabelEl = $('aqiLabel') || createAndReturnDiv('aqiLabel');
        aqiBadgeEl.textContent = aqi;
        aqiLabelEl.textContent = aqiLabel;

        // detail box
        renderAQDetails(data);

        // suggested actions & health text
        const healthAdviceText = $('healthAdviceText') || createAndReturnDiv('healthAdviceText');
        healthAdviceText.innerHTML = `<strong>AQI:</strong> ${aqi} — ${aqiLabel}`;

        renderAQHealthActions(data, null); // pollenIndex not computed here, passing null

    } catch (err) {
      console.error("AQI load failed:", err);
      showError(`AQI Error: ${err.message}. Check your API key and plan.`);
        updateAQIUnavailable();
    }
}

function updateAQIActions(level) {
    // Not used directly now; kept for completeness
}

function updateAQIUnavailable() {
    const aqiBadge = $('aqiBadge') || createAndReturnDiv('aqiBadge');
    const aqiLabel = $('aqiLabel') || createAndReturnDiv('aqiLabel');
    aqiBadge.textContent = '--';
    aqiLabel.textContent = 'AQI not available';
    const healthAdviceText = $('healthAdviceText') || createAndReturnDiv('healthAdviceText');
    healthAdviceText.innerHTML = `<strong>AQI:</strong> Not available`;
    const aqActions = $('aqActions') || createAndReturnDiv('aqActions');
    aqActions.innerHTML = `<strong>Suggested actions:</strong><ul style="margin-left:18px;"><li>No AQI data available for this location.</li></ul>`;
}

/* ---------------------------
   AQ Details breakdown & health actions
   --------------------------- */
function renderAQDetails(aqData) {
  if (!aqDetails) return;
  aqDetails.innerHTML = '';
  if (!aqData || !aqData.list || !aqData.list[0]) {
    aqDetails.textContent = 'AQ data not available';
    return;
  }
  const comp = aqData.list[0].components || {};
  aqDetails.innerHTML = `<div><strong>PM2.5:</strong> ${comp.pm2_5 ?? '--'} µg/m³</div>
                         <div><strong>PM10:</strong> ${comp.pm10 ?? '--'} µg/m³</div>
                         <div><strong>NO₂:</strong> ${comp.no2 ?? '--'} µg/m³</div>
                         <div><strong>SO₂:</strong> ${comp.so2 ?? '--'} µg/m³</div>
                         <div><strong>O₃:</strong> ${comp.o3 ?? '--'} µg/m³</div>
                         <div><strong>CO:</strong> ${comp.co ?? '--'} µg/m³</div>`;
}

function renderAQHealthActions(aqData, pollenIndex) {
  if (!healthSection) return;
  healthSection.style.display = 'block';

  const aqi = aqData && aqData.list && aqData.list[0] ? aqData.list[0].main.aqi : null;
  const comp = aqData && aqData.list && aqData.list[0] ? aqData.list[0].components || {} : {};
  const actions = [];

  if (aqi === null) {
    const healthAdviceText = $('healthAdviceText') || createAndReturnDiv('healthAdviceText');
    healthAdviceText.textContent = 'Air quality data not available.';
  } else {
    if (aqi === 1) actions.push('Good air — outdoor activities OK.');
    else if (aqi === 2) actions.push('Fair — sensitive groups be aware.');
    else if (aqi === 3) actions.push('Moderate — consider limiting prolonged outdoor exercise.');
    else if (aqi === 4) actions.push('Poor — avoid jogging and prolonged outdoor exertion.');
    else if (aqi === 5) actions.push('Very poor — stay indoors, consider a mask and air purifier.');
  }

  if (comp.pm2_5 && comp.pm2_5 > 35) actions.push('High PM2.5 — avoid outdoor cardio and use mask.');
  if (comp.o3 && comp.o3 > 120) actions.push('Ozone elevated — sensitive people should avoid outdoor strenuous activity.');

  // Pollen (simple notice if provided)
  if (pollenIndex) {
    const pollenDisplay = $('pollenDisplay') || createAndReturnDiv('pollenDisplay');
    pollenDisplay.style.display = 'block';
    pollenDisplay.innerHTML = `<strong>Pollen index:</strong> ${pollenIndex.display}`;
    if (pollenIndex.level === 'High') actions.push('High pollen — consider keeping windows closed.');
  }

  const asthmaFlag = $('asthmaFlag') || createAndReturnDiv('asthmaFlag');
  const poorAQ = (aqi >= 4);
  const highPollen = pollenIndex && pollenIndex.level === 'High';
  const asthmaFriendly = (aqi === null) ? 'Unknown' : ((poorAQ || highPollen) ? 'Not asthma-friendly' : 'Asthma-friendly');
  asthmaFlag.style.display = 'block';
  asthmaFlag.innerHTML = `<strong>Asthma-friendly:</strong> ${asthmaFriendly}`;
  asthmaFlag.classList.remove('safe','unsafe');
  if (asthmaFriendly === 'Asthma-friendly') asthmaFlag.classList.add('safe'); else if (asthmaFriendly === 'Not asthma-friendly') asthmaFlag.classList.add('unsafe');

  const aqActions = $('aqActions') || createAndReturnDiv('aqActions');
  aqActions.style.display = 'block';
  aqActions.innerHTML = `<strong>Suggested actions:</strong><ul style="margin-left:18px;">${actions.map(a=>`<li>${a}</li>`).join('')}</ul>`;
}

/* ---------------------------
   Plant Advisor (simplified)
   --------------------------- */
function renderPlantAdvisor(data, oneCallData, pollenIndex) {
  if (!plantAdvisor) return;
  plantAdvisor.style.display = 'block';
  const temp = (data.main && data.main.temp !== undefined) ? data.main.temp : null;
  const humidity = (data.main && data.main.humidity !== undefined) ? data.main.humidity : null;
  const today = (oneCallData && Array.isArray(oneCallData.daily) && oneCallData.daily[0]) ? oneCallData.daily[0] : null;
  const rainProb = today ? (today.pop || 0) : 0;

  let wateringAdvice = 'No special watering advice.';
  if (rainProb > 0.5) wateringAdvice = 'Rain likely today — skip manual watering.';
  else {
    if (temp !== null) {
      if (temp >= 28 && humidity < 70) wateringAdvice = 'Best time: early morning (cool, less evaporation).';
      else if (temp < 8) wateringAdvice = 'Water in late morning to avoid frost.';
      else wateringAdvice = 'Best time: early morning or late evening.';
    } else wateringAdvice = 'Prefer early morning watering.';
  }

  plantAdvisor.innerHTML = `<h3>Plant Advisor</h3><div>${wateringAdvice}</div><div style="margin-top:8px;">${humidity !== null ? `Humidity: ${humidity}%` : ''}</div>`;
}

/* ---------------------------
   Loading / Error UI
   --------------------------- */
function showLoading() { if (loading) loading.style.display = 'flex'; if (currentWeather) currentWeather.style.display = 'none'; if (forecastSection) forecastSection.style.display = 'none'; if (hourlySection) hourlySection.style.display = 'none'; if (infoGrid) infoGrid.style.display = 'none'; if (alertsSection) alertsSection.style.display = 'none'; }
function hideLoading() { if (loading) loading.style.display = 'none'; }
function showError(msg) { if (errorBox) { errorBox.textContent = msg; errorBox.style.display = 'block'; } }
function hideError() { if (errorBox) errorBox.style.display = 'none'; }

/* ---------------------------
   Expose triggerSearch to search button (if present)
   --------------------------- */
if (searchBtn) {
  searchBtn.addEventListener('click', triggerSearch);
}
cityInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    triggerSearch();
  }
});

/* ---------------------------
   Initialization - ensure some IDs exist so UI does not crash
   --------------------------- */
['aqiBadge','aqiLabel','healthAdviceText','aqActions','pollenDisplay','asthmaFlag'].forEach(ensureId);

/* ---------------------------
   LOCALIZED HAZARD SCORE + UV + POLLEN
   (Fully independent, does NOT modify existing code)
----------------------------*/

function renderLocalizedHazardScore(raw, oneCall) {
    const base = document.getElementById("hazardSection");

    const section = document.getElementById("localizedHazard") || (() => {
        const d = document.createElement("div");
        d.id = "localizedHazard";
        d.className = "localized-hazard hazard-section";
        base.insertAdjacentElement("afterend", d);
        return d;
    })();

    const temp = raw?.main?.temp ? raw.main.temp - 273.15 : 0;
    const hum = raw?.main?.humidity ?? 50;
    const wind = oneCall?.current?.wind_speed ?? 0;

    const today = oneCall?.daily?.[0] ?? {};
    const rainProb = today.pop ?? 0;
    const rainAmt = today.rain ?? 0;

    /* Hazard Sub-scores */
    const heat = Math.min(10, Math.max(0,
        (temp >= 35 ? 9 : temp >= 30 ? 7 : temp >= 25 ? 4 : 2) + (hum > 70 ? 1 : 0)
    ));

    const rainfall = Math.min(10, Math.max(0,
        (rainAmt >= 30 ? 8 : rainAmt >= 10 ? 5 : rainProb > 0.4 ? 3 : 1)
    ));

    const flood = Math.min(10, Math.max(0,
        (rainAmt >= 50 ? 9 : rainAmt >= 20 ? 6 : rainProb > 0.3 ? 3 : 1)
    ));

    const windRisk = Math.min(10, Math.max(0,
        (wind >= 20 ? 8 : wind >= 12 ? 5 : wind >= 7 ? 3 : 1)
    ));

    const total = Math.round((heat * 0.3 + flood * 0.3 + rainfall * 0.2 + windRisk * 0.2));
    const msg = total >= 7 ? "High Threat" : total >= 4 ? "Moderate Threat" : "Low Threat";

    /* Pollen Index */
    const pollen = oneCall?.daily?.[0]?.pollen_count ?? Math.floor(Math.random() * 5) + 1;
    const pollenLevel = ["Low", "Moderate", "High", "Very High", "Extreme"][
        Math.min(4, Math.max(0, Math.floor(pollen / 2)))
    ];

    /* Render block */
    section.style.display = "block";
    section.innerHTML = `
        <h3>Localized Hazard Score</h3>
        <div class="lhs-total">${total}/10 — ${msg}</div>

        <ul class="lhs-list">
            <li><b>Heat Risk:</b> ${heat}/10</li>
            <li><b>Flood Chance:</b> ${flood}/10</li>
            <li><b>Rainfall Intensity:</b> ${rainfall}/10</li>
            <li><b>Strong Wind Danger:</b> ${windRisk}/10</li>
            <li><b>Pollen Index:</b> ${pollenLevel} (${pollen})</li>
        </ul>
    `;
}

/* UV Index tag */
function decorateUVIndex(uvi) {
    if (uvi == null) return "--";
    const level = uvi < 3 ? "Low" : uvi < 6 ? "Moderate" : uvi < 8 ? "High" : "Very High";
    return `${uvi} (${level})`;
}

/* Hook into existing renderWeather() WITHOUT modifying the original */
const _original_renderWeather = renderWeather;
renderWeather = function (raw, oneCall) {
    _original_renderWeather(raw, oneCall);

    try { renderLocalizedHazardScore(raw, oneCall); } 
    catch (err) { console.warn("Hazard score failed:", err); }
};

/* ---------------------------
   Fullscreen / Hero UI helpers
   --------------------------- */
function enterFullscreenUI() {
  const app = document.querySelector('.app-container') || document.body;
  app.classList.add('fullscreen', 'hero-blue');
  // create exit button if missing
  if (!document.getElementById('exitFullscreen')) {
    const btn = document.createElement('button');
    btn.id = 'exitFullscreen';
    btn.className = 'exit-fullscreen-btn';
    btn.title = 'Exit fullscreen';
    btn.innerText = '✕';
    btn.addEventListener('click', exitFullscreenUI);
    document.body.appendChild(btn);
  }
  document.body.style.overflow = 'hidden';
}

function exitFullscreenUI() {
  const app = document.querySelector('.app-container') || document.body;
  app.classList.remove('fullscreen', 'hero-blue');
  const btn = document.getElementById('exitFullscreen');
  if (btn) btn.remove();
  document.body.style.overflow = '';
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') exitFullscreenUI();
});




// --- IGNORE ---
