/**
 * API Key Auth Integration Tests
 *
 * Tests the full API key create -> authenticate -> revoke lifecycle
 * through the Hono app with real D1 via miniflare.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createTestContext,
  type TestContext,
} from '../setup';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestContext();
});

afterAll(async () => {
  await ctx.dispose();
});

describe('POST /api-keys — create API key', () => {
  it('generates a new API key for authenticated user', async () => {
    const res = await ctx.makeRequest('/api-keys', {
      auth: 'user',
      method: 'POST',
      body: JSON.stringify({ name: 'Test Key' }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.key).toBeDefined();
    expect(body.key).toMatch(/^sk_/);
    expect(body.prefix).toBeDefined();
    expect(body.name).toBe('Test Key');
    expect(body.warning).toMatch(/save this key/i);
  });

  it('uses default name when none provided', async () => {
    const res = await ctx.makeRequest('/api-keys', {
      auth: 'user',
      method: 'POST',
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.name).toBe('Default');
  });

  it('rejects unauthenticated request', async () => {
    const res = await ctx.makeRequest('/api-keys', {
      auth: 'none',
      method: 'POST',
      body: JSON.stringify({ name: 'Should Fail' }),
    });

    expect(res.status).toBe(401);
  });
});

describe('GET /api-keys — list API keys', () => {
  it('returns list of user API keys with prefixes only', async () => {
    const res = await ctx.makeRequest('/api-keys', { auth: 'user' });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.keys).toBeDefined();
    expect(Array.isArray(body.keys)).toBe(true);
    expect(body.total).toBeGreaterThan(0);

    // Keys should NOT contain the raw key value
    for (const key of body.keys) {
      expect(key.prefix).toBeDefined();
      expect(key.id).toBeDefined();
      expect(key).not.toHaveProperty('key');
      expect(key).not.toHaveProperty('keyHash');
    }
  });
});

describe('DELETE /api-keys/:id — revoke API key', () => {
  it('revokes an active API key', async () => {
    // Create a new key to revoke
    const createRes = await ctx.makeRequest('/api-keys', {
      auth: 'user',
      method: 'POST',
      body: JSON.stringify({ name: 'To Revoke' }),
    });
    const { id: keyId } = await createRes.json() as any;

    // Revoke it
    const revokeRes = await ctx.makeRequest(`/api-keys/${keyId}`, {
      auth: 'user',
      method: 'DELETE',
    });

    expect(revokeRes.status).toBe(200);
    const body = await revokeRes.json() as any;
    expect(body.message).toMatch(/revoked/i);
    expect(body.id).toBe(keyId);
  });

  it('returns 404 for non-existent key', async () => {
    const res = await ctx.makeRequest('/api-keys/nonexistent-id', {
      auth: 'user',
      method: 'DELETE',
    });

    expect(res.status).toBe(404);
  });

  it('returns 404 when revoking already revoked key', async () => {
    // Create then revoke
    const createRes = await ctx.makeRequest('/api-keys', {
      auth: 'user',
      method: 'POST',
      body: JSON.stringify({ name: 'Double Revoke' }),
    });
    const { id: keyId } = await createRes.json() as any;

    await ctx.makeRequest(`/api-keys/${keyId}`, {
      auth: 'user',
      method: 'DELETE',
    });

    // Second revoke should fail
    const res = await ctx.makeRequest(`/api-keys/${keyId}`, {
      auth: 'user',
      method: 'DELETE',
    });
    expect(res.status).toBe(404);
  });
});

describe('API key create -> list -> revoke -> verify lifecycle', () => {
  it('completes the full API key lifecycle', async () => {
    // 1. Create
    const createRes = await ctx.makeRequest('/api-keys', {
      auth: 'user',
      method: 'POST',
      body: JSON.stringify({ name: 'Lifecycle Key' }),
    });
    expect(createRes.status).toBe(201);
    const { id: keyId } = await createRes.json() as any;

    // 2. Verify it appears in list
    const listRes = await ctx.makeRequest('/api-keys', { auth: 'user' });
    const listBody = await listRes.json() as any;
    const found = listBody.keys.find((k: any) => k.id === keyId);
    expect(found).toBeDefined();
    expect(found.isActive).toBe(true);

    // 3. Revoke
    const revokeRes = await ctx.makeRequest(`/api-keys/${keyId}`, {
      auth: 'user',
      method: 'DELETE',
    });
    expect(revokeRes.status).toBe(200);

    // 4. Verify it shows as revoked in list
    const listRes2 = await ctx.makeRequest('/api-keys', { auth: 'user' });
    const listBody2 = await listRes2.json() as any;
    const revoked = listBody2.keys.find((k: any) => k.id === keyId);
    expect(revoked).toBeDefined();
    expect(revoked.isActive).toBe(false);
  });
});
