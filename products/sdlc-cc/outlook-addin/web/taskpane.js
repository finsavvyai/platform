/* taskpane.js — Outlook add-in main UI logic.
 *
 * Two surfaces:
 *   1. Compose mode: get/set the current draft body via Office.js.
 *      "Scrub body" overwrites the draft with the redacted version.
 *   2. Read mode: read-only access to the message body. "Copy clean
 *      text" runs scrub and writes to clipboard so the user can paste
 *      a sanitized copy anywhere (Cowork, ChatGPT, Slack, etc.).
 *
 * Same backend everything else uses: POST /v1/dlp/scrub with the
 * sk_sdlc_* bearer. Settings persist via Office.context.roamingSettings
 * which means the user sees them on every device they're signed into.
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

let item = null; // current Outlook item, set on Office.onReady
let mode = "unknown"; // "compose" | "read" | "unknown"

const setStatus = (id, text, cls = "") => {
  const el = $(id);
  el.textContent = text;
  el.className = "status " + cls;
};

const renderCounts = (counts) => {
  const c = $("counts");
  c.innerHTML = "";
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

// ─── settings persistence ─────────────────────────────────────────
const loadSettings = () => {
  const s = Office.context.roamingSettings;
  $("endpoint").value = s.get(KEYS.endpoint) || DEFAULT_ENDPOINT;
  $("apiKey").value = s.get(KEYS.apiKey) || "";
};

const saveSettings = () => {
  const s = Office.context.roamingSettings;
  s.set(KEYS.endpoint, $("endpoint").value.trim() || DEFAULT_ENDPOINT);
  s.set(KEYS.apiKey, $("apiKey").value.trim());
  s.saveAsync(r => {
    if (r.status === Office.AsyncResultStatus.Succeeded) {
      setStatus("cfg-status", "saved", "ok");
    } else {
      setStatus("cfg-status", "save failed: " + r.error?.message, "err");
    }
  });
};

// ─── core scrub call ─────────────────────────────────────────────
const callScrub = async (text) => {
  const endpoint = (Office.context.roamingSettings.get(KEYS.endpoint) || DEFAULT_ENDPOINT).replace(/\/+$/, "");
  const apiKey = Office.context.roamingSettings.get(KEYS.apiKey);
  if (!apiKey) throw new Error("no API key set — fill in the Gateway section");

  const resp = await fetch(`${endpoint}/v1/dlp/scrub`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ text }),
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`gateway ${resp.status}: ${body.slice(0, 160)}`);
  }
  return resp.json();
};

// ─── Office.js operations ────────────────────────────────────────
const getBodyText = () => new Promise((resolve, reject) => {
  // Outlook supports getAsync on item.body in both compose and read.
  item.body.getAsync(Office.CoercionType.Text, (r) => {
    if (r.status === Office.AsyncResultStatus.Succeeded) resolve(r.value);
    else reject(new Error(r.error?.message || "getAsync failed"));
  });
});

const setBodyText = (text) => new Promise((resolve, reject) => {
  // setAsync only available in compose mode.
  if (!item.body.setAsync) {
    reject(new Error("setBody only available in compose"));
    return;
  }
  item.body.setAsync(text, { coercionType: Office.CoercionType.Text }, (r) => {
    if (r.status === Office.AsyncResultStatus.Succeeded) resolve();
    else reject(new Error(r.error?.message || "setAsync failed"));
  });
});

// ─── actions ─────────────────────────────────────────────────────
const scrubBody = async () => {
  $("scrub-body").disabled = true;
  setStatus("op-status", "scrubbing…");
  try {
    const original = await getBodyText();
    if (!original.trim()) {
      setStatus("op-status", "body is empty", "err");
      return;
    }
    const data = await callScrub(original);
    const total = renderCounts(data.redactions || {});
    $("preview").style.display = "block";
    $("preview").textContent = data.clean_text;
    $("copy-clean").disabled = false;
    window.__cleanText = data.clean_text; // for the copy button

    if (mode === "compose") {
      if (total === 0) {
        setStatus("op-status", "✓ clean — body unchanged", "ok");
      } else {
        await setBodyText(data.clean_text);
        setStatus("op-status", `✓ ${total} redactions applied to the draft`, "ok");
      }
    } else {
      // read mode: can't write back, just preview + offer copy
      const verb = total === 0 ? "clean" : `${total} redactions`;
      setStatus("op-status", `✓ ${verb} — preview shown; use 'Copy clean text' to paste elsewhere`, "ok");
    }
  } catch (e) {
    setStatus("op-status", "failed: " + e.message, "err");
  } finally {
    $("scrub-body").disabled = false;
  }
};

const copyClean = async () => {
  const t = window.__cleanText;
  if (!t) return;
  try {
    await navigator.clipboard.writeText(t);
    setStatus("op-status", "✓ copied to clipboard", "ok");
  } catch (e) {
    setStatus("op-status", "clipboard blocked — copy from preview manually", "err");
  }
};

const testGateway = async () => {
  setStatus("cfg-status", "testing…");
  try {
    const data = await callScrub("test card 4111-1111-1111-1111 email a@b.com");
    const total = Object.values(data.redactions || {}).reduce((a, b) => a + (b || 0), 0);
    setStatus("cfg-status", `✓ ok — ${total} redactions in test payload`, "ok");
  } catch (e) {
    setStatus("cfg-status", e.message, "err");
  }
};

// ─── boot ────────────────────────────────────────────────────────
Office.onReady((info) => {
  if (info.host !== Office.HostType.Outlook) {
    setStatus("op-status", "this add-in only runs in Outlook", "err");
    return;
  }
  item = Office.context.mailbox.item;
  // ItemType + body permissions vary between compose and read mode.
  // Compose has setAsync; read does not. Detect via the body API.
  mode = item.body.setAsync ? "compose" : "read";
  $("mode-line").textContent =
    mode === "compose"
      ? "Compose mode — scrubbing will REPLACE the draft body."
      : "Read mode — scrubbing produces a preview + clipboard copy (read-only).";

  loadSettings();
  renderCounts({});

  $("save").addEventListener("click", saveSettings);
  $("test").addEventListener("click", testGateway);
  $("scrub-body").addEventListener("click", scrubBody);
  $("copy-clean").addEventListener("click", copyClean);
});
