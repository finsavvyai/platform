const API = '/api/v1';
let allConnections = [];
let allFindings = [];
let allHistory = [];
let connectionStatuses = {};
let connFilter = 'all';
let findingFilter = 'all';
let autoRefreshInterval = null;
let githubAppStatus = null;
let providerCatalog = [];

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
  loadProviderCatalog();
  loadGitHubAppStatus();
  loadAll();
  loadOverview();
  startAutoRefresh();
  setupKeyboard();
  setupTabs();
  checkOnboarding();
});

function setupTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const name = tab.dataset.tab;
      document.querySelectorAll('.tab').forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); t.setAttribute('tabindex', '-1'); });
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      tab.setAttribute('tabindex', '0');
      document.getElementById('tab-' + name).classList.add('active');
      if (name === 'overview') loadOverview();
      if (name === 'findings') loadFindings();
      if (name === 'history') loadHistory();
      if (name === 'integrations') loadIntegrations();
      if (name === 'analytics') loadAnalytics();
      if (name === 'policies') loadPolicies();
      if (name === 'secrets') loadSecrets();
    });
  });
}

function setupKeyboard() {
  document.addEventListener('keydown', e => {
    // Ctrl+K or Cmd+K for search
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      document.getElementById('global-search').focus();
    }
    // Escape to close modals
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(m => m.classList.add('hidden'));
    }
    // 1-3 for tab switching (when not focused on input)
    if (!['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
      if (e.key === '1') document.querySelector('[data-tab="overview"]').click();
      if (e.key === '2') document.querySelector('[data-tab="connections"]').click();
      if (e.key === '3') document.querySelector('[data-tab="findings"]').click();
      if (e.key === '4') document.querySelector('[data-tab="history"]').click();
      if (e.key === 'n' || e.key === 'N') showAddModal();
      if (e.key === 'a' || e.key === 'A') showAnalyzeModal();
      if (e.key === 'r' || e.key === 'R') loadAll();
    }
  });

  // Global search
  document.getElementById('global-search').addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    const activeTab = document.querySelector('.tab.active').dataset.tab;
    if (activeTab === 'connections') renderConnections(allConnections.filter(c =>
      c.name.toLowerCase().includes(q) || c.platform.toLowerCase().includes(q)
    ));
    if (activeTab === 'findings') renderFindings(allFindings.filter(f =>
      f.title.toLowerCase().includes(q) || f.description.toLowerCase().includes(q) || f.category.toLowerCase().includes(q)
    ));
    if (activeTab === 'history') renderHistory(allHistory.filter(h =>
      h.connection_name.toLowerCase().includes(q) || h.summary.toLowerCase().includes(q)
    ));
  });
}

function startAutoRefresh() {
  if (autoRefreshInterval) clearInterval(autoRefreshInterval);
  autoRefreshInterval = setInterval(() => {
    loadConnections(true);
    loadFindingStats();
  }, 30000);
}

async function loadAll() {
  updateRefreshStatus('Refreshing...');
  await Promise.all([loadConnections(), loadFindingStats()]);
  updateRefreshStatus('Updated ' + new Date().toLocaleTimeString());
}

function updateRefreshStatus(msg) {
  document.getElementById('last-refresh').textContent = msg;
}

// ===== Connections =====
async function loadConnections(silent) {
  try {
    const res = await fetch(API + '/connections');
    const data = await res.json();
    allConnections = data.connections || [];
    renderConnections(allConnections);
    updateStats();
  } catch (e) {
    if (!silent) {
      document.getElementById('connections-list').innerHTML =
        '<div class="empty-state"><h3>Unable to reach API</h3><p>Check that PipeWarden is running.</p></div>';
    }
  }
}

function renderConnections(conns) {
  const list = document.getElementById('connections-list');
  const filtered = connFilter === 'all' ? conns : conns.filter(c => c.platform === connFilter);
  document.getElementById('badge-conn').textContent = allConnections.length;

  if (filtered.length === 0) {
    const msg = connFilter !== 'all'
      ? `No ${connFilter} connections`
      : 'No connections yet';
    const addTip = connFilter === 'all'
      ? `<p>Add your first CI/CD connection to start monitoring pipeline security.</p>
         <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:12px">
           <button class="btn btn-primary" onclick="showAddModal()">+ Add Connection</button>
           <button class="btn btn-outline" onclick="loadDemoWorkspace()">Load Demo Workspace</button>
           ${renderGitHubAppButton()}
         </div>`
      : `<p>No ${connFilter} connections found.</p>`;
    list.innerHTML = `<div class="empty-state"><h3>${msg}</h3>${addTip}</div>`;
    return;
  }
  list.innerHTML = filtered.map(c => {
    const st = connectionStatuses[c.name];
    let statusHTML = '<span class="status-dot unknown"></span><span>Not tested</span>';
    let troubleshootHTML = '';
    if (st === 'testing') {
      statusHTML = '<span class="status-dot pending"></span><span>Testing...</span>';
    } else if (st && st.connected) {
      const latency = st.latency ? (st.latency/1e6).toFixed(0) + 'ms' : '';
      statusHTML = `<span class="status-dot ok"></span><span>${esc(st.user || 'Connected')} ${latency ? '&middot; ' + latency : ''}</span>`;
    } else if (st && !st.connected) {
      statusHTML = `<span class="status-dot fail"></span><span>${esc(st.message || 'Connection failed')}</span>`;
      troubleshootHTML = renderTroubleshoot(c.platform, st.message || '');
    }
    let icon = 'GH';
    if (c.platform === 'github') icon = 'GH';
    else if (c.platform === 'gitlab') icon = 'GL';
    else if (c.platform === 'bitbucket') icon = 'BB';
    else if (c.platform === 'jenkins') icon = 'J';
    else if (c.platform === 'azure_devops') icon = 'AZ';
    else if (c.platform === 'circleci') icon = 'CI';
    return `
      <div class="conn-card">
        <div class="conn-icon ${c.platform}">${icon}</div>
        <div class="conn-info">
          <div class="conn-name">${esc(c.name)}</div>
          <div class="conn-meta">
            ${c.platform}${c.base_url ? ' &middot; ' + esc(c.base_url) : ''}
          </div>
          <div class="conn-meta">${statusHTML}</div>
        </div>
        <div class="conn-actions">
          <span id="health-badge-${esc(c.name)}" class="health-badge health-badge--loading" onclick="toggleHealthPanel('${esc(c.name)}')" title="Health score — click to expand">…</span>
          <button class="btn btn-outline btn-sm" onclick="testOne('${esc(c.name)}')">Test</button>
          <button class="btn btn-outline btn-sm" onclick="showEditModal('${esc(c.name)}','${esc(c.platform)}','${esc(c.base_url || '')}')">Edit</button>
          <button class="btn btn-outline btn-sm" onclick="toggleSchedulePanel('${esc(c.name)}')">Schedule</button>
          <button class="btn btn-outline btn-sm" onclick="toggleRuntimePanel('${esc(c.name)}')">Runtime</button>
          <button class="btn btn-danger btn-sm" onclick="deleteConn('${esc(c.name)}')">Remove</button>
        </div>
      </div>
      <div id="health-panel-${esc(c.name)}" class="health-panel hidden"></div>
      ${troubleshootHTML}
      ${renderSchedulePanel(c.name)}
      ${renderRuntimePanel(c.name)}`;
  }).join('');
  loadHealthScores(filtered);
}

// ===== Health Score =====
const healthCache = {};

async function loadHealthScores(conns) {
  for (const c of conns) {
    fetchHealthScore(c.name);
  }
}

async function fetchHealthScore(name) {
  try {
    const res = await fetch(`${API}/connections/${encodeURIComponent(name)}/health`);
    if (!res.ok) return;
    const hs = await res.json();
    healthCache[name] = hs;
    renderHealthBadge(name, hs);
  } catch (e) {
    const badge = document.getElementById('health-badge-' + name);
    if (badge) badge.style.display = 'none';
  }
}

function renderHealthBadge(name, hs) {
  const badge = document.getElementById('health-badge-' + name);
  if (!badge) return;
  const gradeClass = { A: 'grade-a', B: 'grade-b', C: 'grade-c', D: 'grade-d', F: 'grade-f' }[hs.grade] || 'grade-f';
  badge.className = `health-badge ${gradeClass}`;
  badge.textContent = `${hs.grade} ${hs.score}`;
}

function toggleHealthPanel(name) {
  const panel = document.getElementById('health-panel-' + name);
  if (!panel) return;
  if (!panel.classList.contains('hidden')) {
    panel.classList.add('hidden');
    return;
  }
  const hs = healthCache[name];
  if (!hs) { fetchHealthScore(name).then(() => expandHealthPanel(name)); return; }
  expandHealthPanel(name);
}

