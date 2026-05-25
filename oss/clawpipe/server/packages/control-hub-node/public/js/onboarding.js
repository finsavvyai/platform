"use strict";

(function (CH) {
  var FLOW_STORAGE_KEY = "control_hub_onboarding";
  var FLOW_STEPS = [
    {
      title: "Step 1 of 4 - Connect OpenClaw",
      description: "Start services (optional via Docker), then verify OpenClaw health.",
      sections: ["sec-connection"],
      focusId: "openclaw-url",
      actionLabel: "Test OpenClaw",
      readinessKey: "openclawTested",
      hintPending: "Start Docker here or enter your URL, then click 'Test OpenClaw'.",
      hintReady: "OpenClaw is reachable. Continue to channel onboarding.",
      nextInstruction: "When status turns green, click Next.",
      checklist: [
        "If this is your local fork, click 'Start Here (Docker)'.",
        "If Docker buttons are hidden, server policy disabled local Docker helpers.",
        "If your OpenClaw image is private/custom, set it in 'OpenClaw Image (fork override)'.",
        "If your fork listens on a non-default internal port (e.g. LunaOS uses 8000), set OpenClaw Container Port.",
        "Wait until Docker status shows services up.",
        "OpenClaw URL should be http://localhost:11434 (unless custom).",
        "If your server requires auth, set Auth Mode + Auth Secret.",
        "Click 'Test OpenClaw'.",
      ],
    },
    {
      title: "Step 2 of 4 - Connect Your First Channel",
      description: "Create one inbound channel (WhatsApp/Telegram/Slack/etc).",
      sections: ["sec-connect-channel", "sec-connected", "sec-channel-types"],
      focusId: "channel-type",
      actionLabel: "Connect Channel",
      readinessKey: "channelConnected",
      hintPending: "Connect at least one channel to continue.",
      hintReady: "A channel is connected. Continue to skill execution.",
      nextInstruction: "After one channel appears in Connected Channels, click Next.",
      checklist: [
        "Pick channel type (use webhook first for fastest setup).",
        "Set a Label and optional Default Agent.",
        "Click 'Connect'.",
      ],
    },
    {
      title: "Step 3 of 4 - Run First Skill",
      description: "Execute a skill with context so the routing path is validated.",
      sections: ["sec-skill", "sec-services"],
      focusId: "skill-context",
      actionLabel: "Run Skill",
      readinessKey: "skillRan",
      hintPending: "Run one skill successfully to continue.",
      hintReady: "Skill execution worked. Continue to node management.",
      nextInstruction: "If result JSON appears without error, click Next.",
      checklist: [
        "Choose an Agent Skill.",
        "Paste a short request in Context.",
        "Click 'Run Skill'.",
      ],
    },
    {
      title: "Step 4 of 4 - Inspect Node",
      description: "Inspect a worker and confirm model operations are reachable.",
      sections: ["sec-node", "sec-offerings"],
      focusId: "node-url-override",
      actionLabel: "Inspect Node",
      readinessKey: "nodeInspected",
      hintPending: "Inspect a node to complete onboarding.",
      hintReady: "Node inspection succeeded. You can finish onboarding.",
      nextInstruction: "After inspection returns data, click Finish Onboarding.",
      checklist: [
        "Select a discovered node OR enter Worker URL override.",
        "Click 'Inspect Node'.",
        "Verify health/status/models appear in the output.",
      ],
    },
  ];

  CH.FLOW_STORAGE_KEY = FLOW_STORAGE_KEY;
  CH.FLOW_STEPS = FLOW_STEPS;

  function saveOnboardingState() {
    localStorage.setItem(FLOW_STORAGE_KEY, JSON.stringify(CH.state.onboarding));
  }

  function loadOnboardingState() {
    var raw = localStorage.getItem(FLOW_STORAGE_KEY);
    if (!raw) return;
    try {
      var parsed = JSON.parse(raw);
      CH.state.onboarding.completed = parsed.completed === true;
      CH.state.onboarding.enabled = CH.state.onboarding.completed ? false : parsed.enabled !== false;
      CH.state.onboarding.step = Number(parsed.step) || 1;
      CH.state.onboarding.dockerStack =
        parsed.dockerStack === "core" || parsed.dockerStack === "full"
          ? parsed.dockerStack
          : "full";
      CH.state.onboarding.openclawImage = String(parsed.openclawImage || "");
      CH.state.onboarding.openclawContainerPort = String(parsed.openclawContainerPort || "");
    } catch {
      // no-op
    }
  }

  function setOnboardingHintOverride(message) {
    CH.state.onboarding.hintOverride = String(message || "");
  }

  function clearOnboardingHintOverride() {
    CH.state.onboarding.hintOverride = "";
  }

  function currentStepConfig() {
    var idx = Math.min(Math.max(CH.state.onboarding.step, 1), FLOW_STEPS.length) - 1;
    return FLOW_STEPS[idx];
  }

  function isCurrentStepReady() {
    var step = currentStepConfig();
    return Boolean(CH.state.flowChecks[step.readinessKey]);
  }

  function setOnboardingEnabled(enabled) {
    CH.state.onboarding.enabled = Boolean(enabled);
    if (!CH.state.onboarding.enabled) {
      CH.state.onboarding.completed = true;
    }
    saveOnboardingState();
    CH.renderOnboarding();
  }

  function setStep(step, scrollToTarget) {
    var normalized = Math.min(Math.max(Number(step) || 1, 1), FLOW_STEPS.length);
    CH.state.onboarding.step = normalized;
    clearOnboardingHintOverride();
    saveOnboardingState();
    CH.renderOnboarding();

    if (scrollToTarget) {
      var sectionId = currentStepConfig().sections[0];
      var target = document.getElementById(sectionId);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }

    var focusId = currentStepConfig().focusId;
    if (focusId) CH.focusInput(focusId);
  }

  CH.saveOnboardingState = saveOnboardingState;
  CH.loadOnboardingState = loadOnboardingState;
  CH.setOnboardingHintOverride = setOnboardingHintOverride;
  CH.clearOnboardingHintOverride = clearOnboardingHintOverride;
  CH.currentStepConfig = currentStepConfig;
  CH.isCurrentStepReady = isCurrentStepReady;
  CH.setOnboardingEnabled = setOnboardingEnabled;
  CH.setStep = setStep;
})(window.ControlHub);
