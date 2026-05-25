// Local runner + project auto-registration — ALL endpoints require auth.

import { Hono } from "hono";
import type { Env } from "./types";
import { verifyJwt } from "./auth";
import { getProjectByRepo } from "./db";

export const registerRoutes = new Hono<{ Bindings: Env }>();

async function getAuthUser(c: { req: { header: (n: string) => string | undefined }; env: Env }) {
  const token = (c.req.header("authorization") ?? "").replace("Bearer ", "");
  return token ? verifyJwt(token, c.env.JWT_SECRET) : null;
}

async function verifyProjectAccess(db: D1Database, repo: string, userSub: string) {
  const project = await getProjectByRepo(db, repo);
  if (!project) return null;
  const membership = await db.prepare(
    "SELECT role FROM project_memberships WHERE project_id = ? AND user_sub = ?"
  ).bind(project.id, userSub).first<{ role: string }>();
  if (!membership) return null;
  return project;
}

// Auto-register a local runner — requires auth + project membership
registerRoutes.post("/runners/register-local", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const body = await c.req.json<{ repo: string; name: string; os: string; arch: string; version: string }>();
  if (!body.repo) return c.json({ error: "repo required" }, 400);

  const project = await verifyProjectAccess(c.env.DB, body.repo, user.sub);
  if (!project) return c.json({ error: "forbidden — no access to this project" }, 403);

  const id = `runner-${body.name}-${project.id.slice(0, 8)}`;
  await c.env.DB.prepare(
    `INSERT OR REPLACE INTO runners (id, project_id, name, token_hash, labels_json, os, arch, status, ip, version, last_heartbeat, created_at, updated_at)
     VALUES (?, ?, ?, 'local', '["local"]', ?, ?, 'online', '127.0.0.1', ?, datetime('now'), datetime('now'), datetime('now'))`
  ).bind(id, project.id, body.name || "local", body.os || "unknown", body.arch || "unknown", body.version || "dev").run();

  return c.json({ runner_id: id, project_id: project.id }, 201);
});

// Report a completed run — requires auth + project membership
registerRoutes.post("/runs/report", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const body = await c.req.json<{
    repo: string; branch: string; sha: string; status: string;
    duration_ms: number; commit_message?: string; checks?: unknown[];
    artifacts?: Array<{ name: string; size_bytes: number; type?: string }>;
  }>();
  if (!body.repo || !body.sha) return c.json({ error: "repo and sha required" }, 400);

  const project = await verifyProjectAccess(c.env.DB, body.repo, user.sub);
  if (!project) return c.json({ error: "forbidden — no access to this project" }, 403);

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    `INSERT INTO runs (id, repo, branch, sha, status, created_at, started_at, finished_at, duration_ms, commit_message, trigger, checks_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'local', ?)`
  ).bind(id, body.repo, body.branch || "main", body.sha, body.status || "passed", now, now, now,
    body.duration_ms || 0, body.commit_message || null, body.checks ? JSON.stringify(body.checks) : null).run();

  await c.env.DB.prepare("UPDATE projects SET build_number = build_number + 1 WHERE repo = ?").bind(body.repo).run();

  // Store artifact sizes if provided
  if (body.artifacts?.length) {
    const projId = (project as any).id || body.repo;
    for (const a of body.artifacts) {
      await c.env.DB.prepare(
        `INSERT INTO artifacts (project_id, name, version, type, size_bytes, sha256, r2_key, uploaded_by)
         VALUES (?, ?, ?, ?, ?, NULL, ?, ?)
         ON CONFLICT(project_id, name, version) DO UPDATE SET
           size_bytes = excluded.size_bytes, uploaded_by = excluded.uploaded_by, created_at = datetime('now')`
      ).bind(projId, a.name, body.sha || id, a.type || "size", a.size_bytes, `sizes/${projId}/${a.name}`, user.sub).run();
    }
  }

  return c.json({ run_id: id, build_number: (project as any).build_number + 1 }, 201);
});

// Artifact size history — returns latest two sizes per artifact name
// so the dashboard can compute deltas. No Pro plan required.
registerRoutes.get("/artifacts/sizes", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  // Get all projects the user has access to
  const { results: projects } = await c.env.DB.prepare(
    "SELECT project_id FROM project_memberships WHERE user_sub = ?"
  ).bind(user.sub).all<{ project_id: string }>();

  if (!projects?.length) return c.json({ artifacts: [] });

  const projectIds = projects.map(p => p.project_id);
  const placeholders = projectIds.map(() => "?").join(",");

  const { results } = await c.env.DB.prepare(
    `SELECT name, size_bytes, version, created_at, project_id
     FROM artifacts WHERE project_id IN (${placeholders})
     ORDER BY name, created_at DESC`
  ).bind(...projectIds).all<{
    name: string; size_bytes: number; version: string;
    created_at: string; project_id: string;
  }>();

  return c.json({ artifacts: results || [] });
});

// Fetch user's GitHub repos — requires auth, uses stored token
registerRoutes.get("/repos/github", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const userRow = await c.env.DB.prepare("SELECT github_token FROM users WHERE sub = ?")
    .bind(user.sub).first<{ github_token: string | null }>();
  if (!userRow?.github_token) return c.json({ error: "GitHub not connected. Re-login.", relogin: true }, 403);

  const resp = await fetch("https://api.github.com/user/repos?per_page=100&sort=updated&type=all", {
    headers: { Authorization: `token ${userRow.github_token}`, "User-Agent": "PushCI/1.0", Accept: "application/vnd.github.v3+json" },
  });
  if (!resp.ok) return c.json({ error: "GitHub API error" }, resp.status as 400);

  const repos = (await resp.json()) as Array<{ full_name: string; private: boolean; language: string; description: string | null; updated_at: string }>;
  const existing = await c.env.DB.prepare(
    "SELECT repo FROM projects JOIN project_memberships ON projects.id = project_memberships.project_id WHERE project_memberships.user_sub = ?"
  ).bind(user.sub).all<{ repo: string }>();
  const connected = new Set((existing.results || []).map((r) => r.repo));

  return c.json({ repos: repos.map((r) => ({ name: r.full_name, private: r.private, language: r.language, description: r.description, updated_at: r.updated_at, connected: connected.has(r.full_name) })) });
});
