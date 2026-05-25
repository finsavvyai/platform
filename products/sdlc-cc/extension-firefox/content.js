// content.js — runs on claude.ai / chatgpt.com pages. Hooks the
// prompt input so we can scrub text BEFORE it submits to the LLM.
//
// Strategy:
//   1. Find the prompt textbox (varies per host: contenteditable on
//      claude.ai, textarea on chatgpt.com).
//   2. Wrap the submit path: if the text contains anything our
//      gateway flags, replace with the scrubbed version + a small
//      notice, then let the user re-press send.
//
// We deliberately don't auto-submit the scrubbed text — the user
// should always see the redacted version before it goes to the LLM,
// in case the redaction is too aggressive. Two-step submit is the
// right safety default.

const HOSTS = {
  "claude.ai": {
    selector:
      'div[contenteditable="true"][role="textbox"], ' +
      'div[contenteditable="true"].ProseMirror, ' +
      'fieldset div[contenteditable="true"]',
    getValue: el => el.innerText,
    setValue: (el, t) => {
      el.focus();
      // Replace contenteditable contents and fire input so the host
      // app's autosave/validation refreshes from the new state.
      el.innerHTML = "";
      document.execCommand("insertText", false, t);
      el.dispatchEvent(new InputEvent("input", { bubbles: true }));
    },
  },
  "chatgpt.com": {
    selector: 'textarea#prompt-textarea, textarea[data-id="root"]',
    getValue: el => el.value,
    setValue: (el, t) => {
      el.focus();
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype, "value"
      ).set;
      setter.call(el, t);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    },
  },
  "chat.openai.com": null, // alias of chatgpt.com — same handlers
  "gemini.google.com": {
    // Gemini wraps its input in a rich-text editor with a stable
    // role + class; both selectors capture the active prompt area.
    selector:
      'rich-textarea div[contenteditable="true"], ' +
      'div.ql-editor[contenteditable="true"]',
    getValue: el => el.innerText,
    setValue: (el, t) => {
      el.focus();
      el.innerHTML = "";
      document.execCommand("insertText", false, t);
      el.dispatchEvent(new InputEvent("input", { bubbles: true }));
    },
  },
  "poe.com": {
    // Poe wraps the prompt in a class-prefixed textarea ("GrowingTextArea")
    // or a placeholder-shaped textarea ("Talk to ..."). Either matches.
    selector: 'textarea[class*="GrowingTextArea"], textarea[placeholder*="Talk to"]',
    getValue: el => el.value,
    setValue: (el, t) => {
      el.focus();
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype, "value"
      ).set;
      setter.call(el, t);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    },
  },
  "perplexity.ai": {
    // Perplexity uses a plain textarea for ask + a contenteditable
    // for follow-ups; both have distinguishing testids/placeholders.
    selector:
      'textarea[placeholder*="Ask"], ' +
      'textarea[data-testid="search-input"], ' +
      'div[contenteditable="true"][data-testid*="follow"]',
    getValue: el => (el.tagName === "TEXTAREA" ? el.value : el.innerText),
    setValue: (el, t) => {
      el.focus();
      if (el.tagName === "TEXTAREA") {
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype, "value"
        ).set;
        setter.call(el, t);
        el.dispatchEvent(new Event("input", { bubbles: true }));
      } else {
        el.innerHTML = "";
        document.execCommand("insertText", false, t);
        el.dispatchEvent(new InputEvent("input", { bubbles: true }));
      }
    },
  },
};

