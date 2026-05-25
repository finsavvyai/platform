import type { Context } from 'hono';
import { z } from 'zod';
import type { Env, Variables } from '../../../types.js';
import { timingSafeCompare } from '../../../lib/timing-safe.js';

type Ctx = Context<{ Bindings: Env; Variables: Variables }>;

const pipewardenScanSchema = z.object({
  repoUrl: z.string().url().max(2048),
  branch: z.string().min(1).max(256).optional(),
  engine: z.enum(['semgrep', 'trivy', 'gitleaks', 'all']).optional(),
  connectionName: z.string().min(1).max(128).optional(),
});

export async function handlePipewardenAudit(c: Ctx) {
  const signature = c.req.header('X-PipeWarden-Signature');
  if (!signature) {
    return c.json({ error: 'Missing signature' }, 401);
  }

  const secret = (c.env as unknown as Record<string, string>).PIPEWARDEN_WEBHOOK_SECRET;
  if (!secret) {
    return c.json({ error: 'Webhook secret not configured' }, 500);
  }

  try {
    const rawBody = await c.req.text();

    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody));
    const computed = 'sha256=' + Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    if (!timingSafeCompare(computed, signature)) {
      console.error('PipeWarden audit webhook signature mismatch');
      return c.json({ error: 'Invalid signature' }, 401);
    }

    const body = JSON.parse(rawBody);
    return c.json({ received: true, eventType: body.action }, 202);
  } catch (error) {
    console.error('PipeWarden audit webhook error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
}

export async function handlePipewardenStatus(c: Ctx) {
  const pipewardenURL = (c.env as unknown as Record<string, string>).PIPEWARDEN_URL;
  const pipewardenToken = (c.env as unknown as Record<string, string>).PIPEWARDEN_API_KEY;

  if (!pipewardenURL || !pipewardenToken) {
    return c.json({ status: 'unconfigured', message: 'PipeWarden integration not configured' }, 200);
  }

  try {
    const response = await fetch(`${pipewardenURL}/api/v1/status`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${pipewardenToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return c.json({ status: 'unreachable', message: `PipeWarden returned HTTP ${response.status}` }, 503);
    }

    const statusData = await response.json();
    return c.json({ status: 'connected', pipewardenStatus: statusData }, 200);
  } catch (error) {
    console.error('PipeWarden status check failed:', error);
    return c.json({ status: 'error', message: String(error) }, 503);
  }
}

export async function handlePipewardenScan(c: Ctx) {
  const pipewardenURL = (c.env as unknown as Record<string, string>).PIPEWARDEN_URL;
  const pipewardenToken = (c.env as unknown as Record<string, string>).PIPEWARDEN_API_KEY;

  if (!pipewardenURL || !pipewardenToken) {
    return c.json({ error: 'PipeWarden not configured' }, 400);
  }

  try {
    const raw = await c.req.json().catch(() => null);
    const parsed = pipewardenScanSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: 'Invalid input', message: parsed.error.issues[0]?.message ?? 'Validation failed' }, 400);
    }

    const response = await fetch(`${pipewardenURL}/api/v1/analysis/run`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${pipewardenToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(parsed.data),
    });

    if (!response.ok) {
      return c.json(
        { error: 'PipeWarden scan failed', status: response.status },
        response.status as 400 | 500 | 502 | 503,
      );
    }

    const result = await response.json();
    return c.json(result, 202);
  } catch (error) {
    console.error('PipeWarden scan error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
}
