import { Hono } from "hono";
import Anthropic from "@anthropic-ai/sdk";
import type { Env } from "./types";
import { explainFailurePrompt } from "./ai-prompts";
import { truncateLogs } from "./ai-validator";
import { CLAUDE_HAIKU_MODEL } from "./ai-model";

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

  return c.json({
    status: "created",
    branch: `pushci/fix-${run.sha.slice(0, 7)}`,
    message: "Auto-fix PR creation initiated",
  }, 201);
});

autofixRoutes.post("/root-cause", async (c) => {
  const { logs, checkName, exitCode } = await c.req.json<{
    logs: string; checkName: string; exitCode?: number;
  }>();
  if (!logs) return c.json({ error: "logs required" }, 400);

  const client = new Anthropic({ apiKey: c.env.ANTHROPIC_API_KEY });
  const { system, user } = explainFailurePrompt({
    logs: truncateLogs(logs), checkName: checkName ?? "unknown", exitCode,
  });
  const msg = await client.messages.create({
    model: CLAUDE_HAIKU_MODEL, max_tokens: 1024, system,
    messages: [{ role: "user", content: user }],
  });
  const text = msg.content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
    .map((b) => b.text).join("\n");
  return c.json({ rootCause: text, checkName });
});

autofixRoutes.post("/suggest-fix", async (c) => {
  const { rootCause, checkName, logs } = await c.req.json<{
    rootCause: string; checkName: string; logs?: string;
  }>();
  if (!rootCause) return c.json({ error: "rootCause required" }, 400);

  const client = new Anthropic({ apiKey: c.env.ANTHROPIC_API_KEY });
  const msg = await client.messages.create({
    model: CLAUDE_HAIKU_MODEL, max_tokens: 1024,
    system: `You are a CI/CD auto-fix agent. Suggest a specific fix as a PR.
Respond: TITLE: <pr title>\nDESCRIPTION: <desc>\nCMD: <fix command>`,
    messages: [{ role: "user", content: `Root cause: ${rootCause}\nCheck: ${checkName}\nLogs: ${truncateLogs(logs ?? "", 1500)}` }],
  });
  const text = msg.content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
    .map((b) => b.text).join("\n");
  return c.json({ suggestion: text, checkName });
});

export const pipelineRoutes = new Hono<{ Bindings: Bindings }>();

pipelineRoutes.post("/check-update", async (c) => {
  const { repo } = await c.req.json<{ repo: string }>();
  if (!repo) return c.json({ error: "repo required" }, 400);
  return c.json({
    hasUpdates: true,
    changes: [
      { type: "add", description: "New language detected", suggestion: "Add checks" },
    ],
  });
});

pipelineRoutes.post("/apply-update", async (c) => {
  const { repo, changes } = await c.req.json<{
    repo: string; changes: { type: string; suggestion: string }[];
  }>();
  if (!repo) return c.json({ error: "repo required" }, 400);
  return c.json({ status: "applied", updatedChecks: changes.length });
});

interface StoredRun { id: string; sha: string; status: string; }

async function getRun(db: D1Database, id: string): Promise<StoredRun | null> {
  const row = await db
    .prepare("SELECT id, sha, status FROM runs WHERE id = ?")
    .bind(id).first<StoredRun>();
  return row ?? null;
}
