import { Hono } from 'hono';
import { signJWT } from '../../../../backend/src/auth/jwt';
import apiTestingRoute from '../../../../backend/src/routes/api-testing.route';
import cloudDevicesRoute from '../../../../backend/src/routes/cloud-devices.route';

const JWT_SECRET = 'test-secret';

type TestEnv = {
  DB?: D1Database;
  ENVIRONMENT: string;
  JWT_SECRET: string;
  API_TESTING_ALLOW_DEMO_MODE?: string;
  CLOUD_DEVICES_ALLOW_DEMO_MODE?: string;
};

const createApp = () => {
  const app = new Hono<any>();
  app.route('/api/api-testing', apiTestingRoute);
  app.route('/api/devices', cloudDevicesRoute);
  return app;
};

const createEnv = (overrides: Partial<TestEnv> = {}): TestEnv => ({
  ENVIRONMENT: 'test',
  JWT_SECRET,
  ...overrides,
});

const createAuthHeader = async () => {
  const token = await signJWT({ userId: 'user-1', role: 'admin' }, JWT_SECRET, 3600);
  return { Authorization: `Bearer ${token}` };
};

describe('production route hardening', () => {
  test('api-testing requires auth in production', async () => {
    const app = createApp();
    const response = await app.request('/api/api-testing/collections', { method: 'GET' }, createEnv({ ENVIRONMENT: 'production' }));
    expect(response.status).toBe(401);
  });

  test('api-testing does not accept unverified token fallback', async () => {
    const app = createApp();
    const response = await app.request(
      '/api/api-testing/collections',
      { method: 'GET', headers: { Authorization: 'Bearer invalid.token.value' } },
      createEnv({ ENVIRONMENT: 'test' }),
    );
    expect(response.status).toBe(401);
  });

  test('api-testing demo mode stays opt-in in non-production', async () => {
    const app = createApp();
    const response = await app.request(
      '/api/api-testing/collections',
      { method: 'GET' },
      createEnv({ ENVIRONMENT: 'test', API_TESTING_ALLOW_DEMO_MODE: 'true' }),
    );
    expect(response.status).toBe(200);
  });

  test('cloud devices production endpoint stays explicit beta response', async () => {
    const app = createApp();
    const response = await app.request(
      '/api/devices',
      { method: 'GET', headers: await createAuthHeader() },
      createEnv({ ENVIRONMENT: 'production' }),
    );
    expect(response.status).toBe(200);
    const body = await response.json() as { success: boolean; data: unknown[]; message?: string };
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.message).toContain('beta');
  });
});
