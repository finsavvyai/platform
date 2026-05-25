"use strict";

(function bootstrapOnboardingExtras() {
  const panel = document.getElementById("sec-onboarding");
  const titleEl = document.getElementById("onboarding-step-title");
  const hintEl = document.getElementById("onboarding-hint");
  if (!panel || !titleEl || !hintEl) return;

  const host = document.createElement("section");
  host.className = "onboarding-extras";
  host.innerHTML = `
    <div class="extras-head">
      <strong>Mission Path</strong>
      <span id="extras-step-meta">Step 1</span>
    </div>
    <div id="extras-orbit" class="extras-orbit"></div>
    <div class="extras-guide">
      <p id="extras-kid-line">Let us connect your robot brain first.</p>
    </div>
  `;

  const progressBar = panel.querySelector(".onboarding-progress");
  if (progressBar?.parentElement) {
    progressBar.parentElement.insertBefore(host, progressBar.nextSibling);
  } else {
    panel.appendChild(host);
  }

  const metaEl = document.getElementById("extras-step-meta");
  const orbitEl = document.getElementById("extras-orbit");
  const kidEl = document.getElementById("extras-kid-line");
  if (!metaEl || !orbitEl || !kidEl) return;

  const kidLines = {
    1: "Tell me where OpenClaw lives and I will ping it.",
    2: "Pick your channel and I will open the message tunnel.",
    3: "Run one skill so we know your AI is alive.",
    4: "Inspect one node and launch control mode.",
  };

  let lastReady = false;
  renderOrbit(1, 4, false);
  updateFromDom();

  const observer = new MutationObserver(updateFromDom);
  observer.observe(titleEl, { childList: true, subtree: true, characterData: true });
  observer.observe(hintEl, { childList: true, subtree: true, characterData: true, attributes: true });
  document.addEventListener("control-hub:onboarding", updateFromEvent);

  function updateFromEvent(ev) {
    const detail = ev?.detail || {};
    const step = clampStep(Number(detail.step) || 1);
    const total = Math.max(1, Number(detail.total) || 4);
    const ready = Boolean(detail.ready);
    updateUi(step, total, ready, String(detail.hint || hintEl.textContent || ""));
  }

  function updateFromDom() {
    const parsed = parseStepTitle(titleEl.textContent || "");
    const ready = hintEl.classList.contains("ready");
    updateUi(parsed.step, parsed.total, ready, hintEl.textContent || "");
  }

  function updateUi(step, total, ready, hint) {
    metaEl.textContent = `Step ${step} of ${total}`;
    kidEl.textContent = pickKidLine(step, ready, hint);
    renderOrbit(step, total, ready);
    pulsePanel(step, ready);
    lastReady = ready;
  }

  function renderOrbit(step, total, ready) {
    const chips = [];
    for (let i = 1; i <= total; i += 1) {
      const state = i < step ? "done" : i === step ? "active" : "todo";
      chips.push(
        `<button class="orbit-chip orbit-${state}" type="button" data-step="${i}" aria-label="Step ${i}">${i}</button>`,
      );
    }
    orbitEl.innerHTML = chips.join("");
    orbitEl.classList.toggle("orbit-ready", ready);
    orbitEl.querySelectorAll(".orbit-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        const section = document.getElementById("sec-onboarding");
        if (section) section.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  function pulsePanel(step, ready) {
    panel.classList.remove("extras-pulse");
    if (ready && !lastReady) {
      void panel.offsetWidth;
      panel.classList.add("extras-pulse");
    }
    panel.dataset.step = String(step);
    panel.dataset.ready = ready ? "1" : "0";
  }

  function parseStepTitle(raw) {
    const match = String(raw).match(/Step\s+(\d+)\s+of\s+(\d+)/i);
    if (!match) return { step: 1, total: 4 };
    return {
      step: clampStep(Number(match[1]) || 1),
      total: Math.max(1, Number(match[2]) || 4),
    };
  }

  function pickKidLine(step, ready, hint) {
    if (ready) return "Nice. This mission checkpoint is complete.";
    if (String(hint || "").trim()) return String(hint).trim();
    return kidLines[step] || kidLines[1];
  }

  function clampStep(step) {
    return Math.max(1, Math.min(4, step));
  }
})();
