"use strict";

const utils = require("../utils");

function registerDockerRoutes(router, ctx) {
  const disabled403 = { error: "Docker helper APIs are disabled. Set CONTROL_HUB_ENABLE_DOCKER_HELPERS=true to enable." };

  router.get("/api/local/docker/stacks", (_req, res) => {
    if (!ctx.DOCKER_HELPERS_ENABLED) { ctx.sendJson(res, 403, disabled403); return; }
    ctx.sendJson(res, 200, {
      ok: true,
      projectRoot: ctx.PROJECT_ROOT,
      stacks: {
        core: { composeFile: ctx.DOCKER_STACK_FILES.core, description: "Master + worker + gateway" },
        full: { composeFile: ctx.DOCKER_STACK_FILES.full, description: "OpenClaw + master + worker + gateway", openclawContainerPortDefault: 11434 },
      },
    });
  });

  router.post("/api/local/docker/up", async (req, res) => {
    if (!ctx.DOCKER_HELPERS_ENABLED) { ctx.sendJson(res, 403, disabled403); return; }
    try {
      const body = await ctx.parseBody(req);
      const stack = utils.normalizeDockerStack(body.stack);
      const extraEnv = {};
      if (stack === "full") {
        const explicitPort = utils.parseExplicitOpenclawContainerPort(body);
        if (body.openclawImage) {
          extraEnv.OPENCLAW_IMAGE = String(body.openclawImage).trim();
          extraEnv.OPENCLAW_CONTAINER_PORT = explicitPort || utils.parseOpenclawContainerPort(body);
        } else if (explicitPort) {
          extraEnv.OPENCLAW_CONTAINER_PORT = explicitPort;
        }
      }
      const args = stack === "full" ? ["up", "-d", "openclaw", "master", "worker", "gateway"] : ["up", "-d"];
      let result;
      try {
        result = await ctx.runDockerCompose(args, stack, 300000, extraEnv);
      } catch (err) {
        if (stack === "full" && !String(body.openclawImage || "").trim() && utils.isOpenclawPullDeniedError(err)) {
          const fallbackImage = await ctx.detectLocalFallbackOpenclawImage();
          if (fallbackImage) {
            extraEnv.OPENCLAW_IMAGE = fallbackImage;
            const explicitPort = utils.parseExplicitOpenclawContainerPort(body);
            extraEnv.OPENCLAW_CONTAINER_PORT = explicitPort || (fallbackImage.toLowerCase().includes("lunaos") ? "8000" : "11434");
            result = await ctx.runDockerCompose(args, stack, 300000, extraEnv);
            result.autoFallbackImage = fallbackImage;
          } else { throw err; }
        } else { throw err; }
      }
      ctx.sendJson(res, 200, result);
    } catch (err) { ctx.sendJson(res, 500, { error: err.message, details: err.details || null }); }
  });

  router.post("/api/local/docker/down", async (req, res) => {
    if (!ctx.DOCKER_HELPERS_ENABLED) { ctx.sendJson(res, 403, disabled403); return; }
    try {
      const body = await ctx.parseBody(req);
      const result = await ctx.runDockerCompose(["down"], utils.normalizeDockerStack(body.stack), 180000);
      ctx.sendJson(res, 200, result);
    } catch (err) { ctx.sendJson(res, 500, { error: err.message, details: err.details || null }); }
  });

  router.post("/api/local/docker/status", async (req, res) => {
    if (!ctx.DOCKER_HELPERS_ENABLED) { ctx.sendJson(res, 403, disabled403); return; }
    try {
      const body = await ctx.parseBody(req);
      const result = await ctx.runDockerCompose(["ps"], utils.normalizeDockerStack(body.stack), 60000);
      ctx.sendJson(res, 200, result);
    } catch (err) { ctx.sendJson(res, 500, { error: err.message, details: err.details || null }); }
  });
}

module.exports = { registerDockerRoutes };
