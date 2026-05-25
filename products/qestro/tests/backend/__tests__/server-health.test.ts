import { describe, test, expect } from '@jest/globals';
import request from 'supertest';
import app from '../index.js';

describe('Server Health Tests', () => {
  test('should respond to health check', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);

    expect(response.body.status).toBe('healthy');
    expect(response.body.timestamp).toBeDefined();
    expect(response.body.version).toBeDefined();
    expect(response.body.environment).toBeDefined();
  });

  test('should respond to API info endpoint', async () => {
    const response = await request(app)
      .get('/api')
      .expect(200);

    expect(response.body.message).toBe('Questro API Server');
    expect(response.body.version).toBeDefined();
    expect(response.body.features).toBeDefined();
  });

  test('data validation endpoints should exist', async () => {
    // Test that endpoints exist (will return 401 without auth, but that means they exist)
    const endpoints = [
      '/api/data-validation/validate-database',
      '/api/data-validation/validate-consistency',
      '/api/data-validation/auto-fix',
      '/api/data-validation/analyze-database',
      '/api/data-validation/analyze-table',
      '/api/data-validation/data-lineage',
      '/api/data-validation/pool-metrics',
      '/api/data-validation/health-check',
      '/api/data-validation/validation-rules'
    ];

    for (const endpoint of endpoints) {
      const response = await request(app)
        .post(endpoint)
        .send({});

      // Should return 401 (unauthorized) not 404 (not found)
      expect([401, 400]).toContain(response.status);
    }
  });

  test('validation rules endpoint should work without auth', async () => {
    // This endpoint might work without auth
    const response = await request(app)
      .get('/api/data-validation/validation-rules');

    // Should either work (200) or require auth (401), but not be missing (404)
    expect([200, 401]).toContain(response.status);
  });

  test('should handle 404 for non-existent routes', async () => {
    const response = await request(app)
      .get('/api/non-existent-endpoint')
      .expect(404);

    expect(response.body.error).toBe('Not found');
    expect(response.body.path).toBe('/api/non-existent-endpoint');
  });

  test('should serve API documentation structure', async () => {
    const response = await request(app)
      .get('/api')
      .expect(200);

    expect(response.body.features).toHaveProperty('recording');
    expect(response.body.features).toHaveProperty('mobileTesting');
    expect(response.body.features).toHaveProperty('webTesting');
    expect(response.body.features).toHaveProperty('aiGeneration');
  });
});