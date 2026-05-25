/**
 * OpenAPI Spec Route Tests
 */
import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { openApiRoutes } from './index.js';

const app = new Hono();
app.route('/openapi.json', openApiRoutes);

describe('GET /openapi.json', () => {
  it('returns valid OpenAPI 3.0 spec', async () => {
    const res = await app.request('/openapi.json');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.openapi).toBe('3.0.3');
    expect(body.info.title).toBe('OpenSyber API');
  });

  it('includes security schemes', async () => {
    const res = await app.request('/openapi.json');
    const body = await res.json();
    expect(body.components.securitySchemes.bearerAuth).toBeDefined();
    expect(body.components.securitySchemes.gatewayToken).toBeDefined();
  });

  it('includes all API paths', async () => {
    const res = await app.request('/openapi.json');
    const body = await res.json();
    const paths = Object.keys(body.paths);
    expect(paths.length).toBeGreaterThan(10);
    expect(paths).toContain('/api/agents/activity/sync');
    expect(paths).toContain('/api/scim/v2/Users');
  });

  it('includes tags for all route groups', async () => {
    const res = await app.request('/openapi.json');
    const body = await res.json();
    const tagNames = body.tags.map((t: { name: string }) => t.name);
    expect(tagNames).toContain('Agent Activity');
    expect(tagNames).toContain('Cloud Security');
    expect(tagNames).toContain('SCIM');
    expect(tagNames).toContain('Marketplace');
  });

  it('serves without auth', async () => {
    const res = await app.request('/openapi.json');
    expect(res.status).toBe(200);
  });
});
