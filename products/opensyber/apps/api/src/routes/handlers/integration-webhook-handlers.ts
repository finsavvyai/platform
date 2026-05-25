import type { Context } from 'hono';
import { eq } from 'drizzle-orm';
import { integrationConnections, integrationEvents } from '@opensyber/db';
import { generateId } from '@opensyber/shared';
import type { Env, Variables } from '../../types.js';
import { recordIntegrationSync } from '../../utils/integration-sync.js';
import { timingSafeCompare } from '../../lib/timing-safe.js';

type Ctx = Context<{ Bindings: Env; Variables: Variables }>;
type Severity = 'info' | 'low' | 'medium' | 'high' | 'critical';

/** Compute HMAC-SHA256 hex digest using Web Crypto API. */
export async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0')).join('');
}

function mapGithubSeverity(event: string, body: Record<string, unknown>): Severity {
  if (event === 'secret_scanning_alert') return 'critical';
  if (event === 'code_scanning_alert' || event === 'dependabot_alert') return 'high';
  if (event === 'branch_protection_rule') return 'medium';
  if ((body.action as string | undefined) === 'deleted') return 'medium';
  return 'info';
}

function summarizeGithub(event: string, body: Record<string, unknown>): string {
  const repo = (body.repository as Record<string, string>)?.full_name || 'unknown';
  return `${event} ${(body.action as string) || ''} on ${repo}`.trim();
}

export async function handleGithubWebhook(c: Ctx): Promise<Response> {
  const secret = (c.env as unknown as Record<string, string>).GITHUB_WEBHOOK_SECRET;
  if (!secret) return c.json({ error: 'Webhook secret not configured' }, 500);

  const signature = c.req.header('X-Hub-Signature-256');
  if (!signature) return c.json({ error: 'Missing signature' }, 401);

  const rawBody = await c.req.text();
  const expected = 'sha256=' + await hmacSha256Hex(secret, rawBody);
  if (!timingSafeCompare(signature, expected)) {
    console.error('GitHub webhook signature mismatch');
    return c.json({ error: 'Invalid signature' }, 401);
  }

  const db = c.get('db');
  const event = c.req.header('X-GitHub-Event') || 'unknown';
  const body = JSON.parse(rawBody);
  const severity = mapGithubSeverity(event, body);
  const summary = summarizeGithub(event, body);

  const connections = await db
    .select()
    .from(integrationConnections)
    .where(eq(integrationConnections.integrationSlug, 'github'));

  for (const conn of connections) {
    const start = Date.now();
    await db.insert(integrationEvents).values({
      id: generateId(),
      connectionId: conn.id,
      eventType: `github.${event}`,
      severity,
      summary,
      rawPayload: JSON.stringify(body).slice(0, 4096),
      latencyMs: Date.now() - start,
    });
    await recordIntegrationSync(db, conn.id, {
      success: true,
      latencyMs: Date.now() - start,
    });
  }

  return c.json({ received: true });
}

export async function handleGitlabWebhook(c: Ctx): Promise<Response> {
  const env = c.env as unknown as Record<string, string | undefined>;
  const secret = env.GITLAB_WEBHOOK_SECRET;
  if (!secret) return c.json({ error: 'Webhook secret not configured' }, 500);

  const token = c.req.header('X-Gitlab-Token');
  if (!token) return c.json({ error: 'Missing token' }, 401);
  if (!timingSafeCompare(token, secret)) {
    console.error('GitLab webhook token mismatch');
    return c.json({ error: 'Invalid token' }, 401);
  }

  const rawBody = await c.req.text();

  // Defense-in-depth body HMAC. GitLab itself does not sign payloads, so
  // deployments route webhooks through a proxy (or GitLab's "secret token
  // plus extra header" pattern) that signs the body with a separate secret.
  // When GITLAB_WEBHOOK_HMAC_SECRET is set, we require that signature —
  // this blocks replay of a leaked X-Gitlab-Token against arbitrary bodies.
  const hmacSecret = env.GITLAB_WEBHOOK_HMAC_SECRET;
  if (hmacSecret) {
    const provided = c.req.header('X-OpenSyber-Signature') ?? '';
    const expected = await hmacSha256Hex(hmacSecret, rawBody);
    const normalized = provided.replace(/^sha256=/i, '').toLowerCase();
    if (!timingSafeCompare(normalized, expected)) {
      console.error('GitLab webhook body HMAC mismatch');
      return c.json({ error: 'Invalid body signature' }, 401);
    }
  }

  const db = c.get('db');
  const event = c.req.header('X-Gitlab-Event') || 'unknown';
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const connections = await db
    .select()
    .from(integrationConnections)
    .where(eq(integrationConnections.integrationSlug, 'gitlab'));

  for (const conn of connections) {
    const start = Date.now();
    await db.insert(integrationEvents).values({
      id: generateId(),
      connectionId: conn.id,
      eventType: `gitlab.${event}`,
      severity: 'info',
      summary: `GitLab event: ${event}`,
      rawPayload: JSON.stringify(body).slice(0, 4096),
      latencyMs: Date.now() - start,
    });
    await recordIntegrationSync(db, conn.id, {
      success: true,
      latencyMs: Date.now() - start,
    });
  }

  return c.json({ received: true });
}

export async function handleGenericWebhook(c: Ctx): Promise<Response> {
  const db = c.get('db');
  const slug = c.req.param('slug');
  if (!slug) return c.json({ error: 'Missing integration slug' }, 400);

  const connections = await db
    .select()
    .from(integrationConnections)
    .where(eq(integrationConnections.integrationSlug, slug));

  if (connections.length === 0) return c.json({ error: 'Unknown integration' }, 404);

  const webhookSecret = (connections[0] as Record<string, unknown>).webhookSecret as string | undefined;
  if (!webhookSecret) return c.json({ error: 'Webhook secret not configured' }, 500);

  const signature = c.req.header('X-Webhook-Signature');
  if (!signature) return c.json({ error: 'Missing signature' }, 401);

  const rawBody = await c.req.text();
  const expected = await hmacSha256Hex(webhookSecret, rawBody);
  if (!timingSafeCompare(signature, expected)) {
    console.error(`Generic webhook signature mismatch for ${slug}`);
    return c.json({ error: 'Invalid signature' }, 401);
  }
  const body = JSON.parse(rawBody);

  for (const connection of connections) {
    const start = Date.now();
    await db.insert(integrationEvents).values({
      id: generateId(),
      connectionId: connection.id,
      eventType: `${slug}.webhook`,
      severity: 'info',
      summary: `Webhook received from ${slug}`,
      rawPayload: JSON.stringify(body).slice(0, 4096),
      latencyMs: Date.now() - start,
    });
    await recordIntegrationSync(db, connection.id, {
      success: true,
      latencyMs: Date.now() - start,
    });
  }

  return c.json({ received: true });
}
