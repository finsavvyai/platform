import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendPaymentFailedEmail } from './email.js';

interface FetchCall { url: string; method: string; headers: Record<string, string>; body: Record<string, unknown> }

describe('sendPaymentFailedEmail', () => {
  let calls: FetchCall[];

  beforeEach(() => {
    calls = [];
    vi.stubGlobal('fetch', vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const body = init?.body && typeof init.body === 'string'
        ? JSON.parse(init.body) as Record<string, unknown>
        : {} as Record<string, unknown>;
      calls.push({
        url: typeof url === 'string' ? url : (url as Request).url,
        method: init?.method ?? 'GET',
        headers: (init?.headers ?? {}) as Record<string, string>,
        body,
      });
      return new Response('{"id":"em_123"}', { status: 200 });
    }));
  });

  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('POSTs to https://api.resend.com/emails', async () => {
    await sendPaymentFailedEmail('resend_test_key', 'Acme Corp');
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe('https://api.resend.com/emails');
    expect(calls[0]!.method).toBe('POST');
  });

  it('sets Authorization: Bearer <apiKey>', async () => {
    await sendPaymentFailedEmail('re_xyz_123', 'Acme Corp');
    expect(calls[0]!.headers.Authorization).toBe('Bearer re_xyz_123');
  });

  it('sets Content-Type: application/json', async () => {
    await sendPaymentFailedEmail('re_x', 'Acme');
    expect(calls[0]!.headers['Content-Type']).toBe('application/json');
  });

  it('body has the canonical from/to billing addresses', async () => {
    await sendPaymentFailedEmail('re_x', 'Acme Corp');
    expect(calls[0]!.body.from).toBe('TokenForge <billing@tokenforge.opensyber.cloud>');
    expect(calls[0]!.body.to).toBe('billing@tokenforge.opensyber.cloud');
  });

  it('subject and text include the tenant name', async () => {
    await sendPaymentFailedEmail('re_x', 'Acme Corp');
    expect(calls[0]!.body.subject).toBe('Payment failed for Acme Corp');
    expect(calls[0]!.body.text).toContain('"Acme Corp"');
  });

  it('text mentions the 7-day grace period (matches Sprint billing policy)', async () => {
    await sendPaymentFailedEmail('re_x', 'Beta Co');
    expect(calls[0]!.body.text).toContain('7-day grace period');
  });
});
