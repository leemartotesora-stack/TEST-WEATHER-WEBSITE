// Replace API key
const API_KEY = '8e052efa9a143acb6d72aa0bb864fb56';
const UNITS = 'metric';


const $ = id => document.getElementById(id);
const show = el => el && (el.classList.remove('hidden'), el.style.display = '');
const hide = el => el && (el.style.display = 'none');
const setText = (id, v) => { const el = $(id); if(el) el.textContent = v; };

function iconUrl(code){ return `https://openweathermap.org/img/wn/${code}@2x.png`; }
function dayNameFrom(ts,tz=0){ return new Date((ts + tz)*1000).toLocaleDateString([], { weekday:'short', month:'short', day:'numeric' }); }
function isoTimeFrom(ts,tz=0){ return new Date((ts + tz)*1000).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }); }
function showTempC(c){ return c===null||c===undefined? '--' : Math.round(c) + (UNITS==='metric'?'°C':'°F') }

const PLACEHOLDERS = ['Iligan, PH','Manila, PH','Cebu, PH','Davao, PH','Cagayan de Oro, PH'];
const suggestionsEl = $('suggestions'), input = $('city');
input.addEventListener('input', (e)=> {
  const q = e.target.value.trim().toLowerCase();
  if(!q){ suggestionsEl.style.display='none'; return; }
  suggestionsEl.innerHTML=''; const filtered = PLACEHOLDERS.filter(p=>p.toLowerCase().includes(q)).slice(0,6);
  if(!filtered.length){ suggestionsEl.style.display='none'; return; }
  filtered.forEach(s=>{ const d = document.createElement('div'); d.className='suggestion-item'; d.textContent=s;
    d.addEventListener('mousedown', (ev)=>{ ev.preventDefault(); input.value=s; suggestionsEl.style.display='none'; fetchForCity(s); });
    suggestionsEl.appendChild(d);
  });
  suggestionsEl.style.display='block';
});
document.addEventListener('click', (e)=> { if (!e.composedPath().includes(suggestionsEl) && e.target !== input) suggestionsEl.style.display='none'; });

