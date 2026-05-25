// Impact analysis: blast radius detection for commits.
// Inspired by GitNexus — maps file dependencies to show change impact.

import { Hono } from "hono";
import Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_HAIKU_MODEL } from "./ai-model";
import { verifyJwt } from "./auth";
import type { Env } from "./types";

type Bindings = Env;
export const impactRoutes = new Hono<{ Bindings: Bindings }>();

interface ImpactResult {
  changed_files: string[];
  affected_files: string[];
  blast_radius: number;
  risk_level: "low" | "medium" | "high" | "critical";
  suggested_tests: string[];
  summary: string;
}

// POST /analyze — analyze impact of a commit/diff
impactRoutes.post("/analyze", async (c) => {
  const token = (c.req.header("authorization") ?? "").replace("Bearer ", "");
  if (!token) return c.json({ error: "unauthorized" }, 401);
  const user = await verifyJwt(token, c.env.JWT_SECRET);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const body = await c.req.json<{
    repo: string;
    changed_files: string[];
    diff?: string;
    commit_message?: string;
  }>();
  if (!body.repo || !body.changed_files?.length) {
    return c.json({ error: "repo and changed_files required" }, 400);
  }

  // Check project membership
  const project = await c.env.DB.prepare(
    "SELECT id FROM projects WHERE repo = ?"
  ).bind(body.repo).first<{ id: string }>();
  if (project) {
    const membership = await c.env.DB.prepare(
      "SELECT role FROM project_memberships WHERE project_id = ? AND user_sub = ?"
    ).bind(project.id, user.sub).first();
    if (!membership) return c.json({ error: "forbidden" }, 403);
  }

  // Load cached dependency graph from KV
  const graphKey = `depgraph:${body.repo}`;
  const cachedGraph = await c.env.RUNNERS.get(graphKey);
  const depGraph: Record<string, string[]> = cachedGraph
    ? JSON.parse(cachedGraph) : {};

  // Compute blast radius from dependency graph
  const affected = computeBlastRadius(body.changed_files, depGraph);
  const blastRadius = affected.length;
  const riskLevel = blastRadius > 20 ? "critical"
    : blastRadius > 10 ? "high"
    : blastRadius > 5 ? "medium" : "low";

  // Use AI for deeper analysis if diff provided
  let summary = `${body.changed_files.length} files changed, ${blastRadius} files potentially affected.`;
  let suggestedTests: string[] = [];

  if (body.diff && c.env.ANTHROPIC_API_KEY) {
    try {
      const ai = await analyzeWithAI(c.env, body.changed_files, body.diff, body.commit_message);
      summary = ai.summary;
      suggestedTests = ai.suggestedTests;
    } catch { /* fallback to basic analysis */ }
  }

  if (suggestedTests.length === 0) {
    suggestedTests = inferTests(body.changed_files);
  }

  const result: ImpactResult = {
    changed_files: body.changed_files,
    affected_files: affected,
    blast_radius: blastRadius,
    risk_level: riskLevel,
    suggested_tests: suggestedTests,
    summary,
  };

  return c.json(result);
});

// GET /graph/:repo — get dependency graph for a repo
impactRoutes.get("/graph/:repo", async (c) => {
  const token = (c.req.header("authorization") ?? "").replace("Bearer ", "");
  if (!token) return c.json({ error: "unauthorized" }, 401);
  const user = await verifyJwt(token, c.env.JWT_SECRET);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const repo = decodeURIComponent(c.req.param("repo"));
  const graphKey = `depgraph:${repo}`;
  const cached = await c.env.RUNNERS.get(graphKey);

  return c.json({
    repo,
    graph: cached ? JSON.parse(cached) : {},
    has_graph: !!cached,
  });
});

// POST /graph/:repo — update dependency graph (from CLI or webhook)
impactRoutes.post("/graph/:repo", async (c) => {
  const token = (c.req.header("authorization") ?? "").replace("Bearer ", "");
  if (!token) return c.json({ error: "unauthorized" }, 401);
  const user = await verifyJwt(token, c.env.JWT_SECRET);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const repo = decodeURIComponent(c.req.param("repo"));
  const body = await c.req.json<{ graph: Record<string, string[]> }>();
  if (!body.graph) return c.json({ error: "graph required" }, 400);

  const graphKey = `depgraph:${repo}`;
  await c.env.RUNNERS.put(graphKey, JSON.stringify(body.graph), {
    expirationTtl: 86400 * 7, // 7 days
  });

  const nodeCount = Object.keys(body.graph).length;
  const edgeCount = Object.values(body.graph).reduce((s, v) => s + v.length, 0);
  return c.json({ ok: true, nodes: nodeCount, edges: edgeCount });
});

function computeBlastRadius(
  changed: string[], graph: Record<string, string[]>,
): string[] {
  const affected = new Set<string>();
  const queue = [...changed];

  while (queue.length > 0) {
    const file = queue.pop()!;
    if (affected.has(file)) continue;
    affected.add(file);
    // Find reverse dependencies (files that import this file)
    for (const [source, deps] of Object.entries(graph)) {
      if (deps.includes(file) && !affected.has(source)) {
        queue.push(source);
      }
    }
  }

  // Remove the originally changed files
  for (const f of changed) affected.delete(f);
  return [...affected].slice(0, 50);
}

function inferTests(files: string[]): string[] {
  const tests: string[] = [];
  const dirs = new Set(files.map(f => f.split("/").slice(0, -1).join("/")));

  for (const f of files) {
    if (f.includes("test") || f.includes("spec")) continue;
    const base = f.replace(/\.\w+$/, "");
    tests.push(`${base}.test.*`);
    tests.push(`${base}.spec.*`);
  }

  for (const d of dirs) {
    if (d.includes("api") || d.includes("route")) tests.push("integration tests");
    if (d.includes("auth")) tests.push("auth tests");
    if (d.includes("component") || d.includes("page")) tests.push("e2e tests");
  }

  return [...new Set(tests)].slice(0, 10);
}

async function analyzeWithAI(
  env: Env, files: string[], diff: string, commitMsg?: string,
): Promise<{ summary: string; suggestedTests: string[] }> {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const truncDiff = diff.slice(0, 2000);

  const msg = await client.messages.create({
    model: CLAUDE_HAIKU_MODEL,
    max_tokens: 512,
    system: `You analyze code changes for a CI/CD system. Given changed files and a diff:
1. Summarize what changed in 1-2 sentences
2. List which test suites should run (unit, integration, e2e, specific areas)
Respond as JSON: {"summary":"...","suggestedTests":["..."]}}`,
    messages: [{
      role: "user",
      content: `Files: ${files.join(", ")}\nCommit: ${commitMsg || "N/A"}\nDiff:\n${truncDiff}`,
    }],
  });

  const text = msg.content.find(
    (b): b is Anthropic.Messages.TextBlock => b.type === "text",
  );
  if (!text) return { summary: "Analysis unavailable", suggestedTests: [] };

  try {
    const parsed = JSON.parse(text.text) as { summary: string; suggestedTests: string[] };
    return parsed;
  } catch {
    return { summary: text.text.slice(0, 200), suggestedTests: [] };
  }
}
