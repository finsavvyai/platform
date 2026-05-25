import { describe, it, expect } from 'vitest';
import { verifyWebhookSignature } from './webhooks.js';

const SECRET = 'whsec_test_0123456789abcdef';

async function hex(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

const isoNow = () => new Date().toISOString();

describe('verifyWebhookSignature', () => {
  it('returns false when signatureHeader is empty', async () => {
    const ok = await verifyWebhookSignature({
      body: '{}', signatureHeader: '', timestampHeader: isoNow(), secret: SECRET,
    });
    expect(ok).toBe(false);
  });

  it('returns false when secret is empty', async () => {
    const ok = await verifyWebhookSignature({
      body: '{}', signatureHeader: 'v1,abc', timestampHeader: isoNow(), secret: '',
    });
    expect(ok).toBe(false);
  });

  it('returns false when timestamp is missing and allowMissingTimestamp=false', async () => {
    const body = '{"event":"x"}';
    const sig = await hex(SECRET, body);
    const ok = await verifyWebhookSignature({
      body, signatureHeader: `v1,${sig}`, timestampHeader: '', secret: SECRET,
    });
    expect(ok).toBe(false);
  });

  it('returns false when timestampHeader is unparseable', async () => {
    const ok = await verifyWebhookSignature({
      body: '{}', signatureHeader: 'v1,abc',
      timestampHeader: 'not-a-date', secret: SECRET,
    });
    expect(ok).toBe(false);
  });

  it('returns false when timestamp drift exceeds tolerance (default 5 min)', async () => {
    const stale = new Date(Date.now() - 10 * 60_000).toISOString();
    const body = '{"event":"x"}';
    const sig = await hex(SECRET, `${stale}.${body}`);
    const ok = await verifyWebhookSignature({
      body, signatureHeader: `v1,${sig}`, timestampHeader: stale, secret: SECRET,
    });
    expect(ok).toBe(false);
  });

  it('returns true on a fresh, correctly signed payload', async () => {
    const ts = isoNow();
    const body = '{"event":"session.bound","data":{"id":"d_1"}}';
    const sig = await hex(SECRET, `${ts}.${body}`);
    const ok = await verifyWebhookSignature({
      body, signatureHeader: `v1,${sig}`, timestampHeader: ts, secret: SECRET,
    });
    expect(ok).toBe(true);
  });

  it('accepts legacy mode (no timestamp) when allowMissingTimestamp=true', async () => {
    const body = '{"legacy":true}';
    const sig = await hex(SECRET, body);
    const ok = await verifyWebhookSignature({
      body, signatureHeader: `v1,${sig}`, timestampHeader: '', secret: SECRET,
      allowMissingTimestamp: true,
    });
    expect(ok).toBe(true);
  });

  it('accepts space-separated rotation signatures when one matches', async () => {
    const ts = isoNow();
    const body = '{"event":"session.verified"}';
    const correct = await hex(SECRET, `${ts}.${body}`);
    const wrong = '0'.repeat(64);
    // Old secret key first, new one second (rotation in progress)
    const header = `v1,${wrong} v1,${correct}`;
    const ok = await verifyWebhookSignature({
      body, signatureHeader: header, timestampHeader: ts, secret: SECRET,
    });
    expect(ok).toBe(true);
  });

  it('rejects all-bad rotation signatures', async () => {
    const ts = isoNow();
    const ok = await verifyWebhookSignature({
      body: '{"event":"x"}',
      signatureHeader: `v1,${'0'.repeat(64)} v1,${'1'.repeat(64)}`,
      timestampHeader: ts, secret: SECRET,
    });
    expect(ok).toBe(false);
  });

  it('skips signature entries with non-v1 versions', async () => {
    const ts = isoNow();
    const body = '{"event":"x"}';
    const correct = await hex(SECRET, `${ts}.${body}`);
    // First entry is v2 (skipped), second is v1 (valid)
    const header = `v2,${correct} v1,${correct}`;
    const ok = await verifyWebhookSignature({
      body, signatureHeader: header, timestampHeader: ts, secret: SECRET,
    });
    expect(ok).toBe(true);

    // v2-only header should fail because no v1 entry matches
    const v2Only = await verifyWebhookSignature({
      body, signatureHeader: `v2,${correct}`, timestampHeader: ts, secret: SECRET,
    });
    expect(v2Only).toBe(false);
  });

  it('honors custom toleranceMs (rejects within default 5min, accepts when widened)', async () => {
    const stale = new Date(Date.now() - 10 * 60_000).toISOString();
    const body = '{"event":"x"}';
    const sig = await hex(SECRET, `${stale}.${body}`);
    const tightFail = await verifyWebhookSignature({
      body, signatureHeader: `v1,${sig}`, timestampHeader: stale, secret: SECRET,
    });
    expect(tightFail).toBe(false);
    const widePass = await verifyWebhookSignature({
      body, signatureHeader: `v1,${sig}`, timestampHeader: stale, secret: SECRET,
      toleranceMs: 60 * 60_000,
    });
    expect(widePass).toBe(true);
  });

  it('accepts mixed-case hex in signature (lowercased before compare)', async () => {
    const ts = isoNow();
    const body = '{"e":"x"}';
    const sig = (await hex(SECRET, `${ts}.${body}`)).toUpperCase();
    const ok = await verifyWebhookSignature({
      body, signatureHeader: `v1,${sig}`, timestampHeader: ts, secret: SECRET,
    });
    expect(ok).toBe(true);
  });

  it('skips entries with empty hex (e.g. `v1,` with nothing after comma)', async () => {
    const ts = isoNow();
    const body = '{"e":"x"}';
    const correct = await hex(SECRET, `${ts}.${body}`);
    // First entry has empty hex (skipped via `!hex` guard), second is valid
    const ok = await verifyWebhookSignature({
      body, signatureHeader: `v1, v1,${correct}`, timestampHeader: ts, secret: SECRET,
    });
    expect(ok).toBe(true);
    // All-empty entries → no match
    const allEmpty = await verifyWebhookSignature({
      body, signatureHeader: 'v1, v1,', timestampHeader: ts, secret: SECRET,
    });
    expect(allEmpty).toBe(false);
  });

  it('timingSafeEqual length-mismatch: short hex like `v1,abc` is rejected without crash', async () => {
    const ts = isoNow();
    const ok = await verifyWebhookSignature({
      body: '{"e":"x"}', signatureHeader: 'v1,abc', timestampHeader: ts, secret: SECRET,
    });
    expect(ok).toBe(false);
  });

  it('rejects future timestamp drift beyond tolerance (symmetric `Math.abs` check)', async () => {
    const future = new Date(Date.now() + 10 * 60_000).toISOString();
    const body = '{"e":"x"}';
    const sig = await hex(SECRET, `${future}.${body}`);
    const ok = await verifyWebhookSignature({
      body, signatureHeader: `v1,${sig}`, timestampHeader: future, secret: SECRET,
    });
    expect(ok).toBe(false);
  });
});
