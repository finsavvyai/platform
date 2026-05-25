import { describe, it, expect } from 'vitest';
import { verifyWebhookSignature } from './webhook-signature.js';

describe('verifyWebhookSignature', () => {
  const secret = 'test-secret-123';

  async function makeSignature(body: string, sec: string): Promise<string> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(sec),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
    return Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  it('returns true for valid signature', async () => {
    const body = '{"test":"data"}';
    const signature = await makeSignature(body, secret);
    const result = await verifyWebhookSignature(body, signature, secret);
    expect(result).toBe(true);
  });

  it('returns false for invalid signature', async () => {
    const body = '{"test":"data"}';
    const result = await verifyWebhookSignature(body, 'invalidsig', secret);
    expect(result).toBe(false);
  });

  it('returns false for wrong secret', async () => {
    const body = '{"test":"data"}';
    const signature = await makeSignature(body, 'wrong-secret');
    const result = await verifyWebhookSignature(body, signature, secret);
    expect(result).toBe(false);
  });

  it('returns false for tampered body', async () => {
    const body = '{"test":"data"}';
    const signature = await makeSignature(body, secret);
    const result = await verifyWebhookSignature('{"test":"tampered"}', signature, secret);
    expect(result).toBe(false);
  });

  it('handles empty body', async () => {
    const body = '';
    const signature = await makeSignature(body, secret);
    const result = await verifyWebhookSignature(body, signature, secret);
    expect(result).toBe(true);
  });

  it('returns false when signature length differs from HMAC length (early-exit guard)', async () => {
    // HMAC-SHA256 is 64 hex chars; anything else short-circuits to false
    // before doing the constant-time compare loop.
    expect(await verifyWebhookSignature('{}', 'abc', secret)).toBe(false);
    expect(await verifyWebhookSignature('{}', 'a'.repeat(63), secret)).toBe(false);
    expect(await verifyWebhookSignature('{}', 'a'.repeat(65), secret)).toBe(false);
  });

  it('matches known-good HMAC-SHA256 of "" with key "key" (RFC 4231 vector)', async () => {
    // hmac_sha256(key="key", msg="") = "5d5d139563c95b5967b9bd9a8c9b233a9dedb45072794cd232dc1b74832607d0"
    expect(await verifyWebhookSignature(
      '',
      '5d5d139563c95b5967b9bd9a8c9b233a9dedb45072794cd232dc1b74832607d0',
      'key',
    )).toBe(true);
  });

  it('handles unicode in the body (TextEncoder UTF-8 round-trip)', async () => {
    const body = JSON.stringify({ message: 'hello 世界 🌍' });
    const signature = await makeSignature(body, secret);
    expect(await verifyWebhookSignature(body, signature, secret)).toBe(true);
  });

  it('case-sensitive hex compare — uppercase signature does NOT match lowercase computed', async () => {
    const body = '{}';
    const signature = await makeSignature(body, secret);
    const upper = signature.toUpperCase();
    expect(upper).not.toBe(signature); // confirms case actually changed
    expect(await verifyWebhookSignature(body, upper, secret)).toBe(false);
  });
});
