// Open-source skill submission: community devs can contribute pipeline skills.

import { Hono } from "hono";
import { verifyJwt } from "./auth";
import type { Env } from "./types";
import type { SkillCategory } from "./skills";

type Bindings = Env;
export const skillSubmitRoutes = new Hono<{ Bindings: Bindings }>();

const VALID_CATEGORIES: SkillCategory[] = ["templates", "checks", "deploy", "notify", "security", "ai"];

interface SubmitInput {
  name: string;
  description: string;
  category: SkillCategory;
  tags: string[];
  steps: Array<{ name: string; run: string; on_fail?: string }>;
  config?: Record<string, string>;
  repoUrl?: string;
}

async function getUser(c: { req: { header: (n: string) => string | undefined }; env: Env }) {
  const token = (c.req.header("authorization") ?? "").replace("Bearer ", "");
  return token ? verifyJwt(token, c.env.JWT_SECRET) : null;
}

/** POST /submit — submit a community skill for review. */
skillSubmitRoutes.post("/submit", async (c) => {
  const user = await getUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const body = await c.req.json<SubmitInput>();
  if (!body.name || !body.description || !body.steps?.length) {
    return c.json({ error: "name, description, and steps are required" }, 400);
  }
  if (!VALID_CATEGORIES.includes(body.category)) {
    return c.json({ error: `invalid category. Valid: ${VALID_CATEGORIES.join(", ")}` }, 400);
  }
  for (const step of body.steps) {
    if (!step.name || !step.run) {
      return c.json({ error: "each step needs name and run" }, 400);
    }
  }

  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO skill_submissions (id,user_id,user_login,name,description,category,tags,steps_json,config_json,repo_url)
     VALUES (?,?,?,?,?,?,?,?,?,?)`
  ).bind(
    id, user.sub, user.login, body.name, body.description, body.category,
    JSON.stringify(body.tags ?? []), JSON.stringify(body.steps),
    JSON.stringify(body.config ?? {}), body.repoUrl ?? null,
  ).run();

  return c.json({ id, status: "pending", message: "Skill submitted for review." }, 201);
});

/** GET /submissions — list your submissions. */
skillSubmitRoutes.get("/submissions", async (c) => {
  const user = await getUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const rows = await c.env.DB.prepare(
    `SELECT id,name,category,status,created_at,reviewed_at,review_note
     FROM skill_submissions WHERE user_id=? ORDER BY created_at DESC`
  ).bind(user.sub).all();

  return c.json({ submissions: rows.results });
});

/** GET /submissions/pending — admin: list pending reviews. */
skillSubmitRoutes.get("/submissions/pending", async (c) => {
  const user = await getUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const rows = await c.env.DB.prepare(
    `SELECT * FROM skill_submissions WHERE status='pending' ORDER BY created_at ASC LIMIT 50`
  ).all();

  return c.json({ submissions: rows.results });
});

/** POST /submissions/:id/review — admin: approve or reject. */
skillSubmitRoutes.post("/submissions/:id/review", async (c) => {
  const user = await getUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const { action, note } = await c.req.json<{ action: "approve" | "reject"; note?: string }>();
  if (action !== "approve" && action !== "reject") {
    return c.json({ error: "action must be approve or reject" }, 400);
  }

  const status = action === "approve" ? "approved" : "rejected";
  const result = await c.env.DB.prepare(
    `UPDATE skill_submissions SET status=?, reviewer_id=?, review_note=?, reviewed_at=datetime('now')
     WHERE id=? AND status='pending'`
  ).bind(status, user.sub, note ?? null, c.req.param("id")).run();

  if (!result.meta.changes) return c.json({ error: "not found or already reviewed" }, 404);
  return c.json({ ok: true, status });
});
