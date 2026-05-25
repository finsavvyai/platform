/**
 * Settings stored in chrome.storage.sync — propagates across the user's
 * Chrome profile so the API key follows them between machines.
 */

export type Policy = 'strict' | 'balanced' | 'permissive';

export interface Settings {
  enabled: boolean;
  apiKey?: string;
  endpoint: string;
  policy: Policy;
}

const KEY = 'sdlc-guard-settings:v1';

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  endpoint: 'https://api.sdlc.cc',
  policy: 'balanced',
};

export async function loadSettings(): Promise<Settings> {
  if (typeof chrome === 'undefined' || !chrome.storage?.sync) {
    return DEFAULT_SETTINGS;
  }
  const stored = await chrome.storage.sync.get(KEY);
  return { ...DEFAULT_SETTINGS, ...(stored?.[KEY] ?? {}) } as Settings;
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await loadSettings()), ...patch };
  if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
    await chrome.storage.sync.set({ [KEY]: next });
  }
  return next;
}

/**
 * Day counter persisted in chrome.storage.local — popup shows today's
 * blocked-PII total without round-tripping to the network.
 */
const COUNTER_KEY = 'sdlc-guard-counter:v1';

interface Counter {
  date: string; // YYYY-MM-DD
  blocks: number;
}

function todayUTC(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export async function loadCounter(): Promise<Counter> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return { date: todayUTC(), blocks: 0 };
  }
  const stored = await chrome.storage.local.get(COUNTER_KEY);
  const c = stored?.[COUNTER_KEY] as Counter | undefined;
  if (!c || c.date !== todayUTC()) {
    return { date: todayUTC(), blocks: 0 };
  }
  return c;
}

export async function bumpCounter(by: number): Promise<Counter> {
  const c = await loadCounter();
  const next: Counter = { date: c.date, blocks: c.blocks + by };
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    await chrome.storage.local.set({ [COUNTER_KEY]: next });
  }
  return next;
}
