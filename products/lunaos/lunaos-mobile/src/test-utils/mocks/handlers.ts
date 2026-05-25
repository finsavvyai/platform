/**
 * MSW request handlers for LunaOS Mobile tests.
 *
 * Provides mock API responses matching the engine API contract.
 * Import and extend in individual test files as needed.
 */

import { http, HttpResponse } from 'msw';

const BASE_URL = 'https://api.lunaos.ai';

/** Default MSW handlers for the LunaOS engine API */
export const handlers = [
  // --- Auth ---
  http.post(`${BASE_URL}/auth/login`, async ({ request }) => {
    const body = await request.json() as any;
    if (body.email === 'test@lunaos.ai' && body.password === 'Test123!') {
      return HttpResponse.json({
        token: 'mock-jwt-token-for-tests',
        user: {
          id: 'user-001',
          email: 'test@lunaos.ai',
          name: 'Test User',
          tier: 'pro',
        },
      });
    }
    return HttpResponse.json(
      { error: 'Invalid email or password' },
      { status: 401 },
    );
  }),

  http.post(`${BASE_URL}/auth/signup`, async ({ request }) => {
    const body = await request.json() as any;
    return HttpResponse.json(
      {
        token: 'mock-jwt-token-signup',
        user: {
          id: 'user-new',
          email: body.email,
          name: body.name || '',
          tier: 'free',
        },
      },
      { status: 201 },
    );
  }),

  http.get(`${BASE_URL}/auth/me`, () => {
    return HttpResponse.json({
      user: {
        id: 'user-001',
        email: 'test@lunaos.ai',
        name: 'Test User',
        tier: 'pro',
      },
    });
  }),

  // --- Agents ---
  http.get(`${BASE_URL}/agents/list`, () => {
    return HttpResponse.json({
      agents: [
        { slug: 'code-reviewer', name: 'Code Reviewer', category: 'dev', tier: 'free' },
        { slug: 'debug-helper', name: 'Debug Helper', category: 'dev', tier: 'pro' },
        { slug: 'api-designer', name: 'API Designer', category: 'dev', tier: 'pro' },
      ],
      total: 3,
      free: 1,
      pro: 2,
    });
  }),

  http.get(`${BASE_URL}/agents/executions`, () => {
    return HttpResponse.json({
      executions: [
        {
          id: 'exec-001',
          agent: 'code-reviewer',
          provider: 'deepseek',
          model: 'deepseek-chat',
          duration_ms: 2500,
          output_length: 1024,
          created_at: '2026-03-29T10:00:00Z',
        },
      ],
      count: 1,
    });
  }),

  // --- Health ---
  http.get(`${BASE_URL}/health`, () => {
    return HttpResponse.json({ status: 'ok', version: '1.0.0' });
  }),
];