(() => {
  const host = location.hostname.replace(/^www\./, "");
  const cfg = HOSTS[host] || HOSTS["chatgpt.com"];
  if (!cfg) return;

  // Floating badge: bottom-right, only appears after a scrub. Tells
  // the user how many redactions happened and where to revert.
  const badge = document.createElement("div");
  Object.assign(badge.style, {
    position: "fixed", bottom: "20px", right: "20px",
    background: "#0e0e10", color: "#ececef",
    border: "1px solid #2a2a31", borderRadius: "10px",
    padding: "10px 14px", fontFamily: "ui-sans-serif, system-ui, sans-serif",
    fontSize: "12px", boxShadow: "0 4px 18px rgba(0,0,0,0.35)",
    zIndex: "2147483647", display: "none", maxWidth: "360px",
    cursor: "default", lineHeight: "1.4",
  });
  document.documentElement.appendChild(badge);

  const flash = (html, ms = 6000) => {
    badge.innerHTML = html;
    badge.style.display = "block";
    clearTimeout(flash._t);
    flash._t = setTimeout(() => { badge.style.display = "none"; }, ms);
  };

  // Find the live prompt element each time we need it (host pages
  // re-mount their components on route changes).
  const findPrompt = () => document.querySelector(cfg.selector);

  // Intercept Cmd/Ctrl+Enter and the Send button (best-effort —
  // the user may also click their own send shortcut). When the user
  // tries to send, scrub first. Only swap the text if redactions > 0.
  // Otherwise let the original text go through untouched.
  let isProcessing = false;
  const handleSend = async (e) => {
    if (isProcessing) return;
    const el = findPrompt();
    if (!el) return;
    const original = cfg.getValue(el).trim();
    if (!original) return;

    isProcessing = true;
    e.preventDefault();
    e.stopImmediatePropagation();

    flash("⏳ scrubbing…", 60000);
    try {
      const res = await chrome.runtime.sendMessage({ type: "scrub", text: original });
      if (!res?.ok) {
        flash(`<b>sdlc.cc:</b> ${res?.error || "scrub failed"}<br/><span style="opacity:.7">your prompt was NOT sent.</span>`);
        return;
      }
      const counts = res.redactions || {};
      const total = Object.values(counts).reduce((a, b) => a + (b || 0), 0);

      if (total === 0) {
        // Clean — let the original text submit. Re-dispatch the event
        // synthetically so the host page's send handler runs.
        flash("✓ clean — sending unchanged");
        cfg.setValue(el, original);
        // small delay so the input event flushes before re-submit
        setTimeout(() => {
          const ev = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true, ...(e.ctrlKey ? { ctrlKey: true } : {}), ...(e.metaKey ? { metaKey: true } : {}) });
          el.dispatchEvent(ev);
        }, 50);
      } else {
        // Substitute with scrubbed version and HOLD — let the user
        // see the redaction before they press send again.
        cfg.setValue(el, res.clean_text);
        const lines = Object.entries(counts)
          .filter(([, n]) => n > 0)
          .map(([k, n]) => `${n} ${k}`)
          .join(", ");
        flash(
          `<b>${total} redaction${total > 1 ? "s" : ""}</b> · ${lines}<br/>` +
          `<span style="opacity:.7">scrubbed text replaced your input. Press send again to submit.</span>`,
          12000
        );
      }
    } catch (err) {
      flash(`<b>sdlc.cc:</b> ${err.message}<br/><span style="opacity:.7">your prompt was NOT sent.</span>`);
    } finally {
      isProcessing = false;
    }
  };

  // Capture-phase listener so we run before the host's own handler.
  // Cmd/Ctrl+Enter is the universal send shortcut on both hosts.
  document.addEventListener("keydown", (e) => {
    const isSend =
      e.key === "Enter" && !e.shiftKey && (e.metaKey || e.ctrlKey);
    if (isSend) handleSend(e);
  }, { capture: true });

  // Also intercept clicks on send-style buttons. Heuristic: button
  // with an aria-label containing "send" or its data-testid does.
  document.addEventListener("click", (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const label = (btn.getAttribute("aria-label") || "").toLowerCase();
    const tid = (btn.getAttribute("data-testid") || "").toLowerCase();
    if (label.includes("send") || tid.includes("send")) {
      handleSend(e);
    }
  }, { capture: true });
})();
