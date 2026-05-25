"use strict";

(function (CH) {
  async function startDockerHere() {
    if (!CH.state.dockerHelpersEnabled) {
      CH.setOnboardingHintOverride("Docker controls are disabled by server policy.");
      CH.renderOnboarding();
      return false;
    }
    CH.syncStateFromDockerInputs();
    var stack = CH.state.onboarding.dockerStack || "full";
    CH.els.onboardingDockerLog.textContent = "Starting Docker stack (" + stack + ")...";
    CH.setOnboardingHintOverride("Starting Docker. This may take 1-5 minutes on first run.");
    CH.renderOnboarding();

    try {
      var result = await CH.dockerAction("up");
      CH.renderDockerLog("Docker stack started.", result);
      if (stack === "full" && !String(CH.els.openclawUrl.value || "").trim()) {
        CH.els.openclawUrl.value = "http://localhost:11434";
      }
      if (!String(CH.els.gatewayUrl.value || "").trim()) {
        CH.els.gatewayUrl.value = "http://localhost:8080";
      }
      if (!String(CH.els.masterUrl.value || "").trim()) {
        CH.els.masterUrl.value = "http://localhost:8000";
      }
      CH.saveConfig();
      if (stack === "full") {
        CH.setOnboardingHintOverride(
          "Docker started. Wait until services are healthy, then click 'Test OpenClaw'.",
        );
      } else {
        CH.setOnboardingHintOverride(
          "Core stack started. Set OpenClaw URL to your running fork endpoint, then click 'Test OpenClaw'.",
        );
      }
      CH.renderOnboarding();
      await CH.refreshAll();
      return true;
    } catch (err) {
      CH.els.onboardingDockerLog.textContent = CH.pretty({ error: err.message });
      var msg = String(err.message || "").toLowerCase();
      if (msg.includes("pull access denied") && msg.includes("openclaw")) {
        CH.setOnboardingHintOverride(
          "Set 'OpenClaw Image (fork override)' to your fork image, then click 'Start Here (Docker)' again.",
        );
        CH.focusInput("onboarding-openclaw-image");
      } else if (msg.includes("openclaw is unhealthy")) {
        CH.setOnboardingHintOverride(
          "OpenClaw container is up but unhealthy. If your fork is LunaOS, set OpenClaw Container Port to 8000 and retry.",
        );
        CH.focusInput("onboarding-openclaw-port");
      } else {
        CH.setOnboardingHintOverride(
          "Docker start failed. Open Docker Desktop, then click 'Start Here (Docker)' again.",
        );
      }
      CH.renderOnboarding();
      return false;
    }
  }

  async function stopDockerHere() {
    if (!CH.state.dockerHelpersEnabled) {
      CH.setOnboardingHintOverride("Docker controls are disabled by server policy.");
      CH.renderOnboarding();
      return false;
    }
    CH.els.onboardingDockerLog.textContent = "Stopping Docker stack...";
    try {
      var result = await CH.dockerAction("down");
      CH.renderDockerLog("Docker stack stopped.", result);
      CH.setOnboardingHintOverride("Docker stack stopped.");
      CH.renderOnboarding();
      return true;
    } catch (err) {
      CH.els.onboardingDockerLog.textContent = CH.pretty({ error: err.message });
      return false;
    }
  }

  async function checkDockerHere() {
    if (!CH.state.dockerHelpersEnabled) {
      CH.setOnboardingHintOverride("Docker controls are disabled by server policy.");
      CH.renderOnboarding();
      return false;
    }
    CH.els.onboardingDockerLog.textContent = "Checking Docker status...";
    try {
      var result = await CH.dockerAction("status");
      CH.renderDockerLog("Docker status.", result);
      return true;
    } catch (err) {
      CH.els.onboardingDockerLog.textContent = CH.pretty({ error: err.message });
      return false;
    }
  }
  function getBlockingMessageForCurrentStep() {
    var stepIdx = CH.state.onboarding.step;
    if (stepIdx === 1) {
      if (!String(CH.els.openclawUrl.value || "").trim()) {
        return "Click 'Start Here (Docker)' or enter OpenClaw Base URL first.";
      }
    }
    if (stepIdx === 2) {
      var type = String(CH.els.channelType.value || "webhook");
      if (type === "whatsapp") {
        var access = String(CH.els.channelAccessToken.value || "").trim();
        var phone = String(CH.els.channelPhoneId.value || "").trim();
        if (!access || !phone) {
          return "For WhatsApp, add Access Token and Phone Number ID.";
        }
      }
      if (type === "telegram") {
        var bot = String(CH.els.channelBotToken.value || "").trim();
        if (!bot) return "For Telegram, add Bot Token.";
      }
    }
    if (stepIdx === 3) {
      if (!String(CH.els.skillContext.value || "").trim()) {
        return "Add a Context message before running a skill.";
      }
    }
    if (stepIdx === 4) {
      if (!CH.getSelectedNodeUrl()) {
        return "Select Worker Node or provide Worker URL override.";
      }
    }
    return "";
  }
  function autofillCurrentStep() {
    var stepIdx = CH.state.onboarding.step;
    if (stepIdx === 1) {
      if (!String(CH.els.openclawUrl.value || "").trim()) {
        CH.els.openclawUrl.value = CH.state.openclawBaseUrl || "http://localhost:11434";
      }
      if (!String(CH.els.gatewayUrl.value || "").trim()) {
        CH.els.gatewayUrl.value = CH.state.gatewayUrl || "http://localhost:8080";
      }
      if (!String(CH.els.masterUrl.value || "").trim()) {
        CH.els.masterUrl.value = CH.state.masterUrl || "http://localhost:8000";
      }
      CH.setOnboardingHintOverride("Filled common local endpoints. Update if your URLs are different.");
    } else if (stepIdx === 2) {
      if (!String(CH.els.channelType.value || "").trim()) {
        CH.els.channelType.value = "webhook";
      }
      if (!String(CH.els.channelLabel.value || "").trim()) {
        CH.els.channelLabel.value = "My Webhook Channel";
      }
      if (!String(CH.els.channelAgent.value || "").trim()) {
        CH.els.channelAgent.value = "run";
      }
      CH.setOnboardingHintOverride("Filled channel defaults. For fastest test, keep channel type as webhook.");
    } else if (stepIdx === 3) {
      if (!String(CH.els.skillContext.value || "").trim()) {
        CH.els.skillContext.value =
          "Summarize current cluster status and suggest one optimization action.";
      }
      CH.setOnboardingHintOverride("Added a starter prompt. You can edit it before running.");
    } else if (stepIdx === 4) {
      if (!String(CH.els.nodeUrlOverride.value || "").trim() && !String(CH.els.nodeSelect.value || "").trim()) {
        CH.els.nodeUrlOverride.value = "http://localhost:8001";
      }
      CH.setOnboardingHintOverride("Added local worker URL. Change it if your worker runs elsewhere.");
    }
    CH.saveConfig();
    CH.renderOnboarding();
  }
  async function runOnboardingStepAction() {
    var blocked = getBlockingMessageForCurrentStep();
    if (blocked) {
      CH.setOnboardingHintOverride(blocked);
      var focusId = CH.currentStepConfig().focusId;
      if (focusId) CH.focusInput(focusId);
      CH.renderOnboarding();
      return;
    }

    CH.clearOnboardingHintOverride();
    var stepIdx = CH.state.onboarding.step;
    if (stepIdx === 1) {
      await CH.testOpenclaw();
    } else if (stepIdx === 2) {
      await CH.connectChannel();
    } else if (stepIdx === 3) {
      await CH.runSkill();
    } else if (stepIdx === 4) {
      await CH.inspectNode();
    }
    CH.renderOnboarding();
  }
  CH.startDockerHere = startDockerHere;
  CH.stopDockerHere = stopDockerHere;
  CH.checkDockerHere = checkDockerHere;
  CH.getBlockingMessageForCurrentStep = getBlockingMessageForCurrentStep;
  CH.autofillCurrentStep = autofillCurrentStep;
  CH.runOnboardingStepAction = runOnboardingStepAction;
})(window.ControlHub);
