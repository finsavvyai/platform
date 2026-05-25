// ─── TokenForge Dashboard Demo Data ───

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const CHART_DATA = [1240, 1580, 1320, 1890, 2100, 980, 1320];
const MAX_VAL = Math.max(...CHART_DATA);

function renderChart() {
  const bars = document.getElementById('chart-bars');
  const labels = document.getElementById('chart-labels');
  bars.innerHTML = CHART_DATA.map((v, i) => {
    const h = Math.round((v / MAX_VAL) * 140) + 20;
    const opacity = i === 4 ? 1 : 0.6;
    return `<div class="chart-bar" style="height:${h}px;opacity:${opacity};">
      <div class="tooltip">${v.toLocaleString()} verifications</div>
    </div>`;
  }).join('');
  labels.innerHTML = DAYS.map(d => `<div class="chart-label">${d}</div>`).join('');
}

const SESSIONS = [
  { device: 'Chrome / macOS', ip: '192.168.1.42', score: 98, time: '2m ago', icon: '💻' },
  { device: 'Safari / iOS 18', ip: '10.0.0.15', score: 94, time: '5m ago', icon: '📱' },
  { device: 'Firefox / Ubuntu', ip: '172.16.0.8', score: 87, time: '12m ago', icon: '🖥️' },
  { device: 'Edge / Windows 11', ip: '192.168.1.100', score: 92, time: '18m ago', icon: '💻' },
  { device: 'Kotlin SDK / Android', ip: '10.0.0.22', score: 96, time: '25m ago', icon: '📱' },
];

function scoreColor(s) {
  if (s >= 90) return 'var(--ok)';
  if (s >= 70) return 'var(--warn)';
  return 'var(--alert)';
}

function renderSessions() {
  const el = document.getElementById('sessions-list');
  el.innerHTML = SESSIONS.map(s => `
    <div class="session-row">
      <div class="session-avatar">${s.icon}</div>
      <div class="session-info">
        <div class="session-device">${s.device}</div>
        <div class="session-meta">${s.ip} · ${s.time}</div>
      </div>
      <div class="session-score" style="color:${scoreColor(s.score)};">${s.score}</div>
    </div>
  `).join('');
}

const EVENTS = [
  { type: 'session.verified', detail: 'Chrome/macOS — trust score 98', severity: 'info', time: '16:42:18', ip: '192.168.1.42' },
  { type: 'trust_score.degraded', detail: 'IP changed from 192.168.1.42 → 10.0.0.1', severity: 'warn', time: '16:41:55', ip: '10.0.0.1' },
  { type: 'session.hijack_attempt', detail: 'Invalid ECDSA signature — cookie used without device key', severity: 'critical', time: '16:40:12', ip: '45.33.32.156' },
  { type: 'step_up.completed', detail: 'TOTP verification successful — trust restored to 100', severity: 'info', time: '16:38:44', ip: '10.0.0.15' },
  { type: 'session.bound', detail: 'New device bound — Safari/iOS 18 (P-256 key generated)', severity: 'info', time: '16:35:20', ip: '10.0.0.15' },
  { type: 'nonce.replay_blocked', detail: 'Duplicate nonce detected — request rejected', severity: 'critical', time: '16:33:01', ip: '45.33.32.156' },
  { type: 'session.revoked', detail: 'Trust score dropped to 15 — automatic revocation', severity: 'warn', time: '16:30:48', ip: '45.33.32.156' },
];

function severityCls(s) {
  return s === 'critical' ? 'severity-critical' : s === 'warn' ? 'severity-warn' : 'severity-info';
}

function renderEvents() {
  const el = document.getElementById('events-table');
  el.innerHTML = `
    <thead><tr><th>Event</th><th>Detail</th><th>Severity</th><th>IP</th><th>Time</th></tr></thead>
    <tbody>${EVENTS.map(e => `
      <tr>
        <td style="font-family:monospace;font-size:12px;color:var(--signal);">${e.type}</td>
        <td style="color:var(--text-secondary);">${e.detail}</td>
        <td><span class="severity-badge ${severityCls(e.severity)}">${e.severity}</span></td>
        <td style="font-family:monospace;font-size:12px;color:var(--text-muted);">${e.ip}</td>
        <td style="font-family:monospace;font-size:12px;color:var(--text-muted);">${e.time}</td>
      </tr>
    `).join('')}</tbody>
  `;
}

// ─── Animate stat counters ───
function animateCounters() {
  document.querySelectorAll('.stat-value').forEach(el => {
    const text = el.textContent;
    const target = parseFloat(text.replace(/,/g, ''));
    if (isNaN(target)) return;
    const isFloat = text.includes('.');
    let current = 0;
    const step = target / 40;
    const interval = setInterval(() => {
      current += step;
      if (current >= target) {
        el.textContent = text;
        clearInterval(interval);
        return;
      }
      el.textContent = isFloat ? current.toFixed(1) : Math.round(current).toLocaleString();
    }, 25);
  });
}

// ─── Boot ───
renderChart();
renderSessions();
renderEvents();
setTimeout(animateCounters, 200);
