/* tab.js — Teams personal-tab UI. No Teams-specific calls beyond
 * microsoftTeams.app.initialize() and getContext() — the rest is
 * identical to the web app shape. Settings persist via localStorage
 * (Teams sandboxes the iframe so storage is per-tenant per-user
 * anyway). */

const $ = id => document.getElementById(id);
const KEYS = { endpoint: "sdlc_endpoint", apiKey: "sdlc_apikey" };
const DEFAULT_ENDPOINT = "https://api.sdlc.cc";
const COUNT_LABELS = [
  ["email", "Email"], ["phone", "Phone"],
  ["pan", "PAN"], ["iban", "IBAN"], ["bic", "BIC"],
  ["ssn", "US SSN"], ["uk_ni", "UK NI"], ["il_id", "IL ID"],
  ["nl_bsn", "NL BSN"], ["de_steuer_id", "DE Steuer-ID"],
  ["ca_sin", "CA SIN"], ["au_tfn", "AU TFN"], ["us_npi", "US NPI"],
  ["ip", "IP"], ["credentials", "Credentials"],
];

const setStatus = (id, text, cls = "") => { const el = $(id); el.textContent = text; el.className = "status " + cls; };
const renderCounts = (counts) => {
  const c = $("counts"); c.innerHTML = "";
  for (const [key, label] of COUNT_LABELS) {
    const n = counts[key] ?? 0;
    const div = document.createElement("div");
    div.className = "count" + (n > 0 ? " hit" : "");
    div.innerHTML = `<div class="n${n === 0 ? " zero" : ""}">${n}</div><div class="label">${label}</div>`;
    c.appendChild(div);
  }
};

const load = () => {
  $("endpoint").value = localStorage.getItem(KEYS.endpoint) || DEFAULT_ENDPOINT;
  $("apiKey").value = localStorage.getItem(KEYS.apiKey) || "";
};
const save = () => {
  localStorage.setItem(KEYS.endpoint, $("endpoint").value.trim() || DEFAULT_ENDPOINT);
  localStorage.setItem(KEYS.apiKey, $("apiKey").value.trim());
  setStatus("cfg-status", "saved", "ok");
};

const callScrub = async (text) => {
  const endpoint = ($("endpoint").value.trim() || DEFAULT_ENDPOINT).replace(/\/+$/, "");
  const key = $("apiKey").value.trim();
  if (!key) throw new Error("no API key — fill the Gateway section first");
  const resp = await fetch(`${endpoint}/v1/dlp/scrub`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
    body: JSON.stringify({ text }),
  });
  if (!resp.ok) throw new Error(`gateway ${resp.status}: ${(await resp.text()).slice(0, 160)}`);
  return resp.json();
};

const scrub = async () => {
  $("scrub").disabled = true;
  try {
    const text = $("input").value.trim();
    if (!text) { setStatus("copy-status", "nothing to scrub", "err"); return; }
    const data = await callScrub(text);
    $("output").textContent = data.clean_text;
    renderCounts(data.redactions || {});
    const total = Object.values(data.redactions || {}).reduce((a, b) => a + (b || 0), 0);
    setStatus("copy-status", total === 0 ? "✓ clean" : `✓ ${total} redactions`, "ok");
    window.__clean = data.clean_text;
  } catch (e) {
    $("output").textContent = "error: " + e.message;
    setStatus("copy-status", "failed", "err");
  } finally { $("scrub").disabled = false; }
};

const pasteIn = async () => {
  try { $("input").value = await navigator.clipboard.readText(); $("input").focus(); }
  catch { setStatus("copy-status", "clipboard blocked", "err"); }
};
const copyOut = async () => {
  if (!window.__clean) return;
  try { await navigator.clipboard.writeText(window.__clean); setStatus("copy-status", "✓ copied", "ok"); }
  catch { setStatus("copy-status", "copy failed", "err"); }
};
const testCfg = async () => {
  setStatus("cfg-status", "testing…");
  try {
    const d = await callScrub("test card 4111-1111-1111-1111 email a@b.com");
    const total = Object.values(d.redactions || {}).reduce((a, b) => a + (b || 0), 0);
    setStatus("cfg-status", `✓ ${total} redactions in test`, "ok");
  } catch (e) { setStatus("cfg-status", e.message, "err"); }
};

// Teams SDK init — needed for the tab to render at all in Teams.
// Outside Teams (e.g. opened directly in a browser), the SDK silently
// fails and the tab still works as a vanilla web page.
if (window.microsoftTeams) {
  microsoftTeams.app.initialize().catch(() => {});
}

document.addEventListener("DOMContentLoaded", () => {
  load();
  renderCounts({});
  $("save").addEventListener("click", save);
  $("test").addEventListener("click", testCfg);
  $("scrub").addEventListener("click", scrub);
  $("paste").addEventListener("click", pasteIn);
  $("copy").addEventListener("click", copyOut);
});
