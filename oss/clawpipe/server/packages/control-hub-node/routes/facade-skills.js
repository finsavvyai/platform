"use strict";

const utils = require("../utils");

function registerFacadeSkillRoutes(router, ctx) {
  router.post("/api/facade/skills/list", async (req, res) => {
    try {
      const body = await ctx.parseBody(req);
      const result = await ctx.proxyRequest({ baseUrl: body.baseUrl || ctx.DEFAULTS.openclawBaseUrl, endpoint: "/tools/agents", method: "GET", authMode: body.authMode, authSecret: body.authSecret, userId: body.userId });
      if (result.ok || !utils.isMissingEndpoint(result)) { ctx.sendJson(res, 200, result); return; }

      const workerBase = utils.normalizeBaseUrl(body.workerUrl || "http://localhost:8001");
      const localSkills = await ctx.proxyRequest({ baseUrl: workerBase, endpoint: "/v1/skills", method: "GET" });
      if (localSkills.ok && Array.isArray(localSkills.body?.skills)) {
        const agents = localSkills.body.skills.map((item) => ({ id: item.id || item.name, name: item.name || item.id || "skill", label: item.name || item.id || "skill", description: item.description || "", source: "worker-v1-skills" }));
        if (!agents.some((a) => a.id === "run")) agents.unshift({ id: "run", name: "run", label: "run", description: "Route request to cluster chat completions", source: "local-facade" });
        ctx.sendJson(res, 200, { ok: true, status: 200, url: "local://facade/tools/agents", body: { agents, mode: "local-facade" } });
        return;
      }
      ctx.sendJson(res, 200, { ok: true, status: 200, url: "local://facade/tools/agents", body: { agents: utils.buildFallbackAgents(), mode: "local-facade" } });
    } catch (err) { ctx.sendJson(res, 400, { error: err.message }); }
  });

  router.post("/api/facade/run-skill", handleRunSkill);
  router.post("/api/facade/skills/run", handleRunSkill);

  async function handleRunSkill(req, res) {
    try {
      const body = await ctx.parseBody(req);
      const result = await ctx.proxyRequest({ baseUrl: body.baseUrl || ctx.DEFAULTS.openclawBaseUrl, endpoint: "/tools/run", method: "POST", authMode: body.authMode, authSecret: body.authSecret, userId: body.userId, payload: body.payload || {} });
      if (result.ok || !utils.isMissingEndpoint(result)) { ctx.sendJson(res, 200, result); return; }

      const prompt = utils.buildSkillPromptFromPayload(body.payload || {});
      const model = String(body.payload?.model || "").trim();
      const gatewayPayload = { messages: [{ role: "user", content: prompt }], stream: false };
      if (model) gatewayPayload.model = model;

      const gatewayRun = await ctx.proxyRequest({ baseUrl: body.gatewayUrl || ctx.DEFAULTS.gatewayUrl, endpoint: "/v1/chat/completions", method: "POST", payload: gatewayPayload });
      if (gatewayRun.ok) { ctx.sendJson(res, 200, { ok: true, status: 200, url: gatewayRun.url, body: { mode: "gateway-chat-fallback", agent: body.payload?.agent || body.payload?.tool || "run", prompt, result: gatewayRun.body } }); return; }

      const workerRun = await ctx.proxyRequest({ baseUrl: body.workerUrl || "http://localhost:8001", endpoint: "/v1/chat/completions", method: "POST", payload: gatewayPayload });
      if (workerRun.ok) { ctx.sendJson(res, 200, { ok: true, status: 200, url: workerRun.url, body: { mode: "worker-chat-fallback", agent: body.payload?.agent || body.payload?.tool || "run", prompt, result: workerRun.body } }); return; }

      ctx.sendJson(res, 200, result);
    } catch (err) { ctx.sendJson(res, 400, { error: err.message }); }
  }
}

module.exports = { registerFacadeSkillRoutes };
