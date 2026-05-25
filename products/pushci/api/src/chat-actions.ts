// Chat dispatcher backend — paired with frontend chatActionDispatcher.ts.
// Adds: GET /status (show_status), POST /optimize-pipeline (optimize_pipeline),
// POST /run + GET /run/:runId (run_pipeline + polling).
//
// All three back the NLP chat action flow. The 3 dangerous actions
// (deploy direct / update_config / manage_secret) are intentionally NOT
// implemented here — they require dedicated security review per CLAUDE.md
// and ship in a later sprint. The frontend dispatcher returns a structured
// "coming soon" message for those without ever hitting the backend.

import { Hono } from "hono";
import Anthropic from "@anthropic-ai/sdk";
import { verifyJwt } from "./auth";
import { requirePlan } from "./usage";
import { CLAUDE_HAIKU_MODEL } from "./ai-model";
import type { Env } from "./types";

type ChatEnv = Env & { ANTHROPIC_API_KEY: string };

export const chatActionRoutes = new Hono<{ Bindings: ChatEnv }>();

// ---------- show_status: GET /api/chat/status ----------
// Read-only aggregation of user's recent runs across all projects they
// have membership on. Tenant-scoped via project_memberships join.
chatActionRoutes.get("/status", async (c) => {
  const token = (c.req.header("authorization") ?? "").replace("Bearer ", "");
  if (!token) return c.json({ error: "unauthorized" }, 401);
  const payload = await verifyJwt(token, c.env.JWT_SECRET);
  if (!payload) return c.json({ error: "unauthorized" }, 401);

  const limit = Math.min(
    Math.max(parseInt(c.req.query("limit") || "10", 10) || 10, 1),
    50,
  );

  const projectsResult = await c.env.DB.prepare(
    `SELECT p.repo FROM projects p
     JOIN project_memberships m ON m.project_id = p.id
     WHERE m.user_sub = ?`,
  ).bind(payload.sub).all<{ repo: string }>();
  const repos = (projectsResult.results ?? []).map((r) => r.repo);
  if (!repos.length) {
    return c.json({ runs: [], total: 0, message: "No projects connected yet." });
  }

  const placeholders = repos.map(() => "?").join(",");
  const runsResult = await c.env.DB.prepare(
    `SELECT id, repo, branch, sha, status, created_at,
            started_at, finished_at, duration_ms
     FROM runs WHERE repo IN (${placeholders})
     ORDER BY created_at DESC LIMIT ?`,
  ).bind(...repos, limit).all();

  const runs = runsResult.results ?? [];
  return c.json({ runs, total: runs.length });
});

// ---------- optimize_pipeline: POST /api/chat/optimize-pipeline ----------
// AI call mirroring the generate-pipeline pattern. Pro+ only.
chatActionRoutes.post(
  "/optimize-pipeline",
  requirePlan("pro", "team", "enterprise"),
  async (c) => {
    const body = await c.req.json<{
      pipelineYaml?: string;
      repoName?: string;
      languages?: string[];
    }>().catch(() => ({} as Record<string, unknown>));

    const client = new Anthropic({ apiKey: c.env.ANTHROPIC_API_KEY });
    const system = `You are a senior CI/CD performance engineer.
Analyze the provided PushCI pipeline and suggest concrete optimizations
for SPEED and COST. Focus on: parallelization, caching, smart
dependencies, redundant steps, cache key design.
Output a markdown response with three sections:
1) **Bottleneck analysis** — 2-3 sentences identifying the slowest path
2) **3-5 specific fixes** — each with estimated time savings and one
   line of justification
3) **Optimized YAML** — full updated pipeline in a single \`\`\`yaml block.
Never include real secrets in the YAML.`;

    const user =
      typeof (body as { pipelineYaml?: string }).pipelineYaml === "string"
        ? `Optimize this PushCI pipeline for "${
            (body as { repoName?: string }).repoName ?? "unknown"
          }":\n\n\`\`\`yaml\n${(body as { pipelineYaml: string }).pipelineYaml}\n\`\`\``
        : `Suggest optimizations for a generic ${
            ((body as { languages?: string[] }).languages ?? ["Node.js"]).join(", ")
          } project pipeline. Assume install/lint/test/build stages exist.`;

    const msg = await client.messages.create({
      model: CLAUDE_HAIKU_MODEL,
      max_tokens: 2048,
      system,
      messages: [{ role: "user", content: user }],
    });

    const text = msg.content
      .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    return c.json({ optimization: text });
  },
);

