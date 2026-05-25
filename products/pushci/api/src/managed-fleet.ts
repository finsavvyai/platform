// Managed runner fleet: provision runners on Hetzner/Fly.io.

import { Hono } from "hono";
import { verifyJwt } from "./auth";
import type { Env } from "./types";

type Bindings = Env;
export const fleetRoutes = new Hono<{ Bindings: Bindings }>();

interface FleetConfig {
  provider: "hetzner" | "flyio";
  region: string;
  size: string;
  count: number;
  project_id: string;
}

const HETZNER_SIZES: Record<string, { cpus: number; ram: number; price: number }> = {
  cx22: { cpus: 2, ram: 4, price: 3.99 },
  cx32: { cpus: 4, ram: 8, price: 6.99 },
  cx42: { cpus: 8, ram: 16, price: 13.99 },
  cx52: { cpus: 16, ram: 32, price: 27.99 },
};

const FLYIO_SIZES: Record<string, { cpus: number; ram: number; price: number }> = {
  shared1x: { cpus: 1, ram: 256, price: 1.94 },
  shared2x: { cpus: 2, ram: 512, price: 3.88 },
  perf1x: { cpus: 1, ram: 2048, price: 5.70 },
  perf2x: { cpus: 2, ram: 4096, price: 11.40 },
};

// GET /fleet/sizes — available runner sizes
fleetRoutes.get("/sizes", (c) => {
  return c.json({ hetzner: HETZNER_SIZES, flyio: FLYIO_SIZES });
});

// POST /fleet/provision — provision managed runners
fleetRoutes.post("/provision", async (c) => {
  const token = (c.req.header("authorization") ?? "").replace("Bearer ", "");
  if (!token) return c.json({ error: "unauthorized" }, 401);
  const user = await verifyJwt(token, c.env.JWT_SECRET);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const body = await c.req.json<FleetConfig>();
  if (!body.provider || !body.size || !body.project_id) {
    return c.json({ error: "provider, size, project_id required" }, 400);
  }

  const sizes = body.provider === "hetzner" ? HETZNER_SIZES : FLYIO_SIZES;
  const spec = sizes[body.size];
  if (!spec) return c.json({ error: `unknown size: ${body.size}` }, 400);

  const count = Math.min(body.count || 1, 10);
  const runners: Array<{ id: string; name: string; status: string }> = [];

  for (let i = 0; i < count; i++) {
    const id = crypto.randomUUID();
    const name = `pushci-${body.provider}-${body.size}-${id.slice(0, 8)}`;

    // Register runner in DB
    await c.env.DB.prepare(`
      INSERT INTO runners (id, project_id, name, token_hash, labels_json, os, arch, status)
      VALUES (?, ?, ?, ?, ?, 'linux', 'amd64', 'pending')
    `).bind(
      id, body.project_id, name, `managed:${id}`,
      JSON.stringify([body.provider, body.size, body.region || "auto"]),
    ).run();

    runners.push({ id, name, status: "provisioning" });
  }

  // Store fleet config in KV for the provisioner
  const fleetKey = `fleet:${body.project_id}`;
  const existing = await c.env.RUNNERS.get(fleetKey);
  const fleet = existing ? JSON.parse(existing) : { runners: [] };
  fleet.runners.push(...runners.map(r => ({
    ...r,
    provider: body.provider,
    size: body.size,
    region: body.region || "auto",
    spec,
    created_at: new Date().toISOString(),
  })));
  await c.env.RUNNERS.put(fleetKey, JSON.stringify(fleet));

  const monthlyCost = count * spec.price;
  return c.json({
    ok: true,
    runners,
    provider: body.provider,
    size: body.size,
    spec,
    estimated_monthly_cost: monthlyCost,
    message: `${count} runner(s) queued for provisioning on ${body.provider}`,
  }, 201);
});

// GET /fleet/:projectId — list managed runners
fleetRoutes.get("/:projectId", async (c) => {
  const token = (c.req.header("authorization") ?? "").replace("Bearer ", "");
  if (!token) return c.json({ error: "unauthorized" }, 401);
  const user = await verifyJwt(token, c.env.JWT_SECRET);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const projectId = c.req.param("projectId");
  const fleetKey = `fleet:${projectId}`;
  const raw = await c.env.RUNNERS.get(fleetKey);
  const fleet = raw ? JSON.parse(raw) : { runners: [] };

  return c.json({ project_id: projectId, fleet });
});

// DELETE /fleet/:projectId/:runnerId — deprovision a runner
fleetRoutes.delete("/:projectId/:runnerId", async (c) => {
  const token = (c.req.header("authorization") ?? "").replace("Bearer ", "");
  if (!token) return c.json({ error: "unauthorized" }, 401);
  const user = await verifyJwt(token, c.env.JWT_SECRET);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const { projectId, runnerId } = c.req.param() as { projectId: string; runnerId: string };

  await c.env.DB.prepare("DELETE FROM runners WHERE id = ? AND project_id = ?")
    .bind(runnerId, projectId).run();

  const fleetKey = `fleet:${projectId}`;
  const raw = await c.env.RUNNERS.get(fleetKey);
  if (raw) {
    const fleet = JSON.parse(raw);
    fleet.runners = fleet.runners.filter((r: { id: string }) => r.id !== runnerId);
    await c.env.RUNNERS.put(fleetKey, JSON.stringify(fleet));
  }

  return c.json({ ok: true, deprovisioned: runnerId });
});
