"use strict";

function registerHealthRoutes(router, ctx) {
  router.get("/api/healthz", (_req, res) => {
    ctx.sendJson(res, 200, {
      status: "ok",
      service: "control-hub-node",
      timestamp: new Date().toISOString(),
    });
  });

  router.get("/api/health", (_req, res) => {
    ctx.sendJson(res, 200, {
      status: "ok",
      service: "control-hub-node",
      defaults: ctx.DEFAULTS,
      uptimeSeconds: Math.floor((Date.now() - ctx.STARTED_AT) / 1000),
      authEnabled: Boolean(ctx.BASIC_AUTH),
      fetchTimeoutMs: ctx.FETCH_TIMEOUT_MS,
      proxyAllowlistEnabled: ctx.PROXY_ALLOWLIST.size > 0,
      dockerHelpersEnabled: ctx.DOCKER_HELPERS_ENABLED,
      trustProxy: ctx.TRUST_PROXY,
      rateLimitEnabled: ctx.RATE_LIMIT_ENABLED,
      rateLimitWindowMs: ctx.RATE_LIMIT_WINDOW_MS,
      rateLimitMax: ctx.RATE_LIMIT_MAX,
      auditLogEnabled: ctx.AUDIT_LOG_ENABLED,
      auditLogHealthz: ctx.AUDIT_LOG_HEALTHZ,
      auditLogFile: ctx.AUDIT_LOG_FILE,
      stateFile: ctx.STATE_FILE,
      timestamp: new Date().toISOString(),
    });
  });

  router.get("/api/config/defaults", (_req, res) => {
    ctx.sendJson(res, 200, ctx.DEFAULTS);
  });
}

module.exports = { registerHealthRoutes };
