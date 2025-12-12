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
  // Assign modern classes for known buttons so dynamically-created fallbacks
  // match the current design used in the HTML/CSS.
  if (id === 'useLocationBtn') {
    b.className = 'use-location-btn';
    b.type = 'button';
  } else if (id === 'searchBtn') {
    b.className = 'search-btn';
    b.type = 'button';
  }
  document.body.appendChild(b);
  return b;
}

/* Show mock data for placeholder cities (only when user searches) */
function revealMock(cityName) {
  lastFetched.locationName = cityName + ', PH';
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

  $('weatherIcon').textContent = '⛅';
  $('temp').textContent = '26°C';
  $('description').textContent = 'Partly Cloudy';
  $('cityName').textContent = lastFetched.locationName;
  $('timestamp').textContent = new Date().toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  $('humidity').textContent = '68%';
  $('windSpeed').textContent = '4.2 m/s';
  $('feelsLike').textContent = '27°C';
  $('pressure').textContent = '1013 hPa';
  $('sunrise').textContent = '05:20';
  $('sunset').textContent = '17:45';
  $('aqiBadge').textContent = '42';
  $('aqiLabel').textContent = 'Good — Low health risk';
  $('uvIndex').textContent = '3';
  $('uvLabel').textContent = 'Moderate — Use sun protection';
  $('visibility').textContent = '10 km';

  // Forecast (simple static cards)
  if (forecastGrid) {
    forecastGrid.innerHTML = `
      <div class="forecast-card"><div class="day">Today</div><div class="icon">⛅</div><div class="temps">24° / 30°</div><div class="desc">Partly Cloudy</div></div>
      <div class="forecast-card"><div class="day">Sun</div><div class="icon">🌧️</div><div class="temps">23° / 28°</div><div class="desc">Light Rain</div></div>
      <div class="forecast-card"><div class="day">Mon</div><div class="icon">☀️</div><div class="temps">25° / 31°</div><div class="desc">Sunny</div></div>
      <div class="forecast-card"><div class="day">Tue</div><div class="icon">⛅</div><div class="temps">24° / 29°</div><div class="desc">Partly Cloudy</div></div>
      <div class="forecast-card"><div class="day">Wed</div><div class="icon">🌦️</div><div class="temps">22° / 27°</div><div class="desc">Showers</div></div>
    `;
  }

  if (hourlyScroll) {
    hourlyScroll.innerHTML = `
      <div class="hourly-card"><div class="hourly-time">10:00</div><div class="hourly-icon">⛅</div><div class="hourly-temp">26°C</div></div>
      <div class="hourly-card"><div class="hourly-time">11:00</div><div class="hourly-icon">⛅</div><div class="hourly-temp">27°C</div></div>
      <div class="hourly-card"><div class="hourly-time">12:00</div><div class="hourly-icon">☀️</div><div class="hourly-temp">28°C</div></div>
      <div class="hourly-card"><div class="hourly-time">13:00</div><div class="hourly-icon">☀️</div><div class="hourly-temp">29°C</div></div>
      <div class="hourly-card"><div class="hourly-time">14:00</div><div class="hourly-icon">☀️</div><div class="hourly-temp">29°C</div></div>
      <div class="hourly-card"><div class="hourly-time">15:00</div><div class="hourly-icon">⛅</div><div class="hourly-temp">28°C</div></div>
      <div class="hourly-card"><div class="hourly-time">16:00</div><div class="hourly-icon">⛅</div><div class="hourly-temp">27°C</div></div>
      <div class="hourly-card"><div class="hourly-time">17:00</div><div class="hourly-icon">🌤️</div><div class="hourly-temp">26°C</div></div>
      <div class="hourly-card"><div class="hourly-time">18:00</div><div class="hourly-icon">🌇</div><div class="hourly-temp">25°C</div></div>
      <div class="hourly-card"><div class="hourly-time">19:00</div><div class="hourly-icon">🌙</div><div class="hourly-temp">24°C</div></div>
      <div class="hourly-card"><div class="hourly-time">20:00</div><div class="hourly-icon">🌙</div><div class="hourly-temp">23°C</div></div>
      <div class="hourly-card"><div class="hourly-time">21:00</div><div class="hourly-icon">🌙</div><div class="hourly-temp">22°C</div></div>
    `;
  }

  if (alertsList) {
    alertsList.innerHTML = `
      <div class="alert-item"><strong>Flood Watch:</strong> Elevated river levels in low-lying areas; avoid crossing flooded roads.</div>
      <div class="alert-item"><strong>Air Quality Advisory:</strong> Sensitive groups should limit prolonged outdoor exertion.</div>
    `;
    alertsSection.style.display = 'block';
  }

  const pad = document.getElementById('plantAdviceText');
  if (pad) pad.innerHTML = '<strong>Best watering time:</strong> Early morning or late evening (avoid hottest hours).<br/><strong>Humidity:</strong> Moderate (approx 60%).<br/><strong>Pest warnings:</strong> Watch for aphids after rainy days.';

  const hsd = document.getElementById('hazardScoreDisplay');
  if (hsd) hsd.textContent = '3/10';
  const hd = document.getElementById('hazardDescription');
  if (hd) hd.textContent = 'Low risk — localized flooding possible in low areas.';

  const hat = document.getElementById('healthAdviceText');
  if (hat) hat.innerHTML = '<strong>AQI:</strong> 42 — Good';

  // Reveal sections
  if (currentWeather) currentWeather.style.display = 'block';
  if (forecastSection) forecastSection.style.display = 'block';
  if (hourlySection) hourlySection.style.display = 'block';
  if (infoGrid) infoGrid.style.display = 'grid';
  if (plantAdvisor) plantAdvisor.style.display = 'block';
  if (hazardSection) hazardSection.style.display = 'block';
  if (healthSection) healthSection.style.display = 'block';

  hideLoading();
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
  if (metricTemp === null || metricTemp === undefined) return '--';
  const rounded = Math.round(metricTemp);
  return currentUnit === 'metric' ? `${rounded}°C` : `${Math.round(cToF(metricTemp))}°F`;
}

