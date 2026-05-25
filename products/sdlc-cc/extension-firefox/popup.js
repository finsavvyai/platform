const $ = id => document.getElementById(id);
const setStatus = (text, cls = "") => {
  const el = $("status");
  el.textContent = text;
  el.className = "status " + cls;
};

(async () => {
  const { endpoint, apiKey } = await chrome.storage.sync.get(["endpoint", "apiKey"]);
  $("endpoint").value = endpoint || "https://api.sdlc.cc";
  $("apiKey").value = apiKey || "";
})();

$("save").addEventListener("click", async () => {
  const endpoint = $("endpoint").value.trim().replace(/\/+$/, "") || "https://api.sdlc.cc";
  const apiKey = $("apiKey").value.trim();
  await chrome.storage.sync.set({ endpoint, apiKey });
  setStatus("saved", "ok");
});

$("test").addEventListener("click", async () => {
  setStatus("testing…");
  // Send a known-PII payload through the scrub endpoint and report
  // whether the round-trip works. A success here verifies endpoint
  // reachability + valid bearer in one call.
  const resp = await chrome.runtime.sendMessage({
    type: "scrub",
    text: "test card 4111-1111-1111-1111 email a@b.com",
  });
  if (resp?.ok) {
    const total = Object.values(resp.redactions || {}).reduce((a, b) => a + (b || 0), 0);
    setStatus(`✓ ok — ${total} redactions in test payload`, "ok");
  } else {
    setStatus(resp?.error || "request failed", "err");
  }
});