$('searchBtn').addEventListener('click', ()=> { const q = input.value.trim(); if(!q) return alert('Enter a city'); fetchForCity(q); });
input.addEventListener('keydown', (e)=> { if(e.key==='Enter'){ e.preventDefault(); $('searchBtn').click(); }});
$('useLocationBtn').addEventListener('click', ()=> {
  if(!navigator.geolocation) return alert('Geolocation unsupported');
  navigator.geolocation.getCurrentPosition(async pos => {
    const lat=pos.coords.latitude, lon=pos.coords.longitude;
    try {
      const rev = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`);
      const j = await rev.json(); input.value = j && j.address ? [j.address.city||j.address.town||j.address.village||j.address.county, j.address.country].filter(Boolean).join(', ') : `${lat.toFixed(2)},${lon.toFixed(2)}`;
    } catch(e){ input.value = `${lat.toFixed(2)},${lon.toFixed(2)}`; }
    fetchByCoords(lat, lon);
  }, err => alert('Could not get location: ' + err.message));
});

function startLoading(){ show($('loading')); hide($('errorBox')); hide($('currentWeather')); hide($('hourlySection')); hide($('forecastSection')); hide($('infoGrid')); }
function stopLoading(){ hide($('loading')); }
function showError(msg){ const e=$('errorBox'); e.style.display='block'; e.textContent = msg; }

async function fetchForCity(q){
  startLoading();
  try {
    const geourl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(q)}&limit=1&appid=${API_KEY}`;
    const g = await fetch(geourl);
    if(!g.ok) throw new Error('Location not found');
    const arr = await g.json();
    if(!arr || !arr.length) throw new Error('Location not found');
    const lat = arr[0].lat, lon = arr[0].lon, nice = `${arr[0].name}${arr[0].state?(', '+arr[0].state):''}, ${arr[0].country}`;
    await fetchByCoords(lat, lon, nice);
  } catch(err) { stopLoading(); showError('Location not found.'); console.error(err); }
}

let map = null, marker = null;
function ensureMap(){
  if(map) return;
  map = L.map('map', { zoomControl:true, attributionControl:false }).setView([14.6,121.0], 5);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{ maxZoom:19 }).addTo(map);
}

async function fetchByCoords(lat, lon, locationName=''){
  startLoading();
  try {
    ensureMap();
    const ocUrl = `https://api.openweathermap.org/data/2.5/onecall?lat=${lat}&lon=${lon}&units=${UNITS}&exclude=minutely&appid=${API_KEY}`;
    const r = await fetch(ocUrl);
    if(!r.ok) throw new Error('Weather fetch failed');
    const data = await r.json();
    let nameLabel = locationName;
    if(!nameLabel){
      try{ const curRes = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}`);
          if(curRes.ok){ const j = await curRes.json(); nameLabel = `${j.name}${j.sys&&j.sys.country? ', ' + j.sys.country: ''}`; }
      } catch(e){}
    }
    let aq = null;
    try { const aRes = await fetch(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`); if(aRes.ok) aq = await aRes.json(); } catch(e){ aq=null; }
    renderAll(data, nameLabel || `${lat.toFixed(2)},${lon.toFixed(2)}`, aq);

    // move map
    map.setView([lat, lon], 10);
    if(marker) marker.remove();
    marker = L.marker([lat, lon]).addTo(map).bindPopup(`${nameLabel || 'Location'}`).openPopup();

    // add cloud/precip tile overlay option (light)
    // Clouds overlay URL example (OpenWeatherMap layers require API key and tile access plan) — omitted to avoid subscription issues
  } catch(err) { stopLoading(); showError('Unable to fetch weather.'); console.error(err); }
}

function renderAll(data, locationName, aqData){
  stopLoading();
  const tzoff = data.timezone_offset || 0;
  const cur = data.current || {};
  const iconCode = cur.weather && cur.weather[0] ? cur.weather[0].icon : '01d';
  $('currentWeather').classList.remove('hidden');
  $('temp').textContent = showTempC(cur.temp);
  setText('description', (cur.weather && cur.weather[0] && cur.weather[0].description) ? cur.weather[0].description : '--');
  setText('cityName', locationName || '--');
  setText('timestamp', new Date().toLocaleString());
  $('weatherIcon').src = iconUrl(iconCode);
  $('weatherIcon').alt = cur.weather && cur.weather[0] ? cur.weather[0].description : 'weather';

  setText('humidity', (cur.humidity!==undefined? cur.humidity + '%':'--'));
  setText('windSpeed', (cur.wind_speed!==undefined? (cur.wind_speed.toFixed(1)+' m/s') : '--'));
  setText('feelsLike', (cur.feels_like!==undefined? showTempC(cur.feels_like) : '--'));
  setText('pressure', (cur.pressure!==undefined? cur.pressure + ' hPa' : '--'));

  // hourly
  const hourly = Array.isArray(data.hourly)?data.hourly.slice(0,12):[];
  const hs = $('hourlyScroll'); hs.innerHTML='';
  if(hourly.length){ show($('hourlySection')); hourly.forEach(h => {
    const div = document.createElement('div'); div.className='hour';
    const t = new Date((h.dt + tzoff)*1000).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    const ic = (h.weather && h.weather[0]) ? h.weather[0].icon : '01d';
    div.innerHTML = `<div class="time">${t}</div><div style="height:40px;margin:6px 0"><img src="${iconUrl(ic)}" alt="" style="height:40px"></div><div class="t">${Math.round(h.temp)}°</div>`;
    hs.appendChild(div);
  }); } else hide($('hourlySection'));

  // daily
  const daily = Array.isArray(data.daily) ? data.daily.slice(0,6) : [];
  const fg = $('forecastGrid'); fg.innerHTML='';
  if(daily.length){ show($('forecastSection')); daily.slice(0,5).forEach(d=> {
    const dd = document.createElement('div'); dd.className='forecast-card';
    const dn = dayNameFrom(d.dt, tzoff);
    const ic = d.weather && d.weather[0] ? d.weather[0].icon : '01d';
    dd.innerHTML = `<div class="icon"><img src="${iconUrl(ic)}" alt="" style="height:40px"></div>
      <div class="meta"><div class="day">${dn}</div><div class="range">${d.weather && d.weather[0] ? d.weather[0].description : ''}</div></div>
      <div style="text-align:right"><div style="font-weight:900">${Math.round(d.temp.max)}°</div><div style="color:#666">${Math.round(d.temp.min)}°</div></div>`;
    dd.addEventListener('click', ()=> showDailyModal(d));
    fg.appendChild(dd);
  }); } else hide($('forecastSection'));

  // info
  show($('infoGrid'));
  setText('sunrise', cur.sunrise ? isoTimeFrom(cur.sunrise, tzoff) : '--:--');
  setText('sunset', cur.sunset ? isoTimeFrom(cur.sunset, tzoff) : '--:--');
  setText('uvIndex', (cur.uvi!==undefined? cur.uvi.toFixed(1) : '--'));
  setText('uvLabel', cur.uvi!==undefined? (cur.uvi<3?'Low': cur.uvi<6?'Moderate': cur.uvi<8?'High': cur.uvi<11?'Very High':'Extreme') : '--');
  setText('visibility', (cur.visibility!==undefined? (cur.visibility/1000).toFixed(1) + ' km' : '--'));

  // alerts
  const alerts = Array.isArray(data.alerts)?data.alerts:[]; const al = $('alertsList'); al.innerHTML='';
  if(alerts.length){ show($('alertsSection')); alerts.forEach(a => { const item = document.createElement('div'); item.className='alert-item'; item.innerHTML = `<strong>${a.event}</strong><div style="margin-top:6px;color:#4b1a1a;font-size:13px">${a.description}</div>`; al.appendChild(item); }); } else hide($('alertsSection'));

  // AQI
  if(aqData && aqData.list && aqData.list[0]){
    const a = aqData.list[0]; const aqi = a.main.aqi; setText('aqiBadge', aqi); const labels=['Good','Fair','Moderate','Poor','Very Poor']; setText('aqiLabel', labels[aqi-1]||'Unknown'); $('aqDetails').textContent = `PM2.5: ${a.components.pm2_5 ?? '—'} µg/m³ • PM10: ${a.components.pm10 ?? '—'} µg/m³`; show($('infoGrid'));
  } else { setText('aqiBadge','--'); setText('aqiLabel','Unknown'); $('aqDetails').textContent='--'; }

  renderPlantHazardHealth(data, aqData);
}

function renderPlantHazardHealth(data, aqData){
  const cur = data.current || {}; const daily0 = Array.isArray(data.daily)?data.daily[0]:null;
  const temp = cur.temp || (daily0 && daily0.temp && daily0.temp.day) || null; const hum = cur.humidity || null; const rainProb = daily0 ? (daily0.pop || 0) : 0;
  let water = 'No special advice.'; if(rainProb>0.6) water='Rain likely today — skip manual watering.'; else if(temp!==null && temp>=28 && hum<70) water='Water early morning (avoid evaporation).'; else water='Water early morning or late evening.';
  show($('plantAdvisor')); $('plantAdviceText').textContent = `${water} (temp: ${temp!==null?Math.round(temp)+'°':'—'}, humidity: ${hum!==null?hum+'%':'—'})`;
  let score = 0; if(temp!==null) score += temp>=35?3: temp>=30?2: temp>=27?1:0;
  const maxWind = Array.isArray(data.hourly) ? Math.max(...data.hourly.slice(0,24).map(h=>h.wind_speed||0)) : (cur.wind_speed||0);
  if(maxWind>=20) score+=3; else if(maxWind>=12) score+=2; else if(maxWind>=6) score+=1;
  const todayRain = daily0 ? (daily0.rain||0) : 0; if(todayRain>=50) score+=3; else if(todayRain>=20) score+=2; else if(todayRain>0) score+=1;
  score = Math.min(10, Math.round(score));
  show($('hazardSection')); setText('hazardScoreDisplay', `${score}/10`); setText('hazardDescription', score>=7? 'High risk — take precautions.' : score>=4? 'Moderate risk — stay alert.' : 'Low risk — normal conditions.');
  show($('healthSection')); const aqi = aqData && aqData.list && aqData.list[0] ? aqData.list[0].main.aqi : null; let health='Air quality data not available.'; if(aqi!==null){ health = aqi===1? 'Good — outdoor activities OK.' : aqi===2? 'Fair — sensitive groups be aware.' : aqi===3? 'Moderate — consider reducing prolonged outdoor exercise.' : aqi===4? 'Poor — avoid prolonged outdoor exertion.' : 'Very poor — stay indoors if possible.'; } $('healthAdviceText').textContent = health;
}

// daily modal
function showDailyModal(day){
  const modal = document.createElement('div'); Object.assign(modal.style,{position:'fixed',left:0,top:0,right:0,bottom:0,background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999});
  const card = document.createElement('div'); card.style.cssText='background:#fff;color:#0b1220;padding:16px;border-radius:12px;max-width:560px;width:92%';
  const when = dayNameFrom(day.dt, (day.timezone_offset||0));
  card.innerHTML = `<h3 style="margin-top:0">${when}</h3>
      <div style="display:flex;gap:12px;flex-wrap:wrap">
        <div><img src="${iconUrl(day.weather[0].icon)}" alt="" style="height:64px"></div>
        <div style="flex:1"><div style="font-weight:900">${Math.round(day.temp.max)}° / ${Math.round(day.temp.min)}°</div><div style="color:#666;margin-top:6px">${day.weather[0].description}</div><div style="margin-top:8px;color:#666;font-size:13px">Humidity: ${day.humidity}% • Wind: ${day.wind_speed} m/s • Rain chance: ${Math.round((day.pop||0)*100)}%</div></div>
      </div>
      <div style="text-align:right;margin-top:12px"><button id="closeDaily" style="padding:8px 10px;border-radius:8px;border:none;background:#667eea;color:#fff;font-weight:800">Close</button></div>`;
  modal.appendChild(card); document.body.appendChild(modal); document.getElementById('closeDaily').addEventListener('click', ()=> modal.remove()); modal.addEventListener('click', (e)=>{ if(e.target===modal) modal.remove(); });
}

// init: default location
(async function init(){ input.value = 'Manila, PH'; fetchForCity('Manila, PH'); })();
// --- IGNORE ---