function expandHealthPanel(name) {
  const hs = healthCache[name];
  if (!hs) return;
  const panel = document.getElementById('health-panel-' + name);
  if (!panel) return;
  const trendIcon = { improving: '▲', stable: '→', degrading: '▼' }[hs.trend] || '→';
  const rows = hs.dimensions.map(d => `
    <tr>
      <td>${esc(d.name)}</td>
      <td><span class="health-dim-bar"><span style="width:${d.score}%;background:${d.score>=75?'#30d158':d.score>=40?'#ffd60a':'#ff453a'}"></span></span></td>
      <td>${d.score}</td>
      <td><span class="dim-status dim-${d.status}">${d.status}</span></td>
      <td>${esc(d.details)}</td>
    </tr>`).join('');
  panel.innerHTML = `
    <div class="health-panel-inner">
      <div class="health-panel-header">
        <strong>Security Health: ${hs.score}/100 (${hs.grade})</strong>
        <span class="health-trend trend-${hs.trend}">${trendIcon} ${hs.trend}</span>
      </div>
      <table class="health-dims-table">
        <thead><tr><th>Dimension</th><th>Score</th><th></th><th>Status</th><th>Details</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  panel.classList.remove('hidden');
}

function filterConnections(f) {
  connFilter = f;
  document.querySelectorAll('[data-filter]').forEach(el => {
    el.classList.toggle('active', el.dataset.filter === f);
  });
  renderConnections(allConnections);
}

function updateStats() {
  document.getElementById('stat-total').textContent = allConnections.length;
  document.getElementById('stat-github').textContent = allConnections.filter(c => c.platform === 'github').length;
  document.getElementById('stat-gitlab').textContent = allConnections.filter(c => c.platform === 'gitlab').length;
  document.getElementById('stat-bitbucket').textContent = allConnections.filter(c => c.platform === 'bitbucket').length;
  document.getElementById('stat-jenkins').textContent = allConnections.filter(c => c.platform === 'jenkins').length;
  document.getElementById('stat-azure').textContent = allConnections.filter(c => c.platform === 'azure_devops').length;
  document.getElementById('stat-circleci').textContent = allConnections.filter(c => c.platform === 'circleci').length;
}

async function loadProviderCatalog() {
  try {
    const res = await fetch(API + '/providers');
    const data = await res.json();
    providerCatalog = data.providers || [];
    applyProviderCatalog();
  } catch (e) { /* ignore */ }
}

function applyProviderCatalog() {
  const supported = new Set(providerCatalog.map(p => p.id));
  document.querySelectorAll('[data-filter]').forEach(el => {
    if (el.dataset.filter === 'all') return;
    el.style.display = supported.has(el.dataset.filter) ? '' : 'none';
  });

  const platformSelect = document.getElementById('conn-platform');
  if (platformSelect) {
    Array.from(platformSelect.options).forEach(opt => {
      opt.hidden = !supported.has(opt.value);
    });
    if (!supported.has(platformSelect.value)) {
      const first = Array.from(platformSelect.options).find(opt => !opt.hidden);
      if (first) {
        platformSelect.value = first.value;
      }
    }
  }

  document.querySelectorAll('.platform-card[data-platform]').forEach(card => {
    card.style.display = supported.has(card.dataset.platform) ? '' : 'none';
  });
  togglePlatformFields();
}

async function loadGitHubAppStatus() {
  try {
    const res = await fetch(API + '/oauth/github/status');
    githubAppStatus = await res.json();
  } catch (e) {
    githubAppStatus = null;
  }
  if (allConnections.length === 0) {
    renderConnections(allConnections);
  }
}

function renderGitHubAppButton() {
  if (!githubAppStatus) return '';
  if (githubAppStatus.configured) {
    return `<button class="btn btn-outline" onclick="startGitHubAppInstall()">Install GitHub App</button>`;
  }
  return `<button class="btn btn-outline" onclick="startGitHubAppInstall()">GitHub App Setup</button>`;
}

function startGitHubAppInstall() {
  if (!githubAppStatus) {
    toast('GitHub App status is still loading', 'info');
    return;
  }
  if (githubAppStatus.configured) {
    window.location.href = githubAppStatus.install_path;
    return;
  }
  toast(githubAppStatus.message || 'GitHub App is not configured yet', 'error');
  showAddModal();
  document.getElementById('conn-platform').value = 'github';
  togglePlatformFields();
}

async function loadDemoWorkspace() {
  try {
    const res = await fetch(API + '/demo/workspace', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) {
      toast(data.error || 'Failed to load demo workspace', 'error');
      return;
    }
    dismissOnboarding();
    toast(`Demo workspace ready. Use ${data.owner}/${data.repo} and run ${data.recommended_run_id}.`, 'success');
    await Promise.all([loadAll(), loadOverview(), loadFindings(), loadHistory()]);
  } catch (e) {
    toast('Failed to load demo workspace', 'error');
  }
}

async function loadFindingStats() {
  try {
    const res = await fetch(API + '/analysis/stats');
    const stats = await res.json();
    document.getElementById('stat-critical').textContent = stats.critical || 0;
    document.getElementById('stat-high').textContent = stats.high || 0;
    document.getElementById('stat-open').textContent = stats.open || 0;
  } catch (e) { /* ignore */ }
}

// ===== Connection CRUD =====
async function saveConnection(e) {
  e.preventDefault();
  if (!validateConnectionForm()) return;

  const editMode = document.getElementById('edit-mode').value;
  const platform = document.getElementById('conn-platform').value;
  const body = {
    name: document.getElementById('conn-name').value.trim(),
    platform: platform,
  };
  if (platform === 'github') {
    body.token = document.getElementById('gh-token').value;
    body.base_url = document.getElementById('gh-base-url').value;
  } else if (platform === 'gitlab') {
    body.token = document.getElementById('gl-token').value;
    body.base_url = document.getElementById('gl-base-url').value;
  } else if (platform === 'bitbucket') {
    body.username = document.getElementById('bb-username').value;
    body.app_password = document.getElementById('bb-app-password').value;
    body.base_url = document.getElementById('bb-base-url').value;
  } else if (platform === 'jenkins') {
    body.base_url = document.getElementById('jenkins-base-url').value;
    body.username = document.getElementById('jenkins-username').value;
    body.token = document.getElementById('jenkins-token').value;
  } else if (platform === 'azure_devops') {
    body.base_url = document.getElementById('azure-base-url').value;
    body.token = document.getElementById('azure-token').value;
  } else if (platform === 'circleci') {
    body.org_slug = document.getElementById('circleci-org-slug').value;
    body.token = document.getElementById('circleci-token').value;
  }

  try {
    let res;
    if (editMode) {
      res = await fetch(API + '/connections/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } else {
      res = await fetch(API + '/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    }
    if (!res.ok) {
      const err = await res.json();
      if (err.error && err.error.includes('already exists')) {
        toast('A connection with this name already exists. Choose a different name.', 'error');
      } else {
        toast(err.error || 'Failed to save connection', 'error');
      }
      return;
    }
    toast(editMode ? 'Connection updated!' : 'Connection added! Click "Test" to verify it works.', 'success');
    closeModal('add-modal');
    document.getElementById('add-form').reset();
    document.getElementById('edit-mode').value = '';
    loadConnections();
  } catch (e) {
    toast('Network error. Check that PipeWarden server is running.', 'error');
  }
}

function showAddModal() {
  document.getElementById('edit-mode').value = '';
  document.getElementById('add-modal-title').textContent = 'Add Connection';
  document.getElementById('save-conn-btn').textContent = 'Add Connection';
  document.getElementById('conn-name').disabled = false;
  document.getElementById('add-form').reset();
  togglePlatformFields();
  document.getElementById('add-modal').classList.remove('hidden');
  setTimeout(() => document.getElementById('conn-name').focus(), 100);
}

function showEditModal(name, platform, baseUrl) {
  document.getElementById('edit-mode').value = name;
  document.getElementById('add-modal-title').textContent = 'Edit Connection';
  document.getElementById('save-conn-btn').textContent = 'Save Changes';
  document.getElementById('conn-name').value = name;
  document.getElementById('conn-name').disabled = true;
  document.getElementById('conn-platform').value = platform;
  togglePlatformFields();
  if (platform === 'github') {
    document.getElementById('gh-base-url').value = baseUrl;
    document.getElementById('gh-token').placeholder = '(unchanged)';
  } else if (platform === 'gitlab') {
    document.getElementById('gl-base-url').value = baseUrl;
    document.getElementById('gl-token').placeholder = '(unchanged)';
  } else if (platform === 'bitbucket') {
    document.getElementById('bb-base-url').value = baseUrl;
    document.getElementById('bb-app-password').placeholder = '(unchanged)';
  } else if (platform === 'jenkins') {
    document.getElementById('jenkins-base-url').value = baseUrl;
    document.getElementById('jenkins-token').placeholder = '(unchanged)';
  } else if (platform === 'azure_devops') {
    document.getElementById('azure-base-url').value = baseUrl;
    document.getElementById('azure-token').placeholder = '(unchanged)';
  } else if (platform === 'circleci') {
    document.getElementById('circleci-token').placeholder = '(unchanged)';
  }
  document.getElementById('add-modal').classList.remove('hidden');
}

async function deleteConn(name) {
  if (!confirm(`Remove connection "${name}"?`)) return;
  try {
    const res = await fetch(`${API}/connections/${encodeURIComponent(name)}`, { method: 'DELETE' });
    if (!res.ok) { toast('Failed to remove', 'error'); return; }
    delete connectionStatuses[name];
    toast('Connection removed', 'success');
    loadConnections();
  } catch (e) { toast('Network error', 'error'); }
}

async function testOne(name) {
  connectionStatuses[name] = 'testing';
  renderConnections(allConnections);
  try {
    const res = await fetch(`${API}/connections/${encodeURIComponent(name)}/test`, { method: 'POST' });
    connectionStatuses[name] = await res.json();
  } catch (e) {
    connectionStatuses[name] = { connected: false, message: 'Request failed' };
  }
  renderConnections(allConnections);
}

async function testAll() {
  allConnections.forEach(c => { connectionStatuses[c.name] = 'testing'; });
  renderConnections(allConnections);
  toast('Testing all connections...', 'info');
  try {
    const res = await fetch(`${API}/connections/test`, { method: 'POST' });
    const data = await res.json();
    Object.assign(connectionStatuses, data);
    const ok = Object.values(data).filter(s => s.connected).length;
    const fail = Object.values(data).filter(s => !s.connected).length;
    toast(`${ok} connected, ${fail} failed`, ok > 0 ? 'success' : 'error');
  } catch (e) {
    toast('Test failed', 'error');
  }
  renderConnections(allConnections);
}

// ===== Findings =====
async function loadFindings() {
  const el = document.getElementById('findings-list');
  try {
    const res = await fetch(API + '/analysis/findings');
    const data = await res.json();
    allFindings = data.findings || [];
    document.getElementById('badge-findings').textContent = allFindings.filter(f => f.status === 'open').length;
    renderFindings(allFindings);
  } catch (err) {
    el.innerHTML = '<div class="empty-state"><h3>Failed to load findings</h3></div>';
  }
}

function renderFindings(findings) {
  const el = document.getElementById('findings-list');
  let filtered = findings;
  if (findingFilter === 'open') {
    filtered = findings.filter(f => f.status === 'open');
  } else if (findingFilter !== 'all') {
    filtered = findings.filter(f => f.severity === findingFilter);
  }
  if (filtered.length === 0) {
    el.innerHTML = '<div class="empty-state"><h3>No findings</h3><p>Run a security analysis to see findings here.</p></div>';
    return;
  }
  el.innerHTML = filtered.map(f => `
    <div class="finding-card ${f.status}${f.status === 'suppressed' ? ' suppressed-row' : ''}">
      <div class="finding-header">
        <span class="severity-badge ${f.severity}">${f.severity}</span>
        <span class="status-badge ${f.status}">${f.status.replace('_', ' ')}</span>
        <span class="finding-title">${esc(f.title)}</span>
      </div>
      <div class="finding-desc">${esc(f.description)}</div>
      ${f.remediation ? `<div class="finding-desc"><strong>Remediation:</strong> ${esc(f.remediation)}</div>` : ''}
      <div class="finding-meta">
        <span>${f.category}</span>
        <span>${esc(f.connection_name)}</span>
        <span>Run ${esc(f.run_id)}</span>
        <span>${(f.confidence * 100).toFixed(0)}% confidence</span>
        ${f.file ? `<span>${esc(f.file)}${f.line ? ':' + f.line : ''}</span>` : ''}
        <span>${new Date(f.created_at).toLocaleDateString()}</span>
      </div>
      <div class="finding-actions">
        ${f.status === 'open' ? `
          <button class="btn btn-warning btn-sm" onclick="updateFinding(${f.id},'acknowledged')">Acknowledge</button>
          <button class="btn btn-success btn-sm" onclick="updateFinding(${f.id},'resolved')">Resolve</button>
          <button class="btn btn-ghost btn-sm" onclick="updateFinding(${f.id},'false_positive')">False Positive</button>
        ` : ''}
        ${f.status === 'acknowledged' ? `
          <button class="btn btn-success btn-sm" onclick="updateFinding(${f.id},'resolved')">Resolve</button>
          <button class="btn btn-outline btn-sm" onclick="updateFinding(${f.id},'open')">Reopen</button>
        ` : ''}
        ${f.status === 'resolved' || f.status === 'false_positive' ? `
          <button class="btn btn-outline btn-sm" onclick="updateFinding(${f.id},'open')">Reopen</button>
        ` : ''}
        ${renderSuppressionActions(f)}
        <button class="btn btn-ghost btn-sm" onclick="loadSimilar(${f.id})">Similar</button>
      </div>
      <div id="similar-${f.id}" class="similar-list" style="display:none;margin-top:8px;font-size:12px;color:var(--muted)"></div>
    </div>
  `).join('');
}

async function loadSimilar(id) {
  const box = document.getElementById(`similar-${id}`);
  if (!box) return;
  if (box.style.display === 'block') { box.style.display = 'none'; return; }
  box.style.display = 'block';
  box.innerHTML = 'Loading similar findings…';
  try {
    const res = await fetch(`${API}/findings/${id}/similar?k=5`);
    if (!res.ok) { box.innerHTML = 'Similar findings unavailable.'; return; }
    const data = await res.json();
    if (!data.enabled) { box.innerHTML = 'Similar findings disabled (RuVector not configured).'; return; }
    if (!data.hits || data.hits.length === 0) { box.innerHTML = 'No similar findings.'; return; }
    box.innerHTML = '<strong>Similar:</strong><ul style="margin:4px 0 0 16px;padding:0">' +
      data.hits.map(h => `<li>#${h.id} — ${esc(h.title)} <span style="opacity:0.6">(score ${h.score.toFixed(2)})</span></li>`).join('') +
      '</ul>';
  } catch (e) {
    box.innerHTML = 'Network error loading similar findings.';
  }
}