/* ---------------------------
   Fetching: weather + forecast using Open-Meteo (open-source, no API key)
   --------------------------- */
async function triggerSearch() {
  const city = cityInput.value.split(',')[0].trim();
  if (!city) return alert('Please enter a city name');
  showLoading();
  hideError();
  try { searchBtn.classList.add('searching'); } catch (e) {}
  try {
    // Geocode city name using Open-Meteo Geocoding API
    const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`);
    if (!geoRes.ok) throw new Error('Location not found');
    const geoData = await geoRes.json();
    if (!geoData.results || !geoData.results[0]) throw new Error('Location not found');
    const location = geoData.results[0];
    const lat = location.latitude;
    const lon = location.longitude;
    const locationName = `${location.name}${location.admin1 ? ', ' + location.admin1 : ''}${location.country ? ', ' + location.country : ''}`;
    
    // Fetch weather and forecast using Open-Meteo Weather API
    const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,pressure_msl,visibility&daily=temperature_2m_max,temperature_2m_min,weather_code,rain_sum,precipitation_probability_max,wind_speed_10m_max,sunrise,sunset,uv_index_max&hourly=temperature_2m,weather_code&timezone=auto`);
    if (!weatherRes.ok) throw new Error('Weather fetch failed');
    const weatherData = await weatherRes.json();
    
    // Transform Open-Meteo response to match existing renderWeather structure
    const data = transformOpenMeteoToCurrent(weatherData, locationName);
    const oneCallData = transformOpenMeteoToForecast(weatherData);
    const aqData = null;
    
    lastFetched = { rawWeather: data, oneCall: oneCallData, aq: aqData, locationName };
    renderWeather(data, oneCallData, aqData);
    try { searchBtn.classList.remove('searching'); } catch (e) {}
    hideLoading();
  } catch (err) {
    console.error('Search error:', err);
    showError('Error fetching weather data.');
    try { searchBtn.classList.remove('searching'); } catch (e) {}
    hideLoading();
  }
}

// Transform Open-Meteo current data to OpenWeatherMap format
function transformOpenMeteoToCurrent(data, locationName) {
  const current = data.current || {};
  const description = getWeatherDescription(current.weather_code);
  return {
    name: locationName.split(',')[0],
    sys: { country: locationName.includes(',') ? locationName.split(',')[1].trim().split(',')[0] : '', sunrise: null, sunset: null },
    weather: [{ id: current.weather_code || 800, main: description, description, icon: getWeatherIcon(current.weather_code) }],
    main: {
      temp: current.temperature_2m || 0,
      feels_like: current.apparent_temperature || 0,
      humidity: current.relative_humidity_2m || 0,
      pressure: current.pressure_msl || 0
    },
    wind: { speed: current.wind_speed_10m || 0 },
    visibility: (current.visibility || 10000) * 1000,
    coord: { lat: data.latitude, lon: data.longitude }
  };
}

