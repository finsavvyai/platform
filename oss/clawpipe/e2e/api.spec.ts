import { test, expect } from '@playwright/test';

const GW = 'https://api.clawpipe.ai';
const uniqueEmail = `e2e-${Date.now()}@clawpipe-test.ai`;
let sessionCookie = '';
let projectId = '';
let apiKey = '';

test.describe.serial('Gateway API E2E', () => {

  test('GET /health returns ok', async ({ request }) => {
    const res = await request.get(`${GW}/health`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.service).toBe('clawpipe-gateway');
  });

  test('CORS headers present', async ({ request }) => {
    const res = await request.get(`${GW}/health`);
    expect(res.headers()['access-control-allow-origin']).toBe('*');
    expect(res.headers()['access-control-allow-methods']).toContain('POST');
  });

  test('POST /auth/register — validation errors', async ({ request }) => {
    // Missing fields
    const r1 = await request.post(`${GW}/auth/register`, { data: {} });
    expect(r1.status()).toBe(400);

    // Short password
    const r2 = await request.post(`${GW}/auth/register`, {
      data: { email: 'a@b.com', password: 'short' },
    });
    expect(r2.status()).toBe(400);
    expect((await r2.json()).error).toContain('8 characters');

    // Invalid email
    const r3 = await request.post(`${GW}/auth/register`, {
      data: { email: 'notanemail', password: 'longpassword123' },
    });
    expect(r3.status()).toBe(400);
    expect((await r3.json()).error).toContain('email');
  });

  test('POST /auth/register — creates user', async ({ request }) => {
    const res = await request.post(`${GW}/auth/register`, {
      data: { email: uniqueEmail, password: 'e2eTestPass123', name: 'E2E User' },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.user.email).toBe(uniqueEmail);
    expect(body.user.name).toBe('E2E User');

    const cookie = res.headers()['set-cookie'];
    expect(cookie).toContain('clawpipe_session=');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    sessionCookie = cookie.split(';')[0];
  });

  test('POST /auth/register — duplicate rejected', async ({ request }) => {
    const res = await request.post(`${GW}/auth/register`, {
      data: { email: uniqueEmail, password: 'anotherpass123' },
    });
    expect(res.status()).toBe(409);
  });

  test('POST /auth/login — wrong password', async ({ request }) => {
    const res = await request.post(`${GW}/auth/login`, {
      data: { email: uniqueEmail, password: 'wrongpassword' },
    });
    expect(res.status()).toBe(401);
  });

  test('POST /auth/login — correct password', async ({ request }) => {
    const res = await request.post(`${GW}/auth/login`, {
      data: { email: uniqueEmail, password: 'e2eTestPass123' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.user.email).toBe(uniqueEmail);

    sessionCookie = res.headers()['set-cookie'].split(';')[0];
  });

  test('GET /auth/me — returns user with cookie', async ({ request }) => {
    const res = await request.get(`${GW}/auth/me`, {
      headers: { Cookie: sessionCookie },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.user.email).toBe(uniqueEmail);
    expect(body.user.name).toBe('E2E User');
  });

  test('GET /auth/me — rejects without cookie', async ({ request }) => {
    const res = await request.get(`${GW}/auth/me`);
    expect(res.status()).toBe(401);
  });

  test('POST /v1/projects — creates project', async ({ request }) => {
    const res = await request.post(`${GW}/v1/projects`, {
      data: { name: 'E2E Test Project' },
      headers: { Cookie: sessionCookie },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.project.name).toBe('E2E Test Project');
    expect(body.project.tier).toBe('free');
    expect(body.apiKey).toMatch(/^cp_/);
    projectId = body.project.id;
    apiKey = body.apiKey;
  });

  test('GET /v1/projects — lists projects', async ({ request }) => {
    const res = await request.get(`${GW}/v1/projects`, {
      headers: { Cookie: sessionCookie },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.projects.length).toBeGreaterThanOrEqual(1);
    const found = body.projects.find((p: { id: string }) => p.id === projectId);
    expect(found).toBeTruthy();
    expect(found.role).toBe('owner');
  });

  test('GET /v1/projects — rejects without auth', async ({ request }) => {
    const res = await request.get(`${GW}/v1/projects`);
    expect(res.status()).toBe(401);
  });

  test('POST /v1/projects/:id/keys/rotate — rotates key', async ({ request }) => {
    const res = await request.post(`${GW}/v1/projects/${projectId}/keys/rotate`, {
      headers: { Cookie: sessionCookie },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.key).toMatch(/^cp_/);
    expect(body.key).not.toBe(apiKey);
    apiKey = body.key;
  });

  test('GET /v1/analytics/overview — with API key auth', async ({ request }) => {
    const res = await request.get(`${GW}/v1/analytics/overview`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'X-Project-Id': projectId,
      },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty('totalRequests');
    expect(body).toHaveProperty('totalCost');
    expect(body).toHaveProperty('cacheHitRate');
  });

  test('GET /v1/analytics/providers — returns array', async ({ request }) => {
    const res = await request.get(`${GW}/v1/analytics/providers`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'X-Project-Id': projectId,
      },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty('providers');
    expect(Array.isArray(body.providers)).toBeTruthy();
  });

  test('GET /v1/analytics/cache — returns daily', async ({ request }) => {
    const res = await request.get(`${GW}/v1/analytics/cache`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'X-Project-Id': projectId,
      },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty('daily');
  });

  test('GET /v1/analytics/routes — returns routes', async ({ request }) => {
    const res = await request.get(`${GW}/v1/analytics/routes`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'X-Project-Id': projectId,
      },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty('routes');
  });

  test('PUT + GET /v1/weights — round trip', async ({ request }) => {
    const weights = [
      { provider: 'openai', model: 'gpt-4o', totalCalls: 10, avgLatencyMs: 500, avgTokensOut: 200, score: 0.8 },
    ];

    const putRes = await request.put(`${GW}/v1/weights`, {
      data: { weights },
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'X-Project-Id': projectId,
      },
    });
    expect(putRes.ok()).toBeTruthy();

    const getRes = await request.get(`${GW}/v1/weights`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'X-Project-Id': projectId,
      },
    });
    expect(getRes.ok()).toBeTruthy();
    const body = await getRes.json();
    expect(body.weights.length).toBeGreaterThanOrEqual(1);
    expect(body.weights[0].provider).toBe('openai');
  });

  test('GET /v1/projects/:id/settings — rejects without auth', async ({ request }) => {
    const res = await request.get(`${GW}/v1/projects/${projectId}/settings`);
    expect(res.status()).toBe(401);
  });

  test('GET /v1/projects/:id/settings — returns slack + budget shape', async ({ request }) => {
    const res = await request.get(`${GW}/v1/projects/${projectId}/settings`, {
      headers: { Cookie: sessionCookie },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty('slack');
    expect(body.slack).toHaveProperty('configured');
    expect(body).toHaveProperty('budget');
    expect(body.budget).toHaveProperty('monthlyCap');
    expect(body.budget).toHaveProperty('usedMtd');
    expect(body.budget).toHaveProperty('pct');
  });

  test('PUT /v1/projects/:id/slack-webhook — rejects non-Slack URL', async ({ request }) => {
    const res = await request.put(`${GW}/v1/projects/${projectId}/slack-webhook`, {
      data: { url: 'https://evil.example/hook' },
      headers: { Cookie: sessionCookie },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toContain('hooks.slack.com');
  });

  test('PUT /v1/projects/:id/slack-webhook — accepts valid URL', async ({ request }) => {
    const res = await request.put(`${GW}/v1/projects/${projectId}/slack-webhook`, {
      data: { url: 'https://hooks.slack.com/services/T00/B00/fake-for-e2e' },
      headers: { Cookie: sessionCookie },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.configured).toBe(true);
  });

  test('PUT /v1/projects/:id/slack-webhook — clears with null', async ({ request }) => {
    const res = await request.put(`${GW}/v1/projects/${projectId}/slack-webhook`, {
      data: { url: null },
      headers: { Cookie: sessionCookie },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.configured).toBe(false);
  });

  test('POST /v1/projects/:id/slack-digest/test — 400 when no webhook', async ({ request }) => {
    const res = await request.post(`${GW}/v1/projects/${projectId}/slack-digest/test`, {
      headers: { Cookie: sessionCookie },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toContain('No Slack webhook');
  });

  test('PUT /v1/projects/:id/budget — rejects negative cap', async ({ request }) => {
    const res = await request.put(`${GW}/v1/projects/${projectId}/budget`, {
      data: { monthlyCap: -10 },
      headers: { Cookie: sessionCookie },
    });
    expect(res.status()).toBe(400);
  });

  test('PUT /v1/projects/:id/budget — sets cap and GET reflects it', async ({ request }) => {
    const putRes = await request.put(`${GW}/v1/projects/${projectId}/budget`, {
      data: { monthlyCap: 250 },
      headers: { Cookie: sessionCookie },
    });
    expect(putRes.ok()).toBeTruthy();
    const putBody = await putRes.json();
    expect(putBody.budget.monthlyCap).toBe(250);

    const getRes = await request.get(`${GW}/v1/projects/${projectId}/settings`, {
      headers: { Cookie: sessionCookie },
    });
    const getBody = await getRes.json();
    expect(getBody.budget.monthlyCap).toBe(250);
  });

  test('PUT /v1/projects/:id/budget — clears with null', async ({ request }) => {
    const res = await request.put(`${GW}/v1/projects/${projectId}/budget`, {
      data: { monthlyCap: null },
      headers: { Cookie: sessionCookie },
    });
    expect(res.ok()).toBeTruthy();
    expect((await res.json()).budget.monthlyCap).toBeNull();
  });

  test('PUT /v1/projects/:id/budget — rejects without auth', async ({ request }) => {
    const res = await request.put(`${GW}/v1/projects/${projectId}/budget`, {
      data: { monthlyCap: 100 },
    });
    expect(res.status()).toBe(401);
  });

  test('GET /v1/projects/:id/export.csv — returns CSV with header row', async ({ request }) => {
    const res = await request.get(`${GW}/v1/projects/${projectId}/export.csv`, {
      headers: { Cookie: sessionCookie },
    });
    expect(res.ok()).toBeTruthy();
    expect(res.headers()['content-type']).toContain('text/csv');
    expect(res.headers()['content-disposition']).toContain('attachment');
    const body = await res.text();
    expect(body.split('\n')[0]).toContain('timestamp,provider,model');
  });

  test('GET /v1/projects/:id/export.csv — rejects without auth', async ({ request }) => {
    const res = await request.get(`${GW}/v1/projects/${projectId}/export.csv`);
    expect(res.status()).toBe(401);
  });

  test('PUT /v1/projects/:id/digest-email — rejects invalid address', async ({ request }) => {
    const res = await request.put(`${GW}/v1/projects/${projectId}/digest-email`, {
      data: { email: 'not-an-email' },
      headers: { Cookie: sessionCookie },
    });
    expect(res.status()).toBe(400);
  });

  test('PUT /v1/projects/:id/digest-email — accepts + clears', async ({ request }) => {
    const setRes = await request.put(`${GW}/v1/projects/${projectId}/digest-email`, {
      data: { email: 'finance@clawpipe-test.ai' },
      headers: { Cookie: sessionCookie },
    });
    expect(setRes.ok()).toBeTruthy();
    expect((await setRes.json()).configured).toBe(true);

    const getRes = await request.get(`${GW}/v1/projects/${projectId}/settings`, {
      headers: { Cookie: sessionCookie },
    });
    const s = await getRes.json();
    expect(s.email.configured).toBe(true);
    expect(s.email.address).toBe('finance@clawpipe-test.ai');

    const clearRes = await request.put(`${GW}/v1/projects/${projectId}/digest-email`, {
      data: { email: null },
      headers: { Cookie: sessionCookie },
    });
    expect((await clearRes.json()).configured).toBe(false);
  });

  test('POST /v1/projects/:id/digest-email/test — 400 when no email set', async ({ request }) => {
    const res = await request.post(`${GW}/v1/projects/${projectId}/digest-email/test`, {
      headers: { Cookie: sessionCookie },
    });
    expect(res.status()).toBe(400);
  });

  test('POST /v1/teams — creates team; GET /v1/teams lists it', async ({ request }) => {
    const createRes = await request.post(`${GW}/v1/teams`, {
      data: { name: `E2E Team ${Date.now()}` },
      headers: { Cookie: sessionCookie },
    });
    expect(createRes.status()).toBe(201);
    const { team } = await createRes.json();
    expect(team.id).toBeTruthy();

    const listRes = await request.get(`${GW}/v1/teams`, {
      headers: { Cookie: sessionCookie },
    });
    const listBody = await listRes.json();
    const found = listBody.teams.find((t: { id: string }) => t.id === team.id);
    expect(found).toBeTruthy();
    expect(found.role).toBe('owner');
  });

  test('PUT /v1/teams/:id/budget — sets team cap', async ({ request }) => {
    const createRes = await request.post(`${GW}/v1/teams`, {
      data: { name: `Budget E2E ${Date.now()}` },
      headers: { Cookie: sessionCookie },
    });
    const { team } = await createRes.json();

    const putRes = await request.put(`${GW}/v1/teams/${team.id}/budget`, {
      data: { monthlyCap: 5000 },
      headers: { Cookie: sessionCookie },
    });
    expect(putRes.ok()).toBeTruthy();
    expect((await putRes.json()).budget.monthlyCap).toBe(5000);
  });

  test('PUT /v1/projects/:id/team — links project to team', async ({ request }) => {
    const createRes = await request.post(`${GW}/v1/teams`, {
      data: { name: `Link E2E ${Date.now()}` },
      headers: { Cookie: sessionCookie },
    });
    const { team } = await createRes.json();

    const linkRes = await request.put(`${GW}/v1/projects/${projectId}/team`, {
      data: { teamId: team.id },
      headers: { Cookie: sessionCookie },
    });
    expect(linkRes.ok()).toBeTruthy();
    expect((await linkRes.json()).teamId).toBe(team.id);
  });

  test('POST /auth/logout — clears cookie', async ({ request }) => {
    const res = await request.post(`${GW}/auth/logout`, {
      headers: { Cookie: sessionCookie },
    });
    expect(res.ok()).toBeTruthy();
    const cookie = res.headers()['set-cookie'];
    expect(cookie).toContain('Max-Age=0');
  });

  test('401 for unauthenticated API routes', async ({ request }) => {
    const res = await request.get(`${GW}/v1/analytics/overview`);
    expect(res.status()).toBe(401);
  });

  test('401 for unknown /v1 routes without auth', async ({ request }) => {
    const res = await request.get(`${GW}/v1/nonexistent`);
    expect(res.status()).toBe(401);
  });
});
