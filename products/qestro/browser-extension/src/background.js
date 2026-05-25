const DEFAULT_APP_URL = 'https://app.qestro.io/recording-studio';
const SESSION_STORAGE_PREFIX = 'questro.session.';
const sessions = new Map();

function createSession(tab) {
  return {
    sessionId: `questro-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tabId: tab.id,
    recording: true,
    startedAt: Date.now(),
    actionCount: 0,
    actions: [],
    currentUrl: tab.url || '',
    pageTitle: tab.title || '',
  };
}

function serializeSession(session) {
  if (!session) {
    return {
      recording: false,
      actionCount: 0,
      currentUrl: '',
      pageTitle: '',
      startedAt: null,
      actions: [],
      sessionId: null,
    };
  }

  return {
    recording: session.recording,
    actionCount: session.actions.length,
    currentUrl: session.currentUrl,
    pageTitle: session.pageTitle,
    startedAt: session.startedAt,
    actions: session.actions.slice(-5),
    sessionId: session.sessionId,
  };
}

function persistSession(session) {
  const key = `${SESSION_STORAGE_PREFIX}${session.tabId}`;
  return chrome.storage.local.set({
    [key]: session,
    'questro.lastSession': session,
  });
}

async function getSessionForTab(tabId) {
  if (sessions.has(tabId)) {
    return sessions.get(tabId);
  }

  const key = `${SESSION_STORAGE_PREFIX}${tabId}`;
  const stored = await chrome.storage.local.get(key);
  if (stored[key]) {
    sessions.set(tabId, stored[key]);
    return stored[key];
  }

  return null;
}

async function resolveTab(tabId) {
  if (tabId) {
    return chrome.tabs.get(tabId);
  }

  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return activeTab;
}

function updateBadge(tabId, session) {
  const text = session?.recording ? String(Math.min(session.actions.length, 999)) : '';
  chrome.action.setBadgeBackgroundColor({ color: '#ff5a36', tabId });
  chrome.action.setBadgeText({ text, tabId });
}

function escapeSingleQuotes(value) {
  return String(value ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function buildPlaywrightExport(session) {
  const steps = [
    "import { test, expect } from '@playwright/test';",
    '',
    "test('recorded by Questro Recorder', async ({ page }) => {",
    `  await page.goto('${escapeSingleQuotes(session.currentUrl || 'about:blank')}');`,
  ];

  for (const action of session.actions) {
    const selector = action.selector?.primary || 'body';

    if (action.type === 'click') {
      steps.push(`  await page.locator('${escapeSingleQuotes(selector)}').click();`);
    } else if (action.type === 'input' || action.type === 'change') {
      steps.push(`  await page.locator('${escapeSingleQuotes(selector)}').fill('${escapeSingleQuotes(action.value || '')}');`);
    } else if (action.type === 'submit') {
      steps.push(`  await page.locator('${escapeSingleQuotes(selector)}').press('Enter');`);
    } else if (action.type === 'keydown') {
      steps.push(`  await page.keyboard.press('${escapeSingleQuotes(action.key || 'Enter')}');`);
    } else if (action.type === 'scroll') {
      steps.push(`  await page.evaluate(() => window.scrollTo(${Number(action.x || 0)}, ${Number(action.y || 0)}));`);
    } else if (action.type === 'navigation' && action.url) {
      steps.push(`  await page.goto('${escapeSingleQuotes(action.url)}');`);
    }
  }

  steps.push('});', '');
  return steps.join('\n');
}

function buildCypressExport(session) {
  const steps = [
    "describe('recorded by Questro Recorder', () => {",
    "  it('replays the captured flow', () => {",
    `    cy.visit('${escapeSingleQuotes(session.currentUrl || '/')}');`,
  ];

  for (const action of session.actions) {
    const selector = action.selector?.primary || 'body';

    if (action.type === 'click') {
      steps.push(`    cy.get('${escapeSingleQuotes(selector)}').click();`);
    } else if (action.type === 'input' || action.type === 'change') {
      steps.push(`    cy.get('${escapeSingleQuotes(selector)}').clear().type('${escapeSingleQuotes(action.value || '')}');`);
    } else if (action.type === 'scroll') {
      steps.push(`    cy.scrollTo(${Number(action.x || 0)}, ${Number(action.y || 0)});`);
    } else if (action.type === 'navigation' && action.url) {
      steps.push(`    cy.visit('${escapeSingleQuotes(action.url)}');`);
    }
  }

  steps.push('  });', '});', '');
  return steps.join('\n');
}

function buildSeleniumExport(session) {
  const steps = [
    "const { Builder, By, Key, until } = require('selenium-webdriver');",
    '',
    '(async function questroRecording() {',
    "  const driver = await new Builder().forBrowser('chrome').build();",
    '  try {',
    `    await driver.get('${escapeSingleQuotes(session.currentUrl || 'about:blank')}');`,
  ];

  for (const action of session.actions) {
    const selector = action.selector?.primary || 'body';

    if (action.type === 'click') {
      steps.push(`    await driver.findElement(By.css('${escapeSingleQuotes(selector)}')).click();`);
    } else if (action.type === 'input' || action.type === 'change') {
      steps.push(`    await driver.findElement(By.css('${escapeSingleQuotes(selector)}')).sendKeys('${escapeSingleQuotes(action.value || '')}');`);
    } else if (action.type === 'submit') {
      steps.push(`    await driver.findElement(By.css('${escapeSingleQuotes(selector)}')).sendKeys(Key.ENTER);`);
    } else if (action.type === 'navigation' && action.url) {
      steps.push(`    await driver.get('${escapeSingleQuotes(action.url)}');`);
    }
  }

  steps.push('  } finally {', '    await driver.quit();', '  }', '})();', '');
  return steps.join('\n');
}

function buildYamlExport(session) {
  const lines = [
    'recording:',
    `  sessionId: ${session.sessionId}`,
    `  startedAt: ${new Date(session.startedAt).toISOString()}`,
    `  currentUrl: ${session.currentUrl || 'about:blank'}`,
    '  actions:',
  ];

  for (const action of session.actions) {
    lines.push(`    - type: ${action.type}`);
    lines.push(`      selector: "${String(action.selector?.primary || 'body').replace(/"/g, '\\"')}"`);
    if (action.value) {
      lines.push(`      value: "${String(action.value).replace(/"/g, '\\"')}"`);
    }
    if (action.key) {
      lines.push(`      key: "${String(action.key).replace(/"/g, '\\"')}"`);
    }
    lines.push(`      timestamp: ${action.timestamp}`);
  }

  return `${lines.join('\n')}\n`;
}

