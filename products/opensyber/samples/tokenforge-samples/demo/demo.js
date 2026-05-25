// ─── TokenForge Interactive Demo ───
const SIGNALS = [
  { key: 'signature', label: 'ECDSA Signature', weight: 40, icon: '🔐' },
  { key: 'ip', label: 'IP Consistency', weight: 15, icon: '🌐' },
  { key: 'geo', label: 'Geo Consistency', weight: 15, icon: '📍' },
  { key: 'fingerprint', label: 'Device Fingerprint', weight: 10, icon: '🖥️' },
  { key: 'velocity', label: 'Request Velocity', weight: 10, icon: '⚡' },
  { key: 'time', label: 'Time Pattern', weight: 5, icon: '🕐' },
  { key: 'nonce', label: 'Nonce Freshness', weight: 5, icon: '🎲' },
];

const SCENARIOS = [
  { id: 'legit', icon: '✅', title: 'Legitimate User', desc: 'Same device, same network — full trust score.', signals: { signature:1, ip:1, geo:1, fingerprint:1, velocity:1, time:1, nonce:1 } },
  { id: 'stolen', icon: '🍪', title: 'Stolen Cookie (XSS)', desc: 'Attacker has the session cookie but no device key.', signals: { signature:0, ip:0, geo:0, fingerprint:0, velocity:1, time:1, nonce:1 } },
  { id: 'mitm', icon: '🕵️', title: 'AiTM Proxy Attack', desc: 'Adversary-in-the-middle replaying from a different IP.', signals: { signature:1, ip:0, geo:0, fingerprint:0, velocity:1, time:1, nonce:1 } },
  { id: 'vpn', icon: '🔄', title: 'VPN / IP Change', desc: 'User switched networks — mild trust drop.', signals: { signature:1, ip:0, geo:1, fingerprint:1, velocity:1, time:1, nonce:1 } },
  { id: 'replay', icon: '📼', title: 'Nonce Replay', desc: 'Attacker replays a captured request verbatim.', signals: { signature:1, ip:1, geo:1, fingerprint:1, velocity:1, time:1, nonce:0 } },
  { id: 'newdevice', icon: '📱', title: 'New Device Login', desc: 'Same user, different browser — rebind needed.', signals: { signature:0, ip:1, geo:1, fingerprint:0, velocity:1, time:1, nonce:1 } },
];

let state = Object.fromEntries(SIGNALS.map(s => [s.key, true]));
let events = [];
let activeScenario = 'legit';

function getScore() {
  return SIGNALS.reduce((sum, s) => sum + (state[s.key] ? s.weight : 0), 0);
}

function getAction(score) {
  if (score >= 80) return { label: 'ALLOW', cls: 'badge-allow', color: '#2ECC7B', desc: 'Request proceeds — full device verification.' };
  if (score >= 40) return { label: 'STEP-UP', cls: 'badge-stepup', color: '#FFB347', desc: 'Challenge with TOTP, email OTP, or passkey.' };
  return { label: 'BLOCK', cls: 'badge-block', color: '#FF4D4D', desc: 'Session revoked — re-authentication required.' };
}

// ─── Render Functions ───

function renderSignals() {
  const panel = document.getElementById('signals-panel');
  panel.innerHTML = '<h3 style="font-size:16px;font-weight:700;margin-bottom:16px;">Trust Signals</h3>';
  SIGNALS.forEach(s => {
    const row = document.createElement('div');
    row.className = 'signal-row';
    const pct = state[s.key] ? s.weight : 0;
    const barColor = state[s.key] ? (s.weight >= 15 ? 'var(--ok)' : s.weight >= 10 ? 'var(--info)' : 'var(--text-dim)') : 'var(--border)';
    row.innerHTML = `
      <span style="font-size:18px;width:28px;text-align:center;">${s.icon}</span>
      <span class="signal-label">${s.label}</span>
      <div class="weight-bar"><div class="weight-fill" style="width:${pct}%;background:${barColor};"></div></div>
      <span class="signal-pts" style="color:${state[s.key] ? 'var(--ok)' : 'var(--alert)'};">${state[s.key] ? '+' : ''}${state[s.key] ? s.weight : 0}</span>
      <button class="toggle ${state[s.key] ? 'on' : ''}" data-key="${s.key}"></button>
    `;
    panel.appendChild(row);
  });
  panel.querySelectorAll('.toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.key;
      state[key] = !state[key];
      addEvent(state[key] ? 'SIGNAL_RESTORED' : 'SIGNAL_LOST',
        `${SIGNALS.find(s => s.key === key).label} ${state[key] ? 'verified' : 'failed'}`,
        state[key] ? 'ok' : 'alert');
      update();
    });
  });
}

