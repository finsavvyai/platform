import { test, expect } from '@playwright/test';

/**
 * API Key Management Tests
 * Tests creation, listing, updating, revocation, and authentication
 */

// Helper function to create a user and get JWT token
async function createUserAndLogin(request: any) {
  const email = `apikey-${Date.now()}@example.com`;
  const password = 'TestPassword123!';

  const registerResponse = await request.post('/api/v1/auth/register', {
    data: {
      email,
      password,
      name: 'API Key Test User'
    }
  });

  const { token } = await registerResponse.json();
  return { token, email };
}

test.describe('API Key Creation', () => {

  test('Can create API key with valid JWT', async ({ request }) => {
    const { token } = await createUserAndLogin(request);

    const response = await request.post('/api/v1/api-keys', {
      headers: {
        Authorization: `Bearer ${token}`
      },
      data: {
        name: 'Test API Key',
        scopes: ['read:users', 'write:users'],
        rateLimit: 5000
      }
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.apiKey).toBeTruthy();
    expect(data.apiKey).toMatch(/^dk_/);
    expect(data.keyPrefix).toBeTruthy();
    expect(data.name).toBe('Test API Key');
    expect(data.scopes).toEqual(['read:users', 'write:users']);
    expect(data.rateLimit).toBe(5000);
  });

  test('Can create API key with expiration', async ({ request }) => {
    const { token } = await createUserAndLogin(request);

    const response = await request.post('/api/v1/api-keys', {
      headers: {
        Authorization: `Bearer ${token}`
      },
      data: {
        name: 'Temporary Key',
        expiresIn: 30 // 30 days
      }
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.expiresAt).toBeTruthy();
  });

  test('Cannot create API key without authentication', async ({ request }) => {
    const response = await request.post('/api/v1/api-keys', {
      data: {
        name: 'Unauthorized Key'
      }
    });

    expect(response.status()).toBe(401);
  });

  test('Cannot create API key without name', async ({ request }) => {
    const { token } = await createUserAndLogin(request);

    const response = await request.post('/api/v1/api-keys', {
      headers: {
        Authorization: `Bearer ${token}`
      },
      data: {
        scopes: ['read:users']
      }
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Invalid request');
  });
});

test.describe('API Key Listing', () => {

  test('Can list all API keys', async ({ request }) => {
    const { token } = await createUserAndLogin(request);

    // Create multiple API keys
    await request.post('/api/v1/api-keys', {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: 'Key 1' }
    });

    await request.post('/api/v1/api-keys', {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: 'Key 2' }
    });

    // List all keys
    const response = await request.get('/api/v1/api-keys', {
      headers: { Authorization: `Bearer ${token}` }
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data.apiKeys).toBeInstanceOf(Array);
    expect(data.apiKeys.length).toBeGreaterThanOrEqual(2);
    expect(data.total).toBeGreaterThanOrEqual(2);
  });

  test('Cannot list API keys without authentication', async ({ request }) => {
    const response = await request.get('/api/v1/api-keys');

    expect(response.status()).toBe(401);
  });

  test('Only lists keys for authenticated user', async ({ request }) => {
    const user1 = await createUserAndLogin(request);
    const user2 = await createUserAndLogin(request);

    // User 1 creates a key
    await request.post('/api/v1/api-keys', {
      headers: { Authorization: `Bearer ${user1.token}` },
      data: { name: 'User 1 Key' }
    });

    // User 2 lists keys - should not see User 1's key
    const response = await request.get('/api/v1/api-keys', {
      headers: { Authorization: `Bearer ${user2.token}` }
    });

    const data = await response.json();
    const hasUser1Key = data.apiKeys.some((key: any) => key.name === 'User 1 Key');
    expect(hasUser1Key).toBe(false);
  });
});

test.describe('API Key Details', () => {

  test('Can get specific API key details', async ({ request }) => {
    const { token } = await createUserAndLogin(request);

    // Create an API key
    const createResponse = await request.post('/api/v1/api-keys', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        name: 'Detailed Key',
        scopes: ['read:data'],
        rateLimit: 2000
      }
    });

    const { keyId } = await createResponse.json();

    // Get key details
    const response = await request.get(`/api/v1/api-keys/${keyId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data.apiKey.id).toBe(keyId);
    expect(data.apiKey.name).toBe('Detailed Key');
    expect(data.apiKey.scopes).toEqual(['read:data']);
    expect(data.apiKey.rateLimit).toBe(2000);
  });

  test('Cannot get another user\'s API key', async ({ request }) => {
    const user1 = await createUserAndLogin(request);
    const user2 = await createUserAndLogin(request);

    // User 1 creates a key
    const createResponse = await request.post('/api/v1/api-keys', {
      headers: { Authorization: `Bearer ${user1.token}` },
      data: { name: 'Private Key' }
    });

    const { keyId } = await createResponse.json();

    // User 2 tries to get it
    const response = await request.get(`/api/v1/api-keys/${keyId}`, {
      headers: { Authorization: `Bearer ${user2.token}` }
    });

    expect(response.status()).toBe(404);
  });
});

test.describe('API Key Update', () => {

  test('Can update API key name', async ({ request }) => {
    const { token } = await createUserAndLogin(request);

    // Create a key
    const createResponse = await request.post('/api/v1/api-keys', {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: 'Old Name' }
    });

    const { keyId } = await createResponse.json();

    // Update name
    const updateResponse = await request.patch(`/api/v1/api-keys/${keyId}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: 'New Name' }
    });

    expect(updateResponse.ok()).toBeTruthy();

    // Verify update
    const getResponse = await request.get(`/api/v1/api-keys/${keyId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const data = await getResponse.json();
    expect(data.apiKey.name).toBe('New Name');
  });

  test('Can update API key scopes', async ({ request }) => {
    const { token } = await createUserAndLogin(request);

    const createResponse = await request.post('/api/v1/api-keys', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        name: 'Scope Test',
        scopes: ['read:data']
      }
    });

    const { keyId } = await createResponse.json();

    // Update scopes
    const updateResponse = await request.patch(`/api/v1/api-keys/${keyId}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { scopes: ['read:data', 'write:data'] }
    });

    expect(updateResponse.ok()).toBeTruthy();

    // Verify
    const getResponse = await request.get(`/api/v1/api-keys/${keyId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const data = await getResponse.json();
    expect(data.apiKey.scopes).toEqual(['read:data', 'write:data']);
  });

  test('Cannot update another user\'s API key', async ({ request }) => {
    const user1 = await createUserAndLogin(request);
    const user2 = await createUserAndLogin(request);

    const createResponse = await request.post('/api/v1/api-keys', {
      headers: { Authorization: `Bearer ${user1.token}` },
      data: { name: 'User 1 Key' }
    });

    const { keyId } = await createResponse.json();

    // User 2 tries to update
    const response = await request.patch(`/api/v1/api-keys/${keyId}`, {
      headers: { Authorization: `Bearer ${user2.token}` },
      data: { name: 'Hacked' }
    });

    expect(response.status()).toBe(404);
  });
});

test.describe('API Key Revocation', () => {

  test('Can revoke API key', async ({ request }) => {
    const { token } = await createUserAndLogin(request);

    // Create a key
    const createResponse = await request.post('/api/v1/api-keys', {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: 'To Be Revoked' }
    });

    const { keyId } = await createResponse.json();

    // Revoke it
    const revokeResponse = await request.delete(`/api/v1/api-keys/${keyId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    expect(revokeResponse.ok()).toBeTruthy();

    // Verify it's inactive
    const getResponse = await request.get(`/api/v1/api-keys/${keyId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const data = await getResponse.json();
    expect(data.apiKey.isActive).toBe(false);
  });

  test('Cannot revoke another user\'s API key', async ({ request }) => {
    const user1 = await createUserAndLogin(request);
    const user2 = await createUserAndLogin(request);

    const createResponse = await request.post('/api/v1/api-keys', {
      headers: { Authorization: `Bearer ${user1.token}` },
      data: { name: 'Protected Key' }
    });

    const { keyId } = await createResponse.json();

    // User 2 tries to revoke
    const response = await request.delete(`/api/v1/api-keys/${keyId}`, {
      headers: { Authorization: `Bearer ${user2.token}` }
    });

    expect(response.status()).toBe(404);
  });
});

test.describe('API Key Rotation', () => {

  test('Can rotate API key', async ({ request }) => {
    const { token } = await createUserAndLogin(request);

    // Create a key
    const createResponse = await request.post('/api/v1/api-keys', {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: 'To Be Rotated' }
    });

    const { keyId, apiKey: oldKey } = await createResponse.json();

    // Rotate it
    const rotateResponse = await request.post(`/api/v1/api-keys/${keyId}/rotate`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    expect(rotateResponse.ok()).toBeTruthy();
    const rotateData = await rotateResponse.json();

    expect(rotateData.success).toBe(true);
    expect(rotateData.apiKey).toBeTruthy();
    expect(rotateData.apiKey).not.toBe(oldKey);
    expect(rotateData.apiKey).toMatch(/^dk_/);
  });

  test('Cannot rotate inactive API key', async ({ request }) => {
    const { token } = await createUserAndLogin(request);

    // Create and revoke a key
    const createResponse = await request.post('/api/v1/api-keys', {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: 'Revoked Key' }
    });

    const { keyId } = await createResponse.json();

    await request.delete(`/api/v1/api-keys/${keyId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    // Try to rotate
    const response = await request.post(`/api/v1/api-keys/${keyId}/rotate`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Invalid operation');
  });
});

test.describe('API Key Authentication', () => {

  test('Can authenticate with API key in X-API-Key header', async ({ request }) => {
    const { token } = await createUserAndLogin(request);

    // Create an API key
    const createResponse = await request.post('/api/v1/api-keys', {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: 'Auth Test Key' }
    });

    const { apiKey } = await createResponse.json();

    // Use API key to access /me endpoint
    const response = await request.get('/api/v1/auth/me', {
      headers: { 'X-API-Key': apiKey }
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.user).toBeTruthy();
  });

  test('Can authenticate with API key in Authorization header', async ({ request }) => {
    const { token } = await createUserAndLogin(request);

    const createResponse = await request.post('/api/v1/api-keys', {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: 'Auth Test Key 2' }
    });

    const { apiKey } = await createResponse.json();

    // Use API key in Authorization header
    const response = await request.get('/api/v1/auth/me', {
      headers: { Authorization: `Bearer ${apiKey}` }
    });

    expect(response.ok()).toBeTruthy();
  });

  test('Cannot authenticate with revoked API key', async ({ request }) => {
    const { token } = await createUserAndLogin(request);

    // Create and revoke a key
    const createResponse = await request.post('/api/v1/api-keys', {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: 'Revoked Auth Key' }
    });

    const { keyId, apiKey } = await createResponse.json();

    await request.delete(`/api/v1/api-keys/${keyId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    // Try to use revoked key
    const response = await request.get('/api/v1/auth/me', {
      headers: { 'X-API-Key': apiKey }
    });

    expect(response.status()).toBe(401);
    const data = await response.json();
    expect(data.message).toContain('revoked');
  });

  test('Cannot authenticate with invalid API key', async ({ request }) => {
    const response = await request.get('/api/v1/auth/me', {
      headers: { 'X-API-Key': 'dk_invalid_key' }
    });

    expect(response.status()).toBe(401);
  });
});
