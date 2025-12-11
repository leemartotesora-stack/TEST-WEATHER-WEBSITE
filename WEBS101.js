const API_KEY = '8e052efa9a143acb6d72aa0bb864fb56'; // Move to backend for production

/* ---------------------------
   Config & placeholders
   --------------------------- */
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
   Suggestions dropdown
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
    div.setAttribute('role', 'option');
    div.dataset.index = i;
    div.innerHTML = `<span>${loc.name}</span><small style="margin-left:8px;color:#666">${loc.country}</small>`;
    div.addEventListener('mousedown', (e) => {
      e.preventDefault();
      selectSuggestion(Number(div.dataset.index));
      suggestionsEl.style.display = 'none';
      triggerSearch();
    });
    suggestionsEl.appendChild(div);
  });
  selectedIndex = -1;
  highlightSuggestion();
  suggestionsEl.style.display = 'block';
}
function highlightSuggestion() {
  Array.from(suggestionsEl.children).forEach((c, i) => c.classList.toggle('active', i === selectedIndex));
}
function selectSuggestion(idx) {
  const item = items[idx];
  if (!item) return;
  cityInput.value = item.name + ', ' + item.country;
}
cityInput.addEventListener('input', () => {
  const q = cityInput.value.trim();
  if (!q) {
    suggestionsEl.style.display = 'none';
    return;
  }
  const filtered = PLACEHOLDERS.filter(x => x.name.toLowerCase().includes(q.toLowerCase())).slice(0, 5);
  items = filtered;
  renderSuggestions(items);
});
cityInput.addEventListener('keydown', (e) => {
  if (suggestionsEl.style.display === 'none') {
    if (e.key === 'Enter') {
      e.preventDefault();
      triggerSearch();
    }
    return;
  }
  const listLen = suggestionsEl.children.length;
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    selectedIndex = Math.min(selectedIndex + 1, listLen - 1);
    highlightSuggestion();
    scrollSuggestionIntoView();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    selectedIndex = Math.max(selectedIndex - 1, 0);
    highlightSuggestion();
    scrollSuggestionIntoView();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (selectedIndex >= 0) selectSuggestion(selectedIndex);
    suggestionsEl.style.display = 'none';
    triggerSearch();
  } else if (e.key === 'Escape') {
    suggestionsEl.style.display = 'none';
  }
});
function scrollSuggestionIntoView() { const el = suggestionsEl.children[selectedIndex]; if (el) el.scrollIntoView({ block: 'nearest' }); }
document.addEventListener('click', (e) => {
  if (!e.composedPath().includes(suggestionsEl) && e.target !== cityInput) {
    suggestionsEl.style.display = 'none';
  }
});

/* ---------------------------
   Units & conversion
   --------------------------- */
function setUnit(u) {
  if (u !== 'metric' && u !== 'imperial') return;
  currentUnit = u;
  const m = document.getElementById('unitMetric');
  const f = document.getElementById('unitImperial');
  if (m && f) {
    m.disabled = (u === 'metric');
    f.disabled = (u === 'imperial');
  }
  if (lastFetched.oneCall && lastFetched.rawWeather) {
    renderWeather(lastFetched.rawWeather, lastFetched.oneCall, lastFetched.aq, true);
  }
}
function cToF(c) {
  return (c * 9 / 5) + 32;
}
function showTemp(metricTemp) {
  if (metricTemp === null || metricTemp === undefined) return '';
  return currentUnit === 'metric' ? Math.round(metricTemp) + '°C' : Math.round(cToF(metricTemp)) + '°F';
}

/* ---------------------------
   Fetching: weather + onecall + air pollution
   --------------------------- */