// ---------- run_pipeline: POST /api/chat/run ----------
// Inserts a pending row into the runs table; existing runner control
// plane picks it up via existing polling/dispatch logic. Supports
// idempotency via Idempotency-Key header or body.idempotency_key.
chatActionRoutes.post("/run", async (c) => {
  const token = (c.req.header("authorization") ?? "").replace("Bearer ", "");
  if (!token) return c.json({ error: "unauthorized" }, 401);
  const payload = await verifyJwt(token, c.env.JWT_SECRET);
  if (!payload) return c.json({ error: "unauthorized" }, 401);

  const body = await c.req.json<{
    repo?: string;
    branch?: string;
    checks?: string[];
    idempotency_key?: string;
  }>().catch(() => ({} as Record<string, unknown>));

  const repo = (body as { repo?: string }).repo;
  if (!repo) return c.json({ error: "repo required" }, 400);

  const access = await c.env.DB.prepare(
    `SELECT p.id FROM projects p
     JOIN project_memberships m ON m.project_id = p.id
     WHERE m.user_sub = ? AND p.repo = ?
     LIMIT 1`,
  ).bind(payload.sub, repo).first<{ id: string }>();
  if (!access) return c.json({ error: "forbidden" }, 403);

  const idempotencyKey =
    c.req.header("idempotency-key") ||
    (body as { idempotency_key?: string }).idempotency_key;
  if (idempotencyKey) {
    const existing = await c.env.DB.prepare(
      `SELECT id, status FROM runs WHERE id = ? LIMIT 1`,
    ).bind(idempotencyKey).first<{ id: string; status: string }>();
    if (existing) {
      return c.json({ run_id: existing.id, status: existing.status, idempotent: true });
    }
  }

  const runId = idempotencyKey || crypto.randomUUID();
  const branch = (body as { branch?: string }).branch || "main";
  const checks = (body as { checks?: string[] }).checks;
  const checksJson = checks ? JSON.stringify(checks) : null;

  await c.env.DB.prepare(
    `INSERT INTO runs (id, repo, branch, sha, status, checks_json)
     VALUES (?, ?, ?, ?, 'pending', ?)`,
  ).bind(runId, repo, branch, "HEAD", checksJson).run();

  return c.json({ run_id: runId, status: "pending" });
});

// ---------- run polling: GET /api/chat/run/:runId ----------
// Frontend polls this every 2s until status is "succeeded" / "failed".
chatActionRoutes.get("/run/:runId", async (c) => {
  const token = (c.req.header("authorization") ?? "").replace("Bearer ", "");
  if (!token) return c.json({ error: "unauthorized" }, 401);
  const payload = await verifyJwt(token, c.env.JWT_SECRET);
  if (!payload) return c.json({ error: "unauthorized" }, 401);

  const runId = c.req.param("runId");
  const run = await c.env.DB.prepare(
    `SELECT r.id, r.repo, r.branch, r.sha, r.status, r.created_at,
            r.started_at, r.finished_at, r.duration_ms, r.checks_json
     FROM runs r
     JOIN projects p ON p.repo = r.repo
     JOIN project_memberships m ON m.project_id = p.id
     WHERE r.id = ? AND m.user_sub = ?
     LIMIT 1`,
  ).bind(runId, payload.sub).first();
  if (!run) return c.json({ error: "not_found" }, 404);

  return c.json(run);
});
