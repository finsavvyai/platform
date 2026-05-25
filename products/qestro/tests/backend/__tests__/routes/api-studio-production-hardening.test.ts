import { Hono } from 'hono';
import apiTestingRoute from '../../../../backend/src/routes/api-testing.route';
import cloudDevicesRoute from '../../../../backend/src/routes/cloud-devices.route';
import { signJWT } from '../../../../backend/src/auth/jwt';

const JWT_SECRET = 'test-secret';

function createEnv(
  environment = 'production',
  overrides: Partial<{
    API_TESTING_ALLOW_DEMO_MODE: string;
    CLOUD_DEVICES_ALLOW_DEMO_MODE: string;
  }> = {},
) {
  return {
    ENVIRONMENT: environment,
    JWT_SECRET,
    ...overrides,
  };
}

function createMockD1(): D1Database {
  const collections: any[] = [];
  const requests: any[] = [];

  const execute = (query: string, values: unknown[]) => {
    const normalized = query.replace(/\s+/g, ' ').trim();

    if (normalized.startsWith('INSERT INTO api_testing_collections')) {
      collections.push({
        id: values[0],
        user_id: values[1],
        project_id: values[2],
        name: values[3],
        description: values[4],
        variables: values[5],
        tags: values[6],
        created_at: values[7],
        updated_at: values[8],
      });
      return { success: true };
    }

    if (normalized.startsWith('INSERT INTO api_testing_requests')) {
      requests.push({
        id: values[0],
        collection_id: values[1],
        user_id: values[2],
        name: values[3],
        description: values[4],
        method: values[5],
        url: values[6],
        headers: values[7],
        body: values[8],
        body_type: values[9],
        auth: values[10],
        pre_request_script: values[11],
        test_script: values[12],
        sort_order: values[13],
        created_at: values[14],
        updated_at: values[15],
      });
      return { success: true };
    }

    return { success: true };
  };

  const selectAll = (query: string, values: unknown[]) => {
    const normalized = query.replace(/\s+/g, ' ').trim();

    if (normalized.includes('FROM api_testing_collections')) {
      const [userId, projectId] = values;
      let rows = collections.filter((row) => row.user_id === userId);
      if (normalized.includes('project_id = ?')) {
        rows = rows.filter((row) => row.project_id === projectId);
      }
      return { results: rows };
    }

    if (normalized.includes('FROM api_testing_requests')) {
      const [collectionId] = values;
      return { results: requests.filter((row) => row.collection_id === collectionId) };
    }

    return { results: [] };
  };

  const selectFirst = (query: string, values: unknown[]) => {
    const normalized = query.replace(/\s+/g, ' ').trim();

    if (normalized.includes('COUNT(*) AS count FROM api_testing_requests')) {
      const [collectionId] = values;
      return { count: requests.filter((row) => row.collection_id === collectionId).length };
    }

    if (normalized.includes('FROM api_testing_collections')) {
      const [id, userId] = values;
      return collections.find((row) => row.id === id && row.user_id === userId) || null;
    }

    return null;
  };

  return {
    prepare: (query: string) => {
      let values: unknown[] = [];
      return {
        bind: (...nextValues: unknown[]) => {
          values = nextValues;
          return {
            all: async () => selectAll(query, values),
            first: async () => selectFirst(query, values),
            run: async () => execute(query, values),
          };
        },
        all: async () => selectAll(query, values),
        first: async () => selectFirst(query, values),
        run: async () => execute(query, values),
      };
    },
  } as unknown as D1Database;
}

function createDbEnv(environment = 'production') {
  return {
    ...createEnv(environment),
    DB: createMockD1(),
  };
}

function createApp() {
  const app = new Hono<any>();
  app.route('/api/api-testing', apiTestingRoute);
  app.route('/api/devices', cloudDevicesRoute);
  return app;
}

async function authHeader(userId = 'user-1') {
  const token = await signJWT({ userId, email: `${userId}@qestro.dev`, role: 'developer' }, JWT_SECRET, 3600);
  return { Authorization: `Bearer ${token}` };
}

