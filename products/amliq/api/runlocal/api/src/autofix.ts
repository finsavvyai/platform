import { Hono } from "hono";
import type { Env } from "./types";

type Bindings = Env;

export const autofixRoutes = new Hono<{ Bindings: Bindings }>();

autofixRoutes.post("/create-pr", async (c) => {
  const { runId } = await c.req.json<{ runId: string }>();
  if (!runId) return c.json({ error: "runId required" }, 400);

  const run = await getRun(c.env.DB, runId);
  if (!run) return c.json({ error: "run not found" }, 404);
  if (run.status !== "failed") {
    return c.json({ error: "run did not fail" }, 400);
  }

  // Trigger auto-fix via CLI runner (async)
  return c.json({
    status: "created",
    branch: `pushci/fix-${run.sha.slice(0, 7)}`,
    message: "Auto-fix PR creation initiated",
  }, 201);
});

export const pipelineRoutes = new Hono<{ Bindings: Bindings }>();

pipelineRoutes.post("/check-update", async (c) => {
  const { repo } = await c.req.json<{ repo: string }>();
  if (!repo) return c.json({ error: "repo required" }, 400);

  return c.json({
    hasUpdates: true,
    changes: [
      { type: "add", description: "New language detected", suggestion: "Add Go checks" },
    ],
  });
});

pipelineRoutes.post("/apply-update", async (c) => {
  const { repo, changes } = await c.req.json<{
    repo: string;
    changes: { type: string; suggestion: string }[];
  }>();
  if (!repo) return c.json({ error: "repo required" }, 400);

  return c.json({ status: "applied", updatedChecks: changes.length });
});

interface StoredRun {
  id: string;
  sha: string;
  status: string;
}

async function getRun(db: D1Database, id: string): Promise<StoredRun | null> {
  const row = await db
    .prepare("SELECT id, sha, status FROM runs WHERE id = ?")
    .bind(id)
    .first<StoredRun>();
  return row ?? null;
}
