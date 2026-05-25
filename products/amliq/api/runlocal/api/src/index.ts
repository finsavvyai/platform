import { Hono } from "hono";
import type { Env } from "./types";
import { handleWebhook } from "./webhook";
import { getRun, listRuns, listProjects, migrateDb } from "./db";
import { githubOAuth, verifyJwt } from "./auth";
import { handleBadge } from "./badge";
import { handleOgCard } from "./og-card";
import { handlePipelineCard } from "./pipeline-card";
import { costRoutes } from "./cost-calculator";
import { aiRoutes } from "./ai-gateway";
import { cloudRoutes } from "./cloud-runners";
import { nlpRoutes } from "./nlp";
import { autofixRoutes, pipelineRoutes } from "./autofix";
import { billingRoutes } from "./billing";
import { corsMiddleware, rateLimitMiddleware, requestLogger, errorHandler } from "./middleware";

type Bindings = Env;
const app = new Hono<{ Bindings: Bindings }>();

async function authCheck(c: { req: { header: (n: string) => string | undefined }; env: Env }) {
  const token = (c.req.header("authorization") ?? "").replace("Bearer ", "");
  return token ? verifyJwt(token, c.env.JWT_SECRET) : null;
}

app.use("*", corsMiddleware);
app.use("*", errorHandler);
app.use("*", requestLogger);
app.use("/api/*", rateLimitMiddleware);

app.get("/health", (c) => c.json({ status: "ok", timestamp: new Date().toISOString() }));

app.post("/webhook/:platform", async (c) => {
  const platform = c.req.param("platform");
  if (!["github", "gitlab", "bitbucket"].includes(platform))
    return c.json({ error: "unsupported platform" }, 400);
  const rawBody = await c.req.text();
  try {
    const result = await handleWebhook(platform as "github" | "gitlab" | "bitbucket", rawBody, c.req.raw.headers, c.env);
    return c.json(result, 201);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "webhook failed" }, 401);
  }
});

app.get("/api/runs", async (c) => {
  if (!await authCheck(c)) return c.json({ error: "unauthorized" }, 401);
  const limit = Math.min(Number(c.req.query("limit") ?? "50"), 200);
  const offset = Math.max(Number(c.req.query("offset") ?? "0"), 0);
  return c.json({ runs: await listRuns(c.env.DB, limit, offset) });
});

app.get("/api/runs/:id", async (c) => {
  if (!await authCheck(c)) return c.json({ error: "unauthorized" }, 401);
  const run = await getRun(c.env.DB, c.req.param("id"));
  return run ? c.json({ run }) : c.json({ error: "not found" }, 404);
});

app.get("/api/projects", async (c) => {
  if (!await authCheck(c)) return c.json({ error: "unauthorized" }, 401);
  return c.json({ projects: await listProjects(c.env.DB) });
});

app.post("/api/auth/github", async (c) => {
  const { code } = await c.req.json<{ code: string }>();
  if (!code) return c.json({ error: "code required" }, 400);
  try {
    return c.json(await githubOAuth(code, c.env));
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "auth failed" }, 500);
  }
});

app.get("/badge/:owner/:repo", (c) => handleBadge(c));
app.get("/api/card/:owner/:repo", (c) => handleOgCard(c));
app.get("/api/card/:owner/:repo/pipeline", (c) => handlePipelineCard(c));
app.route("/api/tools", costRoutes);
app.route("/api/ai", aiRoutes);
app.route("/api/cloud", cloudRoutes);
app.route("/api/nlp", nlpRoutes);
app.route("/api/autofix", autofixRoutes);
app.route("/api/pipeline", pipelineRoutes);
app.route("/api/billing", billingRoutes);

app.post("/api/migrate", async (c) => {
  if (c.env.ENVIRONMENT !== "development") return c.json({ error: "forbidden" }, 403);
  await migrateDb(c.env.DB);
  return c.json({ status: "migrated" });
});

export default app;
