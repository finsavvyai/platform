"use strict";

(function (CH) {
  function hideChannelSetupGuide() {
    if (!CH.els.channelSetupGuide) return;
    CH.els.channelSetupGuide.classList.add("hidden");
  }

  function buildChannelSetupText(connection, channelType) {
    var webhook = connection?.webhookUrl || "http://localhost:8001/hooks/agent";
    var type = String(channelType || connection?.channelType || "webhook");
    return [
      "Channel type: " + type,
      "Webhook URL: " + webhook,
      "1. Open your channel provider dashboard.",
      "2. Paste this webhook URL as the incoming events endpoint.",
      "3. Send a test message from the provider.",
      "4. Click 'Send Test Event' here to verify worker path.",
    ].join("\n");
  }

  function showChannelSetupGuide(options) {
    if (!CH.els.channelSetupGuide) return;
    var connection = options?.connection || {};
    var channelType = options?.channelType || connection.channelType || "webhook";
    var webhookUrl = connection.webhookUrl || "http://localhost:8001/hooks/agent";
    var mode = options?.mode || CH.state.runtimeMode || "native";
    var title =
      mode === "local-facade"
        ? "Local Compatibility Setup"
        : "Channel Setup";
    var description =
      mode === "local-facade"
        ? "OpenClaw channel APIs are not exposed by this fork, so Control Hub configured a local channel bridge."
        : "Channel connection created. Use this guide to finish provider webhook setup.";

    CH.els.channelSetupTitle.textContent = title;
    CH.els.channelSetupText.textContent = description;
    CH.els.channelSetupWebhook.value = webhookUrl;
    if (!String(CH.els.channelSetupSession.value || "").trim()) {
      CH.els.channelSetupSession.value = "demo-session-1";
    }
    CH.els.channelSetupLog.textContent = buildChannelSetupText(connection, channelType);
    CH.els.channelSetupGuide.classList.remove("hidden");
    CH.setRuntimeMode(mode);
  }

  async function sendChannelSetupTestEvent() {
    var webhookUrl = String(CH.els.channelSetupWebhook?.value || "").trim();
    if (!webhookUrl) {
      CH.els.channelSetupLog.textContent = "Missing webhook URL.";
      return;
    }
    var workerUrl = "";
    try {
      var parsed = new URL(webhookUrl);
      workerUrl = parsed.protocol + "//" + parsed.host;
    } catch {
      CH.els.channelSetupLog.textContent = "Invalid webhook URL.";
      return;
    }

    var channelType = String(CH.els.channelType?.value || "webhook");
    var sessionId = String(CH.els.channelSetupSession?.value || "demo-session-1").trim();
    CH.els.channelSetupLog.textContent = "Sending test event...";
    try {
      var result = await CH.facadePost("/api/facade/channel/test-webhook", {
        workerUrl: workerUrl,
        channelType: channelType,
        sessionId: sessionId || "demo-session-1",
        sender: "control-hub-test",
        text: "test message from control hub",
      });
      CH.els.channelSetupLog.textContent = CH.pretty(result);
      if (result.ok) {
        CH.setOnboardingHintOverride("Test event delivered to worker webhook. Now test with your real channel.");
        CH.renderOnboarding();
      }
    } catch (err) {
      CH.els.channelSetupLog.textContent = CH.pretty({ error: err.message });
    }
  }

  async function connectChannel() {
    CH.saveConfig();
    CH.clearOnboardingHintOverride();
    var type = CH.els.channelType.value;
    var payload = {
      channelType: type,
      label: (CH.els.channelLabel.value || "").trim() || "My " + type,
      config: { defaultAgent: (CH.els.channelAgent.value || "run").trim() || "run" },
    };

    if (type === "whatsapp") {
      payload.credentials = {
        accessToken: (CH.els.channelAccessToken.value || "").trim(),
        phoneNumberId: (CH.els.channelPhoneId.value || "").trim(),
        verifyToken: (CH.els.channelVerify.value || "").trim(),
      };
    }
    if (type === "telegram") {
      payload.credentials = {
        botToken: (CH.els.channelBotToken.value || "").trim(),
      };
    }

    CH.els.connectResult.textContent = "Connecting...";
    try {
      var result = CH.expectProxySuccess(await CH.facadePost("/api/facade/connect-channel", {
        baseUrl: CH.state.openclawBaseUrl,
        authMode: CH.state.authMode,
        authSecret: CH.state.authSecret,
        userId: CH.state.userId,
        payload: payload,
      }));
      CH.els.connectResult.textContent = CH.pretty(result);
      var mode = String(result.body?.mode || CH.state.runtimeMode || "").toLowerCase();
      if (mode === "local-facade") {
        showChannelSetupGuide({
          mode: mode,
          channelType: type,
          connection: result.body?.connection || {
            channelType: type,
            label: payload.label,
            webhookUrl: result.body?.setup?.webhookUrl || "http://localhost:8001/hooks/agent",
          },
        });
        CH.setOnboardingHintOverride(
          "Channel saved in compatibility mode. Follow setup guide and send a test event.",
        );
      } else {
        hideChannelSetupGuide();
        CH.setRuntimeMode("native");
      }
      CH.state.flowChecks.channelConnected = true;
      await CH.refreshAll();
      CH.renderOnboarding();
      return true;
    } catch (err) {
      CH.els.connectResult.textContent = CH.pretty({ error: err.message, payload: payload });
      hideChannelSetupGuide();
      CH.renderOnboarding();
      return false;
    }
  }

  async function loadConnections() {
    try {
      var data = await CH.openclawProxy("/channels/connections");
      var entries = data.connections || [];
      CH.els.kpiChannels.textContent = String(entries.length);
      CH.renderList(
        CH.els.connections,
        entries,
        function (c) {
          return '<div class="item"><strong>' + (c.label || c.channelType) + '</strong><div class="meta">' + c.channelType + " \u00b7 " + c.status + " \u00b7 messages " + (c.messageCount || 0) + "</div></div>";
        },
      );
    } catch (err) {
      CH.els.connections.innerHTML = '<div class="item"><div class="meta">' + err.message + "</div></div>";
      CH.els.kpiChannels.textContent = "--";
    }
  }

  CH.hideChannelSetupGuide = hideChannelSetupGuide;
  CH.buildChannelSetupText = buildChannelSetupText;
  CH.showChannelSetupGuide = showChannelSetupGuide;
  CH.sendChannelSetupTestEvent = sendChannelSetupTestEvent;
  CH.connectChannel = connectChannel;
  CH.loadConnections = loadConnections;
})(window.ControlHub);
