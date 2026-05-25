/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { isValidEmail, formatDigestEmail, formatBudgetAlertEmail, sendEmail, senderDomain, checkResendDomainStatus } from './email-digest';
import type { DigestStats } from './slack-digest';
import type { Env } from './types';

describe('isValidEmail', () => {
  it('accepts normal addresses', () => {
    expect(isValidEmail('finance@acme.com')).toBe(true);
    expect(isValidEmail('user+tag@example.co.uk')).toBe(true);
  });
  it('rejects missing at sign', () => {
    expect(isValidEmail('no-at-sign.com')).toBe(false);
  });
  it('rejects missing dot', () => {
    expect(isValidEmail('a@b')).toBe(false);
  });
  it('rejects whitespace', () => {
    expect(isValidEmail('a b@c.com')).toBe(false);
  });
  it('rejects empty', () => {
    expect(isValidEmail('')).toBe(false);
  });
});

const stats: DigestStats = {
  projectName: 'my-app',
  totalRequests: 12500,
  totalCost: 47.82,
  cachedPct: 35.4,
  boostedPct: 28.1,
  avgLatencyMs: 284,
  topModels: [{ model: 'gpt-4o', cost: 30.5, requests: 5200 }],
  costDeltaPct: -12.4,
};

describe('formatDigestEmail', () => {
  it('puts cost in subject', () => {
    expect(formatDigestEmail(stats).subject).toContain('$47.82');
  });
  it('includes project name in subject and body', () => {
    const msg = formatDigestEmail(stats);
    expect(msg.subject).toContain('my-app');
    expect(msg.html).toContain('my-app');
    expect(msg.text).toContain('my-app');
  });
  it('escapes HTML-unsafe project names', () => {
    const msg = formatDigestEmail({ ...stats, projectName: '<script>x</script>' });
    expect(msg.html).not.toContain('<script>');
    expect(msg.html).toContain('&lt;script&gt;');
  });
  it('falls back to first-week note when no delta', () => {
    const msg = formatDigestEmail({ ...stats, costDeltaPct: null });
    expect(msg.html).toContain('First week of data');
    expect(msg.text).toContain('First week of data');
  });
  it('shows empty-row when no models', () => {
    const msg = formatDigestEmail({ ...stats, topModels: [], totalRequests: 0 });
    expect(msg.html).toContain('No requests this week');
  });
  it('links to dashboard and finops', () => {
    const msg = formatDigestEmail(stats);
    expect(msg.html).toContain('app.clawpipe.ai');
    expect(msg.html).toContain('clawpipe.ai/finops');
  });
});

describe('formatBudgetAlertEmail', () => {
  it('uses 🚨 at 100%', () => {
    expect(formatBudgetAlertEmail('p', 100, 500, 500).subject).toContain('🚨');
  });
  it('uses ⚠️ at 80%', () => {
    expect(formatBudgetAlertEmail('p', 80, 400, 500).subject).toContain('⚠️');
  });
  it('uses 📊 at 50%', () => {
    expect(formatBudgetAlertEmail('p', 50, 250, 500).subject).toContain('📊');
  });
  it('shows used vs cap in body', () => {
    const msg = formatBudgetAlertEmail('p', 80, 400, 500);
    expect(msg.text).toContain('$400.00');
    expect(msg.text).toContain('$500.00');
  });
});

describe('senderDomain', () => {
  it('extracts domain from "Name <addr@domain>"', () => {
    expect(senderDomain('ClawPipe <digest@clawpipe.ai>')).toBe('clawpipe.ai');
  });
  it('extracts from bare address', () => {
    expect(senderDomain('hi@example.com')).toBe('example.com');
  });
  it('lowercases', () => {
    expect(senderDomain('A <X@CLAWPIPE.AI>')).toBe('clawpipe.ai');
  });
  it('returns null when no @', () => {
    expect(senderDomain('not-an-email')).toBeNull();
  });
});

describe('checkResendDomainStatus', () => {
  it('returns configured:false when no API key', async () => {
    const r = await checkResendDomainStatus({} as Env);
    expect(r.configured).toBe(false);
    expect(r.verified).toBe(false);
  });

  it('returns verified:true when Resend confirms domain', async () => {
    const orig = globalThis.fetch;
    globalThis.fetch = (async () => new Response(JSON.stringify({
      data: [{ name: 'clawpipe.ai', status: 'verified' }],
    }), { status: 200 })) as typeof fetch;
    try {
      const r = await checkResendDomainStatus({ RESEND_API_KEY: 'k' } as Env);
      expect(r.verified).toBe(true);
      expect(r.status).toBe('verified');
      expect(r.domain).toBe('clawpipe.ai');
    } finally { globalThis.fetch = orig; }
  });

  it('returns not_added when domain absent from response', async () => {
    const orig = globalThis.fetch;
    globalThis.fetch = (async () => new Response(JSON.stringify({ data: [] }), { status: 200 })) as typeof fetch;
    try {
      const r = await checkResendDomainStatus({ RESEND_API_KEY: 'k' } as Env);
      expect(r.verified).toBe(false);
      expect(r.status).toBe('not_added');
    } finally { globalThis.fetch = orig; }
  });
});

describe('sendEmail', () => {
  const msg = { subject: 'hi', html: '<p>hi</p>', text: 'hi' };

  it('returns false when RESEND_API_KEY missing', async () => {
    const env = {} as Env;
    expect(await sendEmail(env, 'a@b.com', msg)).toBe(false);
  });

  it('returns false when address invalid', async () => {
    const env = { RESEND_API_KEY: 'k' } as Env;
    expect(await sendEmail(env, 'not-email', msg)).toBe(false);
  });

  it('POSTs to Resend with auth header and JSON body', async () => {
    let capturedUrl = '', capturedInit: RequestInit | undefined;
    const orig = globalThis.fetch;
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      capturedUrl = url; capturedInit = init;
      return new Response('{}', { status: 200 });
    }) as typeof fetch;
    try {
      const ok = await sendEmail({ RESEND_API_KEY: 'test-key' } as Env, 'a@b.com', msg);
      expect(ok).toBe(true);
      expect(capturedUrl).toBe('https://api.resend.com/emails');
      const headers = (capturedInit?.headers ?? {}) as Record<string, string>;
      expect(headers.Authorization).toBe('Bearer test-key');
      expect(headers['Content-Type']).toBe('application/json');
      const body = JSON.parse(capturedInit?.body as string);
      expect(body.to).toBe('a@b.com');
      expect(body.subject).toBe('hi');
      expect(body.from).toContain('clawpipe.ai');
    } finally { globalThis.fetch = orig; }
  });

  it('uses RESEND_FROM override when present', async () => {
    let capturedBody: { from?: string } = {};
    const orig = globalThis.fetch;
    globalThis.fetch = (async (_u: string, init?: RequestInit) => {
      capturedBody = JSON.parse(init?.body as string);
      return new Response('{}', { status: 200 });
    }) as typeof fetch;
    try {
      await sendEmail({ RESEND_API_KEY: 'k', RESEND_FROM: 'X <x@y.io>' } as Env, 'a@b.com', msg);
      expect(capturedBody.from).toBe('X <x@y.io>');
    } finally { globalThis.fetch = orig; }
  });

  it('returns false on non-2xx Resend response', async () => {
    const orig = globalThis.fetch;
    globalThis.fetch = (async () => new Response('{"err":"x"}', { status: 422 })) as typeof fetch;
    try {
      const ok = await sendEmail({ RESEND_API_KEY: 'k' } as Env, 'a@b.com', msg);
      expect(ok).toBe(false);
    } finally { globalThis.fetch = orig; }
  });
});