function filterFindings(f) {
  findingFilter = f;
  document.querySelectorAll('[data-sev]').forEach(el => {
    el.classList.toggle('active', el.dataset.sev === f);
  });
  renderFindings(allFindings);
}

async function updateFinding(id, status) {
  try {
    const res = await fetch(`${API}/analysis/findings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) { toast('Failed to update finding', 'error'); return; }
    toast(`Finding marked as ${status.replace('_', ' ')}`, 'success');
    loadFindings();
    loadFindingStats();
  } catch (e) { toast('Network error', 'error'); }
}

// ===== History =====
async function loadHistory() {
  const el = document.getElementById('history-list');
  try {
    const res = await fetch(API + '/analysis/history');
    const data = await res.json();
    allHistory = data.history || [];
    document.getElementById('badge-history').textContent = allHistory.length;
    renderHistory(allHistory);
  } catch (err) {
    el.innerHTML = '<div class="empty-state"><h3>Failed to load history</h3></div>';
  }
}

function renderHistory(history) {
  const el = document.getElementById('history-list');
  if (history.length === 0) {
    el.innerHTML = '<div class="empty-state"><h3>No analysis history</h3><p>Run a security analysis to see results here.</p></div>';
    return;
  }
  el.innerHTML = history.map(h => {
    const riskClass = h.risk_score >= 80 ? 'critical' : h.risk_score >= 60 ? 'high' : h.risk_score >= 30 ? 'medium' : 'low';
    const dur = h.duration_ms < 1000 ? h.duration_ms + 'ms' : (h.duration_ms / 1000).toFixed(1) + 's';
    return `
      <div class="analysis-card" onclick="viewAnalysis('${esc(h.connection_name)}','${esc(h.run_id)}')">
        <div class="risk-score ${riskClass}">${h.risk_score}</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:14px">${esc(h.connection_name)} &middot; Run ${esc(h.run_id)}</div>
          <div style="color:var(--muted);font-size:12px;margin-top:4px;line-height:1.3">${esc(h.summary)}</div>
          <div class="finding-meta" style="margin-top:6px">
            <span>${h.findings_count} findings</span>
            <span>${h.tokens_used} tokens</span>
            <span>${dur}</span>
            <span>${h.model}</span>
            <span>${new Date(h.analyzed_at).toLocaleString()}</span>
          </div>
        </div>
      </div>`;
  }).join('');
}

function viewAnalysis(connName, runId) {
  // Switch to findings tab filtered by this run
  document.querySelector('[data-tab="findings"]').click();
  // Filter findings to this connection+run
  const filtered = allFindings.filter(f => f.connection_name === connName && f.run_id === runId);
  if (filtered.length > 0) {
    renderFindings(filtered);
    toast(`Showing ${filtered.length} findings for run ${runId}`, 'info');
  }
}

// ===== Analysis =====
async function showAnalyzeModal() {
  const res = await fetch(API + '/connections');
  const data = await res.json();
  const sel = document.getElementById('analyze-conn');
  sel.innerHTML = (data.connections || []).map(c =>
    `<option value="${esc(c.name)}" data-platform="${c.platform}">${esc(c.name)} (${c.platform})</option>`
  ).join('');
  document.getElementById('recent-runs-container').style.display = 'none';
  document.getElementById('analysis-progress').style.display = 'none';
  document.getElementById('analyze-form').style.display = 'block';
  document.getElementById('analyze-modal').classList.remove('hidden');
}

function onAnalyzeConnChange() {
  document.getElementById('recent-runs-container').style.display = 'none';
}

async function browseRuns() {
  const conn = document.getElementById('analyze-conn').value;
  const owner = document.getElementById('analyze-owner').value;
  const repo = document.getElementById('analyze-repo').value;
  if (!conn || !owner || !repo) {
    toast('Fill in connection, owner, and repo first', 'error');
    return;
  }
  const container = document.getElementById('recent-runs-container');
  const list = document.getElementById('recent-runs-list');
  container.style.display = 'block';
  list.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>';

  try {
    const res = await fetch(`${API}/pipelines/runs?connection=${encodeURIComponent(conn)}&owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}&limit=10`);
    const data = await res.json();
    if (!res.ok) { list.innerHTML = `<div class="empty-state"><p>${esc(data.error)}</p></div>`; return; }
    const runs = data.runs || [];
    if (runs.length === 0) {
      list.innerHTML = '<div class="empty-state"><p>No recent runs found</p></div>';
      return;
    }
    list.innerHTML = runs.map(r => {
      const status = (r.Status || '').toLowerCase();
      return `
        <div class="run-card" style="cursor:pointer" onclick="selectRun('${esc(r.ID)}')">
          <div class="run-status ${status}"></div>
          <div class="run-info">
            <div class="run-title">#${esc(r.ID)} ${esc(r.PipelineID || '')}</div>
            <div class="run-meta">
              <span>${status}</span>
              ${r.Branch ? `<span>${esc(r.Branch)}</span>` : ''}
              ${r.CommitSHA ? `<span>${esc(r.CommitSHA.substring(0,7))}</span>` : ''}
              ${r.StartedAt ? `<span>${new Date(r.StartedAt).toLocaleString()}</span>` : ''}
            </div>
          </div>
        </div>`;
    }).join('');
  } catch (e) {
    list.innerHTML = '<div class="empty-state"><p>Failed to fetch runs</p></div>';
  }
}

function selectRun(runId) {
  document.getElementById('analyze-run-id').value = runId;
  document.getElementById('recent-runs-container').style.display = 'none';
  toast('Run ' + runId + ' selected', 'info');
}

async function runAnalysis(e) {
  e.preventDefault();
  const form = document.getElementById('analyze-form');
  const progress = document.getElementById('analysis-progress');
  const btn = document.getElementById('analyze-submit-btn');
  btn.disabled = true;
  form.style.display = 'none';
  progress.style.display = 'block';

  const body = {
    connection_name: document.getElementById('analyze-conn').value,
    owner: document.getElementById('analyze-owner').value,
    repo: document.getElementById('analyze-repo').value,
    run_id: document.getElementById('analyze-run-id').value,
  };
  try {
    const res = await fetch(API + '/analysis/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      toast(data.error || 'Analysis failed', 'error');
      return;
    }
    const count = data.findings ? data.findings.length : 0;
    toast(`Analysis complete: ${count} findings, risk score ${data.risk_score}/100`, 'success');
    closeModal('analyze-modal');
    document.getElementById('analyze-form').reset();
    loadFindingStats();
    document.querySelector('[data-tab="findings"]').click();
  } catch (err) {
    toast('Network error', 'error');
  } finally {
    btn.disabled = false;
    form.style.display = 'block';
    progress.style.display = 'none';
  }
}

// ===== Pipeline Browser =====
async function showBrowseModal() {
  const res = await fetch(API + '/connections');
  const data = await res.json();
  document.getElementById('browse-conn').innerHTML = (data.connections || []).map(c =>
    `<option value="${esc(c.name)}">${esc(c.name)} (${c.platform})</option>`
  ).join('');
  document.getElementById('browse-results').innerHTML = '';
  document.getElementById('browse-modal').classList.remove('hidden');
}

async function fetchPipelineRuns() {
  const conn = document.getElementById('browse-conn').value;
  const owner = document.getElementById('browse-owner').value;
  const repo = document.getElementById('browse-repo').value;
  if (!conn || !owner || !repo) { toast('Fill in all fields', 'error'); return; }
  const el = document.getElementById('browse-results');
  el.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>';
  try {
    const res = await fetch(`${API}/pipelines/runs?connection=${encodeURIComponent(conn)}&owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}&limit=20`);
    const data = await res.json();
    if (!res.ok) { el.innerHTML = `<div class="empty-state"><p>${esc(data.error)}</p></div>`; return; }
    const runs = data.runs || [];
    if (runs.length === 0) { el.innerHTML = '<div class="empty-state"><p>No runs found</p></div>'; return; }
    el.innerHTML = `<div style="font-size:12px;color:var(--muted);margin-bottom:8px">${runs.length} runs found</div>` +
      runs.map(r => {
        const status = (r.Status || '').toLowerCase();
        const steps = (r.Steps || []).map(s => `<span style="margin-right:8px">${esc(s.Name)}: ${(s.Status||'').toLowerCase()}</span>`).join('');
        return `
          <div class="run-card">
            <div class="run-status ${status}"></div>
            <div class="run-info">
              <div class="run-title">#${esc(r.ID)} ${esc(r.PipelineID || '')}</div>
              <div class="run-meta">
                <span>${status}</span>
                ${r.Branch ? `<span>${esc(r.Branch)}</span>` : ''}
                ${r.CommitSHA ? `<span>${esc(r.CommitSHA.substring(0,7))}</span>` : ''}
                ${r.StartedAt ? `<span>${new Date(r.StartedAt).toLocaleString()}</span>` : ''}
                ${r.URL ? `<a href="${esc(r.URL)}" target="_blank" style="color:var(--accent)">View</a>` : ''}
              </div>
              ${steps ? `<div class="run-meta" style="margin-top:2px">${steps}</div>` : ''}
            </div>
            <button class="btn btn-outline btn-sm" onclick="analyzeFromBrowser('${esc(conn)}','${esc(owner)}','${esc(repo)}','${esc(r.ID)}')">Analyze</button>
          </div>`;
      }).join('');
  } catch (e) { el.innerHTML = '<div class="empty-state"><p>Failed to fetch runs</p></div>'; }
}

async function fetchPipelines() {
  const conn = document.getElementById('browse-conn').value;
  const owner = document.getElementById('browse-owner').value;
  const repo = document.getElementById('browse-repo').value;
  if (!conn || !owner || !repo) { toast('Fill in all fields', 'error'); return; }
  const el = document.getElementById('browse-results');
  el.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div>';
  try {
    const res = await fetch(`${API}/pipelines?connection=${encodeURIComponent(conn)}&owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`);
    const data = await res.json();
    if (!res.ok) { el.innerHTML = `<div class="empty-state"><p>${esc(data.error)}</p></div>`; return; }
    const pipelines = data.pipelines || [];
    if (pipelines.length === 0) { el.innerHTML = '<div class="empty-state"><p>No pipelines found</p></div>'; return; }
    el.innerHTML = `<div style="font-size:12px;color:var(--muted);margin-bottom:8px">${pipelines.length} pipelines</div>` +
      pipelines.map(p => `
        <div class="run-card">
          <div class="run-info">
            <div class="run-title">${esc(p.Name || p.ID)}</div>
            <div class="run-meta">
              <span>ID: ${esc(p.ID)}</span>
              ${p.URL ? `<a href="${esc(p.URL)}" target="_blank" style="color:var(--accent)">View</a>` : ''}
            </div>
          </div>
        </div>
      `).join('');
  } catch (e) { el.innerHTML = '<div class="empty-state"><p>Failed to fetch pipelines</p></div>'; }
}

function analyzeFromBrowser(conn, owner, repo, runId) {
  closeModal('browse-modal');
  document.getElementById('analyze-conn').value = conn;
  document.getElementById('analyze-owner').value = owner;
  document.getElementById('analyze-repo').value = repo;
  document.getElementById('analyze-run-id').value = runId;
  document.getElementById('analyze-modal').classList.remove('hidden');
  document.getElementById('analysis-progress').style.display = 'none';
  document.getElementById('analyze-form').style.display = 'block';
}

// ===== Utilities =====
function togglePlatformFields() {
  document.querySelectorAll('.platform-fields').forEach(el => el.classList.remove('active'));
  document.getElementById('fields-' + document.getElementById('conn-platform').value).classList.add('active');
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

// Close modals on overlay click
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.add('hidden');
  }
});

function toast(msg, type) {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = 'toast ' + (type || 'info');
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 0.3s'; setTimeout(() => el.remove(), 300); }, 3500);
}

function esc(s) {
  if (!s) return '';
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// ===== Overview =====
async function loadOverview() {
  try {
    const res = await fetch(API + '/dashboard/overview');
    const data = await res.json();
    renderOverview(data);
  } catch (e) { /* ignore */ }
}

function renderOverview(data) {
  // Security Score
  const score = data.security_score || 0;
  const circle = document.getElementById('score-circle');
  const grade = document.getElementById('score-grade');
  const desc = document.getElementById('score-desc');
  circle.textContent = score;
  circle.className = 'score-circle ' + (score >= 90 ? 'excellent' : score >= 70 ? 'good' : score >= 50 ? 'fair' : score >= 30 ? 'poor' : 'critical');
  const gradeText = score >= 90 ? 'Excellent' : score >= 70 ? 'Good' : score >= 50 ? 'Fair' : score >= 30 ? 'Needs Work' : 'Critical';
  grade.textContent = gradeText + ' Security Posture';
  desc.textContent = `${data.total_analyses || 0} analyses, ${data.open_findings || 0} open findings`;

  // Finding Summary
  const summaryEl = document.getElementById('finding-summary-chart');
  const sevs = data.severity_counts || {};
  const sevOrder = [
    { key: 'critical', label: 'Critical', color: 'var(--red)' },
    { key: 'high', label: 'High', color: 'var(--orange)' },
    { key: 'medium', label: 'Medium', color: 'var(--yellow)' },
    { key: 'low', label: 'Low', color: 'var(--green)' },
    { key: 'open', label: 'Open', color: 'var(--blue)' },
  ];
  summaryEl.innerHTML = sevOrder.map(s => `
    <div style="text-align:center">
      <div style="font-size:24px;font-weight:700;color:${s.color}">${sevs[s.key] || 0}</div>
      <div style="font-size:11px;color:var(--muted)">${s.label}</div>
    </div>
  `).join('');

  // Trend Chart — uPlot when available, falls back to CSS bars otherwise.
  const trendEl = document.getElementById('trend-chart');
  const trend = (data.recent_trend || []).reverse();
  if (trend.length === 0) {
    trendEl.innerHTML = '<div style="font-size:12px;color:var(--muted);padding:16px">No analysis data yet. Run a scan to see trends.</div>';
  } else if (typeof uPlot !== 'undefined') {
    trendEl.innerHTML = '';
    const xs = trend.map((_, i) => i);
    const ys = trend.map(t => t.risk_score);
    const w = trendEl.clientWidth || 320;
    new uPlot({
      width: w, height: 90,
      padding: [4, 6, 4, 6],
      axes: [{ show: false }, { show: false }],
      scales: { x: { time: false } },
      legend: { show: false },
      cursor: { show: true, drag: { x: false, y: false } },
      series: [
        {},
        {
          label: 'Risk',
          stroke: 'rgba(48, 209, 88, 1)', width: 2,
          fill: 'rgba(48, 209, 88, 0.18)',
          points: { show: true, size: 5 },
          value: (_, v, idx) => {
            const t = trend[idx];
            return t ? `${v} • ${t.findings} findings • ${t.connection} • ${t.date}` : v;
          },
        },
      ],
    }, [xs, ys], trendEl);
  } else {
    const maxScore = Math.max(...trend.map(t => t.risk_score), 1);
    trendEl.innerHTML = trend.map(t => {
      const h = Math.max(4, (t.risk_score / maxScore) * 60);
      const color = t.risk_score >= 80 ? 'var(--red)' : t.risk_score >= 60 ? 'var(--orange)' : t.risk_score >= 30 ? 'var(--yellow)' : 'var(--green)';
      return `<div class="trend-bar" style="height:${h}px;background:${color}" data-tip="Score: ${t.risk_score} | ${t.findings} findings | ${t.connection} | ${t.date}"></div>`;
    }).join('');
  }

  // Quick Stats
  const statsEl = document.getElementById('quick-stats');
  const oldest = data.oldest_open ? daysSince(data.oldest_open) + ' days' : 'N/A';
  statsEl.innerHTML = [
    { label: 'Connections', value: data.connections || 0 },
    { label: 'Total Analyses', value: data.total_analyses || 0 },
    { label: 'Total Findings', value: data.total_findings || 0 },
    { label: 'Oldest Open', value: oldest },
  ].map(s => `
    <div style="background:var(--bg);padding:10px;border-radius:var(--radius);text-align:center">
      <div style="font-size:18px;font-weight:700">${s.value}</div>
      <div style="font-size:11px;color:var(--muted)">${s.label}</div>
    </div>
  `).join('');

  // Recommendations
  const recsEl = document.getElementById('recommendations-list');
  const recs = data.recommendations || [];
  if (recs.length === 0) {
    recsEl.innerHTML = '<div style="font-size:13px;color:var(--muted);padding:12px">No recommendations at this time.</div>';
  } else {
    recsEl.innerHTML = recs.map(r => `
      <div class="rec-item ${r.priority}">
        <div>
          <div class="rec-title">${esc(r.title)}</div>
          <div class="rec-detail">${esc(r.detail)}</div>
        </div>
      </div>
    `).join('');
  }
}

function daysSince(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  return Math.floor((now - d) / (1000 * 60 * 60 * 24));
}

// ===== Quick Scan =====
async function showQuickScanModal() {
  const res = await fetch(API + '/connections');
  const data = await res.json();
  document.getElementById('quick-conn').innerHTML = (data.connections || []).map(c =>
    `<option value="${esc(c.name)}">${esc(c.name)} (${c.platform})</option>`
  ).join('');
  document.getElementById('quick-runs-container').style.display = 'none';
  document.getElementById('quick-scan-modal').classList.remove('hidden');
}

async function browseRunsQuick() {
  const conn = document.getElementById('quick-conn').value;
  const owner = document.getElementById('quick-owner').value;
  const repo = document.getElementById('quick-repo').value;
  if (!conn || !owner || !repo) { toast('Fill in connection, owner, and repo first', 'error'); return; }
  const container = document.getElementById('quick-runs-container');
  const list = document.getElementById('quick-runs-list');
  container.style.display = 'block';
  list.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div>';
  try {
    const res = await fetch(`${API}/pipelines/runs?connection=${encodeURIComponent(conn)}&owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}&limit=10`);
    const data = await res.json();
    if (!res.ok) { list.innerHTML = `<div class="empty-state"><p>${esc(data.error)}</p></div>`; return; }
    const runs = data.runs || [];
    if (runs.length === 0) { list.innerHTML = '<div class="empty-state"><p>No recent runs</p></div>'; return; }
    list.innerHTML = runs.map(r => {
      const status = (r.Status || '').toLowerCase();
      return `
        <div class="run-card" style="cursor:pointer" onclick="document.getElementById('quick-run-id').value='${esc(r.ID)}';document.getElementById('quick-runs-container').style.display='none';toast('Run ${esc(r.ID)} selected','info')">
          <div class="run-status ${status}"></div>
          <div class="run-info">
            <div class="run-title">#${esc(r.ID)}</div>
            <div class="run-meta"><span>${status}</span>${r.Branch ? `<span>${esc(r.Branch)}</span>` : ''}</div>
          </div>
        </div>`;
    }).join('');
  } catch (e) { list.innerHTML = '<div class="empty-state"><p>Failed to fetch runs</p></div>'; }
}

async function runQuickScan(e) {
  e.preventDefault();
  const btn = document.getElementById('quick-submit-btn');
  btn.disabled = true;
  btn.textContent = 'Scanning...';
  const body = {
    connection_name: document.getElementById('quick-conn').value,
    owner: document.getElementById('quick-owner').value,
    repo: document.getElementById('quick-repo').value,
    run_id: document.getElementById('quick-run-id').value,
  };
  try {
    const res = await fetch(API + '/analysis/quick', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) { toast(data.error || 'Scan failed', 'error'); return; }
    const count = data.findings ? data.findings.length : 0;
    toast(`Quick scan complete: ${count} findings, risk score ${data.risk_score}/100`, 'success');
    closeModal('quick-scan-modal');
    document.getElementById('quick-scan-form').reset();
    loadFindingStats();
    loadOverview();
    document.querySelector('[data-tab="findings"]').click();
  } catch (err) {
    toast('Network error', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Run Quick Scan';
  }
}

// ===== Export =====
function exportFindings(format) {
  const url = API + '/analysis/findings/export?format=' + format;
  window.open(url, '_blank');
  toast('Export started', 'info');
}

// ===== Onboarding =====
async function checkOnboarding() {
  try {
    const res = await fetch(API + '/connections');
    const data = await res.json();
    const conns = data.connections || [];
    if (conns.length === 0 && !sessionStorage.getItem('onboarding_dismissed')) {
      document.getElementById('onboarding-overlay').classList.remove('hidden');
    }
  } catch (e) { /* ignore */ }
}

function onboardingAddPlatform(platform) {
  dismissOnboarding();
  if (platform === 'github') {
    startGitHubAppInstall();
    return;
  }
  showAddModal();
  document.getElementById('conn-platform').value = platform;
  togglePlatformFields();
}

function dismissOnboarding() {
  document.getElementById('onboarding-overlay').classList.add('hidden');
  sessionStorage.setItem('onboarding_dismissed', '1');
}

// ===== Form Validation =====
function validateConnectionForm() {
  const platform = document.getElementById('conn-platform').value;
  const editMode = document.getElementById('edit-mode').value;
  let valid = true;

  // Clear previous errors
  document.querySelectorAll('.field-error').forEach(e => e.classList.remove('visible'));
  document.querySelectorAll('.form-group input.invalid').forEach(e => e.classList.remove('invalid'));

  const name = document.getElementById('conn-name').value.trim();
  if (!name) {
    valid = false;
    toast('Connection name is required', 'error');
  }

  if (platform === 'github') {
    const token = document.getElementById('gh-token').value;
    if (!token && !editMode) {
      document.getElementById('gh-token').classList.add('invalid');
      document.getElementById('gh-token-error').classList.add('visible');
      valid = false;
    }
  } else if (platform === 'gitlab') {
    const token = document.getElementById('gl-token').value;
    if (!token && !editMode) {
      document.getElementById('gl-token').classList.add('invalid');
      document.getElementById('gl-token-error').classList.add('visible');
      valid = false;
    }
  } else if (platform === 'bitbucket') {
    const user = document.getElementById('bb-username').value;
    const pass = document.getElementById('bb-app-password').value;
    if (!user && !editMode) {
      document.getElementById('bb-username').classList.add('invalid');
      document.getElementById('bb-username-error').classList.add('visible');
      valid = false;
    }
    if (!pass && !editMode) {
      document.getElementById('bb-app-password').classList.add('invalid');
      document.getElementById('bb-password-error').classList.add('visible');
      valid = false;
    }
  } else if (platform === 'jenkins') {
    const token = document.getElementById('jenkins-token').value;
    if (!token && !editMode) {
      document.getElementById('jenkins-token').classList.add('invalid');
      document.getElementById('jenkins-token-error').classList.add('visible');
      valid = false;
    }
  } else if (platform === 'azure_devops') {
    const token = document.getElementById('azure-token').value;
    if (!token && !editMode) {
      document.getElementById('azure-token').classList.add('invalid');
      document.getElementById('azure-token-error').classList.add('visible');
      valid = false;
    }
  } else if (platform === 'circleci') {
    const token = document.getElementById('circleci-token').value;
    if (!token && !editMode) {
      document.getElementById('circleci-token').classList.add('invalid');
      document.getElementById('circleci-token-error').classList.add('visible');
      valid = false;
    }
  }
  return valid;
}

// ===== Panel 1: Scan Scheduling =====
let expandedConnections = new Set();

function toggleSchedulePanel(name) {
  const panel = document.getElementById('schedule-panel-' + CSS.escape(name));
  if (!panel) return;
  const isOpen = panel.style.display !== 'none';
  if (isOpen) {
    panel.style.display = 'none';
    expandedConnections.delete(name);
  } else {
    panel.style.display = 'block';
    expandedConnections.add(name);
    loadSchedule(name);
  }
}

async function loadSchedule(name) {
  const panel = document.getElementById('schedule-panel-' + CSS.escape(name));
  if (!panel) return;
  try {
    const res = await fetch(`${API}/connections/${encodeURIComponent(name)}/schedule`);
    if (res.ok) {
      const data = await res.json();
      const cronInput = panel.querySelector('.sched-cron');
      const enabledChk = panel.querySelector('.sched-enabled');
      const notifySelect = panel.querySelector('.sched-notify');
      if (cronInput) cronInput.value = data.cron_expr || '';
      if (enabledChk) enabledChk.checked = !!data.enabled;
      if (notifySelect) notifySelect.value = data.notify_on || 'findings_only';
    }
  } catch (e) { /* no schedule yet */ }
}

async function saveSchedule(name) {
  const panel = document.getElementById('schedule-panel-' + CSS.escape(name));
  if (!panel) return;
  const cron_expr = panel.querySelector('.sched-cron').value.trim();
  const enabled = panel.querySelector('.sched-enabled').checked;
  const notify_on = panel.querySelector('.sched-notify').value;
  if (!cron_expr) { toast('Cron expression is required', 'error'); return; }
  try {
    const res = await fetch(`${API}/connections/${encodeURIComponent(name)}/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cron_expr, enabled, notify_on }),
    });
    if (!res.ok) { const d = await res.json(); toast(d.error || 'Failed to save schedule', 'error'); return; }
    toast('Schedule saved', 'success');
  } catch (e) { toast('Network error', 'error'); }
}

