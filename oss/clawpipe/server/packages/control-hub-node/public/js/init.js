"use strict";

(function (CH) {
  document.getElementById("save-config").addEventListener("click", function () {
    CH.saveConfig();
    CH.testOpenclaw();
  });
  document.getElementById("test-openclaw").addEventListener("click", CH.testOpenclaw);
  document.getElementById("connect-channel").addEventListener("click", CH.connectChannel);
  document.getElementById("reload-connections").addEventListener("click", CH.refreshAll);
  document.getElementById("refresh-all").addEventListener("click", CH.refreshAll);
  CH.els.rememberAuthSecret.addEventListener("change", CH.saveConfig);
  CH.els.channelSetupCopyUrl.addEventListener("click", async function () {
    var text = String(CH.els.channelSetupWebhook.value || "").trim();
    var ok = await CH.copyText(text);
    CH.els.channelSetupLog.textContent = ok
      ? "Webhook URL copied."
      : "Copy failed. Value:\n" + text;
  });
  CH.els.channelSetupCopyInstructions.addEventListener("click", async function () {
    var text = CH.buildChannelSetupText(
      {
        channelType: CH.els.channelType.value,
        webhookUrl: CH.els.channelSetupWebhook.value,
      },
      CH.els.channelType.value,
    );
    var ok = await CH.copyText(text);
    CH.els.channelSetupLog.textContent = ok
      ? "Setup text copied."
      : "Copy failed. Instructions:\n" + text;
  });
  CH.els.channelSetupSendTest.addEventListener("click", CH.sendChannelSetupTestEvent);
  CH.els.runSkill.addEventListener("click", CH.runSkill);
  CH.els.inspectNode.addEventListener("click", CH.inspectNode);
  CH.els.nodeLoadModel.addEventListener("click", CH.loadModelOnNode);
  CH.els.nodeUnloadModel.addEventListener("click", CH.unloadModelOnNode);
  CH.els.onboardingPrev.addEventListener("click", function () {
    CH.setStep(CH.state.onboarding.step - 1, true);
  });
  CH.els.onboardingDockerStack.addEventListener("change", CH.syncStateFromDockerInputs);
  CH.els.onboardingOpenclawImage.addEventListener("input", CH.syncStateFromDockerInputs);
  CH.els.onboardingOpenclawPort.addEventListener("input", CH.syncStateFromDockerInputs);
  CH.els.onboardingDockerStart.addEventListener("click", CH.startDockerHere);
  CH.els.onboardingDockerStop.addEventListener("click", CH.stopDockerHere);
  CH.els.onboardingDockerStatus.addEventListener("click", CH.checkDockerHere);
  CH.els.onboardingAutofill.addEventListener("click", CH.autofillCurrentStep);
  CH.els.onboardingStepAction.addEventListener("click", CH.runOnboardingStepAction);
  CH.els.onboardingNext.addEventListener("click", function () {
    if (!CH.isCurrentStepReady()) {
      CH.renderOnboarding();
      return;
    }
    if (CH.state.onboarding.step >= CH.FLOW_STEPS.length) {
      CH.setOnboardingEnabled(false);
      return;
    }
    CH.setStep(CH.state.onboarding.step + 1, true);
  });
  CH.els.onboardingSkip.addEventListener("click", function () {
    CH.setOnboardingEnabled(false);
  });
  CH.els.toggleOnboarding.addEventListener("click", function () {
    if (CH.state.onboarding.enabled) {
      CH.setOnboardingEnabled(false);
      return;
    }
    CH.state.onboarding.completed = false;
    CH.state.onboarding.enabled = true;
    if (!CH.state.onboarding.step) CH.state.onboarding.step = 1;
    CH.saveOnboardingState();
    CH.setStep(CH.state.onboarding.step, true);
  });

  // Boot sequence.
  CH.loadConfig();
  CH.loadServerHealth();
  CH.loadOnboardingState();
  if (CH.state.onboarding.enabled) {
    CH.setStep(CH.state.onboarding.step, false);
  } else {
    CH.renderOnboarding();
  }
  CH.refreshAll();
})(window.ControlHub);
