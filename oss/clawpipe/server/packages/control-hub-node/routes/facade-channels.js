"use strict";

const utils = require("../utils");

function registerFacadeChannelRoutes(router, ctx) {
  router.post("/api/facade/openclaw-health", async (req, res) => {
    try {
      const body = await ctx.parseBody(req);
      const primary = await ctx.proxyRequest({ baseUrl: body.baseUrl || ctx.DEFAULTS.openclawBaseUrl, endpoint: "/health", method: "GET", authMode: body.authMode, authSecret: body.authSecret, userId: body.userId });
      if (primary.ok) { ctx.sendJson(res, 200, primary); return; }
      const fallback = await ctx.proxyRequest({ baseUrl: body.baseUrl || ctx.DEFAULTS.openclawBaseUrl, endpoint: "/", method: "GET", authMode: body.authMode, authSecret: body.authSecret, userId: body.userId });
      if (fallback.ok) {
        ctx.sendJson(res, 200, { ok: true, status: 200, url: fallback.url, body: { source: "fallback-root", message: "Service reachable (root endpoint)", raw: fallback.body } });
        return;
      }
      ctx.sendJson(res, 200, primary);
    } catch (err) { ctx.sendJson(res, 400, { error: err.message }); }
  });

  router.post("/api/facade/connect-channel", async (req, res) => {
    try {
      const body = await ctx.parseBody(req);
      const result = await ctx.proxyRequest({ baseUrl: body.baseUrl || ctx.DEFAULTS.openclawBaseUrl, endpoint: "/channels/connect", method: "POST", authMode: body.authMode, authSecret: body.authSecret, userId: body.userId, payload: body.payload || {} });
      if (result.ok || !utils.isMissingEndpoint(result)) { ctx.sendJson(res, 200, result); return; }
      const connection = ctx.upsertLocalChannelConnection(body.payload || {}, body.workerUrl || "http://localhost:8001");
      ctx.sendJson(res, 200, { ok: true, status: 200, url: "local://facade/channels/connect", body: { mode: "local-facade", warning: "OpenClaw channel endpoint is unavailable. Channel was configured in local compatibility mode.", connection, setup: { webhookUrl: connection.webhookUrl, note: "Configure your channel provider to send events to this webhook URL." } } });
    } catch (err) { ctx.sendJson(res, 400, { error: err.message }); }
  });

  router.post("/api/facade/channel/test-webhook", async (req, res) => {
    try {
      const body = await ctx.parseBody(req);
      const workerUrl = utils.normalizeBaseUrl(body.workerUrl || "http://localhost:8001");
      const payload = {
        channel: utils.normalizeChannelType(body.channelType || "webhook"),
        sender: String(body.sender || "local-user").trim() || "local-user",
        session_id: String(body.sessionId || "demo-session-1").trim() || "demo-session-1",
        text: String(body.text || "Hello from Control Hub test event").trim(),
        group: false,
        model: String(body.model || "default").trim() || "default",
      };
      const result = await ctx.proxyRequest({ baseUrl: workerUrl, endpoint: "/hooks/agent", method: "POST", payload });
      ctx.sendJson(res, 200, { ...result, payload, note: result.ok ? "Webhook accepted by worker." : "Worker returned non-200. See status/body." });
    } catch (err) { ctx.sendJson(res, 400, { error: err.message }); }
  });
}

module.exports = { registerFacadeChannelRoutes };
