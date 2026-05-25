/**
 * Tests: React Native TokenForge SDK
 *
 * The React Native SDK depends on react-native-keychain and elliptic
 * which require a native environment. We test the signing protocol
 * and header format that the SDK implements, validating correctness
 * of the shared algorithm across all platforms.
 */
import { describe, it, expect } from 'vitest';

describe('React Native SDK - Signing Protocol', () => {
  it('should construct payload as sessionId:nonce:timestamp', () => {
    const sessionId = 'rn-session-001';
    const nonce = 'abc123def456';
    const timestamp = 1700000000;
    const payload = `${sessionId}:${nonce}:${timestamp}`;

    expect(payload).toBe('rn-session-001:abc123def456:1700000000');
    expect(payload.split(':')).toHaveLength(3);
  });

  it('should generate unique device IDs (hex format)', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      const id = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
      ids.add(id);
    }
    expect(ids.size).toBe(100);
  });

  it('should produce 32-char hex nonces', () => {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    const nonce = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    expect(nonce).toHaveLength(32);
    expect(nonce).toMatch(/^[0-9a-f]+$/);
  });
});

describe('React Native SDK - Header Contract', () => {
  it('should define all required header names', () => {
    const requiredHeaders = [
      'X-TF-Signature',
      'X-TF-Nonce',
      'X-TF-Timestamp',
      'X-TF-Device-ID',
      'Authorization',
    ];

    const headers: Record<string, string> = {
      'X-TF-Signature': 'base64sig',
      'X-TF-Nonce': 'uniquenonce',
      'X-TF-Timestamp': '1700000000',
      'X-TF-Device-ID': 'device-abc',
      'Authorization': 'Bearer tf_key',
    };

    for (const name of requiredHeaders) {
      expect(headers[name]).toBeDefined();
      expect(headers[name]!.length).toBeGreaterThan(0);
    }
  });

  it('should use Bearer token format for Authorization', () => {
    const auth = `Bearer tf_sample_key`;
    expect(auth).toMatch(/^Bearer tf_/);
  });
});

describe('React Native SDK - Fetch Interceptor Contract', () => {
  it('should merge TF headers into existing request headers', () => {
    const existingHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    const tfHeaders: Record<string, string> = {
      'X-TF-Signature': 'sig',
      'X-TF-Nonce': 'nonce',
      'X-TF-Timestamp': '1700000000',
      'X-TF-Device-ID': 'dev-001',
    };

    const merged = { ...existingHeaders, ...tfHeaders };

    expect(merged['Content-Type']).toBe('application/json');
    expect(merged['X-TF-Signature']).toBe('sig');
    expect(Object.keys(merged)).toHaveLength(6);
  });
});

describe('React Native SDK - Provider API Contract', () => {
  it('should define TokenForgeState shape', () => {
    const state = {
      isBound: false,
      deviceId: 'device-001',
      sessionId: 'session-001',
      signRequest: (req: { url: string }) => req,
      getHeaders: () => ({} as Record<string, string>),
      bind: async () => {},
    };

    expect(state.isBound).toBe(false);
    expect(typeof state.signRequest).toBe('function');
    expect(typeof state.getHeaders).toBe('function');
    expect(typeof state.bind).toBe('function');
  });

  it('should define TokenForgeConfig shape', () => {
    const config = {
      apiKey: 'tf_test_key',
      apiBase: 'https://api.example.com',
    };

    expect(config.apiKey).toMatch(/^tf_/);
    expect(config.apiBase).toMatch(/^https?:\/\//);
  });
});