async function removeSchedule(name) {
  if (!confirm(`Remove schedule for "${name}"?`)) return;
  try {
    const res = await fetch(`${API}/connections/${encodeURIComponent(name)}/schedule`, { method: 'DELETE' });
    if (!res.ok) { toast('Failed to remove schedule', 'error'); return; }
    const panel = document.getElementById('schedule-panel-' + CSS.escape(name));
    if (panel) {
      panel.querySelector('.sched-cron').value = '';
      panel.querySelector('.sched-enabled').checked = false;
      panel.querySelector('.sched-notify').value = 'findings_only';
    }
    toast('Schedule removed', 'success');
  } catch (e) { toast('Network error', 'error'); }
}

function renderSchedulePanel(name) {
  const isOpen = expandedConnections.has(name);
  return `
    <div class="schedule-panel" id="schedule-panel-${esc(name)}" style="display:${isOpen ? 'block' : 'none'}">
      <div class="schedule-panel-inner">
        <h4 style="font-size:12px;text-transform:uppercase;letter-spacing:0.5px;color:var(--muted);margin-bottom:10px">Scan Schedule</h4>
        <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap">
          <div class="form-group" style="margin:0;flex:1;min-width:180px">
            <label style="font-size:11px">Cron Expression</label>
            <input type="text" class="sched-cron" placeholder="0 */6 * * *" style="font-family:monospace;font-size:12px">
          </div>
          <div class="form-group" style="margin:0">
            <label style="font-size:11px">Notify On</label>
            <select class="sched-notify" style="font-size:12px">
              <option value="findings_only">Findings Only</option>
              <option value="all">All Runs</option>
            </select>
          </div>
          <div style="display:flex;align-items:center;gap:6px;padding-bottom:4px">
            <input type="checkbox" class="sched-enabled" id="sched-enabled-${esc(name)}">
            <label for="sched-enabled-${esc(name)}" style="font-size:12px;cursor:pointer">Enabled</label>
          </div>
          <div style="display:flex;gap:6px;padding-bottom:2px">
            <button class="btn btn-primary btn-sm" onclick="saveSchedule('${esc(name)}')">Save Schedule</button>
            <button class="btn btn-outline btn-sm" onclick="removeSchedule('${esc(name)}')">Remove</button>
          </div>
        </div>
      </div>
    </div>`;
}

