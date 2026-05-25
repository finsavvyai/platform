// SPDX-License-Identifier: AGPL-3.0-or-later
import { DEFAULT_SETTINGS, type ExtensionSettings } from "./types";

const KEY = "privacy_gateway_settings";

export async function loadSettings(): Promise<ExtensionSettings> {
  const stored = await chrome.storage.sync.get(KEY);
  const partial = (stored[KEY] ?? {}) as Partial<ExtensionSettings>;
  return { ...DEFAULT_SETTINGS, ...partial };
}

export async function saveSettings(
  patch: Partial<ExtensionSettings>,
): Promise<ExtensionSettings> {
  const current = await loadSettings();
  const next = { ...current, ...patch };
  await chrome.storage.sync.set({ [KEY]: next });
  return next;
}

export function onSettingsChanged(
  fn: (next: ExtensionSettings) => void,
): () => void {
  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: string,
  ): void => {
    if (area !== "sync" || !changes[KEY]) return;
    fn({ ...DEFAULT_SETTINGS, ...(changes[KEY].newValue ?? {}) });
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
