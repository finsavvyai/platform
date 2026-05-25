/**
 * client/index.ts init() + rebind() flow coverage.
 * Sibling file because index.test.ts at 193L already and explicitly
 * defers init/binding tests to binding.test.ts + interceptor.test.ts
 * (per the file's top-of-file comment). This sibling pins the
 * integration layer that TokenForge.init() owns — deviceId/bound
 * state, interceptor install, console.error fallback on failure.
 *
 * Closes the long-standing uncovered range lines 34-69 + 130-131.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { webcrypto } from 'node:crypto';

const { mockBindDevice, mockInstallFetchInterceptor, mockCleanup } = vi.hoisted(() => ({
  mockBindDevice: vi.fn(),
  mockInstallFetchInterceptor: vi.fn(),
  mockCleanup: vi.fn(),
}));

vi.mock('./binding.js', () => ({ bindDevice: mockBindDevice }));
vi.mock('./interceptor.js', () => ({ installFetchInterceptor: mockInstallFetchInterceptor }));
vi.mock('./storage.js', () => ({
  storeDeviceKey: vi.fn(async () => undefined),
  getDeviceKey: vi.fn(async () => null),
  clearDeviceKeys: vi.fn(async () => undefined),
}));

import { TokenForge } from './index.js';
import type { TokenForgeConfig } from '../shared/types.js';

const subtle = (webcrypto as unknown as Crypto).subtle;
vi.stubGlobal('crypto', { subtle });

async function genKeyPair(): Promise<CryptoKeyPair> {
  return subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
}

function baseConfig(over: Partial<TokenForgeConfig> = {}): TokenForgeConfig {
  return { apiBase: 'http://api.test', getSessionId: () => 'sess-1', ...over };
}

describe('TokenForge.init() — coverage of lines 34-69', () => {
  beforeEach(() => {
    mockBindDevice.mockReset();
    mockInstallFetchInterceptor.mockReset().mockReturnValue(mockCleanup);
    mockCleanup.mockReset();
  });

  it('early-returns silently when getSessionId() returns null (line 35)', async () => {
    const tf = new TokenForge(baseConfig({ getSessionId: () => null }));
    await tf.init();
    expect(mockBindDevice).not.toHaveBeenCalled();
    expect(mockInstallFetchInterceptor).not.toHaveBeenCalled();
  });

  it('warns + early-returns when crypto.subtle is unavailable (lines 38-40)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('crypto', undefined);
    const tf = new TokenForge(baseConfig());
    await tf.init();
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/Web Crypto.*not available/));
    expect(mockBindDevice).not.toHaveBeenCalled();
    warn.mockRestore();
    vi.stubGlobal('crypto', { subtle });
  });

  it('happy path: bindDevice succeeds → deviceId/bound set + onDeviceBound called + interceptor installed', async () => {
    const kp = await genKeyPair();
    mockBindDevice.mockResolvedValueOnce({ type: 'ecdsa', deviceId: 'dev-99', keyPair: kp });
    const onBound = vi.fn();
    const tf = new TokenForge(baseConfig({ onDeviceBound: onBound }));
    await tf.init();
    expect(tf.getDeviceId()).toBe('dev-99');
    expect(tf.isBound()).toBe(true);
    expect(onBound).toHaveBeenCalledWith('dev-99');
    expect(mockInstallFetchInterceptor).toHaveBeenCalledTimes(1);
  });

  it('webauthn binding result → keyPair stays null (credential lives on authenticator) but bound=true', async () => {
    mockBindDevice.mockResolvedValueOnce({ type: 'webauthn', deviceId: 'dev-wa', credentialId: 'cred-1' });
    const tf = new TokenForge(baseConfig());
    await tf.init();
    expect(tf.isBound()).toBe(true);
    expect(tf.getDeviceId()).toBe('dev-wa');
    // keyPair is private but interceptor's getSigningMaterial closure returns
    // null when keyPair is null — pinned via interceptor not being given a
    // real keypair.
    expect(mockInstallFetchInterceptor).toHaveBeenCalledTimes(1);
  });

  it('autoIntercept=false skips interceptor install (still binds)', async () => {
    const kp = await genKeyPair();
    mockBindDevice.mockResolvedValueOnce({ type: 'ecdsa', deviceId: 'dev-2', keyPair: kp });
    const tf = new TokenForge(baseConfig({ autoIntercept: false }));
    await tf.init();
    expect(tf.isBound()).toBe(true);
    expect(mockInstallFetchInterceptor).not.toHaveBeenCalled();
  });

  it('graceful degradation: bindDevice throws → console.error + bound stays false (lines 68-71)', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockBindDevice.mockRejectedValueOnce(new Error('network down'));
    const tf = new TokenForge(baseConfig());
    await tf.init();
    expect(err).toHaveBeenCalledWith(expect.stringMatching(/Binding failed/), expect.any(Error));
    expect(tf.isBound()).toBe(false);
    err.mockRestore();
  });

  it('rebind() clears state then re-runs init() (lines 130-131)', async () => {
    const kp1 = await genKeyPair();
    const kp2 = await genKeyPair();
    mockBindDevice
      .mockResolvedValueOnce({ type: 'ecdsa', deviceId: 'dev-old', keyPair: kp1 })
      .mockResolvedValueOnce({ type: 'ecdsa', deviceId: 'dev-new', keyPair: kp2 });
    const tf = new TokenForge(baseConfig());
    await tf.init();
    expect(tf.getDeviceId()).toBe('dev-old');
    await tf.rebind();
    expect(tf.getDeviceId()).toBe('dev-new');
    expect(mockBindDevice).toHaveBeenCalledTimes(2);
    // Cleanup of the first interceptor installation is wired in clearKeys.
    expect(mockCleanup).toHaveBeenCalledTimes(1);
  });

  it('interceptor getSigningMaterial closure: returns null when keyPair is null', async () => {
    mockBindDevice.mockResolvedValueOnce({ type: 'webauthn', deviceId: 'dev-wa', credentialId: 'cred-1' });
    const tf = new TokenForge(baseConfig());
    await tf.init();
    const getSigningMaterial = mockInstallFetchInterceptor.mock.calls[0]![1] as () => Promise<unknown>;
    expect(await getSigningMaterial()).toBeNull();
  });

  it('interceptor getSigningMaterial closure: returns null when getSessionId() flips to null after bind', async () => {
    const kp = await genKeyPair();
    mockBindDevice.mockResolvedValueOnce({ type: 'ecdsa', deviceId: 'dev-1', keyPair: kp });
    let sid: string | null = 'sess-1';
    const tf = new TokenForge(baseConfig({ getSessionId: () => sid }));
    await tf.init();
    sid = null;
    const getSigningMaterial = mockInstallFetchInterceptor.mock.calls[0]![1] as () => Promise<unknown>;
    expect(await getSigningMaterial()).toBeNull();
  });

  it('interceptor getSigningMaterial closure: returns full material on happy path', async () => {
    const kp = await genKeyPair();
    mockBindDevice.mockResolvedValueOnce({ type: 'ecdsa', deviceId: 'dev-7', keyPair: kp });
    const tf = new TokenForge(baseConfig());
    await tf.init();
    const getSigningMaterial = mockInstallFetchInterceptor.mock.calls[0]![1] as () => Promise<{
      privateKey: CryptoKey; sessionId: string; deviceId: string;
    } | null>;
    const mat = await getSigningMaterial();
    expect(mat?.deviceId).toBe('dev-7');
    expect(mat?.sessionId).toBe('sess-1');
    expect(mat?.privateKey).toBeDefined();
  });
});
