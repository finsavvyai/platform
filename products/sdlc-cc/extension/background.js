// background.js — service worker. Handles the only thing the content
// script can't do directly: cross-origin POST to the gateway with the
// stored bearer token. Content scripts can fetch but they share the
// host page's CSP, which on claude.ai blocks our API origin. The SW
// has its own CSP via manifest host_permissions and bypasses page CSP.

const DEFAULT_ENDPOINT = "https://api.sdlc.cc";

// scrubText: the only RPC. Reads endpoint + key from chrome.storage,
// POSTs to /v1/dlp/scrub, returns the parsed response. Errors are
// returned as { ok: false, error } so the content script can decide
// whether to abort the user's submit or warn-and-continue.
async function scrubText(text) {
  const { endpoint, apiKey } = await chrome.storage.sync.get(["endpoint", "apiKey"]);
  const ep = (endpoint || DEFAULT_ENDPOINT).replace(/\/+$/, "");
  if (!apiKey) {
    return { ok: false, error: "no API key set — open the popup or options page" };
  }

  try {
    const resp = await fetch(`${ep}/v1/dlp/scrub`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ text }),
    });
    if (!resp.ok) {
      const body = await resp.text();
      return { ok: false, error: `gateway ${resp.status}: ${body.slice(0, 160)}` };
    }
    const data = await resp.json();
    return { ok: true, ...data };
  } catch (e) {
    return { ok: false, error: `fetch failed: ${e.message}` };
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "scrub" && typeof msg.text === "string") {
    scrubText(msg.text).then(sendResponse);
    return true; // keep the channel open for async response
  }
});

// First-install nudge: open the options page so the user can paste
// their sk_sdlc_* key. Skip on update.
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install") {
    chrome.runtime.openOptionsPage();
  }
});
