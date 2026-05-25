import { describe, expect, it } from 'vitest';
import {
  getDecision,
  listAudit,
  listDecisions,
} from './investigate-client.ts';

const TENANT = 'demo-tenant';

describe('listDecisions (fixture mode)', () => {
  it('returns 3 fixture rows when baseUrl is unset', async () => {
    const r = await listDecisions({ tenantId: TENANT });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.rows).toHaveLength(3);
      expect(r.rows.map((x) => x.recommended_action)).toEqual([
        'allow',
        'flag',
        'block',
      ]);
      // PII discipline: no plaintext name fields surface in the row shape.
      for (const row of r.rows) {
        expect(row.subject_hash.startsWith('sha256:')).toBe(true);
      }
    }
  });
});

describe('listDecisions (real endpoint)', () => {
  it('GETs /v1/aml/decision/history with bearer + tenant header', async () => {
    const calls: [string | URL | Request, RequestInit | undefined][] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push([input, init]);
      return new Response(
        JSON.stringify({ ok: true, tenant_id: TENANT, rows: [] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    };
    const r = await listDecisions({
      tenantId: TENANT,
      baseUrl: 'https://brain.example',
      token: 'tok',
      fetchImpl,
    });
    expect(r.ok).toBe(true);
    const [url, init] = calls[0]!;
    expect(url).toBe('https://brain.example/v1/aml/decision/history');
    expect(init!.method).toBe('GET');
    const headers = init!.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer tok');
    expect(headers['X-Tenant-Id']).toBe(TENANT);
  });

  it('omits Authorization when no token', async () => {
    const calls: [string | URL | Request, RequestInit | undefined][] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push([input, init]);
      return new Response(
        JSON.stringify({ ok: true, tenant_id: TENANT, rows: [] }),
        { status: 200 },
      );
    };
    await listDecisions({
      tenantId: TENANT,
      baseUrl: 'https://brain.example',
      fetchImpl,
    });
    const headers = calls[0]![1]!.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  it('returns http_<status> on non-2xx', async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response('forbidden', { status: 403 });
    const r = await listDecisions({
      tenantId: TENANT,
      baseUrl: 'https://brain.example',
      fetchImpl,
    });
    expect(r).toEqual({ ok: false, error: 'http_403' });
  });

  it('returns network_error on fetch throw', async () => {
    const fetchImpl: typeof fetch = async () => {
      throw new Error('boom');
    };
    const r = await listDecisions({
      tenantId: TENANT,
      baseUrl: 'https://brain.example',
      fetchImpl,
    });
    expect(r).toEqual({ ok: false, error: 'network_error' });
  });
});

describe('getDecision', () => {
  it('rejects empty id with missing_decision_id', async () => {
    const r = await getDecision('  ', { tenantId: TENANT });
    expect(r).toEqual({ ok: false, error: 'missing_decision_id' });
  });

  it('returns fixture detail for known id', async () => {
    const r = await getDecision('dec_01HXYZBLOCK03', { tenantId: TENANT });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.decision.recommended_action).toBe('block');
      expect(r.decision.engine_results).toHaveLength(2);
      // PII discipline: aggregated_explanation contains only stable codes.
      for (const code of r.decision.aggregated_explanation) {
        expect(/^[a-z_]+$/.test(code)).toBe(true);
      }
    }
  });

  it('returns decision_not_found for unknown id (fixture mode)', async () => {
    const r = await getDecision('nope', { tenantId: TENANT });
    expect(r).toEqual({ ok: false, error: 'decision_not_found' });
  });

  it('encodes the id when calling the real endpoint', async () => {
    const calls: [string | URL | Request, RequestInit | undefined][] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push([input, init]);
      return new Response('{}', { status: 200 });
    };
    await getDecision('id with space', {
      tenantId: TENANT,
      baseUrl: 'https://b.example',
      fetchImpl,
    });
    expect(calls[0]![0]).toBe(
      'https://b.example/v1/aml/decision/id%20with%20space',
    );
  });
});

describe('listAudit', () => {
  it('returns fixture chain + records in fixture mode', async () => {
    const r = await listAudit({ tenantId: TENANT });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.chain.verified).toBe(true);
      expect(r.records).toHaveLength(3);
      // First record's chain_prev_hash is the all-zero genesis.
      expect(r.records[0]!.chain_prev_hash).toBe('0'.repeat(64));
      // No PII in reason codes — must match stable-code shape.
      for (const rec of r.records) {
        expect(/^[a-z_]+$/.test(rec.reason)).toBe(true);
      }
    }
  });

  it('hits /v1/aml/audit when baseUrl set', async () => {
    const calls: [string | URL | Request, RequestInit | undefined][] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push([input, init]);
      return new Response(
        JSON.stringify({
          ok: true,
          tenant_id: TENANT,
          records: [],
          chain: { verified: true, last_verified_ts: 'x', head_hash: 'h' },
        }),
        { status: 200 },
      );
    };
    const r = await listAudit({
      tenantId: TENANT,
      baseUrl: 'https://brain.example',
      fetchImpl,
    });
    expect(r.ok).toBe(true);
    expect(calls[0]![0]).toBe('https://brain.example/v1/aml/audit');
  });
});
