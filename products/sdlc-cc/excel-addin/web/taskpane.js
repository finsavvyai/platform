/* taskpane.js — Excel add-in main UI logic.
 *
 * Selection-based scrub: reads the active range's text values, calls
 * /v1/dlp/scrub on each non-empty cell, writes back (or to a new
 * sheet). Same backend everything else uses.
 *
 * Two modes:
 *   - Replace in place: handy for ad-hoc cleanup before copying
 *     elsewhere. Destructive — use Undo (Ctrl-Z) if needed.
 *   - New sheet (Sanitized): non-destructive; writes a copy of the
 *     selection into a freshly created sheet. Default for compliance
 *     workflows where the original must remain untouched.
 *
 * Settings persist via Office.context.document.settings (Excel-side
 * equivalent to Outlook's roamingSettings).
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

let currentSelectionAddress = null;

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
  const s = Office.context.document.settings;
  $("endpoint").value = s.get(KEYS.endpoint) || DEFAULT_ENDPOINT;
  $("apiKey").value = s.get(KEYS.apiKey) || "";
};

const saveSettings = () => {
  const s = Office.context.document.settings;
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
  const endpoint = (Office.context.document.settings.get(KEYS.endpoint) || DEFAULT_ENDPOINT).replace(/\/+$/, "");
  const apiKey = Office.context.document.settings.get(KEYS.apiKey);
  if (!apiKey) throw new Error("no API key set — fill in the Gateway section");

  const resp = await fetch(`${endpoint}/v1/dlp/scrub`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({ text }),
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`gateway ${resp.status}: ${body.slice(0, 160)}`);
  }
  return resp.json();
};

// ─── selection inspection ───────────────────────────────────────
// Excel.run gives a fresh request context; load address + values
// before calling .sync(). Returns { address, values: 2D array } so
// the scrub logic can iterate per-cell and write back at the same
// shape.
const readSelection = () => Excel.run(async (ctx) => {
  const range = ctx.workbook.getSelectedRange();
  range.load(["address", "values", "rowCount", "columnCount"]);
  await ctx.sync();
  return {
    address: range.address,
    values: range.values,
    rows: range.rowCount,
    cols: range.columnCount,
  };
});

const writeBackInPlace = (values) => Excel.run(async (ctx) => {
  const range = ctx.workbook.getSelectedRange();
  range.values = values;
  await ctx.sync();
});

const writeToNewSheet = (values, headers) => Excel.run(async (ctx) => {
  // Find a unique sheet name — "Sanitized", "Sanitized 2", etc.
  const sheets = ctx.workbook.worksheets;
  sheets.load("items/name");
  await ctx.sync();
  const existing = new Set(sheets.items.map(s => s.name));
  let name = "Sanitized";
  let i = 2;
  while (existing.has(name)) { name = `Sanitized ${i++}`; }

  const sheet = sheets.add(name);
  if (headers && headers.length) {
    const hRange = sheet.getRangeByIndexes(0, 0, 1, headers.length);
    hRange.values = [headers];
    hRange.format.font.bold = true;
  }
  const startRow = headers && headers.length ? 1 : 0;
  if (values.length && values[0].length) {
    const target = sheet.getRangeByIndexes(startRow, 0, values.length, values[0].length);
    target.values = values;
  }
  sheet.activate();
  await ctx.sync();
  return name;
});

// ─── action ─────────────────────────────────────────────────────
const scrubSelection = async () => {
  $("scrub-sel").disabled = true;
  setStatus("op-status", "reading selection…");
  try {
    const sel = await readSelection();
    if (!sel.values.length) {
      setStatus("op-status", "empty selection", "err");
      return;
    }
    setStatus("op-status", `scrubbing ${sel.rows}×${sel.cols} cells…`);

    // Aggregate counts across all cells; do per-cell calls so empty
    // cells skip and the per-cell scrub retains full precision.
    const aggregate = {};
    const out = [];
    for (let r = 0; r < sel.values.length; r++) {
      const row = [];
      for (let c = 0; c < sel.values[r].length; c++) {
        const cell = sel.values[r][c];
        const text = (cell == null) ? "" : String(cell);
        if (!text.trim()) {
          row.push(cell);
          continue;
        }
        const data = await callScrub(text);
        row.push(data.clean_text);
        for (const [k, v] of Object.entries(data.redactions || {})) {
          aggregate[k] = (aggregate[k] || 0) + (v || 0);
        }
      }
      out.push(row);
    }

    const total = renderCounts(aggregate);
    const mode = $("mode").value;

    if (mode === "replace") {
      await writeBackInPlace(out);
      setStatus("op-status", `✓ ${total} redactions across ${sel.address}`, "ok");
    } else {
      const name = await writeToNewSheet(out, null);
      setStatus("op-status", `✓ ${total} redactions written to sheet "${name}"`, "ok");
    }
  } catch (e) {
    setStatus("op-status", "failed: " + e.message, "err");
  } finally {
    $("scrub-sel").disabled = false;
  }
};

const refreshSelectionSummary = async () => {
  try {
    const sel = await readSelection();
    currentSelectionAddress = sel.address;
    $("sel-summary").textContent = `Selection: ${sel.address} — ${sel.rows}×${sel.cols} cells`;
  } catch (e) {
    $("sel-summary").textContent = "couldn't read selection: " + e.message;
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

// ─── boot ───────────────────────────────────────────────────────
Office.onReady((info) => {
  if (info.host !== Office.HostType.Excel) {
    setStatus("op-status", "this add-in only runs in Excel", "err");
    return;
  }

  loadSettings();
  renderCounts({});
  refreshSelectionSummary();

  $("save").addEventListener("click", saveSettings);
  $("test").addEventListener("click", testGateway);
  $("scrub-sel").addEventListener("click", scrubSelection);
  $("refresh-sel").addEventListener("click", refreshSelectionSummary);

  // Refresh the address when the user clicks elsewhere — helpful
  // because they often select after opening the taskpane.
  Office.context.document.addHandlerAsync(
    Office.EventType.DocumentSelectionChanged,
    refreshSelectionSummary,
  );
});
