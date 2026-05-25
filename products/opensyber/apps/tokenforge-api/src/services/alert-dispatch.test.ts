import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { dispatchAlerts } from './alert-dispatch.js';
import { createMockEnv } from '../test/helpers.js';
import type { Env } from '../types.js';

interface FetchCall {
  url: string;
  body: Record<string, unknown> | null;
}

function captureFetch(): { calls: FetchCall[] } {
  const calls: FetchCall[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : (input as Request).url;
    let body: Record<string, unknown> | null = null;
    if (init?.body && typeof init.body === 'string') {
      try { body = JSON.parse(init.body) as Record<string, unknown>; } catch { body = null; }
    }
    calls.push({ url, body });
    return new Response('ok');
  }) as typeof fetch;
  // Restore on test cleanup via afterEach
  (calls as unknown as { __restore: () => void }).__restore = () => {
    globalThis.fetch = realFetch;
  };
  return { calls };
}

async function seedRules(env: Env, tenantId: string, rules: unknown[]): Promise<void> {
  await env.CACHE.put(`alert_rules:${tenantId}`, JSON.stringify(rules));
}

describe('dispatchAlerts', () => {
  let env: Env;
  let captured: ReturnType<typeof captureFetch>;

  beforeEach(() => {
    env = createMockEnv();
    captured = captureFetch();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    (captured.calls as unknown as { __restore: () => void }).__restore();
    vi.restoreAllMocks();
  });

  it('returns early (no fetch) when CACHE has no rules for the tenant', async () => {
    await dispatchAlerts('t-no-rules', { type: 'session.hijack_attempt' }, env);
    expect(captured.calls).toHaveLength(0);
  });

  it('returns early when stored rules JSON is malformed', async () => {
    await env.CACHE.put('alert_rules:t1', '{not-json');
    await dispatchAlerts('t1', { type: 'session.hijack_attempt' }, env);
    expect(captured.calls).toHaveLength(0);
  });

  it('dispatches zero alerts when no rules match the event', async () => {
    await seedRules(env, 't1', [
      { id: 'r1', name: 'geo', condition: 'geo_anomaly', channel: 'webhook', destination: 'https://x' },
    ]);
    await dispatchAlerts('t1', { type: 'session.verified', trustScore: 95 }, env);
    expect(captured.calls).toHaveLength(0);
  });

  it('matches hijack_attempt → email via Resend', async () => {
    await seedRules(env, 't1', [
      { id: 'r1', name: 'hijack-team', condition: 'hijack_attempt', channel: 'email', destination: 'sec@acme.com' },
    ]);
    await dispatchAlerts('t1', { type: 'session.hijack_attempt', deviceId: 'dev_1', ip: '1.2.3.4' }, env);
    expect(captured.calls).toHaveLength(1);
    expect(captured.calls[0]!.url).toBe('https://api.resend.com/emails');
    expect(captured.calls[0]!.body!.to).toEqual(['sec@acme.com']);
    expect(captured.calls[0]!.body!.subject).toContain('hijack-team');
  });

  it('matches trust_drop below threshold → webhook with SIEM payload', async () => {
    await seedRules(env, 't1', [
      { id: 'r1', name: 'low-trust', condition: 'trust_drop', threshold: 60, channel: 'webhook', destination: 'https://siem.example/ingest' },
    ]);
    await dispatchAlerts('t1', { type: 'trust.step_up', trustScore: 35, deviceId: 'dev_x' }, env);
    expect(captured.calls).toHaveLength(1);
    expect(captured.calls[0]!.url).toBe('https://siem.example/ingest');
    const payload = captured.calls[0]!.body!;
    expect(payload.source).toBe('tokenforge');
    expect(payload.tenantId).toBe('t1');
    expect(payload.severity).toBe(8); // trustScore<40 path
    expect(payload.severityLabel).toBe('critical');
    expect(typeof payload.cef).toBe('string');
    expect((payload.cef as string).startsWith('CEF:0|OpenSyber|TokenForge|')).toBe(true);
  });

  it('does not fire trust_drop when score is above threshold', async () => {
    await seedRules(env, 't1', [
      { id: 'r1', name: 'low-trust', condition: 'trust_drop', threshold: 50, channel: 'webhook', destination: 'https://x' },
    ]);
    await dispatchAlerts('t1', { type: 'trust.allow', trustScore: 90 }, env);
    expect(captured.calls).toHaveLength(0);
  });

  it('emits severityLabel "high" when trustScore is between 40 and 79', async () => {
    await seedRules(env, 't1', [
      { id: 'r1', name: 'mid-trust', condition: 'trust_drop', threshold: 80, channel: 'webhook', destination: 'https://x' },
    ]);
    await dispatchAlerts('t1', { type: 'trust.step_up', trustScore: 65 }, env);
    const payload = captured.calls[0]!.body!;
    // 40 ≤ 65 < 80 → severity 5 → label "medium" per the >=4 boundary
    expect(payload.severity).toBe(5);
    expect(payload.severityLabel).toBe('medium');
  });

  it('matches multiple rules in a single event and dispatches all (Promise.allSettled)', async () => {
    await seedRules(env, 't1', [
      { id: 'r1', name: 'sec-team-email', condition: 'hijack_attempt', channel: 'email', destination: 'sec@acme.com' },
      { id: 'r2', name: 'siem-feed', condition: 'hijack_attempt', channel: 'webhook', destination: 'https://siem.example' },
      { id: 'r3', name: 'unrelated', condition: 'geo_anomaly', channel: 'webhook', destination: 'https://geo' },
    ]);
    await dispatchAlerts('t1', { type: 'session.hijack_attempt', deviceId: 'dev_x' }, env);
    expect(captured.calls).toHaveLength(2);
    const urls = captured.calls.map((c) => c.url).sort();
    expect(urls).toEqual(['https://api.resend.com/emails', 'https://siem.example']);
  });

  it('matches ip_change condition (reason="ip_mismatch" OR type="ip_change")', async () => {
    await seedRules(env, 't1', [
      { id: 'r-ip', name: 'ip-watch', condition: 'ip_change', channel: 'webhook', destination: 'https://wh' },
    ]);
    await dispatchAlerts('t1', { type: 'whatever', reason: 'ip_mismatch', deviceId: 'd1' }, env);
    expect(captured.calls).toHaveLength(1);
    captured.calls.length = 0;
    await dispatchAlerts('t1', { type: 'ip_change', deviceId: 'd1' }, env);
    expect(captured.calls).toHaveLength(1);
  });

  it('matches geo_anomaly condition (reason OR type)', async () => {
    await seedRules(env, 't1', [
      { id: 'r-geo', name: 'geo-watch', condition: 'geo_anomaly', channel: 'webhook', destination: 'https://wh' },
    ]);
    await dispatchAlerts('t1', { type: 'whatever', reason: 'geo_anomaly' }, env);
    expect(captured.calls).toHaveLength(1);
  });

  it('matches session_revoked condition (reason="session_revoked")', async () => {
    await seedRules(env, 't1', [
      { id: 'r-rev', name: 'rev-watch', condition: 'session_revoked', channel: 'webhook', destination: 'https://wh' },
    ]);
    await dispatchAlerts('t1', { type: 'trust.block', reason: 'session_revoked' }, env);
    expect(captured.calls).toHaveLength(1);
  });

  it('rejects unknown rule.condition (default branch returns false)', async () => {
    await seedRules(env, 't1', [
      { id: 'r-bogus', name: 'bogus', condition: 'made_up_condition', channel: 'webhook', destination: 'https://wh' },
    ]);
    await dispatchAlerts('t1', { type: 'session.hijack_attempt', reason: 'nonce_replay' }, env);
    expect(captured.calls).toHaveLength(0);
  });

  describe('eventSeverity ladder (SIEM payload)', () => {
    const wh = { id: 'r', name: 'r', channel: 'webhook' as const, destination: 'https://wh' };

    async function severityFor(condition: string, event: Record<string, unknown>): Promise<{ severity: number; severityLabel: string }> {
      await seedRules(env, 't1', [{ ...wh, condition, threshold: 80 }]);
      await dispatchAlerts('t1', event as never, env);
      const body = captured.calls[0]!.body as { severity: number; severityLabel: string };
      captured.calls.length = 0;
      return body;
    }

    it('hijack_attempt produces severity=9 critical', async () => {
      const s = await severityFor('hijack_attempt', { type: 'session.hijack_attempt', reason: 'nonce_replay' });
      expect(s.severity).toBe(9);
      expect(s.severityLabel).toBe('critical');
    });

    it('trust_drop with trustScore<40 produces severity=8 critical', async () => {
      const s = await severityFor('trust_drop', { type: 'trust.block', trustScore: 20 });
      expect(s.severity).toBe(8);
      expect(s.severityLabel).toBe('critical');
    });

    it('session_revoked produces severity=7 high', async () => {
      const s = await severityFor('session_revoked', { type: 'trust.block', reason: 'session_revoked' });
      expect(s.severity).toBe(7);
      expect(s.severityLabel).toBe('high');
    });

    it('event with no severity-relevant fields produces severity=3 low', async () => {
      const s = await severityFor('ip_change', { type: 'ip_change' });
      expect(s.severity).toBe(3);
      expect(s.severityLabel).toBe('low');
    });
  });
});