function buildExportContent(format, session) {
  if (format === 'playwright') {
    return buildPlaywrightExport(session);
  }

  if (format === 'cypress') {
    return buildCypressExport(session);
  }

  if (format === 'selenium') {
    return buildSeleniumExport(session);
  }

  if (format === 'yaml') {
    return buildYamlExport(session);
  }

  return JSON.stringify(session, null, 2);
}

function extensionForFormat(format) {
  if (format === 'playwright' || format === 'cypress' || format === 'selenium') {
    return 'js';
  }

  if (format === 'yaml') {
    return 'yaml';
  }

  return 'json';
}

async function exportSession(tabId, format) {
  const session = await getSessionForTab(tabId);
  if (!session || session.actions.length === 0) {
    return { ok: false, error: 'No recorded actions are available to export.' };
  }

  const content = buildExportContent(format, session);
  const extension = extensionForFormat(format);
  const filename = `questro/${session.sessionId}.${extension}`;
  const url = `data:text/plain;charset=utf-8,${encodeURIComponent(content)}`;

  await chrome.downloads.download({
    url,
    filename,
    saveAs: true,
  });

  return { ok: true };
}

async function openQuestro() {
  const { questroAppUrl = DEFAULT_APP_URL } = await chrome.storage.local.get('questroAppUrl');
  await chrome.tabs.create({ url: `${questroAppUrl}?source=browser-extension` });
}

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.local.get('questroAppUrl');
  if (!stored.questroAppUrl) {
    await chrome.storage.local.set({ questroAppUrl: DEFAULT_APP_URL });
  }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  sessions.delete(tabId);
  await chrome.storage.local.remove(`${SESSION_STORAGE_PREFIX}${tabId}`);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message.type === 'questro:get-status') {
      const tab = await resolveTab(message.tabId || sender.tab?.id);
      const session = await getSessionForTab(tab?.id);
      sendResponse({ ok: true, session: serializeSession(session) });
      return;
    }

    if (message.type === 'questro:start-recording') {
      const tab = await resolveTab(message.tabId || sender.tab?.id);
      if (!tab?.id) {
        sendResponse({ ok: false, error: 'No active tab is available for recording.' });
        return;
      }

      const session = createSession(tab);
      sessions.set(tab.id, session);
      await persistSession(session);
      updateBadge(tab.id, session);

      try {
        await chrome.tabs.sendMessage(tab.id, {
          type: 'questro:start-recording',
          session: {
            sessionId: session.sessionId,
            startedAt: session.startedAt,
          },
        });
        sendResponse({ ok: true, session: serializeSession(session) });
      } catch (error) {
        sendResponse({ ok: false, error: 'Questro Recorder cannot attach to this tab.' });
      }
      return;
    }

    if (message.type === 'questro:stop-recording') {
      const tab = await resolveTab(message.tabId || sender.tab?.id);
      if (!tab?.id) {
        sendResponse({ ok: false, error: 'No active tab is available.' });
        return;
      }

      const session = await getSessionForTab(tab.id);
      if (!session) {
        sendResponse({ ok: false, error: 'No active recording session was found.' });
        return;
      }

      session.recording = false;
      sessions.set(tab.id, session);
      await persistSession(session);
      updateBadge(tab.id, session);
      await chrome.tabs.sendMessage(tab.id, { type: 'questro:stop-recording' }).catch(() => undefined);
      sendResponse({ ok: true, session: serializeSession(session) });
      return;
    }

    if (message.type === 'questro:action-recorded') {
      const tabId = sender.tab?.id;
      if (!tabId) {
        sendResponse({ ok: false });
        return;
      }

      const session = (await getSessionForTab(tabId)) || createSession(sender.tab);
      session.currentUrl = message.action?.url || session.currentUrl;
      session.pageTitle = message.action?.title || session.pageTitle;
      session.actions.push(message.action);
      session.actionCount = session.actions.length;
      sessions.set(tabId, session);
      await persistSession(session);
      updateBadge(tabId, session);
      sendResponse({ ok: true });
      return;
    }

    if (message.type === 'questro:page-context') {
      const tabId = sender.tab?.id;
      if (!tabId) {
        sendResponse({ ok: false });
        return;
      }

      const session = await getSessionForTab(tabId);
      if (session) {
        session.currentUrl = message.context?.url || session.currentUrl;
        session.pageTitle = message.context?.title || session.pageTitle;
        sessions.set(tabId, session);
        await persistSession(session);
      }

      sendResponse({ ok: true });
      return;
    }

    if (message.type === 'questro:export-recording') {
      const tab = await resolveTab(message.tabId || sender.tab?.id);
      if (!tab?.id) {
        sendResponse({ ok: false, error: 'No active tab is available.' });
        return;
      }

      const result = await exportSession(tab.id, message.format || 'playwright');
      sendResponse(result);
      return;
    }

    if (message.type === 'questro:open-questro') {
      await openQuestro();
      sendResponse({ ok: true });
      return;
    }

    sendResponse({ ok: false, error: 'Unsupported message type.' });
  })();

  return true;
});
