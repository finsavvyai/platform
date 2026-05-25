import { describe, it, expect } from 'vitest';
import { issueApiKey } from './api-keys.js';

describe('issueApiKey', () => {
  it('emits a tfk_live key prefixed with the appId', async () => {
    const i = await issueApiKey('app_xyz');
    expect(i.liveKey.startsWith('tfk_live_app_xyz.')).toBe(true);
    expect(i.hash).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('produces different secrets across calls', async () => {
    const a = await issueApiKey('app_a');
    const b = await issueApiKey('app_a');
    expect(a.liveKey).not.toBe(b.liveKey);
    expect(a.hash).not.toBe(b.hash);
  });

  it('hash is the SHA-256 b64url of the secret half', async () => {
    const i = await issueApiKey('app_a');
    const secret = i.liveKey.slice('tfk_live_app_a.'.length);
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret) as BufferSource);
    const expected = btoa(String.fromCharCode(...new Uint8Array(buf)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    expect(i.hash).toBe(expected);
  });
});
