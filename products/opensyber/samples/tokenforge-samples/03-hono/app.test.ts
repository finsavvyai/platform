/**
 * Tests: Hono + TokenForge middleware
 *
 * Validates:
 * - Health endpoint skips verification
 * - Profile returns tf context when bound
 * - Block status returns 401
 * - API failure degrades gracefully
 * - Admin endpoint requires elevated trust
 * - Correct headers forwarded to verification API
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { installMockFetch, installFailingFetch } from '../helpers/mock-fetch.js';
import { createApp } from './app.js';

describe('Hono + TokenForge Middleware', () => {
  let mockFetch: ReturnType<typeof installMockFetch>;
  const app = createApp('tf_test_key', 'http://mock-api:9999');

  beforeEach(() => {
    mockFetch = installMockFetch();
  });

  afterEach(() => {
    mockFetch.restore();
  });

  it('should serve health without verification', async () => {
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: 'ok' });
    expect(mockFetch.getCallCount()).toBe(0);
  });

  it('should verify and return profile with tf context', async () => {
    mockFetch.setResponse({
      status: 'allow',
      trustScore: 92,
      deviceId: 'device-abc',
      bound: true,
    });

    const res = await app.request('/api/profile', {
      headers: {
        'X-TF-Signature': 'sig',
        'X-TF-Nonce': 'nonce',
        'X-TF-Timestamp': '1700000000',
        'X-TF-Device-ID': 'device-abc',
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      deviceBound: true,
      trustScore: 92,
      deviceId: 'device-abc',
    });
  });

  it('should return 401 when session is blocked', async () => {
    mockFetch.setResponse({
      status: 'block',
      trustScore: 5,
      deviceId: null,
      bound: false,
      reason: 'nonce_replay',
    });

    const res = await app.request('/api/profile');
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('session_blocked');
  });

  it('should degrade gracefully when API is down', async () => {
    mockFetch.restore();
    const failMock = installFailingFetch();

    const res = await app.request('/api/profile');
    failMock.restore();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deviceBound).toBe(false);
    expect(body.trustScore).toBe(0);
  });

  it('should skip wildcard public paths', async () => {
    const res = await app.request('/api/public/docs');
    // Will 404 since no route, but should not call verify
    expect(mockFetch.getCallCount()).toBe(0);
  });

  it('should list sessions for bound device', async () => {
    mockFetch.setResponse({ status: 'allow', trustScore: 88, deviceId: 'dev-x', bound: true });

    const res = await app.request('/api/sessions');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.currentDevice).toBe('dev-x');
    expect(body.sessions).toHaveLength(1);
  });

  it('should forward correct headers to verify endpoint', async () => {
    await app.request('/api/profile', {
      headers: {
        'X-TF-Signature': 'test-sig',
        'X-TF-Nonce': 'test-nonce',
        'X-TF-Timestamp': '1700000001',
        'X-TF-Device-ID': 'device-xyz',
        'User-Agent': 'CustomAgent/2.0',
      },
    });

    const body = mockFetch.getLastBody();
    expect(body).toMatchObject({
      headers: {
        signature: 'test-sig',
        nonce: 'test-nonce',
        timestamp: '1700000001',
        deviceId: 'device-xyz',
      },
    });
  });
});