// ===== Panel 2: Finding Suppression =====
let suppressFormOpen = {};

function toggleSuppressForm(id) {
  const form = document.getElementById('suppress-form-' + id);
  if (!form) return;
  const isOpen = form.style.display !== 'none';
  form.style.display = isOpen ? 'none' : 'block';
}

async function suppressFinding(id) {
  const form = document.getElementById('suppress-form-' + id);
  if (!form) return;
  const reason = form.querySelector('.suppress-reason').value;
  const note = form.querySelector('.suppress-note').value.trim();
  try {
    const res = await fetch(`${API}/findings/${id}/suppress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason, note }),
    });
    if (!res.ok) { const d = await res.json(); toast(d.error || 'Failed to suppress finding', 'error'); return; }
    toast('Finding suppressed', 'success');
    loadFindings();
    loadFindingStats();
  } catch (e) { toast('Network error', 'error'); }
}

async function reopenFinding(id) {
  try {
    const res = await fetch(`${API}/findings/${id}/reopen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) { const d = await res.json(); toast(d.error || 'Failed to reopen finding', 'error'); return; }
    toast('Finding reopened', 'success');
    loadFindings();
    loadFindingStats();
  } catch (e) { toast('Network error', 'error'); }
}

function renderSuppressionActions(f) {
  if (f.status === 'suppressed') {
    return `
      <div style="display:flex;align-items:center;gap:8px">
        <span class="status-badge suppressed" style="opacity:0.7">Suppressed</span>
        <button class="btn btn-outline btn-sm" onclick="reopenFinding(${f.id})">Reopen</button>
      </div>`;
  }
  return `
    <button class="btn btn-outline btn-sm" onclick="toggleSuppressForm(${f.id})">Suppress</button>
    <div class="suppress-form" id="suppress-form-${f.id}" style="display:none">
      <div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;margin-top:8px;padding:10px;background:var(--surface-2);border-radius:var(--radius)">
        <div class="form-group" style="margin:0;flex:1;min-width:140px">
          <label style="font-size:11px">Reason</label>
          <select class="suppress-reason" style="font-size:12px">
            <option value="false_positive">False Positive</option>
            <option value="accepted_risk">Accepted Risk</option>
            <option value="wont_fix">Won't Fix</option>
          </select>
        </div>
        <div class="form-group" style="margin:0;flex:2;min-width:180px">
          <label style="font-size:11px">Note (optional)</label>
          <textarea class="suppress-note" rows="2" placeholder="Add context..." style="font-size:12px;resize:vertical"></textarea>
        </div>
        <div style="padding-bottom:2px;display:flex;gap:6px">
          <button class="btn btn-warning btn-sm" onclick="suppressFinding(${f.id})">Confirm Suppress</button>
          <button class="btn btn-ghost btn-sm" onclick="toggleSuppressForm(${f.id})">Cancel</button>
        </div>
      </div>
    </div>`;
}

