// Project groups: link multiple repos as one product for cross-repo CI.

import { Hono } from "hono";
import { verifyJwt } from "./auth";
import type { Env } from "./types";

type Bindings = Env;
export const projectGroupRoutes = new Hono<{ Bindings: Bindings }>();

interface GroupConfig {
  id: string;
  name: string;
  repos: string[];
  trigger_downstream: boolean;
  owner_sub: string;
  created_at: string;
}

// GET / — list user's project groups
projectGroupRoutes.get("/", async (c) => {
  const user = await auth(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const key = `groups:${user.sub}`;
  const raw = await c.env.RUNNERS.get(key);
  const groups: GroupConfig[] = raw ? JSON.parse(raw) : [];
  return c.json({ groups });
});

// POST / — create a project group
projectGroupRoutes.post("/", async (c) => {
  const user = await auth(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const body = await c.req.json<{
    name: string;
    repos: string[];
    trigger_downstream?: boolean;
  }>();
  if (!body.name || !body.repos?.length) {
    return c.json({ error: "name and repos required" }, 400);
  }

  const group: GroupConfig = {
    id: crypto.randomUUID(),
    name: body.name,
    repos: body.repos,
    trigger_downstream: body.trigger_downstream ?? false,
    owner_sub: user.sub,
    created_at: new Date().toISOString(),
  };

  const key = `groups:${user.sub}`;
  const raw = await c.env.RUNNERS.get(key);
  const groups: GroupConfig[] = raw ? JSON.parse(raw) : [];
  groups.push(group);
  await c.env.RUNNERS.put(key, JSON.stringify(groups));

  return c.json({ group }, 201);
});

// PUT /:id — update a group
projectGroupRoutes.put("/:id", async (c) => {
  const user = await auth(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const groupId = c.req.param("id");
  const body = await c.req.json<{
    name?: string;
    repos?: string[];
    trigger_downstream?: boolean;
  }>();

  const key = `groups:${user.sub}`;
  const raw = await c.env.RUNNERS.get(key);
  const groups: GroupConfig[] = raw ? JSON.parse(raw) : [];
  const idx = groups.findIndex(g => g.id === groupId);
  if (idx < 0) return c.json({ error: "not found" }, 404);

  if (body.name) groups[idx].name = body.name;
  if (body.repos) groups[idx].repos = body.repos;
  if (body.trigger_downstream !== undefined) groups[idx].trigger_downstream = body.trigger_downstream;

  await c.env.RUNNERS.put(key, JSON.stringify(groups));
  return c.json({ group: groups[idx] });
});

// DELETE /:id — delete a group
projectGroupRoutes.delete("/:id", async (c) => {
  const user = await auth(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const groupId = c.req.param("id");
  const key = `groups:${user.sub}`;
  const raw = await c.env.RUNNERS.get(key);
  const groups: GroupConfig[] = raw ? JSON.parse(raw) : [];
  const filtered = groups.filter(g => g.id !== groupId);
  await c.env.RUNNERS.put(key, JSON.stringify(filtered));

  return c.json({ ok: true });
});

// GET /:id/status — cross-repo status for a group
projectGroupRoutes.get("/:id/status", async (c) => {
  const user = await auth(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const groupId = c.req.param("id");
  const key = `groups:${user.sub}`;
  const raw = await c.env.RUNNERS.get(key);
  const groups: GroupConfig[] = raw ? JSON.parse(raw) : [];
  const group = groups.find(g => g.id === groupId);
  if (!group) return c.json({ error: "not found" }, 404);

  // Fetch latest run status per repo
  const statuses: Array<{ repo: string; status: string; sha: string; updated: string }> = [];
  for (const repo of group.repos) {
    const run = await c.env.DB.prepare(
      "SELECT status, sha, created_at FROM runs WHERE repo = ? ORDER BY created_at DESC LIMIT 1"
    ).bind(repo).first<{ status: string; sha: string; created_at: string }>();
    statuses.push({
      repo,
      status: run?.status || "no runs",
      sha: run?.sha?.slice(0, 7) || "",
      updated: run?.created_at || "",
    });
  }

  const allPassed = statuses.every(s => s.status === "passed");
  return c.json({ group, statuses, all_passed: allPassed });
});

// POST /:id/trigger — trigger CI for all repos in group
projectGroupRoutes.post("/:id/trigger", async (c) => {
  const user = await auth(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const groupId = c.req.param("id");
  const key = `groups:${user.sub}`;
  const raw = await c.env.RUNNERS.get(key);
  const groups: GroupConfig[] = raw ? JSON.parse(raw) : [];
  const group = groups.find(g => g.id === groupId);
  if (!group) return c.json({ error: "not found" }, 404);

  const triggered: string[] = [];
  for (const repo of group.repos) {
    const project = await c.env.DB.prepare(
      "SELECT id FROM projects WHERE repo = ?"
    ).bind(repo).first<{ id: string }>();
    if (project) {
      triggered.push(repo);
      // Queue a CI run for this project
      const runId = crypto.randomUUID();
      await c.env.DB.prepare(
        "INSERT INTO runs (id, repo, branch, sha, status) VALUES (?, ?, 'main', 'group-trigger', 'pending')"
      ).bind(runId, repo).run();
    }
  }

  return c.json({ triggered, count: triggered.length });
});

async function auth(c: { req: { header: (n: string) => string | undefined }; env: Env }) {
  const token = (c.req.header("authorization") ?? "").replace("Bearer ", "");
  return token ? verifyJwt(token, c.env.JWT_SECRET) : null;
}