// Transform Open-Meteo forecast to OpenWeatherMap OneCall format
function transformOpenMeteoToForecast(data) {
  const daily = data.daily || {};
  const hourly = data.hourly || {};
  const current = data.current || {};
  
  return {
    current: {
      temp: current.temperature_2m || 0,
      feels_like: current.apparent_temperature || 0,
      humidity: current.relative_humidity_2m || 0,
      pressure: current.pressure_msl || 0,
      wind_speed: current.wind_speed_10m || 0,
      weather: [{ id: current.weather_code || 800, main: getWeatherDescription(current.weather_code), description: getWeatherDescription(current.weather_code), icon: getWeatherIcon(current.weather_code) }],
      sunrise: daily.sunrise && daily.sunrise[0] ? new Date(daily.sunrise[0]).getTime() / 1000 : null,
      sunset: daily.sunset && daily.sunset[0] ? new Date(daily.sunset[0]).getTime() / 1000 : null,
      uvi: daily.uv_index_max && daily.uv_index_max[0] ? daily.uv_index_max[0] : 0
    },
    daily: (daily.time || []).map((time, idx) => ({
      dt: new Date(time).getTime() / 1000,
      temp: { day: daily.temperature_2m_max ? daily.temperature_2m_max[idx] : 0, min: daily.temperature_2m_min ? daily.temperature_2m_min[idx] : 0, max: daily.temperature_2m_max ? daily.temperature_2m_max[idx] : 0 },
      feels_like: { day: daily.temperature_2m_max ? daily.temperature_2m_max[idx] - 2 : 0 },
      humidity: current.relative_humidity_2m || 50,
      weather: [{ id: daily.weather_code && daily.weather_code[idx] ? daily.weather_code[idx] : 800, main: getWeatherDescription(daily.weather_code ? daily.weather_code[idx] : 800), description: getWeatherDescription(daily.weather_code ? daily.weather_code[idx] : 800), icon: getWeatherIcon(daily.weather_code ? daily.weather_code[idx] : 800) }],
      wind_speed: daily.wind_speed_10m_max ? daily.wind_speed_10m_max[idx] : 0,
      pop: daily.precipitation_probability_max ? daily.precipitation_probability_max[idx] / 100 : 0,
      rain: daily.rain_sum ? daily.rain_sum[idx] : 0,
      sunrise: daily.sunrise && daily.sunrise[idx] ? new Date(daily.sunrise[idx]).getTime() / 1000 : null,
      sunset: daily.sunset && daily.sunset[idx] ? new Date(daily.sunset[idx]).getTime() / 1000 : null,
      uvi: daily.uv_index_max ? daily.uv_index_max[idx] : 0,
      clouds: 0
    })),
    hourly: (hourly.time || []).slice(0, 12).map((time, idx) => ({
      dt: new Date(time).getTime() / 1000,
      temp: hourly.temperature_2m ? hourly.temperature_2m[idx] : 0,
      weather: [{ id: hourly.weather_code && hourly.weather_code[idx] ? hourly.weather_code[idx] : 800, main: getWeatherDescription(hourly.weather_code ? hourly.weather_code[idx] : 800), description: getWeatherDescription(hourly.weather_code ? hourly.weather_code[idx] : 800), icon: getWeatherIcon(hourly.weather_code ? hourly.weather_code[idx] : 800) }],
      wind_speed: current.wind_speed_10m || 0
    })),
    alerts: []
  };
}