// ===== Panel 3: Integrations Tab =====
async function loadIntegrations() {
  renderInboundWebhooks();
  await loadApiKeys();
}

function renderInboundWebhooks() {
  const el = document.getElementById('integrations-webhooks');
  if (!el) return;
  const base = 'https://app.pipewarden.dev/api/v1/webhooks';
  const webhooks = [
    {
      name: 'GitHub',
      url: `${base}/github`,
      instructions: 'Go to your GitHub repo → Settings → Webhooks → Add webhook. Set Content type to <strong>application/json</strong>. Select events: <strong>push</strong> and <strong>pull_request</strong>.',
    },
    {
      name: 'GitLab',
      url: `${base}/gitlab`,
      instructions: 'Go to your GitLab project → Settings → Webhooks. Add the URL above. Select triggers: <strong>Push events</strong> and <strong>Merge request events</strong>.',
    },
  ];
  el.innerHTML = webhooks.map(w => `
    <div class="integrations-webhook-card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <strong style="font-size:14px">${w.name} Webhook</strong>
      </div>
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
        <code style="flex:1;background:var(--bg);padding:6px 10px;border-radius:var(--radius);font-size:12px;color:var(--accent);overflow:auto;white-space:nowrap">${w.url}</code>
        <button class="btn btn-outline btn-sm" onclick="copyToClipboard('${w.url}')">Copy</button>
      </div>
      <p style="font-size:12px;color:var(--muted);line-height:1.5">${w.instructions}</p>
    </div>
  `).join('');
}

async function loadApiKeys() {
  const el = document.getElementById('integrations-apikeys');
  if (!el) return;
  try {
    const res = await fetch(API + '/connections');
    const data = await res.json();
    const conns = data.connections || [];
    if (conns.length === 0) {
      el.innerHTML = '<div class="empty-state"><p>No connections yet. Add a connection first.</p></div>';
      return;
    }
    el.innerHTML = conns.map(c => `
      <div class="apikey-row">
        <div style="display:flex;align-items:center;gap:10px;flex:1">
          <div class="conn-icon ${c.platform}" style="width:28px;height:28px;font-size:9px;border-radius:6px">${platformIcon(c.platform)}</div>
          <div>
            <div style="font-weight:600;font-size:13px">${esc(c.name)}</div>
            <div style="font-size:11px;color:var(--muted)">${c.platform}</div>
          </div>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-outline btn-sm" onclick="generateApiKey('${esc(c.name)}')">Generate API Key</button>
          <button class="btn btn-danger btn-sm" onclick="revokeApiKey('${esc(c.name)}')">Revoke</button>
        </div>
      </div>
    `).join('');
  } catch (e) {
    el.innerHTML = '<div class="empty-state"><p>Failed to load connections</p></div>';
  }
}

function platformIcon(platform) {
  if (platform === 'github') return 'GH';
  if (platform === 'gitlab') return 'GL';
  if (platform === 'bitbucket') return 'BB';
  if (platform === 'jenkins') return 'J';
  if (platform === 'azure_devops') return 'AZ';
  if (platform === 'circleci') return 'CI';
  return '?';
}

async function generateApiKey(name) {
  try {
    const res = await fetch(`${API}/connections/${encodeURIComponent(name)}/apikey`, { method: 'POST' });
    if (!res.ok) { const d = await res.json(); toast(d.error || 'Failed to generate API key', 'error'); return; }
    const data = await res.json();
    showApiKeyModal(name, data.api_key || data.key || '');
  } catch (e) { toast('Network error', 'error'); }
}

function showApiKeyModal(name, key) {
  const modal = document.getElementById('apikey-modal');
  document.getElementById('apikey-modal-name').textContent = name;
  document.getElementById('apikey-modal-key').textContent = key;
  modal.classList.remove('hidden');
}

async function revokeApiKey(name) {
  if (!confirm(`Revoke API key for "${name}"?`)) return;
  try {
    const res = await fetch(`${API}/connections/${encodeURIComponent(name)}/apikey`, { method: 'DELETE' });
    if (!res.ok) { const d = await res.json(); toast(d.error || 'Failed to revoke API key', 'error'); return; }
    toast('API key revoked', 'success');
  } catch (e) { toast('Network error', 'error'); }
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    toast('Copied to clipboard', 'success');
  }).catch(() => {
    toast('Copy failed — select and copy manually', 'error');
  });
}

// ===== Improved Connection Testing =====
function renderTroubleshoot(platform, errorMsg) {
  const msg = (errorMsg || '').toLowerCase();
  let tips = [];

  if (msg.includes('401') || msg.includes('unauthorized') || msg.includes('bad credentials')) {
    tips.push('Your token or credentials are invalid or expired');
    if (platform === 'github') {
      tips.push('Ensure your token has <strong>repo</strong> and <strong>workflow</strong> scopes');
      tips.push('Check if the token has been revoked in GitHub Settings > Developer Settings > Personal Access Tokens');
    } else if (platform === 'gitlab') {
      tips.push('Ensure your token has the <strong>api</strong> scope and has not expired');
      tips.push('Check token expiry in GitLab > User Settings > Access Tokens');
    } else {
      tips.push('Verify your username and app password are correct');
      tips.push('Ensure the app password has <strong>Pipelines: Read</strong> permission');
    }
  } else if (msg.includes('403') || msg.includes('forbidden')) {
    tips.push('Your token lacks required permissions');
    if (platform === 'github') tips.push('The token needs <strong>repo</strong> scope for private repos');
    if (platform === 'gitlab') tips.push('You may need project-level access, not just a valid token');
    if (platform === 'bitbucket') tips.push('Add <strong>Pipelines: Read</strong> permission to your app password');
  } else if (msg.includes('404') || msg.includes('not found')) {
    tips.push('The API endpoint was not found. Check your Base URL setting');
    if (platform === 'github') tips.push('For GitHub Enterprise, use https://YOUR-HOST/api/v3');
    if (platform === 'gitlab') tips.push('For self-hosted GitLab, use https://YOUR-HOST/api/v4');
  } else if (msg.includes('timeout') || msg.includes('deadline') || msg.includes('context')) {
    tips.push('The connection timed out. Check your network and the server URL');
    tips.push('If using a self-hosted instance, ensure it is reachable from this server');
  } else if (msg.includes('dns') || msg.includes('no such host') || msg.includes('dial')) {
    tips.push('Cannot reach the server. Check the Base URL for typos');
    tips.push('Ensure the server is accessible from the network where PipeWarden runs');
  } else {
    tips.push('Check that your credentials are correct and not expired');
    tips.push('Verify your Base URL is correct (leave empty for cloud-hosted platforms)');
    tips.push('Ensure the platform is accessible from this network');
  }

  return `<div class="troubleshoot-panel">
    <h4>Troubleshooting</h4>
    <ul>${tips.map(t => `<li>${t}</li>`).join('')}</ul>
  </div>`;
}

// ===== Tab: Analytics =====
let analyticsData = { trends: null, top: null };

async function loadAnalytics() {
  const summaryEl = document.getElementById('analytics-summary');
  const chartEl = document.getElementById('analytics-trend-chart');
  const topEl = document.getElementById('analytics-top-findings');
  if (!summaryEl) return;

  summaryEl.innerHTML = '<div style="font-size:12px;color:var(--muted);padding:8px">Loading...</div>';
  chartEl.innerHTML = '';
  topEl.innerHTML = '';

  try {
    const [trendsRes, topRes] = await Promise.all([
      fetch(API + '/analytics/trends?days=30'),
      fetch(API + '/analytics/top-findings?limit=8'),
    ]);
    const trends = trendsRes.ok ? await trendsRes.json() : null;
    const top = topRes.ok ? await topRes.json() : null;
    analyticsData = { trends, top };
    renderAnalyticsSummary(trends);
    renderAnalyticsTrendChart(trends);
    renderAnalyticsTopFindings(top);
  } catch (e) {
    summaryEl.innerHTML = '<div class="empty-state"><p>Failed to load analytics data.</p></div>';
  }
}

function renderAnalyticsSummary(data) {
  const el = document.getElementById('analytics-summary');
  if (!el) return;
  if (!data) {
    el.innerHTML = '<div style="font-size:12px;color:var(--muted);padding:8px">No analytics data available.</div>';
    return;
  }
  const total = data.total_findings || 0;
  const open = data.open_findings || 0;
  const suppressed = data.suppressed_findings || 0;
  const riskScore = data.risk_score || 0;
  const trendDir = data.trend || 'stable';
  const trendIcon = trendDir === 'up' ? '↑' : trendDir === 'down' ? '↓' : '→';
  const trendColor = trendDir === 'up' ? 'var(--red)' : trendDir === 'down' ? 'var(--green)' : 'var(--muted)';
  el.innerHTML = `
    <div class="stat-card"><div class="value">${total}</div><div class="label">Total Findings</div></div>
    <div class="stat-card"><div class="value red">${open}</div><div class="label">Open</div></div>
    <div class="stat-card"><div class="value" style="color:var(--muted)">${suppressed}</div><div class="label">Suppressed</div></div>
    <div class="stat-card"><div class="value ${riskScore >= 70 ? 'red' : riskScore >= 40 ? 'orange' : 'green'}">${riskScore}</div><div class="label">Risk Score</div></div>
    <div class="stat-card"><div class="value" style="color:${trendColor};font-size:28px">${trendIcon}</div><div class="label">Trend (30d)</div></div>
  `;
}

