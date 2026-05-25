// Pipeline Visualization API — DAG and timeline data for pipeline runs.

import { Hono } from "hono";
import { verifyJwt } from "./auth";
import type { Env, JobRecord } from "./types";

export const pipelineVizRoutes = new Hono<{ Bindings: Env }>();

interface DagNode {
  id: string;
  name: string;
  status: string;
  duration_ms: number | null;
  started_at: string | null;
  finished_at: string | null;
}

interface DagEdge {
  from: string;
  to: string;
}

interface PipelineDAG {
  nodes: DagNode[];
  edges: DagEdge[];
}

interface TimelineEntry {
  id: string;
  name: string;
  status: string;
  start: number;
  end: number;
  duration_ms: number;
}

// DAG endpoint — returns graph structure for pipeline visualization
pipelineVizRoutes.get("/dag/:runId", async (c) => {
  const token = (c.req.header("authorization") ?? "").replace("Bearer ", "");
  const user = token ? await verifyJwt(token, c.env.JWT_SECRET) : null;
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const runId = c.req.param("runId");
  const { results } = await c.env.DB.prepare(
    "SELECT id, run_id, status, steps_json, labels_json, started_at, finished_at FROM jobs WHERE run_id = ? ORDER BY created_at ASC"
  ).bind(runId).all<JobRecord>();

  if (!results || results.length === 0) {
    return c.json({ error: "no jobs found for run" }, 404);
  }

  const nodes: DagNode[] = [];
  const edges: DagEdge[] = [];

  for (const job of results) {
    const startMs = job.started_at ? new Date(job.started_at).getTime() : null;
    const endMs = job.finished_at ? new Date(job.finished_at).getTime() : null;
    const duration = startMs && endMs ? endMs - startMs : null;

    // Derive a display name from steps_json or fall back to id
    let name = job.id;
    if (job.steps_json) {
      try {
        const steps = JSON.parse(job.steps_json);
        if (Array.isArray(steps) && steps.length > 0 && steps[0].name) {
          name = steps[0].name;
        }
      } catch { /* ignore parse errors */ }
    }

    nodes.push({
      id: job.id,
      name,
      status: job.status,
      duration_ms: duration,
      started_at: job.started_at,
      finished_at: job.finished_at,
    });

    // Parse labels_json for dependency edges ("needs:jobId")
    if (job.labels_json) {
      try {
        const labels: string[] = JSON.parse(job.labels_json);
        for (const label of labels) {
          if (label.startsWith("needs:")) {
            const depId = label.slice(6);
            edges.push({ from: depId, to: job.id });
          }
        }
      } catch { /* ignore parse errors */ }
    }
  }

  const dag: PipelineDAG = { nodes, edges };
  return c.json(dag);
});

// Timeline endpoint — returns Gantt chart data
pipelineVizRoutes.get("/timeline/:runId", async (c) => {
  const token = (c.req.header("authorization") ?? "").replace("Bearer ", "");
  const user = token ? await verifyJwt(token, c.env.JWT_SECRET) : null;
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const runId = c.req.param("runId");

  // Get the run to find the start time
  const run = await c.env.DB.prepare(
    "SELECT started_at, created_at FROM runs WHERE id = ?"
  ).bind(runId).first<{ started_at: string | null; created_at: string }>();

  if (!run) return c.json({ error: "run not found" }, 404);

  const runStart = new Date(run.started_at ?? run.created_at).getTime();

  const { results } = await c.env.DB.prepare(
    "SELECT id, status, steps_json, labels_json, started_at, finished_at FROM jobs WHERE run_id = ? ORDER BY created_at ASC"
  ).bind(runId).all<JobRecord>();

  if (!results || results.length === 0) {
    return c.json({ error: "no jobs found for run" }, 404);
  }

  const timeline: TimelineEntry[] = [];

  for (const job of results) {
    const jobStart = job.started_at ? new Date(job.started_at).getTime() : runStart;
    const jobEnd = job.finished_at ? new Date(job.finished_at).getTime() : Date.now();
    const duration = jobEnd - jobStart;

    let name = job.id;
    if (job.steps_json) {
      try {
        const steps = JSON.parse(job.steps_json);
        if (Array.isArray(steps) && steps.length > 0 && steps[0].name) {
          name = steps[0].name;
        }
      } catch { /* ignore */ }
    }

    timeline.push({
      id: job.id,
      name,
      status: job.status,
      start: jobStart - runStart,
      end: jobEnd - runStart,
      duration_ms: duration,
    });
  }

  return c.json({ runId, runStart: new Date(runStart).toISOString(), entries: timeline });
});
