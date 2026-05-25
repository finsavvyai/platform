// SSE log streaming: real-time log tailing via Server-Sent Events.

import { Hono } from "hono";
import { verifyJwt } from "./auth";
import type { Env } from "./types";

type Bindings = Env;

export const logStreamRoutes = new Hono<{ Bindings: Bindings }>();

const TERMINAL_STATUSES = new Set(["passed", "failed", "cancelled"]);
const POLL_INTERVAL_MS = 2000;
const MAX_STREAM_MS = 10 * 60 * 1000; // 10 minutes

/** GET /stream/:runId — SSE endpoint for live log streaming. */
logStreamRoutes.get("/stream/:runId", async (c) => {
  const token = c.req.query("token") ?? "";
  if (!token) return c.json({ error: "token query param required" }, 401);

  const payload = await verifyJwt(token, c.env.JWT_SECRET);
  if (!payload) return c.json({ error: "invalid or expired token" }, 401);

  const runId = c.req.param("runId");

  // Verify the user owns the run via project membership
  const run = await c.env.DB.prepare(`
    SELECT runs.* FROM runs
    JOIN projects ON projects.repo = runs.repo
    JOIN project_memberships ON project_memberships.project_id = projects.id
    WHERE runs.id = ? AND project_memberships.user_sub = ?
  `).bind(runId, payload.sub).first<{ id: string; status: string }>();

  if (!run) return c.json({ error: "run not found or access denied" }, 404);

  let lastOffset = 0;
  const startTime = Date.now();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async pull(controller) {
      // Safety timeout
      if (Date.now() - startTime > MAX_STREAM_MS) {
        controller.enqueue(encoder.encode("event: done\ndata: timeout\n\n"));
        controller.close();
        return;
      }

      // Read new log data from KV
      const raw = await c.env.RUNNERS.get(`run:logs:${runId}`);
      if (raw && raw.length > lastOffset) {
        const newData = raw.slice(lastOffset);
        lastOffset = raw.length;
        const lines = newData.split("\n").filter(Boolean);
        for (const line of lines) {
          const evt = JSON.stringify({ line, timestamp: new Date().toISOString() });
          controller.enqueue(encoder.encode(`event: log\ndata: ${evt}\n\n`));
        }
      }

      // Check terminal status
      const current = await c.env.DB.prepare(
        "SELECT status FROM runs WHERE id = ?"
      ).bind(runId).first<{ status: string }>();

      if (current && TERMINAL_STATUSES.has(current.status)) {
        const final = JSON.stringify({ status: current.status });
        controller.enqueue(encoder.encode(`event: done\ndata: ${final}\n\n`));
        controller.close();
        return;
      }

      // Wait before next poll
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
});