describe('API Studio and Cloud Devices production hardening', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('requires verified auth for API Studio in production', async () => {
    const app = createApp();
    const response = await app.request('/api/api-testing/collections', { method: 'GET' }, createEnv());
    expect(response.status).toBe(401);
  });

  it('does not seed demo API collections in production', async () => {
    const app = createApp();
    const response = await app.request(
      '/api/api-testing/collections',
      { method: 'GET', headers: await authHeader() },
      createEnv(),
    );
    expect(response.status).toBe(200);
    const body = await response.json() as { data: unknown[] };
    expect(body.data).toEqual([]);
  });

  it('blocks API execution to local/private targets before fetch', async () => {
    const app = createApp();
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    const response = await app.request(
      '/api/api-testing/execute',
      {
        method: 'POST',
        headers: { ...(await authHeader()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: 'GET', url: 'http://127.0.0.1:8000/api/health' }),
      },
      createEnv(),
    );

    expect(response.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
    const body = await response.json() as { error: string };
    expect(body.error).toMatch(/blocked/i);
  });

  it('requires verified auth for Cloud Devices in production', async () => {
    const app = createApp();
    const response = await app.request('/api/devices', { method: 'GET' }, createEnv());
    expect(response.status).toBe(401);
  });

  it('does not expose fake cloud devices in production', async () => {
    const app = createApp();
    const response = await app.request('/api/devices', { method: 'GET', headers: await authHeader() }, createEnv());
    expect(response.status).toBe(200);
    const body = await response.json() as { data: unknown[] };
    expect(body.data).toEqual([]);
  });

  it('keeps provider discovery disabled in production until real integrations exist', async () => {
    const app = createApp();
    const response = await app.request(
      '/api/devices/discover/browserstack',
      { method: 'POST', headers: await authHeader() },
      createEnv(),
    );
    expect(response.status).toBe(501);
  });

  it('still allows local demo data outside production', async () => {
    const app = createApp();
    const response = await app.request(
      '/api/devices',
      { method: 'GET' },
      createEnv('development', { CLOUD_DEVICES_ALLOW_DEMO_MODE: 'true' }),
    );
    expect(response.status).toBe(200);
    const body = await response.json() as { data: unknown[] };
    expect(body.data.length).toBeGreaterThan(0);
  });

  it('does not leak previously seeded demo devices into production', async () => {
    const app = createApp();
    await app.request(
      '/api/devices',
      { method: 'GET' },
      createEnv('development', { CLOUD_DEVICES_ALLOW_DEMO_MODE: 'true' }),
    );

    const response = await app.request('/api/devices', { method: 'GET', headers: await authHeader() }, createEnv());
    expect(response.status).toBe(200);
    const body = await response.json() as { data: unknown[] };
    expect(body.data).toEqual([]);
  });

  it('persists API Studio collections and requests through the D1 binding', async () => {
    const app = createApp();
    const env = createDbEnv();
    const headers = { ...(await authHeader()), 'Content-Type': 'application/json' };

    const createCollectionResponse = await app.request(
      '/api/api-testing/collections',
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: 'Production Smoke', projectId: 'project-1', variables: { baseUrl: 'https://api.qestro.app' } }),
      },
      env,
    );
    expect(createCollectionResponse.status).toBe(201);
    const createdCollection = await createCollectionResponse.json() as { data: { id: string } };

    const addRequestResponse = await app.request(
      `/api/api-testing/collections/${createdCollection.data.id}/requests`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: 'Health', method: 'GET', url: 'https://api.qestro.app/api/health' }),
      },
      env,
    );
    expect(addRequestResponse.status).toBe(201);

    const listResponse = await app.request(
      '/api/api-testing/collections?projectId=project-1',
      { method: 'GET', headers },
      env,
    );
    expect(listResponse.status).toBe(200);
    const listBody = await listResponse.json() as { data: Array<{ id: string; requestCount: number; variables: Record<string, string> }> };
    expect(listBody.data).toHaveLength(1);
    expect(listBody.data[0].requestCount).toBe(1);
    expect(listBody.data[0].variables.baseUrl).toBe('https://api.qestro.app');

    const getResponse = await app.request(
      `/api/api-testing/collections/${createdCollection.data.id}`,
      { method: 'GET', headers },
      env,
    );
    expect(getResponse.status).toBe(200);
    const getBody = await getResponse.json() as { data: { requests: Array<{ name: string; url: string }> } };
    expect(getBody.data.requests).toEqual([
      expect.objectContaining({ name: 'Health', url: 'https://api.qestro.app/api/health' }),
    ]);
  });
});
