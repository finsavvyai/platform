"use strict";

(function (CH) {
  async function loadNodes() {
    try {
      var data = await CH.finsavvyProxy("master", "/cluster/status");
      var nodes = data.online_nodes ?? data.total_nodes ?? 0;
      CH.els.kpiNodes.textContent = String(nodes);
    } catch {
      CH.els.kpiNodes.textContent = "--";
    }
  }

  function getSelectedNodeUrl() {
    var override = (CH.els.nodeUrlOverride.value || "").trim().replace(/\/+$/, "");
    if (override) return override;
    return (CH.els.nodeSelect.value || "").trim().replace(/\/+$/, "");
  }

  async function inspectNode() {
    CH.clearOnboardingHintOverride();
    var nodeUrl = getSelectedNodeUrl();
    if (!nodeUrl) {
      CH.els.nodeInspectResult.textContent = CH.pretty({
        error: "Select a worker node or provide Worker URL override.",
      });
      return false;
    }

    CH.els.nodeInspectResult.textContent = "Inspecting node...";
    try {
      var result = await CH.facadePost("/api/facade/node/inspect", { nodeUrl: nodeUrl });
      if (!result.ok) throw new Error(result.error || "Node inspection failed");
      CH.els.nodeInspectResult.textContent = CH.pretty(result);
      CH.state.flowChecks.nodeInspected = true;
      CH.renderOnboarding();
      return true;
    } catch (err) {
      CH.els.nodeInspectResult.textContent = CH.pretty({ error: err.message, nodeUrl: nodeUrl });
      CH.renderOnboarding();
      return false;
    }
  }

  function updateFlowChecksFromData(result) {
    var connections = result.connections?.ok ? result.connections.body.connections || [] : [];
    CH.state.flowChecks.openclawTested = Boolean(result.openclawHealth?.ok);
    CH.state.flowChecks.channelConnected = connections.length > 0;
  }

  function renderFromBootstrap(data) {
    var result = data.result || {};
    var snapshot = data.snapshot || {};
    var runtimeMode = CH.detectRuntimeMode(result);
    CH.setRuntimeMode(runtimeMode);

    CH.els.kpiNodes.textContent = String(snapshot.nodes ?? "--");
    CH.els.kpiModels.textContent = String(snapshot.models ?? "--");
    CH.els.kpiChannels.textContent = String(snapshot.channels ?? "--");
    CH.els.kpiServices.textContent = String(snapshot.services ?? "--");

    var types = result.channelTypes?.ok ? result.channelTypes.body.channelTypes || [] : [];
    var connections = result.connections?.ok
      ? result.connections.body.connections || []
      : [];
    var services = result.services?.ok ? result.services.body.services || [] : [];
    var providers = result.providers?.ok
      ? result.providers.body
      : { error: result.providers?.body?.error || "Unavailable" };
    var models = result.models?.ok
      ? result.models.body.data || result.models.body.models || []
      : [];
    updateFlowChecksFromData(result);
    CH.state.agents = result.agents?.ok ? CH.toAgentOptions(result.agents.body) : [];
    CH.state.nodes = result.clusterNodes?.ok ? CH.toNodeOptions(result.clusterNodes.body) : [];

    CH.renderList(
      CH.els.channelTypes,
      types,
      function (ch) {
        return '<div class="item"><strong>' + CH.escapeHtml(ch.name || ch.type) + '</strong><div class="meta">' + CH.escapeHtml(ch.type) + " \u00b7 " + CH.escapeHtml(ch.authMethod || "n/a") + "<br>" + CH.escapeHtml(ch.description || "") + "</div></div>";
      },
    );
    CH.renderList(
      CH.els.connections,
      connections,
      function (c) {
        return '<div class="item"><strong>' + CH.escapeHtml(c.label || c.channelType) + '</strong><div class="meta">' + CH.escapeHtml(c.channelType) + " \u00b7 " + CH.escapeHtml(c.status || "unknown") + " \u00b7 messages " + CH.escapeHtml(c.messageCount || 0) + "</div></div>";
      },
    );
    CH.renderList(
      CH.els.services,
      services,
      function (s) {
        return '<div class="item"><strong>' + CH.escapeHtml(s.name || s.id) + '</strong><div class="meta">' + CH.escapeHtml(s.tier || "core") + " \u00b7 " + CH.escapeHtml(s.status || "unknown") + "<br>" + CH.escapeHtml(s.quickInfo || s.description || "") + "</div></div>";
      },
    );
    CH.els.providers.textContent = CH.pretty(providers);
    CH.els.models.textContent = models
      .map(function (m) { return typeof m === "string" ? m : m.id || m.model_id || m.name; })
      .filter(Boolean)
      .join("\n") || "No models";
    CH.setSelectOptions(
      CH.els.skillAgent,
      CH.state.agents.map(function (a) { return { value: a.id, label: a.label }; }),
      "No agents found",
    );
    CH.setSelectOptions(CH.els.nodeSelect, CH.state.nodes, "No worker nodes discovered");
    if (runtimeMode === "local-facade" && connections.length > 0) {
      CH.showChannelSetupGuide({
        mode: runtimeMode,
        channelType: connections[0].channelType,
        connection: connections[0],
      });
    } else if (runtimeMode !== "local-facade") {
      CH.hideChannelSetupGuide();
    }
    CH.renderOnboarding();
  }

  async function refreshAll() {
    CH.saveConfig();
    try {
      var data = await CH.facadePost("/api/facade/bootstrap", {
        openclawBaseUrl: CH.state.openclawBaseUrl,
        gatewayUrl: CH.state.gatewayUrl,
        masterUrl: CH.state.masterUrl,
        authMode: CH.state.authMode,
        authSecret: CH.state.authSecret,
        userId: CH.state.userId,
      });
      renderFromBootstrap(data);
      if (data.result?.openclawHealth?.ok) {
        CH.setStatus("OpenClaw reachable", true);
      } else {
        CH.setStatus("OpenClaw unavailable", false);
      }
    } catch (err) {
      CH.setStatus("Refresh failed: " + err.message, false);
      CH.renderOnboarding();
    }
  }

  CH.loadNodes = loadNodes;
  CH.getSelectedNodeUrl = getSelectedNodeUrl;
  CH.inspectNode = inspectNode;
  CH.updateFlowChecksFromData = updateFlowChecksFromData;
  CH.renderFromBootstrap = renderFromBootstrap;
  CH.refreshAll = refreshAll;
})(window.ControlHub);
