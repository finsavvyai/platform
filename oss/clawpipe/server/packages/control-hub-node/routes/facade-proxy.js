"use strict";

function registerFacadeProxyRoutes(router, ctx) {
  router.post("/api/openclaw/proxy", async (req, res) => {
    try {
      const body = await ctx.parseBody(req);
      const result = await ctx.proxyRequest({
        baseUrl: body.baseUrl || ctx.DEFAULTS.openclawBaseUrl,
        endpoint: body.endpoint,
        method: body.method || "GET",
        authMode: body.authMode,
        authSecret: body.authSecret,
        userId: body.userId,
        payload: body.payload,
      });
      ctx.sendJson(res, 200, result);
    } catch (err) { ctx.sendJson(res, 400, { error: err.message }); }
  });

  router.post("/api/finsavvy/proxy", async (req, res) => {
    try {
      const body = await ctx.parseBody(req);
      const target = body.target === "master"
        ? body.baseUrl || ctx.DEFAULTS.masterUrl
        : body.baseUrl || ctx.DEFAULTS.gatewayUrl;
      const result = await ctx.proxyRequest({
        baseUrl: target,
        endpoint: body.endpoint,
        method: body.method || "GET",
        payload: body.payload,
        extraHeaders: body.headers,
      });
      ctx.sendJson(res, 200, result);
    } catch (err) { ctx.sendJson(res, 400, { error: err.message }); }
  });
}

module.exports = { registerFacadeProxyRoutes };
