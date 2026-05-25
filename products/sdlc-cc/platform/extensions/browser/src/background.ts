// SPDX-License-Identifier: AGPL-3.0-or-later
import { redact, GatewayError } from "./lib/api";
import { loadSettings, saveSettings } from "./lib/storage";
import type { RuntimeMessage, RuntimeResponse } from "./lib/types";

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    await chrome.runtime.openOptionsPage();
  }
});

chrome.runtime.onMessage.addListener(
  (msg: RuntimeMessage, _sender, sendResponse) => {
    handle(msg)
      .then(sendResponse)
      .catch((err: unknown) => {
        sendResponse({
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        } satisfies RuntimeResponse);
      });
    return true;
  },
);

async function handle(msg: RuntimeMessage): Promise<RuntimeResponse> {
  switch (msg.kind) {
    case "redact": {
      const settings = await loadSettings();
      if (!settings.enabled) {
        return {
          ok: true,
          data: { redacted: msg.payload.text, detections: [], blocked: false },
        };
      }
      try {
        const data = await redact(settings, msg.payload);
        return { ok: true, data };
      } catch (err) {
        if (err instanceof GatewayError) {
          return { ok: false, error: `gateway ${err.status}: ${err.message}` };
        }
        throw err;
      }
    }
    case "getSettings": {
      const data = await loadSettings();
      return { ok: true, data };
    }
    case "setSettings": {
      const data = await saveSettings(msg.payload);
      return { ok: true, data };
    }
  }
}