async function triggerSearch() {
  const city = cityInput.value.split(',')[0].trim();
  if (!city) return alert('Please enter a city name');
  showLoading();
  hideError();
  try {
    const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=metric`);
    if (!res.ok) throw new Error('Location not found');
    const data = await res.json();
    const lat = data.coord.lat;
    const lon = data.coord.lon;
    const locationName = `${data.name}, ${data.sys.country}`;
    let oneCallData = null;
    try {
      const oneCallRes = await fetch(`https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lon}&exclude=minutely&units=metric&appid=${API_KEY}`);
      if (!oneCallRes.ok) {
        const fallback = await fetch(`https://api.openweathermap.org/data/2.5/onecall?lat=${lat}&lon=${lon}&exclude=minutely&units=metric&appid=${API_KEY}`);
        oneCallData = fallback.ok ? await fallback.json() : null;
      } else {
        oneCallData = await oneCallRes.json();
      }
    } catch (e) {
      oneCallData = null;
    }
    let aqData = null;
    try {
      const aqRes = await fetch(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`);
      aqData = aqRes.ok ? await aqRes.json() : null;
    } catch (e) {
      aqData = null;
    }
    lastFetched = { rawWeather: data, oneCall: oneCallData, aq: aqData, locationName };
    renderWeather(data, oneCallData, aqData);
    hideLoading();
  } catch (err) {
    console.error(err);
    showError('Error fetching weather data.');
    hideLoading();
  }
}

/* ---------------------------
   Geolocation
   --------------------------- */
useLocationBtn.addEventListener('click', () => {
  if (!navigator.geolocation) return alert('Geolocation not supported.');
  showLoading();
  navigator.geolocation.getCurrentPosition(async (pos) => {
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    try {
      const geoRes = await fetch(`https://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${API_KEY}`);
      if (geoRes.ok) {
        const geo = await geoRes.json();
        if (Array.isArray(geo) && geo.length) {
          cityInput.value = `${geo[0].name}, ${geo[0].country}`;
        }
      }
      let oneCallData = null;
      try {
        const oneCallRes = await fetch(`https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lon}&exclude=minutely&units=metric&appid=${API_KEY}`);
        if (!oneCallRes.ok) {
          const fallback = await fetch(`https://api.openweathermap.org/data/2.5/onecall?lat=${lat}&lon=${lon}&exclude=minutely&units=metric&appid=${API_KEY}`);
          oneCallData = fallback.ok ? await fallback.json() : null;
        } else {
          oneCallData = await oneCallRes.json();
        }
      } catch (e) {
        oneCallData = null;
      }
      let aqData = null;
      try {
        const aqRes = await fetch(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`);
        aqData = aqRes.ok ? await aqRes.json() : null;
      } catch (e) {
        aqData = null;
      }
      const data = {
        name: cityInput.value.split(',')[0] || 'My Location',
        sys: { country: '' },
        weather: (oneCallData && oneCallData.current && oneCallData.current.weather) ? oneCallData.current.weather : [{ icon: '01d', description: '' }],
        main: {
          temp: (oneCallData && oneCallData.current) ? oneCallData.current.temp : null,
          feels_like: (oneCallData && oneCallData.current) ? oneCallData.current.feels_like : null,
          humidity: (oneCallData && oneCallData.current) ? oneCallData.current.humidity : null,
          pressure: (oneCallData && oneCallData.current) ? oneCallData.current.pressure : null
        },
        wind: { speed: (oneCallData && oneCallData.current) ? oneCallData.current.wind_speed : 0 },
        coord: { lat, lon },
        sys: { sunrise: (oneCallData && oneCallData.current) ? oneCallData.current.sunrise : null, sunset: (oneCallData && oneCallData.current) ? oneCallData.current.sunset : null }
      };
      lastFetched = { rawWeather: data, oneCall: oneCallData, aq: aqData, locationName: cityInput.value };
      renderWeather(data, oneCallData, aqData);
    } catch (err) {
      console.error(err);
      showError('Unable to fetch location weather.');
    } finally {
      hideLoading();
    }
  }, (err) => {
    console.error(err);
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

  const iconMap = {
    '01d': '', '01n': '',
    '02d': '', '02n': '',
    '03d': '', '03n': '',
    '04d': '', '04n': '',
    '09d': '', '09n': '',
    '10d': '', '10n': '',
    '11d': '', '11n': '',
    '13d': '', '13n': '',
    '50d': '', '50n': ''
  };

  ensureId('weatherIcon');
  ensureId('temp');
  ensureId('description');
  ensureId('cityName');
  ensureId('timestamp');
  ensureId('humidity');
  ensureId('windSpeed');
  ensureId('feelsLike');
  ensureId('pressure');
  ensureId('sunrise');
  ensureId('sunset');
  ensureId('uvIndex');
  ensureId('uvLabel');
  ensureId('visibility');
  ensureId('aqiBadge');
  ensureId('aqiLabel');

  const icon = (data.weather && data.weather[0] && data.weather[0].icon) ? iconMap[data.weather[0].icon] : '';
  $('weatherIcon').textContent = icon;
  $('temp').textContent = (data.main && data.main.temp !== undefined) ? showTemp(data.main.temp) : '--';
  $('description').textContent = (data.weather && data.weather[0]) ? capitalizeFirst(data.weather[0].description) : '--';
  $('cityName').textContent = lastFetched.locationName || `${data.name || '--'}, ${data.sys && data.sys.country ? data.sys.country : ''}`;
  if (!dontSetTimestamp) $('timestamp').textContent = new Date().toLocaleString();
  $('humidity').textContent = (data.main && data.main.humidity !== undefined) ? data.main.humidity + '%' : '--';
  $('windSpeed').textContent = (data.wind && data.wind.speed !== undefined) ? formatWind(data.wind.speed) : '--';
  $('feelsLike').textContent = (data.main && data.main.feels_like !== undefined) ? showTemp(data.main.feels_like) : '--';
  $('pressure').textContent = (data.main && data.main.pressure !== undefined) ? data.main.pressure + ' hPa' : '--';

  const sunriseTs = (data.sys && data.sys.sunrise) ? data.sys.sunrise : (oneCallData && oneCallData.current && oneCallData.current.sunrise) ? oneCallData.current.sunrise : null;
  const sunsetTs = (data.sys && data.sys.sunset) ? data.sys.sunset : (oneCallData && oneCallData.current && oneCallData.current.sunset) ? oneCallData.current.sunset : null;
  const sunrise = sunriseTs ? new Date(sunriseTs * 1000) : null;
  const sunset = sunsetTs ? new Date(sunsetTs * 1000) : null;
  $('sunrise').textContent = sunrise ? sunrise.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--';
  $('sunset').textContent = sunset ? sunset.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--';

  const uv = (oneCallData && oneCallData.current && oneCallData.current.uvi !== undefined) ? oneCallData.current.uvi : null;
  $('uvIndex').textContent = (uv !== null) ? uv.toFixed(1) : '--';
  $('uvLabel').textContent = uv === null ? '' : uv < 3 ? 'Low' : uv < 6 ? 'Moderate' : uv < 8 ? 'High' : uv < 11 ? 'Very High' : 'Extreme';

  $('visibility').textContent = (data.visibility !== undefined && data.visibility !== null) ? (data.visibility / 1000).toFixed(1) + ' km' : '--';

  const aqi = aqData && aqData.list && aqData.list[0] ? aqData.list[0].main.aqi : null;
  const aqiLabels = ['Good', 'Fair', 'Moderate', 'Poor', 'Very Poor'];
  const aqiBadgeEl = $('aqiBadge') || createAndReturnDiv('aqiBadge');
  aqiBadgeEl.textContent = aqi || '';
  const aqiLabelEl = $('aqiLabel') || createAndReturnDiv('aqiLabel');
  aqiLabelEl.textContent = aqi ? (aqiLabels[aqi - 1] || 'Unknown') : 'Unknown';
  renderAQDetails(aqData);
  applyAqiClass(aqiBadgeEl, aqi);

  forecastGrid.innerHTML = '';
  if (oneCallData && Array.isArray(oneCallData.daily)) {
    oneCallData.daily.slice(1, 6).forEach(day => {
      const d = new Date(day.dt * 1000);
      const ico = (day.weather && day.weather[0] && day.weather[0].icon) ? iconMap[day.weather[0].icon] : '';
      const card = document.createElement('div');
      card.className = 'forecast-card';
      card.innerHTML = `<div class="forecast-date">${d.toLocaleDateString([], { weekday: 'short' })}</div><div class="forecast-icon">${ico}</div><div class="forecast-temp">${showTemp(day.temp.day)}</div><div class="forecast-range">${Math.round(day.temp.min)}° / ${Math.round(day.temp.max)}°</div>`;
      card.addEventListener('click', () => showDailyModal(day, d));
      forecastGrid.appendChild(card);
    });
  }

  hourlyScroll.innerHTML = '';
  if (oneCallData && Array.isArray(oneCallData.hourly)) {
    oneCallData.hourly.slice(0, 12).forEach(hour => {
      const d = new Date(hour.dt * 1000);
      const ico = (hour.weather && hour.weather[0] && hour.weather[0].icon) ? iconMap[hour.weather[0].icon] : '';
      const card = document.createElement('div');
      card.className = 'hourly-card';
      card.innerHTML = `<div class="hourly-time">${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div><div class="hourly-icon">${ico}</div><div class="hourly-temp">${showTemp(hour.temp)}</div>`;
      hourlyScroll.appendChild(card);
    });
  }

  alertsList.innerHTML = '';
  if (oneCallData && oneCallData.alerts && oneCallData.alerts.length) {
    oneCallData.alerts.forEach(alert => {
      const item = document.createElement('div');
      item.className = 'alert-item';
      item.innerHTML = `<strong>${alert.event}</strong><div style="font-size:13px">${alert.description}</div>`;
      alertsList.appendChild(item);
    });
    alertsSection.style.display = 'block';
    flashAlerts();
  } else {
    alertsSection.style.display = 'none';
  }

  const pollen = computePollenIndex(oneCallData, data);
  renderPlantAdvisor(data, oneCallData, pollen);
  renderHazardScore(data, oneCallData);
  renderAQHealthActions(aqData, pollen);

  const wid = (data.weather && data.weather[0] && data.weather[0].id) ? data.weather[0].id : 800;
  const icoC = (data.weather && data.weather[0] && data.weather[0].icon) ? data.weather[0].icon : '01d';
  applyDynamicBackground(wid, icoC);

  currentWeather.style.display = 'block';
  forecastSection.style.display = 'block';
  hourlySection.style.display = 'block';
  infoGrid.style.display = 'grid';

  // Enter fullscreen UI mode on successful render
  enterFullscreenUI();
}

/* ---------------------------
   Fullscreen UI helpers
   --------------------------- */
let isFullscreen = false;
function enterFullscreenUI() {
  if (isFullscreen) return;
  isFullscreen = true;
  document.body.classList.add('fullscreen-mode');
  const app = document.querySelector('.app-container');
  if (app) app.classList.add('fullscreen');
  // ensure right-column containers appear inside the right column visually
  const rightNodes = ['forecastSection','hourlySection','infoGrid','alertsSection','plantAdvisor','hazardSection','healthSection'];
  rightNodes.forEach(id => {
    const n = document.getElementById(id);
    if (n) n.style.display = 'block';
  });
  // create exit button
  if (!document.getElementById('exitFullscreenBtn')) {
    const btn = document.createElement('button');
    btn.id = 'exitFullscreenBtn';
    btn.className = 'exit-fullscreen-btn';
    btn.title = 'Exit full view';
    btn.innerHTML = '';
    btn.addEventListener('click', exitFullscreenUI);
    document.body.appendChild(btn);
  }
}
function exitFullscreenUI() {
  if (!isFullscreen) return;
  isFullscreen = false;
  document.body.classList.remove('fullscreen-mode');
  const app = document.querySelector('.app-container');
  if (app) app.classList.remove('fullscreen');
  const btn = document.getElementById('exitFullscreenBtn');
  if (btn) btn.remove();
}

/* ---------------------------
   AQ badge coloring
   --------------------------- */
function applyAqiClass(el, aqi) {
  if (!el) return;
  el.className = '';
  el.classList.add('aqi-badge');
  if (aqi === 1) el.classList.add('aqi-good');
  else if (aqi === 2) el.classList.add('aqi-fair');
  else if (aqi === 3) el.classList.add('aqi-moderate');
  else if (aqi === 4) el.classList.add('aqi-poor');
  else if (aqi === 5) el.classList.add('aqi-verypoor');
}

/* ---------------------------
   Plant Advisor
   --------------------------- */
function renderPlantAdvisor(data, oneCallData, pollenIndex) {
  if (!plantAdvisor) return;
  plantAdvisor.style.display = 'block';
  const temp = (data.main && data.main.temp !== undefined) ? data.main.temp : null;
  const humidity = (data.main && data.main.humidity !== undefined) ? data.main.humidity : null;
  const today = (oneCallData && Array.isArray(oneCallData.daily) && oneCallData.daily[0]) ? oneCallData.daily[0] : null;
  const rainProb = today ? (today.pop || 0) : 0;

  let wateringAdvice = 'No special watering advice.';
  if (rainProb > 0.5) {
    wateringAdvice = 'Rain likely today  skip manual watering and use rainfall.';
  } else {
    if (temp !== null) {
      if (temp >= 28 && humidity < 70) wateringAdvice = 'Best time: early morning (cool, less evaporation).';
      else if (temp < 8) wateringAdvice = 'Watering in late morning to mid-day is safer to avoid frost damage.';
      else wateringAdvice = 'Best time: early morning or late evening (avoid hottest hours).';
    } else wateringAdvice = 'Prefer early morning watering.';
  }

  let humidityAdvice = 'Humidity: unknown.';
  if (humidity !== null) {
    if (humidity < 40) humidityAdvice = `Low humidity (${humidity}%)  plants may need more frequent watering.`;
    else if (humidity <= 60) humidityAdvice = `Good humidity (${humidity}%) for most garden plants.`;
    else humidityAdvice = `High humidity (${humidity}%)  risk of fungal disease increases; ensure airflow.`;
  }

  const pestWarnings = [];
  if (humidity !== null && humidity > 75 && temp !== null && temp >= 20) pestWarnings.push('High humidity + warm temp  watch for fungal diseases (mildew).');
  if (temp !== null && temp >= 25 && (oneCallData && oneCallData.current && oneCallData.current.wind_speed > 5)) pestWarnings.push('Warm and breezy  aphids and mites may spread faster.');
  if (rainProb > 0.6) pestWarnings.push('After heavy rain, slugs/snails and fungal issues may increase.');
  if (pollenIndex && pollenIndex.level === 'High') pestWarnings.push('High pollen  expect more allergens and possible plant stress for sensitive species.');

  const pestHtml = pestWarnings.length ? `<ul style="margin:6px 0 0 16px">${pestWarnings.map(p => `<li>${p}</li>`).join('')}</ul>` : `<div style="color:#666">No immediate pest warnings.</div>`;
  plantAdvisor.innerHTML = `<strong>Best watering time:</strong> ${wateringAdvice}<br/><strong>Humidity:</strong> ${humidityAdvice}<br/><strong>Pest warnings:</strong> ${pestHtml}<br/><small style="color:#666">Pollen index: ${pollenIndex ? pollenIndex.display : ''}</small>`;
}

/* ---------------------------
   Hazard Score (0-10)
   --------------------------- */
function renderHazardScore(data, oneCallData) {
  if (!hazardSection) return;
  hazardSection.style.display = 'block';

  const temp = (data.main && data.main.temp !== undefined) ? data.main.temp : null;
  const windNow = (data.wind && data.wind.speed !== undefined) ? data.wind.speed : 0;
  const today = oneCallData && oneCallData.daily && oneCallData.daily[0] ? oneCallData.daily[0] : null;

  let maxHourlyRain = 0;
  if (oneCallData && Array.isArray(oneCallData.hourly)) {
    oneCallData.hourly.slice(0, 24).forEach(h => {
      if (h.rain && h.rain['1h'] && h.rain['1h'] > maxHourlyRain) maxHourlyRain = h.rain['1h'];
    });
  }

  const floodProbability = today ? (today.pop || 0) : 0;
  const rainAmount = today ? (today.rain || 0) : 0;

  let heatScore = 0;
  if (temp !== null) {
    heatScore = temp >= 35 ? 3 : temp >= 30 ? 2 : temp >= 27 ? 1 : 0;
    const humidity = (data.main && data.main.humidity !== undefined) ? data.main.humidity : 50;
    if (temp >= 30 && humidity > 65) heatScore += 1;
  }

  let rainScore = 0;
  if (maxHourlyRain >= 20) rainScore = 3;
  else if (maxHourlyRain >= 5) rainScore = 2;
  else if (rainAmount > 0) rainScore = 1;

  let floodScore = 0;
  if (floodProbability > 0.75 || rainAmount >= 50) floodScore = 3;
  else if (floodProbability > 0.4 || rainAmount >= 20) floodScore = 2;
  else if (floodProbability > 0.1) floodScore = 1;

  const maxWind = (oneCallData && Array.isArray(oneCallData.hourly)) ? Math.max(...oneCallData.hourly.slice(0, 24).map(h => h.wind_speed || 0), windNow) : windNow;
  let windScore = 0;
  if (maxWind >= 20) windScore = 3;
  else if (maxWind >= 12) windScore = 2;
  else if (maxWind >= 6) windScore = 1;

  const raw = (heatScore * 1.5) + (rainScore * 1.2) + (floodScore * 1.5) + (windScore * 1.3);
  let score = Math.round(Math.min(10, raw));
  if (isNaN(score)) score = 0;

  const message = score >= 7 ? 'High risk  take precautions.' : score >= 4 ? 'Moderate risk  stay alert.' : 'Low risk  normal conditions.';
  const breakdownHtml = `<div style="font-size:13px;color:#666"><div><strong>Heat risk:</strong> ${heatScore}/4</div><div><strong>Rain intensity:</strong> ${rainScore}/3 (max hourly rain ${maxHourlyRain} mm)</div><div><strong>Flood chance:</strong> ${floodScore}/3 (pop ${(floodProbability * 100).toFixed(0)}%, rain ${rainAmount} mm)</div><div><strong>Wind danger:</strong> ${windScore}/3 (max wind ${maxWind.toFixed(1)} m/s)</div></div>`;

  const hazardScoreDisplay = $('hazardScoreDisplay') || createAndReturnDiv('hazardScoreDisplay');
  const hazardDescription = $('hazardDescription') || createAndReturnDiv('hazardDescription');
  const hazardBreakdown = $('hazardBreakdown') || createAndReturnDiv('hazardBreakdown');

  hazardScoreDisplay.textContent = `${score}/10`;
  hazardDescription.textContent = message;
  hazardBreakdown.innerHTML = breakdownHtml;
  hazardBreakdown.style.display = 'block';
}

/* ---------------------------
   Pollen Index (heuristic)
   --------------------------- */
function computePollenIndex(oneCallData, data) {
  const now = new Date();
  const month = now.getMonth() + 1;
  let seasonFactor = 1;
  if (month >= 3 && month <= 6) seasonFactor = 1.3;
  else if (month >= 7 && month <= 9) seasonFactor = 1.1;
  else if (month >= 10 && month <= 11) seasonFactor = 1.0;
  else seasonFactor = 0.8;

  const temp = (data.main && data.main.temp !== undefined) ? data.main.temp : 20;
  const humidity = (data.main && data.main.humidity !== undefined) ? data.main.humidity : 50;
  const wind = (oneCallData && oneCallData.current && oneCallData.current.wind_speed) ? oneCallData.current.wind_speed : (data.wind && data.wind.speed ? data.wind.speed : 3);
  const today = (oneCallData && oneCallData.daily && oneCallData.daily[0]) ? oneCallData.daily[0] : null;
  const rainProb = today ? (today.pop || 0) : 0;
  const rainAmount = today ? (today.rain || 0) : 0;

  let base = ((Math.max(0, temp - 10) * 1.5) + (wind * 3) * (1 - (humidity / 100))) * seasonFactor;
  base = Math.max(0, base - (rainAmount * 2) - (rainProb * 20));

  const value = Math.min(100, Math.round(base));
  const level = value < 30 ? 'Low' : value < 60 ? 'Moderate' : 'High';

  return { value, level, display: `${level} (approx ${value})` };
}

/* ---------------------------
   AQ Health Actions
   --------------------------- */
function renderAQHealthActions(aqData, pollenIndex) {
  if (!healthSection) return;
  healthSection.style.display = 'block';

  const aqi = aqData && aqData.list && aqData.list[0] ? aqData.list[0].main.aqi : null;
  const actions = [];

  if (aqi === null) {
    const healthAdviceText = $('healthAdviceText') || createAndReturnDiv('healthAdviceText');
    healthAdviceText.textContent = 'Air quality data not available.';
  } else {
    if (aqi === 1) actions.push('Good air  outdoor activities OK.');
    else if (aqi === 2) actions.push('Fair  sensitive groups be aware.');
    else if (aqi === 3) actions.push('Moderate  consider limiting prolonged outdoor exercise.');
    else if (aqi === 4) actions.push('Poor  avoid jogging and prolonged outdoor exertion.');
    else if (aqi === 5) actions.push('Very poor  stay indoors, consider a mask and air purifier.');
  }

  const comp = aqData && aqData.list && aqData.list[0] ? (aqData.list[0].components || {}) : {};
  if (comp.pm2_5 && comp.pm2_5 > 35) actions.push('High PM2.5  avoid outdoor cardio and use mask.');
  if (comp.o3 && comp.o3 > 120) actions.push('Ozone elevated  sensitive people should avoid outdoor strenuous activity.');

  const pollenDisplay = $('pollenDisplay') || createAndReturnDiv('pollenDisplay');
  if (pollenIndex) {
    pollenDisplay.style.display = 'block';
    pollenDisplay.innerHTML = `<strong>Pollen index:</strong> ${pollenIndex.display}`;
    if (pollenIndex.level === 'High') actions.push('High pollen  consider keeping windows closed and washing clothing after gardening.');
  }

  const asthmaFriendly = (() => {
    if (!aqi) return 'Unknown';
    const poorAQ = (aqi >= 4);
    const highPollen = pollenIndex && pollenIndex.level === 'High';
    return (poorAQ || highPollen) ? 'Not asthma-friendly' : 'Asthma-friendly';
  })();

  const asthmaFlag = $('asthmaFlag') || createAndReturnDiv('asthmaFlag');
  asthmaFlag.style.display = 'block';
  asthmaFlag.innerHTML = `<strong>Asthma-friendly:</strong> ${asthmaFriendly}`;
  asthmaFlag.classList.remove('safe', 'unsafe');
  if (asthmaFriendly === 'Asthma-friendly') asthmaFlag.classList.add('safe');
  else if (asthmaFriendly === 'Not asthma-friendly') asthmaFlag.classList.add('unsafe');

  const aqActions = $('aqActions') || createAndReturnDiv('aqActions');
  aqActions.style.display = 'block';
  aqActions.innerHTML = `<strong>Suggested actions:</strong><ul style="margin:6px 0 0 16px">${actions.map(a => `<li>${a}</li>`).join('')}</ul>`;

  const healthAdviceText = $('healthAdviceText') || createAndReturnDiv('healthAdviceText');
  healthAdviceText.textContent = aqi ? `AQI: ${aqi}  ${aqi === 1 ? 'Good' : aqi === 2 ? 'Fair' : aqi === 3 ? 'Moderate' : aqi === 4 ? 'Poor' : 'Very Poor'}` : 'AQI not available';
}

/* ---------------------------
   AQ Details breakdown
   --------------------------- */
function renderAQDetails(aqData) {
  if (!aqDetails) return;
  aqDetails.innerHTML = '';
  if (!aqData || !aqData.list || !aqData.list[0]) {
    aqDetails.textContent = 'AQ data not available';
    return;
  }
  const comp = aqData.list[0].components || {};
  aqDetails.innerHTML = `<div><strong>PM2.5:</strong> ${comp.pm2_5 ?? ''} µg/m³</div><div><strong>PM10:</strong> ${comp.pm10 ?? ''} µg/m³</div><div><strong>NO:</strong> ${comp.no2 ?? ''} µg/m³</div><div><strong>SO:</strong> ${comp.so2 ?? ''} µg/m³</div><div><strong>O:</strong> ${comp.o3 ?? ''} µg/m³</div><div><strong>CO:</strong> ${comp.co ?? ''} µg/m³</div>`;
}

/* ---------------------------
   Daily modal
   --------------------------- */
function showDailyModal(dayData, date) {
  let modal = document.getElementById('dailyModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'dailyModal';
    Object.assign(modal.style, { position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, display: 'none', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', zIndex: 2000 });
    const card = document.createElement('div');
    card.id = 'dailyModalCard';
    Object.assign(card.style, { background: 'white', padding: '16px', borderRadius: '12px', maxWidth: '600px', width: '90%' });
    modal.appendChild(card);
    document.body.appendChild(modal);
  }
  const card = document.getElementById('dailyModalCard');
  const sunrise = new Date(dayData.sunrise * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const sunset = new Date(dayData.sunset * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const pop = Math.round((dayData.pop || 0) * 100);
  card.innerHTML = `<h3 style="margin-top:0">${date.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}</h3><p><strong>${capitalizeFirst(dayData.weather[0].description)}</strong></p><div style="display:flex;gap:12px;flex-wrap:wrap"><div>Max: ${showTemp(dayData.temp.max)}</div><div>Min: ${showTemp(dayData.temp.min)}</div><div>Feels like: ${showTemp(dayData.feels_like.day)}</div><div>Humidity: ${dayData.humidity}%</div><div>Wind: ${formatWind(dayData.wind_speed)}</div><div>Rain chance: ${pop}%</div><div>Clouds: ${dayData.clouds}%</div><div>UV index: ${dayData.uvi ?? ''}</div><div>Sunrise: ${sunrise}</div><div>Sunset: ${sunset}</div></div><p style="margin-top:12px">${dayData.weather[0].description}</p><button id="closeDailyModal" style="margin-top:12px">Close</button>`;
  document.getElementById('closeDailyModal').addEventListener('click', closeDailyModal);
  modal.style.display = 'flex';
}

function closeDailyModal() {
  const modal = document.getElementById('dailyModal');
  if (modal) modal.style.display = 'none';
}

/* ---------------------------
   Loading / Error UI
   --------------------------- */
function showLoading() {
  if (loading) loading.style.display = 'flex';
  if (currentWeather) currentWeather.style.display = 'none';
  if (forecastSection) forecastSection.style.display = 'none';
  if (hourlySection) hourlySection.style.display = 'none';
  if (infoGrid) infoGrid.style.display = 'none';
  if (alertsSection) alertsSection.style.display = 'none';
}

function hideLoading() {
  if (loading) loading.style.display = 'none';
}

function showError(msg) {
  if (errorBox) {
    errorBox.textContent = msg;
    errorBox.style.display = 'block';
  }
}

function hideError() {
  if (errorBox) errorBox.style.display = 'none';
}

/* ---------------------------
   Utility functions
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

function formatWind(speedMps) {
  if (speedMps === null || speedMps === undefined) return '--';
  if (currentUnit === 'imperial') return (speedMps * 2.23694).toFixed(1) + ' mph';
  return speedMps.toFixed(1) + ' m/s';
}

function applyDynamicBackground(weatherId, iconCode) {
  let cls = 'bg-default';
  if (weatherId >= 200 && weatherId < 300) cls = 'bg-thunder';
  else if (weatherId >= 300 && weatherId < 600) cls = 'bg-rain';
  else if (weatherId >= 600 && weatherId < 700) cls = 'bg-snow';
  else if (weatherId >= 700 && weatherId < 800) cls = 'bg-fog';
  else if (weatherId === 800) cls = (iconCode && iconCode.endsWith('n')) ? 'bg-night-clear' : 'bg-sunny';
  else cls = 'bg-cloudy';

  document.body.classList.remove('bg-thunder', 'bg-rain', 'bg-snow', 'bg-fog', 'bg-night-clear', 'bg-sunny', 'bg-cloudy', 'bg-default');
  document.body.classList.add(cls);
}

function flashAlerts() {
  if (!alertsSection) return;
  alertsSection.style.transition = 'box-shadow 0.3s';
  alertsSection.style.boxShadow = '0 0 20px rgba(255,0,0,0.6)';
  try {
    if (alertAudio.src) alertAudio.play().catch(() => { });
  } catch (e) { }
  setTimeout(() => {
    alertsSection.style.boxShadow = '';
  }, 3000);
}

/* ---------------------------
   Event bindings
   --------------------------- */
searchBtn.addEventListener('click', triggerSearch);
cityInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    triggerSearch();
  }
});

/* ESC to exit fullscreen */
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && isFullscreen) exitFullscreenUI();
});

/* default unit */
setUnit('metric');

console.warn('Warning: API key is exposed in frontend JS. Consider moving API calls to a backend proxy to protect your key.');
