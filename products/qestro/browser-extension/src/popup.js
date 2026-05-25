const elements = {
  statusBadge: document.getElementById('statusBadge'),
  pageTitle: document.getElementById('pageTitle'),
  pageUrl: document.getElementById('pageUrl'),
  actionCount: document.getElementById('actionCount'),
  sessionState: document.getElementById('sessionState'),
  toggleRecording: document.getElementById('toggleRecording'),
  openQuestro: document.getElementById('openQuestro'),
  exportRecording: document.getElementById('exportRecording'),
  formatSelect: document.getElementById('formatSelect'),
  actionList: document.getElementById('actionList'),
  message: document.getElementById('message'),
};

let currentTabId = null;
let currentSession = null;

function setMessage(message, isError) {
  elements.message.textContent = message || '';
  elements.message.style.color = isError ? '#fca5a5' : '#9fb2d0';
}

function renderActions(actions) {
  elements.actionList.innerHTML = '';

  if (!actions || actions.length === 0) {
    elements.actionList.innerHTML = '<li class="empty-state">Start a recording to capture steps.</li>';
    return;
  }

  for (const action of actions.slice().reverse()) {
    const item = document.createElement('li');
    item.className = 'action-item';
    item.innerHTML = `
      <div class="action-title">${action.type}</div>
      <div class="action-meta">${action.selector?.primary || 'body'} · ${action.timestamp}ms</div>
    `;
    elements.actionList.appendChild(item);
  }
}

function renderSession(session) {
  currentSession = session;

  const recording = Boolean(session?.recording);
  elements.statusBadge.textContent = recording ? 'Recording' : 'Idle';
  elements.statusBadge.className = `badge ${recording ? 'recording' : 'idle'}`;
  elements.pageTitle.textContent = session?.pageTitle || 'Waiting for an active tab';
  elements.pageUrl.textContent = session?.currentUrl || 'No URL detected';
  elements.actionCount.textContent = String(session?.actionCount || 0);
  elements.sessionState.textContent = recording
    ? 'Active'
    : session?.sessionId
      ? 'Ready to export'
      : 'Not started';
  elements.toggleRecording.textContent = recording ? 'Stop Recording' : 'Start Recording';
  elements.exportRecording.disabled = !session || (session.actionCount || 0) === 0;
  renderActions(session?.actions || []);
}

async function getActiveTabId() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTabId = tab?.id ?? null;
  return currentTabId;
}

function sendMessage(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      resolve(response || { ok: false, error: chrome.runtime.lastError?.message || 'Unknown extension error.' });
    });
  });
}

async function refreshStatus() {
  const tabId = await getActiveTabId();
  const response = await sendMessage({ type: 'questro:get-status', tabId });

  if (!response.ok) {
    setMessage(response.error || 'Unable to read extension status.', true);
    return;
  }

  renderSession(response.session);
}

async function handleToggleRecording() {
  const tabId = await getActiveTabId();
  if (!tabId) {
    setMessage('No active tab is available.', true);
    return;
  }

  const wasRecording = Boolean(currentSession?.recording);
  const response = await sendMessage({
    type: wasRecording ? 'questro:stop-recording' : 'questro:start-recording',
    tabId,
  });

  if (!response.ok) {
    setMessage(response.error || 'The recorder could not access this tab.', true);
    return;
  }

  renderSession(response.session);
  setMessage(wasRecording ? 'Recording stopped.' : 'Recording started.');
}

async function handleExport() {
  const tabId = await getActiveTabId();
  const response = await sendMessage({
    type: 'questro:export-recording',
    tabId,
    format: elements.formatSelect.value,
  });

  if (!response.ok) {
    setMessage(response.error || 'Export failed.', true);
    return;
  }

  setMessage(`Downloaded ${elements.formatSelect.value} export.`);
}

async function handleOpenQuestro() {
  await sendMessage({ type: 'questro:open-questro' });
  setMessage('Opened Questro in a new tab.');
}

elements.toggleRecording.addEventListener('click', handleToggleRecording);
elements.exportRecording.addEventListener('click', handleExport);
elements.openQuestro.addEventListener('click', handleOpenQuestro);

refreshStatus().catch((error) => {
  setMessage(error.message || 'Unable to initialize the Questro popup.', true);
});