function renderAnalyticsTrendChart(data) {
  const el = document.getElementById('analytics-trend-chart');
  if (!el) return;
  const days = (data && data.days) || [];
  if (days.length === 0) {
    el.innerHTML = '<div class="empty-state"><p>No trend data available for the last 30 days.</p></div>';
    return;
  }

  const W = 600, H = 200;
  const PAD = { top: 16, right: 16, bottom: 32, left: 36 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const severities = [
    { key: 'critical', color: '#ff453a' },
    { key: 'high',     color: '#ff9f0a' },
    { key: 'medium',   color: '#ffd60a' },
    { key: 'low',      color: '#30d158' },
  ];

  const allCounts = days.flatMap(d => severities.map(s => (d[s.key] || 0)));
  const maxVal = Math.max(...allCounts, 1);
  const xStep = days.length > 1 ? chartW / (days.length - 1) : 0;
  const yScale = v => chartH - (v / maxVal) * chartH;

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map(f => {
    const y = PAD.top + chartH * (1 - f);
    return `<line x1="${PAD.left}" y1="${y}" x2="${W - PAD.right}" y2="${y}" stroke="#333" stroke-width="1"/>
            <text x="${PAD.left - 4}" y="${y + 4}" fill="#666" font-size="9" text-anchor="end">${Math.round(f * maxVal)}</text>`;
  }).join('');

  const xLabels = days.filter((_, i) => i % 5 === 0 || i === days.length - 1).map(d => {
    const origIdx = days.indexOf(d);
    const x = PAD.left + origIdx * xStep;
    return `<text x="${x}" y="${H - 4}" fill="#666" font-size="9" text-anchor="middle">${d.date ? d.date.slice(5) : ''}</text>`;
  }).join('');

  const lines = severities.map(s => {
    const pts = days.map((d, i) => `${PAD.left + i * xStep},${PAD.top + yScale(d[s.key] || 0)}`).join(' ');
    return `<polyline points="${pts}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round"/>`;
  }).join('');

  const legend = severities.map((s, i) =>
    `<rect x="${PAD.left + i * 90}" y="${H + 2}" width="10" height="10" fill="${s.color}"/>
     <text x="${PAD.left + i * 90 + 13}" y="${H + 11}" fill="#aaa" font-size="10">${s.key}</text>`
  ).join('');

  el.innerHTML = `<svg viewBox="0 0 ${W} ${H + 16}" width="100%" style="max-width:${W}px;display:block;background:var(--bg-elevated);border-radius:var(--r-md)">
    ${gridLines}${xLabels}${lines}${legend}
  </svg>`;
}

function renderAnalyticsTopFindings(data) {
  const el = document.getElementById('analytics-top-findings');
  if (!el) return;
  const items = (data && data.categories) || [];
  if (items.length === 0) {
    el.innerHTML = '<div class="empty-state"><p>No category data available.</p></div>';
    return;
  }
  const maxCount = Math.max(...items.map(i => i.count || 0), 1);
  el.innerHTML = items.map(item => {
    const pct = Math.round(((item.count || 0) / maxCount) * 100);
    const sevColor = item.top_severity === 'critical' ? 'var(--red)' :
                     item.top_severity === 'high' ? 'var(--orange)' :
                     item.top_severity === 'medium' ? 'var(--yellow)' : 'var(--green)';
    return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
      <div style="width:140px;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${esc(item.category)}">${esc(item.category)}</div>
      <div style="flex:1;height:18px;background:var(--surface-2);border-radius:3px;overflow:hidden">
        <div style="height:100%;width:${pct}%;background:${sevColor};border-radius:3px"></div>
      </div>
      <div style="width:40px;font-size:12px;color:var(--muted);text-align:right">${item.count || 0}</div>
    </div>`;
  }).join('');
}

// ===== Tab: Policies =====
let customPolicies = [];

async function loadPolicies() {
  await Promise.all([loadBuiltinPolicies(), loadCustomPolicies()]);
}

async function loadBuiltinPolicies() {
  const el = document.getElementById('builtin-policies-table');
  if (!el) return;
  try {
    const res = await fetch(API + '/policies');
    if (!res.ok) throw new Error('not ok');
    const data = await res.json();
    const policies = data.policies || [];
    if (policies.length === 0) {
      el.innerHTML = '<div class="empty-state"><p>No policies found.</p></div>';
      return;
    }
    el.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="border-bottom:1px solid var(--border)">
        <th style="text-align:left;padding:8px 10px;color:var(--muted);font-weight:600;font-size:11px;text-transform:uppercase">ID</th>
        <th style="text-align:left;padding:8px 10px;color:var(--muted);font-weight:600;font-size:11px;text-transform:uppercase">Name</th>
        <th style="text-align:left;padding:8px 10px;color:var(--muted);font-weight:600;font-size:11px;text-transform:uppercase">Severity</th>
        <th style="text-align:left;padding:8px 10px;color:var(--muted);font-weight:600;font-size:11px;text-transform:uppercase">Status</th>
      </tr></thead>
      <tbody>${policies.map(p => `
        <tr style="border-bottom:1px solid var(--border)">
          <td style="padding:8px 10px;font-family:monospace;font-size:11px;color:var(--accent)">${esc(p.id)}</td>
          <td style="padding:8px 10px">${esc(p.name)}</td>
          <td style="padding:8px 10px"><span class="severity-badge ${p.severity || 'medium'}">${esc(p.severity || 'medium')}</span></td>
          <td style="padding:8px 10px"><span style="background:${p.enabled !== false ? 'rgba(48,209,88,0.15)' : 'var(--surface-2)'};color:${p.enabled !== false ? 'var(--green)' : 'var(--muted)'};padding:2px 8px;border-radius:10px;font-size:11px">${p.enabled !== false ? 'Enabled' : 'Disabled'}</span></td>
        </tr>`).join('')}
      </tbody>
    </table>`;
  } catch (e) {
    el.innerHTML = '<div class="empty-state"><p>Failed to load policies. The API endpoint may not be available yet.</p></div>';
  }
}

async function loadCustomPolicies() {
  const el = document.getElementById('custom-policies-list');
  if (!el) return;
  try {
    const res = await fetch(API + '/policies/custom');
    if (!res.ok) throw new Error('not ok');
    const data = await res.json();
    customPolicies = data.policies || [];
  } catch (e) {
    customPolicies = [];
  }
  renderCustomPolicies();
}

function renderCustomPolicies() {
  const el = document.getElementById('custom-policies-list');
  if (!el) return;
  if (customPolicies.length === 0) {
    el.innerHTML = '<div style="font-size:13px;color:var(--muted);padding:8px 0">No custom policies yet. Click "+ Add Policy" to create one.</div>';
    return;
  }
  el.innerHTML = customPolicies.map(p => `
    <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)">
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600">${esc(p.name)}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px">${esc(p.id)} &middot; ${esc(p.description || '')}</div>
      </div>
      <span class="severity-badge ${p.severity || 'medium'}">${esc(p.severity || 'medium')}</span>
      <button class="btn btn-outline btn-sm" onclick="editCustomPolicy('${esc(p.id)}')">Edit</button>
      <button class="btn btn-outline btn-sm" onclick="openPolicyTestModal('${esc(p.id)}','${esc(p.name)}')">Test</button>
      <button class="btn btn-danger btn-sm" onclick="deleteCustomPolicy('${esc(p.id)}')">Delete</button>
    </div>`).join('');
}

function showAddPolicyForm() {
  document.getElementById('policy-form-title').textContent = 'New Custom Policy';
  document.getElementById('policy-edit-id').value = '';
  document.getElementById('policy-id').value = '';
  document.getElementById('policy-id').disabled = false;
  document.getElementById('policy-name').value = '';
  document.getElementById('policy-desc').value = '';
  document.getElementById('policy-pattern').value = '';
  document.getElementById('policy-severity').value = 'high';
  document.getElementById('policy-message').value = '';
  document.getElementById('add-policy-form').style.display = 'block';
}

function hideAddPolicyForm() {
  document.getElementById('add-policy-form').style.display = 'none';
}

function editCustomPolicy(id) {
  const p = customPolicies.find(x => x.id === id);
  if (!p) return;
  document.getElementById('policy-form-title').textContent = 'Edit Custom Policy';
  document.getElementById('policy-edit-id').value = p.id;
  document.getElementById('policy-id').value = p.id;
  document.getElementById('policy-id').disabled = true;
  document.getElementById('policy-name').value = p.name || '';
  document.getElementById('policy-desc').value = p.description || '';
  document.getElementById('policy-pattern').value = p.pattern || '';
  document.getElementById('policy-severity').value = p.severity || 'high';
  document.getElementById('policy-message').value = p.message || '';
  document.getElementById('add-policy-form').style.display = 'block';
}

async function saveCustomPolicy() {
  const editId = document.getElementById('policy-edit-id').value;
  const body = {
    id: document.getElementById('policy-id').value.trim(),
    name: document.getElementById('policy-name').value.trim(),
    description: document.getElementById('policy-desc').value.trim(),
    pattern: document.getElementById('policy-pattern').value.trim(),
    severity: document.getElementById('policy-severity').value,
    message: document.getElementById('policy-message').value.trim(),
  };
  if (!body.id || !body.name || !body.pattern) {
    toast('ID, Name, and Pattern are required', 'error');
    return;
  }
  try {
    const method = editId ? 'PUT' : 'POST';
    const url = editId
      ? `${API}/policies/custom/${encodeURIComponent(editId)}`
      : `${API}/policies/custom`;
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) { const d = await res.json(); toast(d.error || 'Failed to save policy', 'error'); return; }
    toast(editId ? 'Policy updated' : 'Policy created', 'success');
    hideAddPolicyForm();
    loadCustomPolicies();
  } catch (e) { toast('Network error', 'error'); }
}

async function deleteCustomPolicy(id) {
  if (!confirm(`Delete custom policy "${id}"?`)) return;
  try {
    const res = await fetch(`${API}/policies/custom/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!res.ok) { toast('Failed to delete policy', 'error'); return; }
    toast('Policy deleted', 'success');
    loadCustomPolicies();
  } catch (e) { toast('Network error', 'error'); }
}

function openPolicyTestModal(id, name) {
  document.getElementById('policy-test-id').value = id;
  document.getElementById('policy-test-name').textContent = name;
  document.getElementById('policy-test-yaml').value = '';
  document.getElementById('policy-test-result').style.display = 'none';
  document.getElementById('policy-test-modal').classList.remove('hidden');
}

async function runPolicyTest() {
  const id = document.getElementById('policy-test-id').value;
  const content = document.getElementById('policy-test-yaml').value.trim();
  const resultEl = document.getElementById('policy-test-result');
  if (!content) { toast('Paste some content to test against', 'error'); return; }
  try {
    const res = await fetch(`${API}/policies/${encodeURIComponent(id)}/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    const data = await res.json();
    resultEl.style.display = 'block';
    if (!res.ok) {
      resultEl.style.background = 'rgba(255,69,58,0.1)';
      resultEl.style.border = '1px solid var(--red)';
      resultEl.innerHTML = `<strong style="color:var(--red)">Error:</strong> ${esc(data.error || 'Test failed')}`;
      return;
    }
    const matched = data.matched || false;
    const matches = data.matches || [];
    if (matched) {
      resultEl.style.background = 'rgba(255,69,58,0.1)';
      resultEl.style.border = '1px solid var(--red)';
      resultEl.innerHTML = `<strong style="color:var(--red)">Policy Triggered</strong> — ${matches.length} match(es)<br>
        ${matches.map(m => `<div style="font-family:monospace;font-size:11px;margin-top:4px;color:var(--orange)">${esc(m)}</div>`).join('')}`;
    } else {
      resultEl.style.background = 'rgba(48,209,88,0.1)';
      resultEl.style.border = '1px solid var(--green)';
      resultEl.innerHTML = '<strong style="color:var(--green)">No Match</strong> — Content passed this policy check.';
    }
  } catch (e) { toast('Network error', 'error'); }
}

// ===== Tab: Secrets =====
let allSecrets = [];
let secretFilter = 'all';

async function loadSecrets() {
  const summaryEl = document.getElementById('secrets-summary-bar');
  const tableEl = document.getElementById('secrets-table-wrap');
  if (!summaryEl) return;
  summaryEl.innerHTML = '<div style="font-size:12px;color:var(--muted)">Loading...</div>';
  tableEl.innerHTML = '';

  try {
    const [summaryRes, secretsRes] = await Promise.all([
      fetch(API + '/secrets/summary'),
      fetch(API + '/secrets'),
    ]);
    const summary = summaryRes.ok ? await summaryRes.json() : null;
    const secretsData = secretsRes.ok ? await secretsRes.json() : null;
    allSecrets = (secretsData && secretsData.secrets) || [];
    renderSecretsSummary(summary);
    renderSecretsTable(allSecrets);
  } catch (e) {
    summaryEl.innerHTML = '';
    tableEl.innerHTML = '<div class="empty-state"><p>Failed to load secrets data.</p></div>';
  }
}

function renderSecretsSummary(data) {
  const el = document.getElementById('secrets-summary-bar');
  if (!el) return;
  if (!data) { el.innerHTML = ''; return; }
  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;padding:10px 16px;background:rgba(255,69,58,0.1);border:1px solid var(--red);border-radius:var(--radius)">
      <span style="color:var(--red);font-size:20px;font-weight:700">${data.active || 0}</span>
      <span style="color:var(--red);font-size:13px">Active</span>
    </div>
    <div style="display:flex;align-items:center;gap:8px;padding:10px 16px;background:rgba(48,209,88,0.1);border:1px solid var(--green);border-radius:var(--radius)">
      <span style="color:var(--green);font-size:20px;font-weight:700">${data.revoked || 0}</span>
      <span style="color:var(--green);font-size:13px">Revoked</span>
    </div>
    <div style="display:flex;align-items:center;gap:8px;padding:10px 16px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius)">
      <span style="color:var(--muted);font-size:20px;font-weight:700">${data.expired || 0}</span>
      <span style="color:var(--muted);font-size:13px">Expired</span>
    </div>
  `;
}

function filterSecrets(f) {
  secretFilter = f;
  document.querySelectorAll('[data-secret-filter]').forEach(el => {
    el.classList.toggle('active', el.dataset.secretFilter === f);
  });
  renderSecretsTable(allSecrets);
}

function renderSecretsTable(secrets) {
  const el = document.getElementById('secrets-table-wrap');
  if (!el) return;
  let filtered = secrets;
  if (secretFilter !== 'all') {
    filtered = secrets.filter(s => (s.status || '').toLowerCase() === secretFilter);
  }
  if (filtered.length === 0) {
    el.innerHTML = '<div class="empty-state"><h3>No secrets found</h3><p>Run a DLP scan to detect exposed secrets in your pipelines.</p></div>';
    return;
  }
  el.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:12px">
    <thead><tr style="border-bottom:1px solid var(--border)">
      <th style="text-align:left;padding:8px 10px;color:var(--muted);font-size:11px;text-transform:uppercase;font-weight:600">Finding ID</th>
      <th style="text-align:left;padding:8px 10px;color:var(--muted);font-size:11px;text-transform:uppercase;font-weight:600">Pattern</th>
      <th style="text-align:left;padding:8px 10px;color:var(--muted);font-size:11px;text-transform:uppercase;font-weight:600">Redacted Value</th>
      <th style="text-align:left;padding:8px 10px;color:var(--muted);font-size:11px;text-transform:uppercase;font-weight:600">Status</th>
      <th style="text-align:left;padding:8px 10px;color:var(--muted);font-size:11px;text-transform:uppercase;font-weight:600">First Seen</th>
      <th style="text-align:left;padding:8px 10px;color:var(--muted);font-size:11px;text-transform:uppercase;font-weight:600">Last Seen</th>
      <th style="text-align:left;padding:8px 10px;color:var(--muted);font-size:11px;text-transform:uppercase;font-weight:600">Age</th>
      <th style="padding:8px 10px"></th>
    </tr></thead>
    <tbody>${filtered.map(s => {
      const status = (s.status || 'active').toLowerCase();
      const rowBg = status === 'active' ? 'rgba(255,69,58,0.06)' : status === 'revoked' ? 'rgba(48,209,88,0.06)' : '';
      const statusColor = status === 'active' ? 'var(--red)' : status === 'revoked' ? 'var(--green)' : 'var(--muted)';
      const firstSeen = s.first_seen ? new Date(s.first_seen).toLocaleDateString() : '-';
      const lastSeen = s.last_seen ? new Date(s.last_seen).toLocaleDateString() : '-';
      const age = s.first_seen ? daysSince(s.first_seen) + 'd' : '-';
      const id = esc(String(s.id || s.finding_id || '-'));
      return `<tr style="border-bottom:1px solid var(--border);background:${rowBg}">
        <td style="padding:8px 10px;font-family:monospace;font-size:11px">${id}</td>
        <td style="padding:8px 10px">${esc(s.pattern || s.type || '-')}</td>
        <td style="padding:8px 10px;font-family:monospace;font-size:11px;color:var(--orange)">${esc(s.redacted_value || s.value || '***')}</td>
        <td style="padding:8px 10px"><span style="color:${statusColor};font-weight:600">${status}</span></td>
        <td style="padding:8px 10px;color:var(--muted)">${firstSeen}</td>
        <td style="padding:8px 10px;color:var(--muted)">${lastSeen}</td>
        <td style="padding:8px 10px;color:var(--muted)">${age}</td>
        <td style="padding:8px 10px">${status === 'active'
          ? `<button class="btn btn-danger btn-sm" onclick="openRevokeSecretModal('${esc(String(s.id || s.finding_id || ''))}')">Revoke</button>`
          : ''}</td>
      </tr>`;
    }).join('')}
    </tbody>
  </table>`;
}

function openRevokeSecretModal(id) {
  const display = document.getElementById('revoke-secret-id');
  display.textContent = id;
  display.dataset.id = id;
  document.getElementById('revoke-secret-notes').value = '';
  document.getElementById('revoke-secret-modal').classList.remove('hidden');
}

async function confirmRevokeSecret() {
  const id = document.getElementById('revoke-secret-id').dataset.id;
  const notes = document.getElementById('revoke-secret-notes').value.trim();
  try {
    const res = await fetch(`${API}/secrets/${encodeURIComponent(id)}/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    });
    if (!res.ok) { const d = await res.json(); toast(d.error || 'Failed to revoke secret', 'error'); return; }
    toast('Secret revoked', 'success');
    closeModal('revoke-secret-modal');
    loadSecrets();
  } catch (e) { toast('Network error', 'error'); }
}

// ===== Panel: Runtime Scan =====
let runtimePanelOpen = new Set();

function renderRuntimePanel(name) {
  const isOpen = runtimePanelOpen.has(name);
  return `<div class="schedule-panel" id="runtime-panel-${esc(name)}" style="display:${isOpen ? 'block' : 'none'}">
    <div class="schedule-panel-inner">
      <h4 style="font-size:12px;text-transform:uppercase;letter-spacing:0.5px;color:var(--muted);margin-bottom:10px">Runtime Scan — Paste Pipeline Logs</h4>
      <div class="form-group" style="margin-bottom:8px">
        <textarea id="runtime-logs-${esc(name)}" rows="6" placeholder="Paste pipeline execution logs here..." style="width:100%;font-family:monospace;font-size:11px;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:var(--radius);padding:8px;resize:vertical"></textarea>
      </div>
      <div style="display:flex;gap:6px;margin-bottom:10px">
        <button class="btn btn-primary btn-sm" onclick="runRuntimeScan('${esc(name)}')">Analyze Logs</button>
        <button class="btn btn-outline btn-sm" onclick="clearRuntimeScan('${esc(name)}')">Clear</button>
      </div>
      <div id="runtime-results-${esc(name)}"></div>
    </div>
  </div>`;
}

function toggleRuntimePanel(name) {
  const panel = document.getElementById('runtime-panel-' + CSS.escape(name));
  if (!panel) return;
  const isOpen = panel.style.display !== 'none';
  if (isOpen) {
    panel.style.display = 'none';
    runtimePanelOpen.delete(name);
  } else {
    panel.style.display = 'block';
    runtimePanelOpen.add(name);
  }
}

function clearRuntimeScan(name) {
  const logs = document.getElementById('runtime-logs-' + CSS.escape(name));
  const results = document.getElementById('runtime-results-' + CSS.escape(name));
  if (logs) logs.value = '';
  if (results) results.innerHTML = '';
}

async function runRuntimeScan(name) {
  const logsEl = document.getElementById('runtime-logs-' + CSS.escape(name));
  const resultsEl = document.getElementById('runtime-results-' + CSS.escape(name));
  if (!logsEl || !resultsEl) return;
  const logs = logsEl.value.trim();
  if (!logs) { toast('Paste some logs before analyzing', 'error'); return; }
  resultsEl.innerHTML = '<div style="font-size:12px;color:var(--muted);padding:8px">Analyzing...</div>';
  try {
    const res = await fetch(`${API}/connections/${encodeURIComponent(name)}/scan/runtime`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logs }),
    });
    const data = await res.json();
    if (!res.ok) {
      resultsEl.innerHTML = `<div style="color:var(--red);font-size:12px;padding:6px">${esc(data.error || 'Analysis failed')}</div>`;
      return;
    }
    const findings = data.findings || [];
    if (findings.length === 0) {
      resultsEl.innerHTML = '<div style="color:var(--green);font-size:12px;padding:6px">No issues detected in the provided logs.</div>';
      return;
    }
    resultsEl.innerHTML = `<div style="font-size:11px;color:var(--muted);margin-bottom:6px">${findings.length} finding(s) detected</div>
      ${findings.map(f => {
        const sevColor = f.severity === 'critical' ? 'var(--red)' : f.severity === 'high' ? 'var(--orange)' : f.severity === 'medium' ? 'var(--yellow)' : 'var(--green)';
        return `<div style="display:flex;align-items:flex-start;gap:8px;padding:8px;background:var(--surface-2);border-radius:var(--radius);margin-bottom:6px;border-left:3px solid ${sevColor}">
          <span class="severity-badge ${f.severity}" style="flex-shrink:0">${esc(f.severity || '?')}</span>
          <div>
            <div style="font-size:12px;font-weight:600">${esc(f.title || f.description || 'Finding')}</div>
            ${f.line ? `<div style="font-size:11px;color:var(--muted)">Line ${f.line}</div>` : ''}
            ${f.description && f.title ? `<div style="font-size:11px;color:var(--muted);margin-top:2px">${esc(f.description)}</div>` : ''}
          </div>
        </div>`;
      }).join('')}`;
  } catch (e) {
    resultsEl.innerHTML = '<div style="color:var(--red);font-size:12px;padding:6px">Network error during analysis</div>';
  }
}
