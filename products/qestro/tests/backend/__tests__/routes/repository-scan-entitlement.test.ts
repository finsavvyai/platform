import { Hono } from 'hono';
import testgenRoutes from '../../../../backend/src/testgenRoutes';
import billingRoutes from '../../../../backend/src/billingRoutes';
import { signJWT } from '../../../../backend/src/auth/jwt';

const JWT_SECRET = 'test-secret';

function createApp() {
  const app = new Hono<any>();
  app.route('/api/testgen', testgenRoutes);
  app.route('/api/billing', billingRoutes);
  return app;
}

function createEnv() {
  return {
    DB: {} as D1Database,
    ENVIRONMENT: 'production',
    JWT_SECRET,
  };
}

async function authHeader(subscription: string) {
  const token = await signJWT(
    {
      userId: `user-${subscription}`,
      email: `${subscription}@qestro.dev`,
      role: 'user',
      subscription,
    },
    JWT_SECRET,
    3600,
  );
  return { Authorization: `Bearer ${token}` };
}

describe('repository scan paid entitlement', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('reports feature access as denied for free users', async () => {
    const app = createApp();
    const response = await app.request(
      '/api/billing/feature-access/github_repository_scan',
      { method: 'GET', headers: await authHeader('free') },
      createEnv(),
    );

    expect(response.status).toBe(200);
    const body = await response.json() as { access: { hasAccess: boolean; planId: string; usage: { limit: number } } };
    expect(body.access.planId).toBe('free');
    expect(body.access.hasAccess).toBe(false);
    expect(body.access.usage.limit).toBe(0);
  });

  it('denies direct repository scan API calls for free users', async () => {
    const app = createApp();
    const response = await app.request(
      '/api/testgen/repository-scan',
      {
        method: 'POST',
        headers: { ...(await authHeader('free')), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repositoryUrl: 'https://github.com/acme/shop',
          branch: 'main',
          persona: 'product',
        }),
      },
      createEnv(),
    );

    expect(response.status).toBe(403);
    const body = await response.json() as { access: { hasAccess: boolean } };
    expect(body.access.hasAccess).toBe(false);
  });

  it('generates repository scenario prompt for professional users', async () => {
    const app = createApp();
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/git/trees/develop')) {
        return Response.json({
          tree: [
            { path: 'README.md', type: 'blob', size: 120 },
            { path: 'package.json', type: 'blob', size: 80 },
            { path: 'src/routes/checkout.ts', type: 'blob', size: 300 },
            { path: 'tests/checkout.spec.ts', type: 'blob', size: 280 },
          ],
        });
      }
      if (url.includes('/contents/README.md')) {
        return new Response('# Shop\nCheckout and billing application.');
      }
      if (url.includes('/contents/package.json')) {
        return new Response('{"scripts":{"test":"vitest"},"dependencies":{"hono":"latest"}}');
      }
      if (url.includes('/contents/src/routes/checkout.ts')) {
        return new Response('export async function checkout() { /* validates payment and cart */ }');
      }
      if (url.includes('/contents/tests/checkout.spec.ts')) {
        return new Response('test("checkout happy path", async () => {})');
      }
      return new Response('not found', { status: 404 });
    }) as unknown as typeof fetch;

    const response = await app.request(
      '/api/testgen/repository-scan',
      {
        method: 'POST',
        headers: { ...(await authHeader('professional')), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repositoryUrl: 'https://github.com/acme/shop',
          branch: 'develop',
          focus: 'checkout risk',
          persona: 'business',
        }),
      },
      createEnv(),
    );

    expect(response.status).toBe(200);
    const body = await response.json() as {
      data: {
        repository: { fullName: string; branch: string };
        connection: { liveIndexing: boolean; indexedFiles: Array<{ path: string }> };
        billing: { planId: string; usage: { limit: number; used: number } };
        prompt: string;
        scenarios: Array<{ persona: string; steps: string[]; sourcePaths: string[] }>;
      };
    };
    expect(body.data.repository).toEqual({ url: 'https://github.com/acme/shop', fullName: 'acme/shop', branch: 'develop' });
    expect(body.data.connection.liveIndexing).toBe(true);
    expect(body.data.connection.indexedFiles.map((file) => file.path)).toContain('src/routes/checkout.ts');
    expect(body.data.billing.planId).toBe('professional');
    expect(body.data.billing.usage.limit).toBe(50);
    expect(body.data.billing.usage.used).toBe(1);
    expect(body.data.prompt).toContain('Business Analyst');
    expect(body.data.prompt).toContain('src/routes/checkout.ts');
    expect(body.data.prompt).toContain('validates payment and cart');
    expect(body.data.scenarios.length).toBeGreaterThan(0);
    expect(body.data.scenarios[0].steps.length).toBeGreaterThan(0);
    expect(body.data.scenarios[0].sourcePaths).toContain('src/routes/checkout.ts');
  });
});
