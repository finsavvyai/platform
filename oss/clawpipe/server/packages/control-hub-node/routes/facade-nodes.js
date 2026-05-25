"use strict";

const utils = require("../utils");

function registerFacadeNodeRoutes(router, ctx) {
  router.post("/api/facade/node-inspect", handleNodeInspect);
  router.post("/api/facade/node/inspect", handleNodeInspect);

  async function handleNodeInspect(req, res) {
    try {
      const body = await ctx.parseBody(req);
      const nodeUrl = utils.normalizeBaseUrl(body.nodeUrl);
      if (!nodeUrl) throw new Error("nodeUrl is required");
      const calls = {
        health: ctx.proxyRequest({ baseUrl: nodeUrl, endpoint: "/health", method: "GET" }),
        status: ctx.proxyRequest({ baseUrl: nodeUrl, endpoint: "/status", method: "GET" }),
        models: ctx.proxyRequest({ baseUrl: nodeUrl, endpoint: "/v1/models", method: "GET" }),
        localModels: ctx.proxyRequest({ baseUrl: nodeUrl, endpoint: "/models/local", method: "GET" }),
        engine: ctx.proxyRequest({ baseUrl: nodeUrl, endpoint: "/engine/status", method: "GET" }),
      };
      const entries = Object.entries(calls);
      const settled = await Promise.allSettled(entries.map(([, p]) => p));
      const result = {};
      for (let i = 0; i < entries.length; i++) {
        const [key] = entries[i];
        result[key] = settled[i].status === "fulfilled"
          ? settled[i].value
          : { ok: false, status: 599, body: { error: settled[i].reason?.message } };
      }
      ctx.sendJson(res, 200, { ok: true, nodeUrl, result });
    } catch (err) { ctx.sendJson(res, 400, { error: err.message }); }
  }

  router.post("/api/facade/node-model-load", handleModelLoad);
  router.post("/api/facade/node/model/load", handleModelLoad);

  async function handleModelLoad(req, res) {
    try {
      const body = await ctx.parseBody(req);
      const nodeUrl = utils.normalizeBaseUrl(body.nodeUrl);
      if (!nodeUrl) throw new Error("nodeUrl is required");
      if (!body.modelId || !body.modelPath) throw new Error("modelId and modelPath are required");
      const payload = { model_id: body.modelId, model_path: body.modelPath };
      if (body.nCtx) payload.n_ctx = Number(body.nCtx);
      const result = await ctx.proxyRequest({ baseUrl: nodeUrl, endpoint: "/models/load", method: "POST", payload });
      ctx.sendJson(res, 200, result);
    } catch (err) { ctx.sendJson(res, 400, { error: err.message }); }
  }

  router.post("/api/facade/node-model-unload", handleModelUnload);
  router.post("/api/facade/node/model/unload", handleModelUnload);

  async function handleModelUnload(req, res) {
    try {
      const body = await ctx.parseBody(req);
      const nodeUrl = utils.normalizeBaseUrl(body.nodeUrl);
      if (!nodeUrl) throw new Error("nodeUrl is required");
      if (!body.modelId) throw new Error("modelId is required");
      const result = await ctx.proxyRequest({ baseUrl: nodeUrl, endpoint: "/models/unload", method: "POST", payload: { model_id: body.modelId } });
      ctx.sendJson(res, 200, result);
    } catch (err) { ctx.sendJson(res, 400, { error: err.message }); }
  }
}

module.exports = { registerFacadeNodeRoutes };
