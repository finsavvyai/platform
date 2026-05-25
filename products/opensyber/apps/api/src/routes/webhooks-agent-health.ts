import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { instances, skillInstallations, skills } from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import { gatewayAuthMiddleware } from '../middleware/gateway-auth.js';
import { agentHealthSchema } from './validation/webhooks-agent.js';

const agentHealthWebhookRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

agentHealthWebhookRoutes.post('/agent/health', gatewayAuthMiddleware, async (c) => {
  const db = c.get('db');
  const parsed = agentHealthSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: 'Invalid input', details: parsed.error.issues[0]?.message }, 400);
  const body = parsed.data;

  const headerInstanceId = c.req.header('X-Instance-Id');
  if (body.instanceId !== headerInstanceId) {
    return c.json({ error: 'Forbidden', message: 'Instance ID mismatch' }, 403);
  }

  // Look up current instance to handle status lifecycle
  const [currentInstance] = await db.select({ status: instances.status })
    .from(instances).where(eq(instances.id, body.instanceId));

  // Determine new status — first health ping transitions installing → running
  type InstanceStatus = 'running' | 'installing' | 'error';
  let newStatus: InstanceStatus;
  if (body.engineRunning) {
    newStatus = 'running';
  } else if (currentInstance?.status === 'installing') {
    // Agent booted but engine not ready yet — stay installing
    newStatus = 'installing';
  } else {
    newStatus = 'error';
  }

  await db.update(instances).set({
    status: newStatus as typeof newStatus,
    agentVersion: body.agentVersion, engineVersion: body.engineVersion,
    lastHealthCheck: new Date().toISOString(),
  }).where(eq(instances.id, body.instanceId));

  // Health cache write runs in the background. The ACK response back
  // to the daemon just needs "received: true" + the desired skill list;
  // waiting for KV propagation here adds ~100ms per heartbeat across
  // ALL deployed agents (hundreds of pings/minute in aggregate). Losing
  // a rare cache write just means the dashboard reads are one heartbeat
  // stale. c.executionCtx is a throwing getter in tests — try/catch.
  const putPromise = c.env.CACHE.put(
    `health:${body.instanceId}`,
    JSON.stringify({ ...body, timestamp: new Date().toISOString() }),
    { expirationTtl: 300 },
  );
  try {
    c.executionCtx.waitUntil(putPromise);
  } catch {
    void putPromise.catch(() => {});
  }

  const activeInstalls = await db
    .select({ slug: skills.slug, version: skillInstallations.version })
    .from(skillInstallations)
    .innerJoin(skills, eq(skillInstallations.skillId, skills.id))
    .where(and(
      eq(skillInstallations.instanceId, body.instanceId),
      eq(skillInstallations.isActive, true),
    ));

  return c.json({
    received: true,
    desiredSkills: activeInstalls.map((s) => ({ slug: s.slug, version: s.version })),
  });
});

export { agentHealthWebhookRoutes };
