/**
 * Display-ID smoke tests.
 *
 * Asserts that:
 *   1. POST /api/test-cases returns a display_id matching /^TC-\d{4,}$/.
 *   2. Two consecutive creates produce strictly-increasing display_ids.
 *   3. GET /api/test-cases/:id echoes the display_id.
 *   4. The endpoints require auth.
 *
 * The test registers a fresh user against /api/auth/register so it runs
 * against any environment (staging, prod, local) without needing fixtures.
 */
import { test, expect, request as playwrightRequest } from '@playwright/test';

const API = process.env.E2E_API_URL || 'https://api.qestro.app';

/** Extract an access token from whatever shape the auth endpoint returns. */
function extractToken(payload: unknown): string | undefined {
  const p = payload as Record<string, unknown> | null | undefined;
  if (!p) return undefined;
  const data = (p.data ?? {}) as Record<string, unknown>;
  const tokens = (data.tokens ?? p.tokens ?? {}) as Record<string, unknown>;
  return (
    (tokens.accessToken as string | undefined) ||
    (tokens.token as string | undefined) ||
    (data.accessToken as string | undefined) ||
    (data.token as string | undefined) ||
    (p.accessToken as string | undefined) ||
    (p.token as string | undefined)
  );
}

async function registerAndAuth() {
  const ctx = await playwrightRequest.newContext({ baseURL: API });
  const email = `displayid-${Date.now()}-${Math.floor(Math.random() * 1e6)}@qestro-e2e.dev`;
  const password = 'TestPassword#2026!';

  const reg = await ctx.post('/api/auth/register', {
    data: { email, password, name: 'Display-ID Test' },
  });

  if (reg.status() !== 201 && reg.status() !== 200) {
    // Fallback: try login if user already exists somehow.
    const login = await ctx.post('/api/auth/login', { data: { email, password } });
    expect(login.ok()).toBeTruthy();
    const token = extractToken(await login.json());
    expect(token, 'login should return a JWT').toBeTruthy();
    return { ctx, token: token as string, email };
  }
  const token = extractToken(await reg.json());
  expect(token, 'register should return a JWT').toBeTruthy();
  return { ctx, token: token as string, email };
}

/** Every test case needs a valid projectId (FK constraint). */
async function createProject(ctx: ReturnType<typeof playwrightRequest.newContext> extends Promise<infer T> ? T : never, token: string): Promise<string> {
  const res = await ctx.post('/api/projects', {
    headers: { Authorization: `Bearer ${token}` },
    data: { name: `Display-ID E2E ${Date.now()}` },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  const id = body?.data?.id || body?.id;
  expect(typeof id).toBe('string');
  return id as string;
}

test.describe('Display IDs', () => {
  test('POST /api/test-cases returns TC-NNNN display_id', async () => {
    const { ctx, token } = await registerAndAuth();
    const projectId = await createProject(ctx, token);
    const res = await ctx.post('/api/test-cases', {
      headers: { Authorization: `Bearer ${token}` },
      data: { projectId, title: 'Display ID smoke-test case' },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeTruthy();
    expect(typeof body.data.id).toBe('string');
    expect(body.data.displayId, 'response should include displayId').toMatch(/^TC-\d{4,}$/);
    await ctx.dispose();
  });

  test('Display IDs increment monotonically on successive creates', async () => {
    const { ctx, token } = await registerAndAuth();
    const projectId = await createProject(ctx, token);

    const mk = async () =>
      (await (await ctx.post('/api/test-cases', {
        headers: { Authorization: `Bearer ${token}` },
        data: { projectId, title: `Monotonic ${Date.now()}` },
      })).json()).data.displayId as string;

    const a = await mk();
    const b = await mk();
    expect(a).toMatch(/^TC-\d{4,}$/);
    expect(b).toMatch(/^TC-\d{4,}$/);
    const nA = parseInt(a.slice(3), 10);
    const nB = parseInt(b.slice(3), 10);
    expect(nB).toBeGreaterThan(nA);
    await ctx.dispose();
  });

  test('GET /api/test-cases/:id returns display_id', async () => {
    const { ctx, token } = await registerAndAuth();
    const projectId = await createProject(ctx, token);
    const create = await (await ctx.post('/api/test-cases', {
      headers: { Authorization: `Bearer ${token}` },
      data: { projectId, title: 'Fetch me back' },
    })).json();
    const id = create.data.id;
    const fetched = await (await ctx.get(`/api/test-cases/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })).json();
    expect(fetched.success).toBe(true);
    expect(fetched.data.id).toBe(id);
    // Accept either casing: the GET list path returns raw Drizzle rows
    // (camelCase mapping via drizzle), while some older paths may emit
    // snake_case. Defensively read both.
    const displayId = fetched.data.displayId ?? fetched.data.display_id;
    expect(displayId).toMatch(/^TC-\d{4,}$/);
    await ctx.dispose();
  });

  test('Unauthenticated POST /api/test-cases returns 401', async ({ request }) => {
    const res = await request.post(`${API}/api/test-cases`, {
      data: { projectId: 'display-id-e2e', title: 'nope' },
    });
    expect(res.status()).toBe(401);
  });
});
