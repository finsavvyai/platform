/** @vitest-environment node */
import { describe, it, expect, beforeEach } from 'vitest';
import { handleLSWebhook, verifyLSSignature } from './lemonsqueezy-webhook';

// In-memory D1 shim. Tracks mutations to projects + billing_events.
function makeDB() {
  const projects = new Map<string, Record<string, unknown>>();
  const events = new Set<string>(); // ls_event_ids
  const calls: Array<{ sql: string; binds: unknown[] }> = [];

  const prepare = (sql: string) => ({
    bind: (...binds: unknown[]) => ({
      run: async () => {
        calls.push({ sql, binds });
        if (sql.startsWith('INSERT INTO billing_events')) {
          const lsEventId = binds[3] as string;
          if (events.has(lsEventId)) {
            throw new Error('UNIQUE constraint failed: billing_events.ls_event_id');
          }
          events.add(lsEventId);
          return { success: true };
        }
        if (sql.startsWith('UPDATE projects SET')) {
          const projectId = binds[binds.length - 1] as string;
          const current = projects.get(projectId) ?? {};
          // Crudely parse `col1 = ?, col2 = ?` to map binds back to column names.
          const m = sql.match(/SET (.+) WHERE id = \?/);
          if (m) {
            const cols = m[1].split(',').map((c) => c.trim().split(' ')[0]);
            cols.forEach((col, i) => { current[col] = binds[i]; });
          }
          projects.set(projectId, current);
          return { success: true };
        }
        return { success: true };
      },
    }),
  });

  return {
    DB: { prepare },
    _projects: projects,
    _events: events,
    _calls: calls,
  };
}

const SECRET = 'test-secret';

async function sign(body: string, secret = SECRET): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function makeEnv(extra: Record<string, string> = {}) {
  const db = makeDB();
  const env = {
    DB: db.DB,
    LEMONSQUEEZY_WEBHOOK_SECRET: SECRET,
    ...extra,
  } as unknown as Parameters<typeof handleLSWebhook>[0];
  return { env, db };
}

function makeReq(body: string, sig: string | null): Request {
  const headers: Record<string, string> = {};
  if (sig !== null) headers['X-Signature'] = sig;
  return new Request('https://x/v1/webhooks/lemonsqueezy', {
    method: 'POST', headers, body,
  });
}

describe('verifyLSSignature', () => {
  it('returns true for a valid signature', async () => {
    const body = '{"hello":"world"}';
    const sig = await sign(body);
    expect(await verifyLSSignature(body, sig, SECRET)).toBe(true);
  });

  it('returns false for a tampered body', async () => {
    const sig = await sign('{"hello":"world"}');
    expect(await verifyLSSignature('{"hello":"hacked"}', sig, SECRET)).toBe(false);
  });

  it('returns false for empty signature', async () => {
    expect(await verifyLSSignature('body', '', SECRET)).toBe(false);
  });

  it('returns false for empty secret', async () => {
    expect(await verifyLSSignature('body', 'deadbeef', '')).toBe(false);
  });

  it('returns false for non-hex signature', async () => {
    expect(await verifyLSSignature('body', 'not-hex-zzz', SECRET)).toBe(false);
  });
});

describe('handleLSWebhook', () => {
  let envBundle: ReturnType<typeof makeEnv>;
  beforeEach(() => { envBundle = makeEnv(); });

  it('returns 401 when signature header missing', async () => {
    const res = await handleLSWebhook(envBundle.env, makeReq('{}', null));
    expect(res.status).toBe(401);
  });

  it('returns 401 on bad signature', async () => {
    const res = await handleLSWebhook(envBundle.env, makeReq('{"a":1}', 'deadbeef'));
    expect(res.status).toBe(401);
  });

  it('returns 200 on valid signature for known event', async () => {
    const body = JSON.stringify({
      meta: { event_name: 'subscription_created', custom_data: { project_id: 'p1' } },
      data: { id: 'sub_1', attributes: { variant_id: 'v_dev', customer_id: 99, renews_at: '2026-05-25T00:00:00Z' } },
    });
    const res = await handleLSWebhook(envBundle.env, makeReq(body, await sign(body)));
    expect(res.status).toBe(200);
    expect(envBundle.db._projects.get('p1')?.tier_status).toBe('active');
  });

  it('is idempotent on duplicate ls_event_id (200 without re-applying)', async () => {
    const body = JSON.stringify({
      meta: { event_name: 'subscription_payment_recovered', custom_data: { project_id: 'p2' } },
      data: { id: 'sub_dup', attributes: {} },
    });
    const sig = await sign(body);
    const r1 = await handleLSWebhook(envBundle.env, makeReq(body, sig));
    expect(r1.status).toBe(200);
    const updateCallsBefore = envBundle.db._calls.filter((c) => c.sql.startsWith('UPDATE projects')).length;

    const r2 = await handleLSWebhook(envBundle.env, makeReq(body, sig));
    expect(r2.status).toBe(200);
    const j2 = await r2.json() as { duplicate?: boolean };
    expect(j2.duplicate).toBe(true);

    const updateCallsAfter = envBundle.db._calls.filter((c) => c.sql.startsWith('UPDATE projects')).length;
    expect(updateCallsAfter).toBe(updateCallsBefore);
  });

  it('returns 200 for unknown event name (ignored)', async () => {
    const body = JSON.stringify({
      meta: { event_name: 'license_key_created', custom_data: { project_id: 'p3' } },
      data: { id: 'lk_1', attributes: {} },
    });
    const res = await handleLSWebhook(envBundle.env, makeReq(body, await sign(body)));
    expect(res.status).toBe(200);
    const j = await res.json() as { applied?: boolean; reason?: string };
    expect(j.applied).toBe(false);
    expect(j.reason).toBe('unknown_event');
  });
});
