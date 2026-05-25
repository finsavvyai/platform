import { Hono } from "hono";
import type { Env } from "./types";

type Bindings = Env;

interface PoolStatus {
  total: number;
  idle: number;
  busy: number;
  pending: number;
}

interface CloudJob {
  repoUrl: string;
  sha: string;
  steps: string[];
  labels?: string[];
}

export const cloudRoutes = new Hono<{ Bindings: Bindings }>();

// POST /api/cloud/provision — request a managed runner
cloudRoutes.post("/provision", async (c) => {
  const body = await c.req.json<{ labels?: string[]; size?: string }>();
  const id = `runner-${Date.now()}`;
  // In production: call Hetzner/Fly API to provision VM
  return c.json({
    id,
    status: "starting",
    labels: body.labels ?? ["linux"],
    size: body.size ?? "cx21",
  }, 201);
});

// GET /api/cloud/status — pool status
cloudRoutes.get("/status", async (c) => {
  // In production: query scheduler for real counts
  const status: PoolStatus = {
    total: 0,
    idle: 0,
    busy: 0,
    pending: 0,
  };
  return c.json({ pool: status });
});

// POST /api/cloud/run — submit job to managed runner queue
cloudRoutes.post("/run", async (c) => {
  const body = await c.req.json<CloudJob>();
  if (!body.repoUrl || !body.sha) {
    return c.json({ error: "repoUrl and sha required" }, 400);
  }
  const jobId = `job-${Date.now()}`;
  // In production: enqueue to Redis/NATS-backed queue
  return c.json({
    jobId,
    status: "queued",
    repoUrl: body.repoUrl,
    sha: body.sha,
    labels: body.labels ?? [],
  }, 202);
});

// DELETE /api/cloud/runners/:id — destroy runner
cloudRoutes.delete("/runners/:id", async (c) => {
  const id = c.req.param("id");
  // In production: call provisioner.Destroy(id)
  return c.json({ id, status: "destroying" });
});
