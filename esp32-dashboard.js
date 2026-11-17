const $ = (id) => document.getElementById(id);

let apiBase = localStorage.getItem('esp32ApiBase') || '';
let pollTimer = null;
let currentTheme = localStorage.getItem('esp32Theme') || 'light';

function normalizeEspAddress(value) {
  let trimmed = value.trim();
  if (!trimmed) return '';
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    trimmed = `http://${trimmed}`;
  }

  try {
    const url = new URL(trimmed);
    return `${url.protocol}//${url.host}`;
  } catch (err) {
    return trimmed.replace(/\/+$/, '');
  }
}

function apiUrl(path) {
  return `${apiBase}${path}`;
}

function setConnection(ok, message) {
  $('liveDot').classList.toggle('online', ok);
  $('connectionText').textContent = message || (ok ? `Connected to ${apiBase}` : 'Offline');
}

function connectToEsp() {
  apiBase = normalizeEspAddress($('espIpInput').value);
  localStorage.setItem('esp32ApiBase', apiBase);
  setConnection(false, apiBase ? `Connecting to ${apiBase}` : 'Enter ESP32 IP');
  fetchStatus();

  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(fetchStatus, 2000);
}

function setTheme(theme) {
  currentTheme = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = currentTheme;
  localStorage.setItem('esp32Theme', currentTheme);
  $('lightThemeBtn').classList.toggle('active-theme', currentTheme === 'light');
  $('darkThemeBtn').classList.toggle('active-theme', currentTheme === 'dark');
}

function setupCursorGlow() {
  const glow = $('cursorLight');
  if (!glow) return;

  window.addEventListener('pointermove', (event) => {
    glow.style.transform = `translate(${event.clientX - 140}px, ${event.clientY - 140}px)`;
    glow.classList.add('visible');
  });

  window.addEventListener('pointerleave', () => {
    glow.classList.remove('visible');
  });
}

function setupClickGlow() {
  document.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const glow = document.createElement('span');
    glow.className = 'click-glow';
    glow.style.left = `${event.clientX - rect.left}px`;
    glow.style.top = `${event.clientY - rect.top}px`;
    button.appendChild(glow);
    glow.addEventListener('animationend', () => glow.remove(), { once: true });
  });
}

function formatReading(value, unit) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 'Error';
  return `${Number(value).toFixed(1)} ${unit}`;
}

function setBadge(id, on, onText = 'ON', offText = 'OFF') {
  const el = $(id);
  el.textContent = on ? onText : offText;
  el.classList.toggle('on', on);
  el.classList.toggle('open', onText === 'OPEN' && on);
  el.classList.toggle('unlocked', onText === 'UNLOCKED' && on);
}

function setGlow(id, on) {
  $(id).classList.toggle('on', Boolean(on));
}

function updateDashboard(data) {
  setConnection(true);

  $('temperature').textContent = formatReading(data.temperature, 'C');
  $('humidity').textContent = formatReading(data.humidity, '%');
  $('gasStatus').textContent = data.gasWarning ? 'WARNING' : 'SAFE';
  $('gasValue').textContent = `ADC ${data.gas}`;
  $('gasMetric').classList.toggle('warning', Boolean(data.gasWarning));
  $('peopleCount').textContent = data.peopleCount;

  $('bedroom1Mode').textContent = data.bedroom1Mode;
  $('bedroom1Hint').textContent = data.bedroom1AutoReturnPending
    ? 'AUTO will resume when Bedroom 1 becomes empty'
    : (data.bedroom1Mode === 'AUTO' ? 'Occupancy automation active' : 'Manual web control active');

  setBadge('bedroom1State', data.bedroom1);
  setBadge('bedroom1AcState', data.bedroom1Ac);
  setBadge('bedroom2State', data.bedroom2);
  setBadge('kitchenState', data.kitchen);
  setBadge('living1State', data.living1);
  setBadge('living2State', data.living2);

  setGlow('bedroom1Glow', data.bedroom1);
  setGlow('bedroom1AcGlow', data.bedroom1Ac);
  setGlow('bedroom2Glow', data.bedroom2);
  setGlow('kitchenGlow', data.kitchen);
  setGlow('living1Glow', data.living1);
  setGlow('living2Glow', data.living2);

  $('bedroom1AcMode').textContent = data.bedroom1AcMode || 'AUTO';
  const acThreshold = Number(data.bedroom1AcTempThreshold ?? 30).toFixed(1);
  $('bedroom1AcHint').textContent = data.bedroom1AcMode === 'MANUAL'
    ? 'Manual web control active'
    : `Auto when temperature is above ${acThreshold} C and Bedroom 1 is occupied`;
  $('livingAllState').textContent = data.living1 && data.living2 ? 'ON' : (data.living1 || data.living2 ? 'PARTIAL' : 'OFF');
  $('livingAllState').classList.toggle('on', Boolean(data.living1 || data.living2));

  setBadge('doorState', !data.doorLocked, 'UNLOCKED', 'LOCKED');
  $('doorSlider').parentElement.classList.toggle('unlocked', !data.doorLocked);
  $('nfcStatus').textContent = data.lastNfcStatus || 'No Scan Yet';

  setBadge('garageState', data.garageOpen, 'OPEN', 'CLOSED');
  $('garageScene').classList.toggle('open', Boolean(data.garageOpen));
}

async function fetchStatus() {
  if (!apiBase) {
    setConnection(false, 'Enter ESP32 IP');
    return;
  }

  try {
    const response = await fetch(apiUrl('/api/status'), { cache: 'no-store' });
    if (!response.ok) throw new Error(`Status ${response.status}`);
    updateDashboard(await response.json());
  } catch (err) {
    setConnection(false, `Offline: ${err.message}`);
  }
}

async function postJson(path, payload) {
  if (!apiBase) {
    setConnection(false, 'Enter ESP32 IP');
    return false;
  }

  try {
    const response = await fetch(apiUrl(path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store'
    });

    if (!response.ok) {
      let message = `Command ${response.status}`;
      try {
        const body = await response.json();
        if (body.error) message = body.error;
      } catch (ignore) {}
      throw new Error(message);
    }

    await fetchStatus();
    return true;
  } catch (err) {
    setConnection(false, `Command error: ${err.message}`);
    return false;
  }
}

function setLight(name, state) {
  const payload = { name, state };
  if (name === 'bedroom1') payload.manual = true;
  postJson('/api/light', payload);
}

function setLivingAll(state) {
  postJson('/api/living-all', { state });
}

function setDoor(locked) {
  postJson('/api/door', { state: locked ? 'lock' : 'unlock' });
}

function setGarage(state) {
  postJson('/api/garage', { state });
}

function setBedroom1Mode(mode) {
  postJson('/api/bedroom1-mode', { mode });
}

function setBedroom1Ac(state) {
  postJson('/api/bedroom1-ac', { state });
}

function setBedroom1AcMode(mode) {
  postJson('/api/bedroom1-ac', { mode });
}
window.addEventListener('DOMContentLoaded', () => {
  setTheme(currentTheme);
  setupCursorGlow();
  setupClickGlow();

  if (apiBase) $('espIpInput').value = apiBase.replace(/^https?:\/\//, '');

  $('espIpInput').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') connectToEsp();
  });

  connectToEsp();
});