// WMO Weather interpretation codes
function getWeatherDescription(code) {
  const codeMap = {
    0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
    45: 'Foggy', 48: 'Foggy', 51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
    61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
    71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow', 77: 'Snow grains',
    80: 'Slight rain showers', 81: 'Moderate rain showers', 82: 'Violent rain showers',
    85: 'Slight snow showers', 86: 'Heavy snow showers',
    95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Thunderstorm with hail'
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
infoGrid
/* ---------------------------
   Geolocation
   --------------------------- */
useLocationBtn.addEventListener('click', () => {
  if (!navigator.geolocation) return alert('Geolocation not supported.');
  try {
    useLocationBtn.disabled = true;
    try { useLocationBtn.classList.add('searching'); } catch(e) {}
  } catch (e) {}
  showLoading();
  navigator.geolocation.getCurrentPosition(async (pos) => {
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    try {
      // Reverse geocode using nominatim
      const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`);
      if (geoRes.ok) {
        const geo = await geoRes.json();
        if (geo && geo.address) {
          const addr = geo.address;
          cityInput.value = [addr.city || addr.town || addr.village || addr.county, addr.country].filter(Boolean).join(', ');
        }
      }

      // Fetch weather using Open-Meteo API
      const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,pressure_msl,visibility&daily=temperature_2m_max,temperature_2m_min,weather_code,rain_sum,precipitation_probability_max,wind_speed_10m_max,sunrise,sunset,uv_index_max&hourly=temperature_2m,weather_code&timezone=auto`);
      if (!weatherRes.ok) throw new Error('Weather fetch failed');
      const weatherData = await weatherRes.json();

      // Transform to match renderWeather structure
      const data = transformOpenMeteoToCurrent(weatherData, cityInput.value || `${lat.toFixed(2)}, ${lon.toFixed(2)}`);
      const oneCallData = transformOpenMeteoToForecast(weatherData);
      const aqData = null;

      const locationName = cityInput.value || (data && data.name ? `${data.name}${data.sys && data.sys.country ? ', ' + data.sys.country : ''}` : 'My Location');
      lastFetched = { rawWeather: data, oneCall: oneCallData, aq: aqData, locationName };
      renderWeather(data, oneCallData, aqData);
    } catch (err) {
      console.error(err);
      showError('Unable to fetch location weather.');
    } finally {
      hideLoading();
      try { useLocationBtn.disabled = false; useLocationBtn.classList.remove('searching'); } catch (e) {}
    }
  }, (err) => {
    console.error(err);
    hideLoading();
    try { useLocationBtn.disabled = false; useLocationBtn.classList.remove('searching'); } catch (e) {}
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
  '01d': '☀️', '01n': '🌙',
  '02d': '⛅', '02n': '☁️',
  '03d': '☁️', '03n': '☁️',
  '04d': '☁️', '04n': '☁️',
  '09d': '🌧️', '09n': '🌧️',
  '10d': '🌦️', '10n': '🌦️',
  '11d': '⛈️', '11n': '⛈️',
  '13d': '❄️', '13n': '❄️',
  '50d': '🌫️', '50n': '🌫️'
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

  // In renderWeather function, find the forecast grid update section (around line 340):
// Update forecast section - VERTICAL layout
forecastGrid.innerHTML = '';
if (oneCallData && Array.isArray(oneCallData.daily)) {
  oneCallData.daily.slice(1, 6).forEach(day => {
    const d = new Date(day.dt * 1000);
    const ico = (day.weather && day.weather[0] && day.weather[0].icon) ? iconMap[day.weather[0].icon] : '';
    const desc = day.weather && day.weather[0] ? capitalizeFirst(day.weather[0].description) : '';
    
    const card = document.createElement('div');
    card.className = 'forecast-card-vertical';
    
    card.innerHTML = `
      <div class="forecast-day">${d.toLocaleDateString([], { weekday: 'short' })}</div>
      <div class="forecast-icon">${ico}</div>
      <div class="forecast-temp-range">${Math.round(day.temp.min)}° / ${Math.round(day.temp.max)}°</div>
      <div class="forecast-desc">${desc}</div>
    `;
    
    card.addEventListener('click', () => showDailyModal(day, d));
    forecastGrid.appendChild(card);
  });
}

// Also change the container class in forecastGrid
if (forecastGrid) {
  forecastGrid.className = 'forecast-vertical-grid';
}

  hourlyScroll.innerHTML = '';
if (oneCallData && Array.isArray(oneCallData.hourly)) {
  oneCallData.hourly.slice(0, 12).forEach(hour => {
    const d = new Date(hour.dt * 1000);
    const ico = (hour.weather && hour.weather[0] && hour.weather[0].icon) ? iconMap[hour.weather[0].icon] : '';
    const card = document.createElement('div');
    card.className = 'hourly-card';
    
    // FIXED: Use proper structure
    card.innerHTML = `
      <div class="hourly-time">${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
      <div class="hourly-icon">${ico}</div>
      <div class="hourly-temp">${showTemp(hour.temp)}</div>
    `;
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

  // Update horizontal scrollbar after content loads
  setTimeout(function() {
    if (typeof setupHorizontalScrollbar === 'function') {
      setupHorizontalScrollbar();
    }
  }, 300);
}

/* ---------------------------
   Fullscreen UI helpers
   --------------------------- */
let isFullscreen = false;
function enterFullscreenUI() {
  // Fullscreen mode disabled - keep normal layout
  return;
}
function exitFullscreenUI() {
  // Fullscreen mode disabled - keep normal layout
  return;
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
  aqDetails.innerHTML = `<div><strong>PM2.5:</strong> ${comp.pm2_5 ?? '--'} µg/m³</div><div><strong>PM10:</strong> ${comp.pm10 ?? '--'} µg/m³</div><div><strong>NO₂:</strong> ${comp.no2 ?? '--'} µg/m³</div><div><strong>SO₂:</strong> ${comp.so2 ?? '--'} µg/m³</div><div><strong>O₃:</strong> ${comp.o3 ?? '--'} µg/m³</div><div><strong>CO:</strong> ${comp.co ?? '--'} µg/m³</div>`;
}

/* ---------------------------
   Daily modal
   --------------------------- */
function showDailyModal(dayData, date) {
  let modal = document.getElementById('dailyModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'dailyModal';
    Object.assign(modal.style, { position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, display: 'none', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', zIndex: 2000 });
    const card = document.createElement('div');
    card.id = 'dailyModalCard';
    Object.assign(card.style, { background: 'white', padding: '24px', borderRadius: '12px', maxWidth: '500px', width: '90%', maxHeight: '80vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)' });
    modal.appendChild(card);
    document.body.appendChild(modal);
  }
  const card = document.getElementById('dailyModalCard');
  const sunrise = new Date(dayData.sunrise * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const sunset = new Date(dayData.sunset * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const pop = Math.round((dayData.pop || 0) * 100);
  card.innerHTML = `<h3 style="margin-top:0;color:var(--text);margin-bottom:16px">${date.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}</h3><p style="color:var(--text-light);margin:0 0 12px 0"><strong style="color:var(--text)">${capitalizeFirst(dayData.weather[0].description)}</strong></p><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px"><div style="padding:12px;background:var(--primary-light);border-radius:8px"><div style="font-size:11px;color:var(--muted);margin-bottom:4px">Max</div><div style="font-size:18px;font-weight:600;color:var(--text)">${showTemp(dayData.temp.max)}</div></div><div style="padding:12px;background:var(--primary-light);border-radius:8px"><div style="font-size:11px;color:var(--muted);margin-bottom:4px">Min</div><div style="font-size:18px;font-weight:600;color:var(--text)">${showTemp(dayData.temp.min)}</div></div><div style="padding:12px;background:var(--primary-light);border-radius:8px"><div style="font-size:11px;color:var(--muted);margin-bottom:4px">Feels Like</div><div style="font-size:18px;font-weight:600;color:var(--text)">${showTemp(dayData.feels_like.day)}</div></div><div style="padding:12px;background:var(--primary-light);border-radius:8px"><div style="font-size:11px;color:var(--muted);margin-bottom:4px">Humidity</div><div style="font-size:18px;font-weight:600;color:var(--text)">${dayData.humidity}%</div></div><div style="padding:12px;background:var(--primary-light);border-radius:8px"><div style="font-size:11px;color:var(--muted);margin-bottom:4px">Wind</div><div style="font-size:18px;font-weight:600;color:var(--text)">${formatWind(dayData.wind_speed)}</div></div><div style="padding:12px;background:var(--primary-light);border-radius:8px"><div style="font-size:11px;color:var(--muted);margin-bottom:4px">Rain Chance</div><div style="font-size:18px;font-weight:600;color:var(--text)">${pop}%</div></div><div style="padding:12px;background:var(--primary-light);border-radius:8px"><div style="font-size:11px;color:var(--muted);margin-bottom:4px">Clouds</div><div style="font-size:18px;font-weight:600;color:var(--text)">${dayData.clouds}%</div></div><div style="padding:12px;background:var(--primary-light);border-radius:8px"><div style="font-size:11px;color:var(--muted);margin-bottom:4px">UV Index</div><div style="font-size:18px;font-weight:600;color:var(--text)">${dayData.uvi?.toFixed(1) ?? '--'}</div></div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px"><div><div style="font-size:12px;color:var(--muted);margin-bottom:4px;font-weight:600">Sunrise</div><div style="font-size:16px;font-weight:600;color:var(--text)">${sunrise}</div></div><div><div style="font-size:12px;color:var(--muted);margin-bottom:4px;font-weight:600">Sunset</div><div style="font-size:16px;font-weight:600;color:var(--text)">${sunset}</div></div></div><button id="closeDailyModal" style="width:100%;padding:12px;background:var(--primary);color:white;border:none;border-radius:8px;font-weight:600;cursor:pointer;transition:all 0.2s">Close</button>`;
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
  const bgClasses = ['bg-day','bg-night','bg-rain','bg-sunny','bg-rain','bg-thunder','bg-snow','bg-cloudy','bg-fog','bg-night-clear','bg-default'];
  document.body.classList.remove(...bgClasses);

  let cls = 'bg-default';
  const id = Number(weatherId);
  if (isFinite(id)) {
    if (id >= 200 && id < 300) cls = 'bg-rain'; // use rain image for storms
    else if ((id >= 300 && id < 400) || (id >= 500 && id < 600)) cls = 'bg-rain';
    else if (id >= 600 && id < 700) cls = 'bg-snow';
    else if (id >= 700 && id < 800) cls = 'bg-fog';
    else if (id === 800) cls = (iconCode && String(iconCode).includes('n')) ? 'bg-night' : 'bg-day';
    else if (id > 800 && id < 900) cls = 'bg-cloudy';
  }

  document.body.classList.add(cls);

  // Create or update a subtle particle/icon overlay matching the background
  try { _ensureWeatherOverlayForClass(cls); } catch (e) { console.warn('Overlay error', e); }
}

function _ensureWeatherOverlayForClass(bgClass) {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    _removeWeatherOverlay();
    return;
  }

  const map = {
    'bg-rain': 'overlay-rain',
    'bg-snow': 'overlay-snow',
    'bg-thunder': 'overlay-thunder',
    'bg-cloudy': 'overlay-clouds',
    'bg-sunny': 'overlay-sunny',
    'bg-day': 'overlay-sunny',
    'bg-night': 'overlay-stars',
    'bg-fog': 'overlay-pollen',
    'bg-night-clear': 'overlay-stars',
    'bg-default': ''
  };

  const overlayClass = map[bgClass] || '';
  const existing = document.getElementById('weatherOverlay');
  if (!overlayClass) {
    if (existing) _removeWeatherOverlay();
    return;
  }

  const ol = existing || (function(){ const d=document.createElement('div'); d.id='weatherOverlay'; d.className='weather-overlay'; document.body.appendChild(d); return d; })();
  ol.className = 'weather-overlay';
  if (overlayClass) ol.classList.add(overlayClass);
  ol.innerHTML = '';

  const isMobile = /Mobi|Android/i.test(navigator.userAgent);
  const rainCount = isMobile? 14 : 28;
  const snowCount = isMobile? 10 : 22;
  const starCount = isMobile? 18 : 36;
  const pollenCount = isMobile? 12 : 24;

  if (overlayClass === 'overlay-rain') {
    for (let i=0;i<rainCount;i++){
      const s=document.createElement('span'); s.className='drop';
      s.style.left = (Math.random()*100)+'%';
      s.style.animationDelay = (Math.random()*1.2)+'s';
      s.style.opacity = (0.4 + Math.random()*0.6).toFixed(2);
      s.style.height = (8 + Math.random()*18) + 'px';
      ol.appendChild(s);
    }
  } else if (overlayClass === 'overlay-snow'){
    for (let i=0;i<snowCount;i++){
      const f=document.createElement('span'); f.className='flake';
      f.style.left = (Math.random()*100)+'%';
      f.style.animationDelay = (Math.random()*4)+'s';
      f.style.opacity = (0.7 + Math.random()*0.3).toFixed(2);
      f.style.width = f.style.height = (4 + Math.random()*8) + 'px';
      f.style.animationDuration = (6 + Math.random()*6) + 's';
      ol.appendChild(f);
    }
  } else if (overlayClass === 'overlay-stars'){
    for (let i=0;i<starCount;i++){
      const st=document.createElement('span'); st.className='star';
      st.style.left = (Math.random()*100)+'%';
      st.style.top = (Math.random()*60)+'%';
      st.style.animationDelay = (Math.random()*3)+'s';
      st.style.opacity = (0.2 + Math.random()*0.9).toFixed(2);
      ol.appendChild(st);
    }
  } else if (overlayClass === 'overlay-clouds'){
    const cloudCount = isMobile? 2 : 4;
    for (let i=0;i<cloudCount;i++){
      const c=document.createElement('div'); c.className='cloud';
      c.style.top = (5 + i*12 + Math.random()*20)+'vh';
      c.style.left = (-30 + Math.random()*60)+'vw';
      c.style.opacity = (0.08 + Math.random()*0.18).toFixed(2);
      c.style.animationDuration = (20 + Math.random()*30) + 's';
      ol.appendChild(c);
    }
  } else if (overlayClass === 'overlay-pollen'){
    for (let i=0;i<pollenCount;i++){
      const p=document.createElement('span'); p.className='pollen';
      p.style.left = (Math.random()*100)+'%';
      p.style.top = (Math.random()*40)+'%';
      p.style.animationDelay = (Math.random()*6)+'s';
      p.style.opacity = (0.6 + Math.random()*0.4).toFixed(2);
      ol.appendChild(p);
    }
  } else if (overlayClass === 'overlay-thunder'){
    for (let i=0;i<10;i++){
      const s=document.createElement('span'); s.className='drop';
      s.style.left = (Math.random()*100)+'%';
      s.style.animationDelay = (Math.random()*1.4)+'s';
      s.style.opacity = (0.35 + Math.random()*0.6).toFixed(2);
      s.style.height = (6 + Math.random()*14) + 'px';
      ol.appendChild(s);
    }
  } else if (overlayClass === 'overlay-sunny'){
    const sun = document.createElement('div'); sun.className='sun'; sun.textContent='☀︎'; ol.appendChild(sun);
  }
}

function _removeWeatherOverlay(){
  const ex = document.getElementById('weatherOverlay');
  if (ex && ex.parentNode) ex.parentNode.removeChild(ex);
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

console.log('Using Open-Meteo for weather data — open source, no API key required.');

// Add horizontal slider controls (left/right) for sections that scroll horizontally
function addHorizontalSliderControls(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  // ensure relative positioning
  const computed = window.getComputedStyle(container);
  if (computed.position === 'static') container.style.position = 'relative';

  const left = document.createElement('button');
  left.className = 'slider-btn slider-left';
  left.setAttribute('aria-label', 'Scroll left');
  left.innerText = '‹';

  const right = document.createElement('button');
  right.className = 'slider-btn slider-right';
  right.setAttribute('aria-label', 'Scroll right');
  right.innerText = '›';

  container.appendChild(left);
  container.appendChild(right);

  const scrollAmount = () => Math.round(container.clientWidth * 0.7);

  left.addEventListener('click', () => container.scrollBy({ left: -scrollAmount(), behavior: 'smooth' }));
  right.addEventListener('click', () => container.scrollBy({ left: scrollAmount(), behavior: 'smooth' }));

  function updateVisibility() {
    // show controls only when overflow exists
    if (container.scrollWidth <= container.clientWidth + 2) {
      left.style.display = 'none';
      right.style.display = 'none';
    } else {
      left.style.display = 'flex';
      right.style.display = 'flex';
    }
  }

  updateVisibility();
  // adjust on resize and on content changes
  window.addEventListener('resize', updateVisibility);
  const obs = new MutationObserver(() => updateVisibility());
  obs.observe(container, { childList: true, subtree: true, attributes: true });
}

// initialize sliders for forecast and info sections
addHorizontalSliderControls('forecastSection');
addHorizontalSliderControls('infoGrid');

/* Add this function to WEBS101.js, preferably near the end of the file */

function setupHorizontalScrollbar() {
  // Create horizontal scrollbar element
  const scrollbar = document.createElement('div');
  scrollbar.className = 'horizontal-scroll-indicator';
  scrollbar.innerHTML = '<div class="horizontal-scroll-track"><div class="horizontal-scroll-thumb"></div></div>';
  document.body.appendChild(scrollbar);
  
  const track = scrollbar.querySelector('.horizontal-scroll-track');
  const thumb = scrollbar.querySelector('.horizontal-scroll-thumb');
  const weatherMain = document.querySelector('.weather-main');
  
  // Check if vertical scrollbar is visible
  function checkScrollbar() {
    const hasVerticalScrollbar = weatherMain.scrollHeight > weatherMain.clientHeight;
    
    if (hasVerticalScrollbar) {
      // Show horizontal scrollbar
      scrollbar.style.display = 'block';
      
      // Update thumb position and size
      const scrollWidth = weatherMain.scrollWidth;
      const clientWidth = weatherMain.clientWidth;
      const scrollLeft = weatherMain.scrollLeft;
      
      if (scrollWidth > clientWidth) {
        // Calculate thumb width based on visible area
        const thumbWidth = (clientWidth / scrollWidth) * track.clientWidth;
        thumb.style.width = Math.max(thumbWidth, 40) + 'px';
        
        // Calculate thumb position
        const maxScroll = scrollWidth - clientWidth;
        const thumbPosition = (scrollLeft / maxScroll) * (track.clientWidth - thumbWidth);
        thumb.style.left = thumbPosition + 'px';
        
        // Make weather-main horizontally scrollable
        weatherMain.style.overflowX = 'auto';
      } else {
        // Hide thumb if no horizontal overflow
        thumb.style.width = '0';
        weatherMain.style.overflowX = 'hidden';
      }
    } else {
      // Hide horizontal scrollbar entirely
      scrollbar.style.display = 'none';
      weatherMain.style.overflowX = 'hidden';
    }
  }
  
  // Update scrollbar on scroll
  weatherMain.addEventListener('scroll', function() {
    checkScrollbar();
  });
  
  // Update scrollbar on resize
  window.addEventListener('resize', checkScrollbar);
  
  // Drag functionality for the thumb
  let isDragging = false;
  let startX;
  let startLeft;
  
  thumb.addEventListener('mousedown', function(e) {
    isDragging = true;
    startX = e.clientX;
    startLeft = parseFloat(thumb.style.left) || 0;
    e.preventDefault();
  });
  
  document.addEventListener('mousemove', function(e) {
    if (!isDragging) return;
    
    const deltaX = e.clientX - startX;
    const trackWidth = track.clientWidth;
    const thumbWidth = thumb.clientWidth;
    const maxThumbLeft = trackWidth - thumbWidth;
    
    let newLeft = startLeft + deltaX;
    newLeft = Math.max(0, Math.min(newLeft, maxThumbLeft));
    
    // Update thumb position
    thumb.style.left = newLeft + 'px';
    
    // Update weather-main scroll position
    const scrollWidth = weatherMain.scrollWidth;
    const clientWidth = weatherMain.clientWidth;
    const maxScroll = scrollWidth - clientWidth;
    const scrollPercent = newLeft / (trackWidth - thumbWidth);
    
    weatherMain.scrollLeft = scrollPercent * maxScroll;
  });
  
  document.addEventListener('mouseup', function() {
    isDragging = false;
  });
  
  // Click on track to jump
  track.addEventListener('click', function(e) {
    if (e.target === thumb) return;
    
    const trackRect = track.getBoundingClientRect();
    const clickX = e.clientX - trackRect.left;
    const thumbWidth = thumb.clientWidth;
    const trackWidth = track.clientWidth;
    
    // Calculate new thumb center position
    let newLeft = clickX - (thumbWidth / 2);
    newLeft = Math.max(0, Math.min(newLeft, trackWidth - thumbWidth));
    
    // Update thumb
    thumb.style.left = newLeft + 'px';
    
    // Update scroll
    const scrollWidth = weatherMain.scrollWidth;
    const clientWidth = weatherMain.clientWidth;
    const maxScroll = scrollWidth - clientWidth;
    const scrollPercent = newLeft / (trackWidth - thumbWidth);
    
    weatherMain.scrollLeft = scrollPercent * maxScroll;
  });
  
  // Initial check
  setTimeout(checkScrollbar, 100);
  
  // Check again after content loads
  setTimeout(checkScrollbar, 500);
}

// Call the function after DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(setupHorizontalScrollbar, 100);
});

// Also call it after weather data is loaded
// Add this at the end of renderWeather function, after all content is rendered:
// setTimeout(setupHorizontalScrollbar, 100);
// In revealMock function, update forecast mock data
if (forecastGrid) {
  forecastGrid.innerHTML = `
    <div class="forecast-card-vertical">
      <div class="forecast-day">Today</div>
      <div class="forecast-icon">⛅</div>
      <div class="forecast-temp-range">24° / 30°</div>
      <div class="forecast-desc">Partly Cloudy</div>
    </div>
    <div class="forecast-card-vertical">
      <div class="forecast-day">Sun</div>
      <div class="forecast-icon">🌧️</div>
      <div class="forecast-temp-range">23° / 28°</div>
      <div class="forecast-desc">Light Rain</div>
    </div>
    <div class="forecast-card-vertical">
      <div class="forecast-day">Mon</div>
      <div class="forecast-icon">☀️</div>
      <div class="forecast-temp-range">25° / 31°</div>
      <div class="forecast-desc">Sunny</div>
    </div>
    <div class="forecast-card-vertical">
      <div class="forecast-day">Tue</div>
      <div class="forecast-icon">⛅</div>
      <div class="forecast-temp-range">24° / 29°</div>
      <div class="forecast-desc">Partly Cloudy</div>
    </div>
    <div class="forecast-card-vertical">
      <div class="forecast-day">Wed</div>
      <div class="forecast-icon">🌦️</div>
      <div class="forecast-temp-range">22° / 27°</div>
      <div class="forecast-desc">Showers</div>
    </div>
  `;
  forecastGrid.className = 'forecast-vertical-grid';
}