function renderRing() {
  const score = getScore();
  const action = getAction(score);
  const r = 80, c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  document.getElementById('score-ring').innerHTML = `
    <circle cx="100" cy="100" r="${r}" fill="none" stroke="var(--border)" stroke-width="12"/>
    <circle cx="100" cy="100" r="${r}" fill="none" stroke="${action.color}" stroke-width="12"
      stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${offset}"
      transform="rotate(-90 100 100)" style="transition:all 0.5s ease;"/>
    <text x="100" y="92" text-anchor="middle" fill="var(--text-primary)" font-size="48" font-weight="800">${score}</text>
    <text x="100" y="118" text-anchor="middle" fill="var(--text-muted)" font-size="14">/ 100</text>
  `;
  document.getElementById('action-badge').innerHTML = `<span class="score-badge ${action.cls}">${action.label}</span>`;
  document.getElementById('action-desc').textContent = action.desc;
}

function renderScenarios() {
  const el = document.getElementById('scenarios');
  el.innerHTML = '';
  SCENARIOS.forEach(sc => {
    const card = document.createElement('div');
    card.className = `scenario-card card-hover ${activeScenario === sc.id ? 'active' : ''}`;
    card.innerHTML = `<div class="scenario-icon">${sc.icon}</div><div class="scenario-title">${sc.title}</div><div class="scenario-desc">${sc.desc}</div>`;
    card.addEventListener('click', () => {
      activeScenario = sc.id;
      SIGNALS.forEach(s => { state[s.key] = !!sc.signals[s.key]; });
      addEvent('SCENARIO_APPLIED', `Simulating: ${sc.title}`, 'info');
      update();
    });
    el.appendChild(card);
  });
}

function renderHeaders() {
  const el = document.getElementById('headers-preview');
  const nonce = crypto.randomUUID().replace(/-/g, '').slice(0, 24);
  const ts = Math.floor(Date.now() / 1000);
  const sig = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).slice(0, 44);
  const devId = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  el.innerHTML = [
    { k: 'X-TF-Signature', v: sig },
    { k: 'X-TF-Nonce', v: nonce },
    { k: 'X-TF-Timestamp', v: String(ts) },
    { k: 'X-TF-Device-ID', v: devId },
  ].map(h => `<div class="header-line"><span class="header-key">${h.k}</span>: <span class="header-val">${h.v}</span></div>`).join('');
}

function addEvent(type, detail, severity) {
  const time = new Date().toLocaleTimeString('en-US', { hour12: false });
  events.unshift({ type, detail, severity, time });
  if (events.length > 8) events.pop();
  renderEvents();
}

function renderEvents() {
  const el = document.getElementById('events-feed');
  el.innerHTML = events.map(e => `
    <div class="event-card">
      <div class="event-dot ${e.severity}"></div>
      <div class="event-body">
        <div class="event-type">${e.type}</div>
        <div class="event-detail">${e.detail}</div>
      </div>
      <div class="event-time">${e.time}</div>
    </div>
  `).join('');
}

function update() {
  renderSignals();
  renderRing();
  renderScenarios();
  renderHeaders();
}

// ─── Boot ───
update();
addEvent('DEVICE_BOUND', 'Device key generated (ECDSA P-256, non-extractable)', 'ok');
addEvent('SESSION_VERIFIED', 'Trust score: 100 — all signals nominal', 'ok');
