"use strict";

(function (CH) {
  function syncDockerInputsFromState() {
    if (CH.els.onboardingDockerStack) {
      CH.els.onboardingDockerStack.value = CH.state.onboarding.dockerStack || "full";
    }
    if (CH.els.onboardingOpenclawImage) {
      CH.els.onboardingOpenclawImage.value = CH.state.onboarding.openclawImage || "";
    }
    if (CH.els.onboardingOpenclawPort) {
      CH.els.onboardingOpenclawPort.value = CH.state.onboarding.openclawContainerPort || "";
    }
  }

  function syncStateFromDockerInputs() {
    CH.state.onboarding.dockerStack = CH.els.onboardingDockerStack?.value || "full";
    CH.state.onboarding.openclawImage = (CH.els.onboardingOpenclawImage?.value || "").trim();
    CH.state.onboarding.openclawContainerPort = (CH.els.onboardingOpenclawPort?.value || "").trim();
    if (
      !CH.state.onboarding.openclawContainerPort &&
      CH.state.onboarding.openclawImage.toLowerCase().includes("lunaos")
    ) {
      CH.state.onboarding.openclawContainerPort = "8000";
      if (CH.els.onboardingOpenclawPort) {
        CH.els.onboardingOpenclawPort.value = "8000";
      }
    }
    CH.saveOnboardingState();
  }

  function celebrateOnboardingPanel() {
    if (!CH.els.onboardingPanel) return;
    CH.els.onboardingPanel.classList.remove("celebrate");
    void CH.els.onboardingPanel.offsetWidth;
    CH.els.onboardingPanel.classList.add("celebrate");
  }

  function applyFlowVisibility() {
    var allFlowSections = [
      "sec-snapshot", "sec-connection", "sec-connect-channel", "sec-connected",
      "sec-channel-types", "sec-services", "sec-skill", "sec-node", "sec-offerings",
    ];

    if (!CH.state.onboarding.enabled) {
      document.body.classList.remove("flow-mode");
      allFlowSections.forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.classList.remove("flow-hidden", "flow-focus");
      });
      return;
    }

    document.body.classList.add("flow-mode");
    var step = CH.currentStepConfig();
    var visible = new Set(["sec-snapshot"].concat(step.sections));

    allFlowSections.forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.classList.toggle("flow-hidden", !visible.has(id));
      el.classList.toggle("flow-focus", step.sections.includes(id));
    });
  }

  function renderOnboarding() {
    if (!CH.els.onboardingPanel) return;

    var inFlow = CH.state.onboarding.enabled;
    CH.els.onboardingPanel.classList.toggle("hidden", !inFlow);
    CH.els.toggleOnboarding.textContent = inFlow ? "Exit Guided Flow" : "Guided Flow";

    if (!inFlow) {
      applyFlowVisibility();
      return;
    }

    var step = CH.currentStepConfig();
    var stepIdx = CH.state.onboarding.step;
    var progress = Math.round((stepIdx / CH.FLOW_STEPS.length) * 100);
    var ready = CH.isCurrentStepReady();

    CH.els.onboardingStepTitle.textContent = step.title;
    CH.els.onboardingStepDescription.textContent = step.description;
    CH.els.onboardingChecklist.innerHTML = (step.checklist || [])
      .map(function (line) { return "<li>" + CH.escapeHtml(line) + "</li>"; })
      .join("");
    CH.els.onboardingProgressFill.style.width = progress + "%";
    CH.els.onboardingHint.textContent =
      CH.state.onboarding.hintOverride || (ready ? step.hintReady : step.hintPending);
    CH.els.onboardingHint.className = "onboarding-hint " + (ready ? "ready" : "pending");
    CH.els.onboardingNextInstruction.textContent = step.nextInstruction || "";
    CH.els.onboardingPanel.classList.toggle("is-ready", ready);

    if (ready && CH.state.ui.celebratedStep !== stepIdx) {
      celebrateOnboardingPanel();
      CH.state.ui.celebratedStep = stepIdx;
    }

    CH.els.onboardingPrev.disabled = stepIdx === 1;
    var showDockerControls = stepIdx === 1 && CH.state.dockerHelpersEnabled;
    CH.els.onboardingDockerConfig.classList.toggle("hidden", !showDockerControls);
    CH.els.onboardingDockerStart.classList.toggle("hidden", !showDockerControls);
    CH.els.onboardingDockerStop.classList.toggle("hidden", !showDockerControls);
    CH.els.onboardingDockerStatus.classList.toggle("hidden", !showDockerControls);
    CH.els.onboardingDockerLog.classList.toggle("hidden", !showDockerControls);
    syncDockerInputsFromState();
    CH.els.onboardingAutofill.textContent = "Auto Fill Step";
    CH.els.onboardingStepAction.textContent = step.actionLabel;
    CH.els.onboardingNext.textContent = stepIdx === CH.FLOW_STEPS.length ? "Finish Onboarding" : "Next";
    CH.els.onboardingNext.disabled = !ready;
    document.dispatchEvent(new CustomEvent("control-hub:onboarding", { detail: { step: stepIdx, total: CH.FLOW_STEPS.length, ready: ready, title: step.title, hint: CH.els.onboardingHint.textContent } }));
    applyFlowVisibility();
  }

  function renderDockerLog(prefix, result) {
    var lines = [];
    lines.push(prefix);
    if (result?.command) lines.push("$ " + result.command);
    if (result?.stdout) lines.push(result.stdout);
    if (result?.stderr) lines.push(result.stderr);
    CH.els.onboardingDockerLog.textContent = lines.filter(Boolean).join("\n\n") || "No output.";
  }

  async function dockerAction(action) {
    syncStateFromDockerInputs();
    var path = "/api/local/docker/" + action;
    var payload = {
      stack: CH.state.onboarding.dockerStack || "full",
      openclawImage: CH.state.onboarding.openclawImage || "",
      openclawContainerPort: CH.state.onboarding.openclawContainerPort || "",
    };
    var result = await CH.facadePost(path, payload);
    return result;
  }

  CH.syncDockerInputsFromState = syncDockerInputsFromState;
  CH.syncStateFromDockerInputs = syncStateFromDockerInputs;
  CH.celebrateOnboardingPanel = celebrateOnboardingPanel;
  CH.applyFlowVisibility = applyFlowVisibility;
  CH.renderOnboarding = renderOnboarding;
  CH.renderDockerLog = renderDockerLog;
  CH.dockerAction = dockerAction;
})(window.ControlHub);
