"use strict";

(function (CH) {
  async function loadServices() {
    try {
      var data = await CH.openclawProxy("/services");
      var entries = data.services || [];
      CH.els.kpiServices.textContent = String(entries.length);
      CH.renderList(
        CH.els.services,
        entries,
        function (s) {
          return '<div class="item"><strong>' + CH.escapeHtml(s.name || s.id) + '</strong><div class="meta">' + CH.escapeHtml(s.tier || "core") + " \u00b7 " + CH.escapeHtml(s.status || "unknown") + "<br>" + CH.escapeHtml(s.quickInfo || s.description || "") + "</div></div>";
        },
      );
    } catch (err) {
      CH.els.services.innerHTML = '<div class="item"><div class="meta">' + err.message + "</div></div>";
      CH.els.kpiServices.textContent = "--";
    }
  }

  async function loadProviders() {
    try {
      var providers = await CH.openclawProxy("/services/providers/status");
      CH.els.providers.textContent = CH.pretty(providers);
    } catch (err) {
      CH.els.providers.textContent = CH.pretty({ error: err.message });
    }
  }

  async function testOpenclaw() {
    CH.saveConfig();
    CH.clearOnboardingHintOverride();
    try {
      CH.expectProxySuccess(await CH.facadePost("/api/facade/openclaw-health", {
        baseUrl: CH.state.openclawBaseUrl,
        authMode: CH.state.authMode,
        authSecret: CH.state.authSecret,
        userId: CH.state.userId,
      }));
      CH.setStatus("OpenClaw reachable", true);
      CH.state.flowChecks.openclawTested = true;
      CH.renderOnboarding();
      return true;
    } catch (err) {
      CH.setStatus("Failed: " + err.message, false);
      CH.state.flowChecks.openclawTested = false;
      CH.renderOnboarding();
      return false;
    }
  }

  async function runSkill() {
    CH.saveConfig();
    CH.clearOnboardingHintOverride();
    var agent = (CH.els.skillAgent.value || "").trim();
    var context = (CH.els.skillContext.value || "").trim();
    if (!agent) {
      CH.els.skillResult.textContent = CH.pretty({ error: "Select an agent skill first." });
      return false;
    }
    if (!context) {
      CH.els.skillResult.textContent = CH.pretty({ error: "Context is required." });
      return false;
    }

    var payload = {
      agent: agent,
      tool: agent,
      useRag: CH.els.skillRag.value === "true",
      use_rag: CH.els.skillRag.value === "true",
      source: (CH.els.skillSource.value || "").trim() || "control-hub-node",
      context: context,
      input: context,
      query: context,
    };
    var provider = (CH.els.skillProvider.value || "").trim();
    if (provider) payload.provider = provider;

    CH.els.skillResult.textContent = "Running skill...";
    try {
      var result = CH.expectProxySuccess(await CH.facadePost("/api/facade/skills/run", {
        baseUrl: CH.state.openclawBaseUrl,
        authMode: CH.state.authMode,
        authSecret: CH.state.authSecret,
        userId: CH.state.userId,
        payload: payload,
      }));
      CH.els.skillResult.textContent = CH.pretty(result.body ?? result);
      CH.state.flowChecks.skillRan = true;
      CH.renderOnboarding();
      return true;
    } catch (err) {
      CH.els.skillResult.textContent = CH.pretty({ error: err.message, payload: payload });
      CH.renderOnboarding();
      return false;
    }
  }

  CH.loadServices = loadServices;
  CH.loadProviders = loadProviders;
  CH.testOpenclaw = testOpenclaw;
  CH.runSkill = runSkill;
})(window.ControlHub);
