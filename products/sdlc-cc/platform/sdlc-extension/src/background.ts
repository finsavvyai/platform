/**
 * Service worker — handles install / update lifecycle and surfaces the
 * options page on first install so the user can paste their SDLC API key.
 */

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.runtime.openOptionsPage();
  }
});

// Keep the worker alive for the brief window the popup is open. MV3 spins it
// up on demand; this listener is the simplest way to ensure it's ready when
// the popup queries today's block count.
chrome.runtime.onConnect.addListener(() => {
  // No-op; presence of a listener is enough.
});
