import { describe, it, expect } from 'vitest';
import {
  canonicalizeAction,
  sha256B64Url,
  hashActionPayload,
  b64UrlEncodeBytes,
} from './action-hash.js';

describe('canonicalizeAction', () => {
  it('serializes a single-key payload identically', () => {
    expect(canonicalizeAction({ action: 'checkout' })).toBe('{"action":"checkout"}');
  });

  it('sorts keys so {a:1,b:2} and {b:2,a:1} produce the same string', () => {
    const a = canonicalizeAction({ action: 'x', amount: 10, recipient: 'r' });
    const b = canonicalizeAction({ recipient: 'r', amount: 10, action: 'x' });
    expect(a).toBe(b);
  });

  it('preserves nested object order WITHOUT recursing (top-level only)', () => {
    // The current implementation only sorts the TOP-level keys —
    // nested objects keep insertion order. This is intentional: sorting
    // recursively is a different contract and would break consumers that
    // rely on stringified-then-hashed JSON literals. Pinning current
    // behavior so a future "improvement" surfaces with this test.
    const a = canonicalizeAction({ action: 'x', meta: { b: 2, a: 1 } });
    const b = canonicalizeAction({ action: 'x', meta: { a: 1, b: 2 } });
    expect(a).not.toBe(b);
  });

  it('handles empty record', () => {
    expect(canonicalizeAction({})).toBe('{}');
  });

  it('preserves typed values (number, boolean, null, array)', () => {
    const out = canonicalizeAction({
      action: 'x', amount: 1499, voucher: null, expedited: true, items: [1, 2, 3],
    });
    expect(out).toContain('"amount":1499');
    expect(out).toContain('"voucher":null');
    expect(out).toContain('"expedited":true');
    expect(out).toContain('"items":[1,2,3]');
  });
});

describe('b64UrlEncodeBytes', () => {
  it('returns empty string for empty bytes', () => {
    expect(b64UrlEncodeBytes(new Uint8Array(0))).toBe('');
  });

  it('strips trailing = padding', () => {
    expect(b64UrlEncodeBytes(new Uint8Array([0x00]))).toBe('AA');
  });

  it('uses url-safe alphabet (- and _ instead of + and /)', () => {
    const out = b64UrlEncodeBytes(new Uint8Array([0xfb, 0xff, 0xfe]));
    expect(out).toBe('-__-');
    expect(out).not.toContain('+');
    expect(out).not.toContain('/');
    expect(out).not.toContain('=');
  });
});

describe('sha256B64Url', () => {
  it('returns the known-good SHA-256 of the empty string', async () => {
    // sha256("") = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
    // base64url of that 32-byte digest:
    const expected = '47DEQpj8HBSa-_TImW-5JCeuQeRkm5NMpJWZG3hSuFU';
    expect(await sha256B64Url('')).toBe(expected);
  });

  it('is deterministic — same input always produces same digest', async () => {
    const a = await sha256B64Url('hello');
    const b = await sha256B64Url('hello');
    expect(a).toBe(b);
  });

  it('different inputs produce different digests', async () => {
    expect(await sha256B64Url('a')).not.toBe(await sha256B64Url('b'));
  });

  it('output is base64url (no padding, no + or /)', async () => {
    const out = await sha256B64Url('test');
    expect(out).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe('hashActionPayload', () => {
  it('produces the same hash regardless of key insertion order (canonicalize wins)', async () => {
    const a = await hashActionPayload({ action: 'x', amount: 10 });
    const b = await hashActionPayload({ amount: 10, action: 'x' });
    expect(a).toBe(b);
  });

  it('changing any value changes the hash', async () => {
    const a = await hashActionPayload({ action: 'checkout', amount: 100 });
    const b = await hashActionPayload({ action: 'checkout', amount: 101 });
    expect(a).not.toBe(b);
  });

  it('changing the action changes the hash', async () => {
    const a = await hashActionPayload({ action: 'checkout' });
    const b = await hashActionPayload({ action: 'refund' });
    expect(a).not.toBe(b);
  });

  it('two empty payloads collide (both hash to the same {} digest)', async () => {
    expect(await hashActionPayload({})).toBe(await hashActionPayload({}));
  });
});
