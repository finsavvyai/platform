import { test, expect, request } from '@playwright/test';

const API_BASE_URL = 'http://localhost:3001';

test.describe('QueryFlux API Integration Tests', () => {
  test.beforeAll(async () => {
    // Ensure API server is running
    const apiRequest = await request.newContext();

    try {
      const response = await apiRequest.get(`${API_BASE_URL}/health`);
      // Health endpoint might not exist, so we ignore 404 errors
    } catch (error) {
      console.log('Note: API server might not have a health endpoint');
    }

    await apiRequest.dispose();
  });

  test('API server is running', async ({ request }) => {
    // Test that API server responds (even with 404, it means server is up)
    const response = await request.get(`${API_BASE_URL}/nonexistent`);
    expect(response.status()).toBe(404);
  });

  test('PostgreSQL connection endpoint', async ({ request }) => {
    const response = await request.post(`${API_BASE_URL}/api/test/postgresql`, {
      data: {}
    });

    // Should return JSON response (even if connection fails)
    expect(response.headers()['content-type']).toContain('application/json');

    const data = await response.json();
    expect(data).toHaveProperty('success');
    expect(typeof data.success).toBe('boolean');
  });

  test('MySQL connection endpoint', async ({ request }) => {
    const response = await request.post(`${API_BASE_URL}/api/test/mysql`, {
      data: {}
    });

    // Should return JSON response
    expect(response.headers()['content-type']).toContain('application/json');

    const data = await response.json();
    expect(data).toHaveProperty('success');
    expect(typeof data.success).toBe('boolean');
  });

  test('Redis connection endpoint', async ({ request }) => {
    const response = await request.post(`${API_BASE_URL}/api/test/redis`, {
      data: {}
    });

    // Should return JSON response
    expect(response.headers()['content-type']).toContain('application/json');

    const data = await response.json();
    expect(data).toHaveProperty('success');
    expect(typeof data.success).toBe('boolean');
  });

  test('MongoDB connection endpoint', async ({ request }) => {
    const response = await request.post(`${API_BASE_URL}/api/test/mongodb`, {
      data: {}
    });

    // Should return JSON response
    expect(response.headers()['content-type']).toContain('application/json');

    const data = await response.json();
    expect(data).toHaveProperty('success');
    expect(typeof data.success).toBe('boolean');
  });

  test('PostgreSQL schema endpoint', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/api/schema/postgresql`);

    // Should return JSON response
    expect(response.headers()['content-type']).toContain('application/json');

    const data = await response.json();
    expect(data).toHaveProperty('success');
    expect(typeof data.success).toBe('boolean');

    if (data.success) {
      expect(data).toHaveProperty('schema');
      expect(typeof data.schema).toBe('object');
    }
  });

  test('MySQL schema endpoint', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/api/schema/mysql`);

    // Should return JSON response
    expect(response.headers()['content-type']).toContain('application/json');

    const data = await response.json();
    expect(data).toHaveProperty('success');
    expect(typeof data.success).toBe('boolean');

    if (data.success) {
      expect(data).toHaveProperty('schema');
      expect(typeof data.schema).toBe('object');
    }
  });

  test('MongoDB schema endpoint', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/api/schema/mongodb`);

    // Should return JSON response
    expect(response.headers()['content-type']).toContain('application/json');

    const data = await response.json();
    expect(data).toHaveProperty('success');
    expect(typeof data.success).toBe('boolean');

    if (data.success) {
      expect(data).toHaveProperty('schema');
      expect(typeof data.schema).toBe('object');
    }
  });

  test('API handles invalid endpoints gracefully', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/api/invalid/endpoint`);

    expect(response.status()).toBe(404);
  });

  test('API handles malformed JSON requests', async ({ request }) => {
    const response = await request.post(`${API_BASE_URL}/api/test/postgresql`, {
      data: 'invalid json'
    });

    // Should handle malformed requests gracefully
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });
});