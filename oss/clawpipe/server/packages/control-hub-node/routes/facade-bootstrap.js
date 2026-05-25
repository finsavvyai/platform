"use strict";

const utils = require("../utils");

function applyBootstrapFallbacks(result, localFacadeState, modelsCount) {
  if (utils.isMissingEndpoint(result.channelTypes)) {
    result.channelTypes = { ok: true, status: 200, url: "local://facade/channels", body: { channelTypes: utils.FALLBACK_CHANNEL_TYPES, mode: "local-facade" } };
  }
  if (utils.isMissingEndpoint(result.connections)) {
    result.connections = { ok: true, status: 200, url: "local://facade/channels/connections", body: { connections: localFacadeState.channels, mode: "local-facade" } };
  }
  if (utils.isMissingEndpoint(result.agents)) {
    result.agents = { ok: true, status: 200, url: "local://facade/tools/agents", body: { agents: utils.buildFallbackAgents(), mode: "local-facade" } };
  }
  if (utils.isMissingEndpoint(result.services)) {
    result.services = { ok: true, status: 200, url: "local://facade/services", body: { services: utils.buildFallbackServices(modelsCount), mode: "local-facade" } };
  }
  if (utils.isMissingEndpoint(result.providers)) {
    result.providers = { ok: true, status: 200, url: "local://facade/services/providers/status", body: { mode: "local-facade", providers: [{ name: "cluster", status: modelsCount > 0 ? "ready" : "degraded" }] } };
  }
}

function registerFacadeBootstrapRoute(router, ctx) {
  router.post("/api/facade/bootstrap", async (req, res) => {
    try {
      const body = await ctx.parseBody(req);
      const openclawBaseUrl = body.openclawBaseUrl || ctx.DEFAULTS.openclawBaseUrl;
      const { authMode, authSecret, userId } = body;
      const gatewayUrl = body.gatewayUrl || ctx.DEFAULTS.gatewayUrl;
      const masterUrl = body.masterUrl || ctx.DEFAULTS.masterUrl;

      const tasks = {
        openclawHealth: ctx.proxyRequest({ baseUrl: openclawBaseUrl, endpoint: "/health", method: "GET", authMode, authSecret, userId }),
        channelTypes: ctx.proxyRequest({ baseUrl: openclawBaseUrl, endpoint: "/channels", method: "GET", authMode, authSecret, userId }),
        connections: ctx.proxyRequest({ baseUrl: openclawBaseUrl, endpoint: "/channels/connections", method: "GET", authMode, authSecret, userId }),
        services: ctx.proxyRequest({ baseUrl: openclawBaseUrl, endpoint: "/services", method: "GET", authMode, authSecret, userId }),
        providers: ctx.proxyRequest({ baseUrl: openclawBaseUrl, endpoint: "/services/providers/status", method: "GET", authMode, authSecret, userId }),
        agents: ctx.proxyRequest({ baseUrl: openclawBaseUrl, endpoint: "/tools/agents", method: "GET", authMode, authSecret, userId }),
        models: ctx.proxyRequest({ baseUrl: gatewayUrl, endpoint: "/v1/models", method: "GET" }),
        cluster: ctx.proxyRequest({ baseUrl: masterUrl, endpoint: "/cluster/status", method: "GET" }),
        clusterNodes: ctx.proxyRequest({ baseUrl: masterUrl, endpoint: "/cluster/nodes", method: "GET" }),
      };

      const entries = Object.entries(tasks);
      const settled = await Promise.allSettled(entries.map(([, p]) => p));
      const result = {};
      for (let i = 0; i < entries.length; i++) {
        const [key] = entries[i];
        result[key] = settled[i].status === "fulfilled"
          ? settled[i].value
          : { ok: false, status: 599, body: { error: settled[i].reason?.message || "Request failed" } };
      }

      if (utils.isMissingEndpoint(result.openclawHealth)) {
        const rootHealth = await ctx.proxyRequest({ baseUrl: openclawBaseUrl, endpoint: "/", method: "GET", authMode, authSecret, userId });
        if (rootHealth.ok) result.openclawHealth = { ok: true, status: 200, url: rootHealth.url, body: { source: "fallback-root", message: "Service reachable (root endpoint)", raw: rootHealth.body } };
      }

      const modelsCount = result.models?.ok && Array.isArray(result.models?.body?.data) ? result.models.body.data.length : 0;
      applyBootstrapFallbacks(result, ctx.localFacadeState, modelsCount);

      const snapshot = {
        nodes: result.cluster?.ok ? result.cluster.body.online_nodes ?? result.cluster.body.total_nodes ?? 0 : 0,
        models: result.models?.ok ? (Array.isArray(result.models.body.data) ? result.models.body.data.length : 0) : 0,
        channels: result.connections?.ok ? (Array.isArray(result.connections.body.connections) ? result.connections.body.connections.length : 0) : 0,
        services: result.services?.ok ? (Array.isArray(result.services.body.services) ? result.services.body.services.length : 0) : 0,
      };

      ctx.sendJson(res, 200, { ok: true, snapshot, result });
    } catch (err) { ctx.sendJson(res, 400, { error: err.message }); }
  });
}

module.exports = { registerFacadeBootstrapRoute };
