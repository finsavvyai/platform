#!/usr/bin/env node
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const utils = require("./utils");
const { makeRouter } = require("./router");
const { resolveBasicAuthCredentials, requireBasicAuth } = require("./middleware/auth");
const { makeRateLimitStore, getClientIp, consumeRateLimit } = require("./middleware/rate-limit");
const { writeAuditEvent } = require("./middleware/audit");
const { proxyRequest } = require("./services/proxy");
const { runDockerCompose, detectLocalFallbackOpenclawImage } = require("./services/docker");
const { loadLocalState, upsertLocalChannelConnection } = require("./services/state");
const { registerHealthRoutes } = require("./routes/health");
const { registerDockerRoutes } = require("./routes/docker-routes");
const { registerFacadeProxyRoutes } = require("./routes/facade-proxy");
const { registerFacadeChannelRoutes } = require("./routes/facade-channels");
const { registerFacadeSkillRoutes } = require("./routes/facade-skills");
const { registerFacadeNodeRoutes } = require("./routes/facade-nodes");
const { registerFacadeBootstrapRoute } = require("./routes/facade-bootstrap");

const { parseBooleanEnv, parseIntEnv, SECURITY_HEADERS } = utils;
const PORT = Number(process.env.PORT || 9090);
const HOST = process.env.HOST || "127.0.0.1";
const STATIC_DIR = path.join(__dirname, "public");
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const STARTED_AT = Date.now();
const FETCH_TIMEOUT_MS = Number(process.env.CONTROL_HUB_FETCH_TIMEOUT_MS || 15000);
const DOCKER_HELPERS_ENABLED = String(process.env.CONTROL_HUB_ENABLE_DOCKER_HELPERS || "true").toLowerCase() !== "false";
const PROXY_ALLOWLIST = new Set(String(process.env.CONTROL_HUB_PROXY_ALLOWLIST || "").split(",").map((i) => i.trim().toLowerCase()).filter(Boolean));
const STATE_FILE = process.env.CONTROL_HUB_STATE_FILE || path.join(PROJECT_ROOT, ".control-hub", "control-hub-state.json");
const AUDIT_LOG_FILE = process.env.CONTROL_HUB_AUDIT_LOG_FILE || path.join(PROJECT_ROOT, ".control-hub", "control-hub-audit.log");
const BASIC_AUTH = resolveBasicAuthCredentials(process.env);
const TRUST_PROXY = parseBooleanEnv(process.env.CONTROL_HUB_TRUST_PROXY, false);
const RATE_LIMIT_ENABLED = parseBooleanEnv(process.env.CONTROL_HUB_RATE_LIMIT_ENABLED || "true", true);
const RATE_LIMIT_WINDOW_MS = parseIntEnv(process.env.CONTROL_HUB_RATE_LIMIT_WINDOW_MS || "60000", 60000, 1000);
const RATE_LIMIT_MAX = parseIntEnv(process.env.CONTROL_HUB_RATE_LIMIT_MAX || "120", 120, 1);
const AUDIT_LOG_ENABLED = parseBooleanEnv(process.env.CONTROL_HUB_AUDIT_LOG_ENABLED || "true", true);
const AUDIT_LOG_HEALTHZ = parseBooleanEnv(process.env.CONTROL_HUB_AUDIT_LOG_HEALTHZ || "false", false);
const DEFAULTS = { openclawBaseUrl: process.env.OPENCLAW_BASE_URL || "", gatewayUrl: process.env.FINSAVVY_GATEWAY_URL || "http://localhost:8080", masterUrl: process.env.FINSAVVY_MASTER_URL || "http://localhost:8000" };
const DOCKER_STACK_FILES = { core: path.join(PROJECT_ROOT, "docker-compose.yml"), full: path.join(PROJECT_ROOT, "deploy", "docker-compose.yml") };
const STATIC_CSP = "default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";
const MIME_TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "application/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png" };

const rateLimitStore = makeRateLimitStore();
const localFacadeState = loadLocalState(STATE_FILE);

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => { data += chunk; if (data.length > 5 * 1024 * 1024) { reject(new Error("Request body too large")); req.destroy(); } });
    req.on("end", () => { if (!data) { resolve({}); return; } try { resolve(JSON.parse(data)); } catch (err) { reject(new Error("Invalid JSON body")); } });
    req.on("error", reject);
  });
}

function sendJson(res, status, payload) { const body = JSON.stringify(payload); res.writeHead(status, utils.apiHeaders("application/json; charset=utf-8")); res.end(body); }
function sendText(res, status, text) { res.writeHead(status, utils.apiHeaders("text/plain; charset=utf-8")); res.end(text); }

