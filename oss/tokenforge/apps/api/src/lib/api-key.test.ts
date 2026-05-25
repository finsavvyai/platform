import { describe, it, expect } from 'vitest';
import { issueApiKey, verifyApiKey, appIdFromKey } from './api-key.js';

describe('api-key issue + verify', () => {
  it('round-trips a valid key', async () => {
    const issued = await issueApiKey('app_abc');
    expect(issued.liveKey.startsWith('tfk_live_app_abc.')).toBe(true);
    const r = await verifyApiKey(issued.liveKey, issued.hash);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.appId).toBe('app_abc');
  });

  it('rejects a key with a tampered secret', async () => {
    const issued = await issueApiKey('app_abc');
    const tampered = issued.liveKey.slice(0, -2) + 'xx';
    const r = await verifyApiKey(tampered, issued.hash);
    expect(r.ok).toBe(false);
  });

  it('rejects a key with the wrong prefix', async () => {
    const r = await verifyApiKey('not_a_real_key', 'whatever');
    expect(r.ok).toBe(false);
  });

  it('rejects a key with no separator', async () => {
    const r = await verifyApiKey('tfk_live_no-dot-here', 'whatever');
    expect(r.ok).toBe(false);
  });

  it('extracts appId from a well-formed key', () => {
    expect(appIdFromKey('tfk_live_app_xyz.secretpart')).toBe('app_xyz');
    expect(appIdFromKey('garbage')).toBeNull();
    expect(appIdFromKey('tfk_live_no-dot')).toBeNull();
  });

  it('rejects a key with empty secret half', async () => {
    const r = await verifyApiKey('tfk_live_app_xyz.', 'whatever');
    expect(r.ok).toBe(false);
  });

  it('rejects when expected hash differs in length', async () => {
    const issued = await issueApiKey('app_a');
    const r = await verifyApiKey(issued.liveKey, issued.hash + 'extra');
    expect(r.ok).toBe(false);
  });
});
