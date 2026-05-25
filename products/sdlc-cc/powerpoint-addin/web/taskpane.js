/* taskpane.js — PowerPoint add-in main UI logic.
 *
 * PowerPoint's Office.js surface is shallower than Word/Excel:
 * there's no `PowerPoint.run` with a rich object model. We use the
 * common API instead:
 *   - Office.context.document.getSelectedDataAsync — selected text
 *     on the current slide
 *   - Office.context.document.setSelectedDataAsync — replace it
 *
 * For "scrub all slides" we walk slide-by-slide via the slide-
 * iteration shape and read each slide's text frames. PowerPoint
 * web/desktop support this; mobile is more limited and we don't
 * target it.
 *
 * Speaker notes are read/written via the slide's notesSlide.
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

// ─── PowerPoint API helpers ─────────────────────────────────────
// PowerPoint.run is available on web + desktop (PowerPoint API 1.4+);
// the host check at boot already gated us, so calls inside here are
// safe.
const readDeck = (scope, includeNotes) => PowerPoint.run(async (ctx) => {
  const presentation = ctx.presentation;
  let slides;

  if (scope === "selected") {
    slides = presentation.getSelectedSlides();
  } else {
    slides = presentation.slides;
  }
  slides.load("items");
  await ctx.sync();

  const out = [];
  for (const slide of slides.items) {
    const shapes = slide.shapes;
    shapes.load("items/textFrame,items/textFrame/textRange");
    let notes = null;
    if (includeNotes) {
      const ns = slide.notesSlide;
      ns.load("shapes/items/textFrame/textRange");
      notes = ns;
    }
    await ctx.sync();

    const cells = [];
    for (const s of shapes.items) {
      if (s.textFrame && s.textFrame.textRange) {
        cells.push({ kind: "shape", ref: s, text: s.textFrame.textRange.text });
      }
    }
    if (notes) {
      for (const s of notes.shapes.items) {
        if (s.textFrame && s.textFrame.textRange) {
          cells.push({ kind: "notes", ref: s, text: s.textFrame.textRange.text });
        }
      }
    }
    out.push({ slide, cells });
  }
  return { ctx, slides: out };
});

// Write scrubbed text back per cell. Caller passes the same ctx +
// slides shape readDeck returned; we don't open a fresh
// PowerPoint.run because the refs would be invalidated.
const writeDeck = async (ctx, slides) => {
  for (const slide of slides) {
    for (const cell of slide.cells) {
      if (cell.scrubbed != null && cell.scrubbed !== cell.text) {
        cell.ref.textFrame.textRange.text = cell.scrubbed;
      }
    }
  }
  await ctx.sync();
};

// ─── action ─────────────────────────────────────────────────────
const scrub = async () => {
  $("scrub").disabled = true;
  setStatus("op-status", "reading deck…");
  try {
    const scope = $("scope").value;
    const includeNotes = $("notes").value === "yes";

    // PowerPoint.run hands us a context; we re-enter it after the
    // batch scrub by wrapping writeDeck in the same run. Easier:
    // do everything inside a single PowerPoint.run.
    await PowerPoint.run(async (ctx) => {
      const presentation = ctx.presentation;
      let slidesCol = scope === "selected"
        ? presentation.getSelectedSlides()
        : presentation.slides;
      slidesCol.load("items");
      await ctx.sync();

      const aggregate = {};
      let cellCount = 0;

      for (const slide of slidesCol.items) {
        const shapes = slide.shapes;
        shapes.load("items/textFrame,items/textFrame/textRange");
        let notesShapes = null;
        if (includeNotes) {
          const ns = slide.notesSlide;
          ns.load("shapes/items/textFrame,shapes/items/textFrame/textRange");
          notesShapes = ns.shapes;
        }
        await ctx.sync();

        const todo = [];
        for (const s of shapes.items) {
          if (s.textFrame && s.textFrame.textRange && s.textFrame.textRange.text) {
            todo.push(s.textFrame.textRange);
          }
        }
        if (notesShapes) {
          for (const s of notesShapes.items) {
            if (s.textFrame && s.textFrame.textRange && s.textFrame.textRange.text) {
              todo.push(s.textFrame.textRange);
            }
          }
        }

        for (const tr of todo) {
          const text = tr.text;
          if (!text.trim()) continue;
          cellCount++;
          const data = await callScrub(text);
          for (const [k, v] of Object.entries(data.redactions || {})) {
            aggregate[k] = (aggregate[k] || 0) + (v || 0);
          }
          if (data.clean_text !== text) {
            tr.text = data.clean_text;
          }
        }
      }

      await ctx.sync();
      const total = renderCounts(aggregate);
      setStatus("op-status", `✓ ${total} redactions across ${cellCount} text frames (Ctrl-Z to revert)`, "ok");
    });
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
  if (info.host !== Office.HostType.PowerPoint) {
    setStatus("op-status", "this add-in only runs in PowerPoint", "err");
    return;
  }
  loadSettings();
  renderCounts({});
  $("save").addEventListener("click", saveSettings);
  $("test").addEventListener("click", testGateway);
  $("scrub").addEventListener("click", scrub);
});