const ctx = {
  DEFAULTS, DOCKER_HELPERS_ENABLED, PROXY_ALLOWLIST, FETCH_TIMEOUT_MS, STARTED_AT, BASIC_AUTH, TRUST_PROXY,
  RATE_LIMIT_ENABLED, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX, AUDIT_LOG_ENABLED, AUDIT_LOG_HEALTHZ, AUDIT_LOG_FILE,
  STATE_FILE, PROJECT_ROOT, DOCKER_STACK_FILES, localFacadeState,
  sendJson, sendText, parseBody,
  proxyRequest: (opts) => proxyRequest(opts, PROXY_ALLOWLIST, FETCH_TIMEOUT_MS),
  runDockerCompose: (args, stack, timeout, env) => runDockerCompose(args, stack, timeout, env, PROJECT_ROOT, DOCKER_STACK_FILES),
  detectLocalFallbackOpenclawImage: () => detectLocalFallbackOpenclawImage(PROJECT_ROOT),
  upsertLocalChannelConnection: (payload, workerUrl) => upsertLocalChannelConnection(localFacadeState, STATE_FILE, payload, workerUrl),
};

const router = makeRouter();
registerHealthRoutes(router, ctx);
registerDockerRoutes(router, ctx);
registerFacadeProxyRoutes(router, ctx);
registerFacadeChannelRoutes(router, ctx);
registerFacadeSkillRoutes(router, ctx);
registerFacadeNodeRoutes(router, ctx);
registerFacadeBootstrapRoute(router, ctx);

function serveStatic(req, res, pathname) {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.join(STATIC_DIR, safePath);
  const normalized = path.normalize(filePath);
  if (!normalized.startsWith(path.normalize(STATIC_DIR))) { sendText(res, 403, "Forbidden"); return; }
  fs.stat(normalized, (err, stat) => {
    if (err || !stat.isFile()) { sendText(res, 404, "Not found"); return; }
    const type = MIME_TYPES[path.extname(normalized)] || "application/octet-stream";
    res.writeHead(200, { ...SECURITY_HEADERS, "Content-Type": type, "Content-Security-Policy": STATIC_CSP, "Cache-Control": "no-store" });
    fs.createReadStream(normalized).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const startedAt = Date.now();
  const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  const clientIp = getClientIp(req, TRUST_PROXY);
  let pathname = "/";
  res.setHeader("X-Request-Id", requestId);
  try {
    pathname = new URL(req.url, `http://${req.headers.host || "localhost"}`).pathname;
  } catch { sendJson(res, 400, { error: "Invalid request URL" }); return; }

  const isApiRequest = pathname.startsWith("/api/");
  const isPublicHealthz = req.method === "GET" && pathname === "/api/healthz";
  if (isPublicHealthz) { req.authState = "public-healthz"; req.authUser = ""; }

  if (isApiRequest && RATE_LIMIT_ENABLED && !isPublicHealthz) {
    const rate = consumeRateLimit(rateLimitStore, clientIp, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX);
    res.setHeader("X-RateLimit-Limit", String(rate.limit));
    res.setHeader("X-RateLimit-Remaining", String(rate.remaining));
    res.setHeader("X-RateLimit-Reset", String(Math.floor(rate.resetAt / 1000)));
    if (rate.limited) { res.setHeader("Retry-After", String(rate.retryAfterSeconds)); sendJson(res, 429, { error: "Rate limit exceeded", retryAfterSeconds: rate.retryAfterSeconds }); return; }
  }

  if (!isPublicHealthz && !requireBasicAuth(req, res, BASIC_AUTH)) return;

  res.on("finish", () => {
    if (!isApiRequest) return;
    if (!AUDIT_LOG_HEALTHZ && pathname === "/api/healthz") return;
    writeAuditEvent(AUDIT_LOG_FILE, AUDIT_LOG_ENABLED, { requestId, method: req.method, path: pathname, status: res.statusCode, durationMs: Date.now() - startedAt, ip: clientIp, authState: req.authState || (BASIC_AUTH ? "unknown" : "disabled"), authUser: req.authUser || "", rateLimited: res.statusCode === 429, userAgent: utils.trimHeaderValue(req.headers["user-agent"], 512) });
  });

  if (isApiRequest) {
    const handled = await router.dispatch(req, res, pathname);
    if (!handled) sendJson(res, 404, { error: "API route not found" });
    return;
  }
  serveStatic(req, res, pathname);
});

server.listen(PORT, HOST, () => { console.log(`Control Hub facade running at http://${HOST}:${PORT}`); }); // eslint-disable-line no-console
process.on("SIGINT", () => { console.log("Received SIGINT. Shutting down Control Hub..."); server.close(() => { console.log("Control Hub stopped."); process.exit(0); }); }); // eslint-disable-line no-console
process.on("SIGTERM", () => { console.log("Received SIGTERM. Shutting down Control Hub..."); server.close(() => { console.log("Control Hub stopped."); process.exit(0); }); }); // eslint-disable-line no-console
