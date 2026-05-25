/* taskpane.js — Word add-in main UI logic.
 *
 * Two scopes:
 *   - Current selection: range = ctx.document.getSelection()
 *   - Entire document: range = ctx.document.body
 *
 * Two write modes:
 *   - Replace text in place (destructive — Ctrl-Z reverts)
 *   - Insert sanitized copy below (non-destructive — appends to
 *     the document at the end, after a separator line)
 *
 * Same /v1/dlp/scrub backend as the other surfaces. Settings persist
 * via Office.context.document.settings (per-document scope; matches
 * Excel pattern).
 */

const $ = id => document.getElementById(id);
const KEYS = { endpoint: "sdlc.endpoint", apiKey: "sdlc.apiKey" };
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
  let total = 0;
  for (const [key, label] of COUNT_LABELS) {
    const n = counts[key] ?? 0;
    total += n;
    const div = document.createElement("div");
    div.className = "count" + (n > 0 ? " hit" : "");
    div.innerHTML = `<div class="n${n === 0 ? " zero" : ""}">${n}</div><div class="label">${label}</div>`;
    c.appendChild(div);
  }
  return total;
};

const loadSettings = () => {
  const s = Office.context.document.settings;
  $("endpoint").value = s.get(KEYS.endpoint) || DEFAULT_ENDPOINT;
  $("apiKey").value = s.get(KEYS.apiKey) || "";
};
const saveSettings = () => {
  const s = Office.context.document.settings;
  s.set(KEYS.endpoint, $("endpoint").value.trim() || DEFAULT_ENDPOINT);
  s.set(KEYS.apiKey, $("apiKey").value.trim());
  s.saveAsync(r => setStatus("cfg-status", r.status === Office.AsyncResultStatus.Succeeded ? "saved" : "save failed", r.status === Office.AsyncResultStatus.Succeeded ? "ok" : "err"));
};

const callScrub = async (text) => {
  const endpoint = (Office.context.document.settings.get(KEYS.endpoint) || DEFAULT_ENDPOINT).replace(/\/+$/, "");
  const apiKey = Office.context.document.settings.get(KEYS.apiKey);
  if (!apiKey) throw new Error("no API key set — fill in Gateway section");
  const resp = await fetch(`${endpoint}/v1/dlp/scrub`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({ text }),
  });
  if (!resp.ok) throw new Error(`gateway ${resp.status}: ${(await resp.text()).slice(0, 160)}`);
  return resp.json();
};

// ─── Word.run helpers ────────────────────────────────────────────
const readRange = (scope) => Word.run(async (ctx) => {
  const range = scope === "selection" ? ctx.document.getSelection() : ctx.document.body;
  range.load("text");
  await ctx.sync();
  return { range, text: range.text };
});

const replaceRange = (scope, text) => Word.run(async (ctx) => {
  const range = scope === "selection" ? ctx.document.getSelection() : ctx.document.body;
  range.insertText(text, Word.InsertLocation.replace);
  await ctx.sync();
});

const appendAtEnd = (text) => Word.run(async (ctx) => {
  const body = ctx.document.body;
  body.insertParagraph("", Word.InsertLocation.end);
  body.insertParagraph("--- Sanitized copy (sdlc.cc) ---", Word.InsertLocation.end);
  body.insertText(text, Word.InsertLocation.end);
  await ctx.sync();
});

// ─── action ─────────────────────────────────────────────────────
const scrub = async () => {
  $("scrub").disabled = true;
  setStatus("op-status", "reading…");
  try {
    const scope = $("scope").value;
    const mode = $("mode").value;
    const { text } = await readRange(scope);
    if (!text.trim()) {
      setStatus("op-status", "no text in scope", "err");
      return;
    }
    setStatus("op-status", `scrubbing ${text.length} chars…`);
    const data = await callScrub(text);
    const total = renderCounts(data.redactions || {});

    if (mode === "replace") {
      await replaceRange(scope, data.clean_text);
      setStatus("op-status", `✓ ${total} redactions, replaced in place (Ctrl-Z to revert)`, "ok");
    } else {
      await appendAtEnd(data.clean_text);
      setStatus("op-status", `✓ ${total} redactions, sanitized copy appended`, "ok");
    }
  } catch (e) {
    setStatus("op-status", "failed: " + e.message, "err");
  } finally { $("scrub").disabled = false; }
};

const testGateway = async () => {
  setStatus("cfg-status", "testing…");
  try {
    const d = await callScrub("test card 4111-1111-1111-1111 email a@b.com");
    const total = Object.values(d.redactions || {}).reduce((a, b) => a + (b || 0), 0);
    setStatus("cfg-status", `✓ ${total} redactions in test`, "ok");
  } catch (e) { setStatus("cfg-status", e.message, "err"); }
};

Office.onReady((info) => {
  if (info.host !== Office.HostType.Word) {
    setStatus("op-status", "this add-in only runs in Word", "err");
    return;
  }
  loadSettings();
  renderCounts({});
  $("save").addEventListener("click", saveSettings);
  $("test").addEventListener("click", testGateway);
  $("scrub").addEventListener("click", scrub);
});
