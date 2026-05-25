import { Hono } from 'hono';
import type { Context } from 'hono';
import { verifyJWT } from '../auth/jwt';

type Env = {
  Bindings: { DB?: D1Database; ENVIRONMENT: string; JWT_SECRET: string; API_TESTING_ALLOW_DEMO_MODE?: string };
  Variables: { userId: string; userRole: string };
};

type ApiMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';

type AuthConfig = {
  type?: 'none' | 'bearer' | 'basic' | 'apiKey' | 'oauth2';
  token?: string;
  username?: string;
  password?: string;
  apiKey?: string;
  apiKeyLocation?: 'header' | 'query';
  apiKeyName?: string;
};

type ApiRequestRecord = {
  id: string;
  name: string;
  method: ApiMethod;
  url: string;
  headers: Record<string, string>;
  body?: unknown;
  bodyType: 'json' | 'form-data' | 'x-www-form-urlencoded' | 'raw';
  auth?: AuthConfig;
  description?: string;
  preRequestScript?: string;
  testScript?: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

type ApiCollectionRecord = {
  id: string;
  userId: string;
  projectId: string;
  name: string;
  description?: string;
  variables: Record<string, string>;
  tags: string[];
  requests: ApiRequestRecord[];
  createdAt: string;
  updatedAt: string;
};

type ApiEnvironmentRecord = {
  id: string;
  userId: string;
  projectId: string;
  name: string;
  variables: Record<string, string>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type ApiHistoryRecord = {
  id: string;
  userId: string;
  requestId?: string;
  collectionId?: string;
  method: ApiMethod;
  url: string;
  status: number;
  statusText: string;
  responseTime: number;
  responseSize: number;
  headers: Record<string, string>;
  body: unknown;
  timestamp: string;
};

const route = new Hono<Env>();

const now = () => new Date().toISOString();
const makeId = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;
const epochNow = () => Date.now();
const toIso = (value: number | string | null | undefined) => {
  if (typeof value === 'number') return new Date(value).toISOString();
  if (typeof value === 'string') {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? new Date(numeric).toISOString() : value;
  }
  return now();
};
const ok = (data: unknown, message?: string) => ({
  success: true,
  data,
  message,
  timestamp: now(),
});

const collections = new Map<string, ApiCollectionRecord>();
const environments = new Map<string, ApiEnvironmentRecord>();
const history: ApiHistoryRecord[] = [];

const demoCollectionId = 'api_coll_demo_qestro';
const MAX_RESPONSE_BYTES = 1024 * 1024;
const REQUEST_TIMEOUT_MS = 15000;
const MAX_REDIRECTS = 5;
const EXECUTION_RATE_WINDOW_MS = 60_000;
const EXECUTION_RATE_MAX = 30;

const isProductionEnv = (environment?: string) => ['production', 'prod'].includes((environment || '').toLowerCase());

const isDemoAllowed = (environment?: string, demoFlag?: string) =>
  !isProductionEnv(environment) && String(demoFlag || '').toLowerCase() === 'true';

const executionRateLimits = new Map<string, { count: number; windowStartedAt: number }>();

const isExecutionRateLimited = (userId: string) => {
  const nowTs = Date.now();
  const current = executionRateLimits.get(userId);
  if (!current || nowTs - current.windowStartedAt >= EXECUTION_RATE_WINDOW_MS) {
    executionRateLimits.set(userId, { count: 1, windowStartedAt: nowTs });
    return false;
  }

  current.count += 1;
  return current.count > EXECUTION_RATE_MAX;
};

const hasDb = (c: { env?: Env['Bindings'] }) => Boolean(c.env?.DB);
const shouldRethrowStorageError = (c: { env?: Env['Bindings'] }) => isProductionEnv(c.env?.ENVIRONMENT);

const parseJson = <T>(value: unknown, fallback: T): T => {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const stringifyJson = (value: unknown) => JSON.stringify(value ?? null);

type CollectionRow = {
  id: string;
  user_id: string;
  project_id: string | null;
  name: string;
  description: string | null;
  variables: string | null;
  tags: string | null;
  created_at: number;
  updated_at: number;
};

type RequestRow = {
  id: string;
  collection_id: string;
  name: string;
  method: ApiMethod;
  url: string;
  headers: string | null;
  body: string | null;
  body_type: ApiRequestRecord['bodyType'];
  auth: string | null;
  description: string | null;
  pre_request_script: string | null;
  test_script: string | null;
  sort_order: number;
  created_at: number;
  updated_at: number;
};

type EnvironmentRow = {
  id: string;
  user_id: string;
  project_id: string | null;
  name: string;
  variables: string | null;
  is_active: number;
  created_at: number;
  updated_at: number;
};

type HistoryRow = {
  id: string;
  request_id: string | null;
  collection_id: string | null;
  method: ApiMethod;
  url: string;
  response_status: number;
  response_status_text: string;
  response_time: number;
  response_size: number;
  response_headers: string | null;
  response_body: string | null;
  executed_at: number;
};

const mapRequestRow = (row: RequestRow): ApiRequestRecord => ({
  id: row.id,
  name: row.name,
  method: normalizeMethod(row.method),
  url: row.url,
  headers: parseJson<Record<string, string>>(row.headers, {}),
  body: parseJson<unknown>(row.body, undefined),
  bodyType: row.body_type || 'json',
  auth: parseJson<AuthConfig | undefined>(row.auth, undefined),
  description: row.description ?? undefined,
  preRequestScript: row.pre_request_script ?? undefined,
  testScript: row.test_script ?? undefined,
  sortOrder: row.sort_order,
  createdAt: toIso(row.created_at),
  updatedAt: toIso(row.updated_at),
});

const mapCollectionRow = (row: CollectionRow, requests: ApiRequestRecord[] = []): ApiCollectionRecord => ({
  id: row.id,
  userId: row.user_id,
  projectId: row.project_id ?? 'default',
  name: row.name,
  description: row.description ?? undefined,
  variables: parseJson<Record<string, string>>(row.variables, {}),
  tags: parseJson<string[]>(row.tags, []),
  requests,
  createdAt: toIso(row.created_at),
  updatedAt: toIso(row.updated_at),
});

const mapEnvironmentRow = (row: EnvironmentRow): ApiEnvironmentRecord => ({
  id: row.id,
  userId: row.user_id,
  projectId: row.project_id ?? 'default',
  name: row.name,
  variables: parseJson<Record<string, string>>(row.variables, {}),
  isActive: Boolean(row.is_active),
  createdAt: toIso(row.created_at),
  updatedAt: toIso(row.updated_at),
});

const mapHistoryRow = (row: HistoryRow): ApiHistoryRecord => ({
  id: row.id,
  userId: '',
  requestId: row.request_id ?? undefined,
  collectionId: row.collection_id ?? undefined,
  method: normalizeMethod(row.method),
  url: row.url,
  status: row.response_status,
  statusText: row.response_status_text,
  responseTime: row.response_time,
  responseSize: row.response_size,
  headers: parseJson<Record<string, string>>(row.response_headers, {}),
  body: parseJson<unknown>(row.response_body, null),
  timestamp: toIso(row.executed_at),
});

const ensureSeedData = () => {
  if (!collections.has(demoCollectionId)) {
    const createdAt = now();
    collections.set(demoCollectionId, {
      id: demoCollectionId,
      userId: 'demo-user',
      projectId: 'demo',
      name: 'Qestro API',
      description: 'Ready-to-run API checks for the local Qestro backend.',
      variables: { baseUrl: 'http://localhost:8000' },
      tags: ['demo', 'qestro'],
      createdAt,
      updatedAt: createdAt,
      requests: [
        {
          id: 'api_req_health',
          name: 'Health Check',
          method: 'GET',
          url: 'http://localhost:8000/api/health',
          headers: {},
          bodyType: 'json',
          sortOrder: 1,
          createdAt,
          updatedAt: createdAt,
        },
        {
          id: 'api_req_projects',
          name: 'List Projects',
          method: 'GET',
          url: 'http://localhost:8000/api/projects',
          headers: {},
          bodyType: 'json',
          sortOrder: 2,
          createdAt,
          updatedAt: createdAt,
        },
      ],
    });
  }

  if (environments.size === 0) {
    const createdAt = now();
    environments.set('api_env_local', {
      id: 'api_env_local',
      userId: 'demo-user',
      projectId: 'demo',
      name: 'Local backend',
      variables: {
        baseUrl: 'http://localhost:8000',
      },
      isActive: true,
      createdAt,
      updatedAt: createdAt,
    });
  }
};

route.use('*', async (c, next) => {
  const authorization = c.req.header('Authorization');
  const environment = c.env?.ENVIRONMENT;
  const demoMode = isDemoAllowed(environment, c.env?.API_TESTING_ALLOW_DEMO_MODE);

  if (!authorization?.startsWith('Bearer ')) {
    if (demoMode) {
      c.set('userId', 'demo-user');
      c.set('userRole', 'developer');
      await next();
      return;
    }

    return c.json({ success: false, error: 'Authentication required' }, 401);
  }

  try {
    const payload = await verifyJWT(authorization.slice(7), c.env.JWT_SECRET);
    c.set('userId', String(payload.userId || payload.sub));
    c.set('userRole', String(payload.role || 'user'));
    await next();
  } catch {
    return c.json({ success: false, error: 'Invalid or expired token' }, 401);
  }
});

const replaceVariables = (value: string, variables: Record<string, string>) =>
  Object.entries(variables).reduce(
    (next, [key, variableValue]) => next.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'), variableValue),
    value,
  );

const normalizeMethod = (method?: string): ApiMethod => {
  const upper = (method || 'GET').toUpperCase();
  if (['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'].includes(upper)) {
    return upper as ApiMethod;
  }
  return 'GET';
};

const normalizeHeaders = (headers?: unknown) => {
  if (!headers || typeof headers !== 'object' || Array.isArray(headers)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(headers as Record<string, unknown>).map(([key, value]) => [key, String(value)]),
  );
};

const resolveEnvironmentVariables = async (c: Context<Env>, environmentId?: string) => {
  if (hasDb(c)) {
    try {
      const row = environmentId
        ? await c.env.DB!.prepare('SELECT * FROM api_testing_environments WHERE id = ? AND user_id = ?')
            .bind(environmentId, c.get('userId'))
            .first<EnvironmentRow>()
        : await c.env.DB!.prepare(
            'SELECT * FROM api_testing_environments WHERE user_id = ? AND is_active = 1 ORDER BY updated_at DESC LIMIT 1',
          )
            .bind(c.get('userId'))
            .first<EnvironmentRow>();
      return row ? mapEnvironmentRow(row).variables : {};
    } catch (error) {
      if (shouldRethrowStorageError(c)) {
        throw error;
      }
    }
  }

  if (environmentId && environments.has(environmentId)) {
    return environments.get(environmentId)?.variables ?? {};
  }

  const active = [...environments.values()].find((environment) => environment.isActive);
  return active?.variables ?? {};
};

const applyAuth = (url: URL, headers: Headers, auth?: AuthConfig) => {
  if (!auth || !auth.type || auth.type === 'none') {
    return;
  }

  if (auth.type === 'bearer' && auth.token) {
    headers.set('Authorization', `Bearer ${auth.token}`);
  }

  if (auth.type === 'basic' && auth.username && auth.password) {
    headers.set('Authorization', `Basic ${btoa(`${auth.username}:${auth.password}`)}`);
  }

  if (auth.type === 'apiKey' && auth.apiKey) {
    const keyName = auth.apiKeyName || 'X-API-Key';
    if (auth.apiKeyLocation === 'query') {
      url.searchParams.set(keyName, auth.apiKey);
    } else {
      headers.set(keyName, auth.apiKey);
    }
  }
};

const isPrivateIPv4 = (hostname: string) => {
  const match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return false;

  const octets = match.slice(1).map(Number);
  if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return false;

  const [a, b] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
};

const isUnsafeHostname = (hostname: string) => {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return (
    normalized === 'localhost' ||
    normalized === 'metadata.google.internal' ||
    normalized.endsWith('.localhost') ||
    normalized.endsWith('.local') ||
    normalized.endsWith('.internal') ||
    normalized === '::1' ||
    normalized.startsWith('fe80:') ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    isPrivateIPv4(normalized)
  );
};

const validateTargetUrl = (target: URL) => {
  if (!['http:', 'https:'].includes(target.protocol)) {
    return 'Only HTTP and HTTPS requests are supported';
  }

  if (isUnsafeHostname(target.hostname)) {
    return 'Requests to private, local, link-local, or internal hosts are blocked';
  }

  return null;
};

const buildRequestInit = (method: ApiMethod, headers: Headers, body: unknown): RequestInit => {
  const init: RequestInit = { method, headers, redirect: 'manual', signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) };
  if (!['GET', 'HEAD'].includes(method) && body !== undefined) {
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
  }
  return init;
};

const fetchWithGuards = async (target: URL, init: RequestInit, redirectsRemaining = MAX_REDIRECTS): Promise<Response> => {
  const unsafeReason = validateTargetUrl(target);
  if (unsafeReason) throw new Error(unsafeReason);

  const response = await fetch(target.toString(), init);
  if ([301, 302, 303, 307, 308].includes(response.status)) {
    if (redirectsRemaining <= 0) throw new Error('Too many redirects');
    const location = response.headers.get('location');
    if (!location) return response;
    const redirected = new URL(location, target);
    const redirectedReason = validateTargetUrl(redirected);
    if (redirectedReason) throw new Error(`Blocked unsafe redirect: ${redirectedReason}`);
    return fetchWithGuards(redirected, init, redirectsRemaining - 1);
  }

  return response;
};

const getDbRequestsForCollection = async (db: D1Database, collectionId: string) => {
  const result = await db
    .prepare('SELECT * FROM api_testing_requests WHERE collection_id = ? ORDER BY sort_order ASC, created_at ASC')
    .bind(collectionId)
    .all<RequestRow>();
  return (result.results || []).map(mapRequestRow);
};

const getDbCollection = async (db: D1Database, collectionId: string, userId: string) => {
  const row = await db
    .prepare('SELECT * FROM api_testing_collections WHERE id = ? AND user_id = ?')
    .bind(collectionId, userId)
    .first<CollectionRow>();
  if (!row) return null;
  return mapCollectionRow(row, await getDbRequestsForCollection(db, collectionId));
};

route.get('/collections', async (c) => {
  if (hasDb(c)) {
    try {
      const projectId = c.req.query('projectId');
      const userId = c.get('userId');
      const statement = projectId
        ? c.env.DB!.prepare(
            'SELECT * FROM api_testing_collections WHERE user_id = ? AND project_id = ? ORDER BY created_at DESC',
          ).bind(userId, projectId)
        : c.env.DB!.prepare('SELECT * FROM api_testing_collections WHERE user_id = ? ORDER BY created_at DESC').bind(userId);
      const result = await statement.all<CollectionRow>();
      const data = await Promise.all((result.results || []).map(async (row) => {
        const requests = await getDbRequestsForCollection(c.env.DB!, row.id);
        return {
          ...mapCollectionRow(row, requests),
          requestCount: requests.length,
        };
      }));
      return c.json(ok(data));
    } catch (error) {
      if (shouldRethrowStorageError(c)) {
        console.error('API Studio collection list failed:', error);
        return c.json({ success: false, error: 'Failed to list collections' }, 500);
      }
    }
  }

  if (isDemoAllowed(c.env?.ENVIRONMENT)) ensureSeedData();
  const projectId = c.req.query('projectId');
  const userId = c.get('userId');
  const isProduction = isProductionEnv(c.env?.ENVIRONMENT);
  const data = [...collections.values()]
    .filter((collection) => !isProduction || collection.id !== demoCollectionId)
    .filter((collection) => collection.userId === userId)
    .filter((collection) => !projectId || collection.projectId === projectId)
    .map((collection) => ({
      ...collection,
      requestCount: collection.requests.length,
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return c.json(ok(data));
});

route.post('/collections', async (c) => {
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}));
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) {
    return c.json({ success: false, error: 'Collection name is required' }, 400);
  }

  const timestamp = now();
  const epoch = epochNow();
  const collection: ApiCollectionRecord = {
    id: makeId('api_coll'),
    userId: c.get('userId'),
    projectId: typeof body.projectId === 'string' && body.projectId ? body.projectId : 'demo',
    name,
    description: typeof body.description === 'string' ? body.description : undefined,
    variables: normalizeHeaders(body.variables),
    tags: Array.isArray(body.tags) ? body.tags.map(String) : [],
    requests: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  if (hasDb(c)) {
    try {
      await c.env.DB!.prepare(
        `INSERT INTO api_testing_collections
          (id, user_id, project_id, name, description, variables, tags, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          collection.id,
          collection.userId,
          collection.projectId,
          collection.name,
          collection.description ?? null,
          stringifyJson(collection.variables),
          stringifyJson(collection.tags),
          epoch,
          epoch,
        )
        .run();
      return c.json(ok(collection, 'Collection created'), 201);
    } catch (error) {
      if (shouldRethrowStorageError(c)) {
        console.error('API Studio collection create failed:', error);
        return c.json({ success: false, error: 'Failed to create collection' }, 500);
      }
    }
  }

  collections.set(collection.id, collection);
  return c.json(ok(collection, 'Collection created'), 201);
});

route.get('/collections/:id', async (c) => {
  if (hasDb(c)) {
    try {
      const collection = await getDbCollection(c.env.DB!, c.req.param('id'), c.get('userId'));
      if (!collection) {
        return c.json({ success: false, error: 'Collection not found' }, 404);
      }
      return c.json(ok(collection));
    } catch (error) {
      if (shouldRethrowStorageError(c)) {
        console.error('API Studio collection get failed:', error);
        return c.json({ success: false, error: 'Failed to get collection' }, 500);
      }
    }
  }

  if (isDemoAllowed(c.env?.ENVIRONMENT)) ensureSeedData();
  const collection = collections.get(c.req.param('id'));
  if (
    !collection ||
    collection.userId !== c.get('userId') ||
    (isProductionEnv(c.env?.ENVIRONMENT) && collection.id === demoCollectionId)
  ) {
    return c.json({ success: false, error: 'Collection not found' }, 404);
  }
  return c.json(ok(collection));
});

route.delete('/collections/:id', async (c) => {
  if (hasDb(c)) {
    try {
      const existing = await c.env.DB!.prepare('SELECT id FROM api_testing_collections WHERE id = ? AND user_id = ?')
        .bind(c.req.param('id'), c.get('userId'))
        .first<{ id: string }>();
      if (!existing) {
        return c.json({ success: false, error: 'Collection not found' }, 404);
      }
      await c.env.DB!.prepare('DELETE FROM api_testing_collections WHERE id = ? AND user_id = ?')
        .bind(c.req.param('id'), c.get('userId'))
        .run();
      return c.json({ success: true, message: 'Collection deleted', timestamp: now() });
    } catch (error) {
      if (shouldRethrowStorageError(c)) {
        console.error('API Studio collection delete failed:', error);
        return c.json({ success: false, error: 'Failed to delete collection' }, 500);
      }
    }
  }

  const collection = collections.get(c.req.param('id'));
  if (!collection || collection.userId !== c.get('userId')) {
    return c.json({ success: false, error: 'Collection not found' }, 404);
  }
  collections.delete(collection.id);
  return c.json({ success: true, message: 'Collection deleted', timestamp: now() });
});

route.post('/collections/:id/requests', async (c) => {
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}));

  if (hasDb(c)) {
    try {
      const collection = await c.env.DB!.prepare('SELECT id FROM api_testing_collections WHERE id = ? AND user_id = ?')
        .bind(c.req.param('id'), c.get('userId'))
        .first<{ id: string }>();
      if (!collection) {
        return c.json({ success: false, error: 'Collection not found' }, 404);
      }

      const name = typeof body.name === 'string' ? body.name.trim() : '';
      const url = typeof body.url === 'string' ? body.url.trim() : '';
      if (!name || !url) {
        return c.json({ success: false, error: 'Request name and URL are required' }, 400);
      }

      const count = await c.env.DB!.prepare('SELECT COUNT(*) AS count FROM api_testing_requests WHERE collection_id = ?')
        .bind(c.req.param('id'))
        .first<{ count: number }>();
      const epoch = epochNow();
      const request: ApiRequestRecord = {
        id: makeId('api_req'),
        name,
        method: normalizeMethod(String(body.method || 'GET')),
        url,
        headers: normalizeHeaders(body.headers),
        body: body.body,
        bodyType: String(body.bodyType || 'json') as ApiRequestRecord['bodyType'],
        auth: body.auth && typeof body.auth === 'object' ? (body.auth as AuthConfig) : undefined,
        description: typeof body.description === 'string' ? body.description : undefined,
        preRequestScript: typeof body.preRequestScript === 'string' ? body.preRequestScript : undefined,
        testScript: typeof body.testScript === 'string' ? body.testScript : undefined,
        sortOrder: Number(count?.count || 0) + 1,
        createdAt: toIso(epoch),
        updatedAt: toIso(epoch),
      };

      await c.env.DB!.prepare(
        `INSERT INTO api_testing_requests
          (id, collection_id, user_id, name, description, method, url, headers, body, body_type, auth, pre_request_script, test_script, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          request.id,
          c.req.param('id'),
          c.get('userId'),
          request.name,
          request.description ?? null,
          request.method,
          request.url,
          stringifyJson(request.headers),
          request.body === undefined ? null : stringifyJson(request.body),
          request.bodyType,
          request.auth ? stringifyJson(request.auth) : null,
          request.preRequestScript ?? null,
          request.testScript ?? null,
          request.sortOrder,
          epoch,
          epoch,
        )
        .run();
      return c.json(ok(request, 'Request added'), 201);
    } catch (error) {
      if (shouldRethrowStorageError(c)) {
        console.error('API Studio request create failed:', error);
        return c.json({ success: false, error: 'Failed to add request' }, 500);
      }
    }
  }

  const collection = collections.get(c.req.param('id'));
  if (!collection || collection.userId !== c.get('userId')) {
    return c.json({ success: false, error: 'Collection not found' }, 404);
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const url = typeof body.url === 'string' ? body.url.trim() : '';
  if (!name || !url) {
    return c.json({ success: false, error: 'Request name and URL are required' }, 400);
  }

  const timestamp = now();
  const request: ApiRequestRecord = {
    id: makeId('api_req'),
    name,
    method: normalizeMethod(String(body.method || 'GET')),
    url,
    headers: normalizeHeaders(body.headers),
    body: body.body,
    bodyType: String(body.bodyType || 'json') as ApiRequestRecord['bodyType'],
    auth: body.auth && typeof body.auth === 'object' ? (body.auth as AuthConfig) : undefined,
    description: typeof body.description === 'string' ? body.description : undefined,
    preRequestScript: typeof body.preRequestScript === 'string' ? body.preRequestScript : undefined,
    testScript: typeof body.testScript === 'string' ? body.testScript : undefined,
    sortOrder: collection.requests.length + 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  collection.requests.push(request);
  collection.updatedAt = timestamp;
  return c.json(ok(request, 'Request added'), 201);
});

route.post('/execute', async (c) => {
  if (isExecutionRateLimited(c.get('userId'))) {
    return c.json({ success: false, error: 'Rate limit exceeded. Try again in one minute.' }, 429);
  }

  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}));
  const method = normalizeMethod(String(body.method || 'GET'));
  const inputUrl = typeof body.url === 'string' ? body.url.trim() : '';
  if (!inputUrl) {
    return c.json({ success: false, error: 'URL is required' }, 400);
  }

  const variables = await resolveEnvironmentVariables(c, typeof body.environmentId === 'string' ? body.environmentId : undefined);
  const resolvedUrl = replaceVariables(inputUrl, variables);
  let target: URL;

  try {
    target = new URL(resolvedUrl);
  } catch {
    return c.json({ success: false, error: 'URL must be absolute and include http:// or https://' }, 400);
  }

  if (!['http:', 'https:'].includes(target.protocol)) {
    return c.json({ success: false, error: 'Only HTTP and HTTPS requests are supported' }, 400);
  }

  const unsafeReason = validateTargetUrl(target);
  if (unsafeReason) {
    return c.json({ success: false, error: unsafeReason }, 400);
  }

  const headers = new Headers(normalizeHeaders(body.headers));
  if (!headers.has('Content-Type') && method !== 'GET' && method !== 'HEAD') {
    headers.set('Content-Type', 'application/json');
  }
  applyAuth(target, headers, body.auth && typeof body.auth === 'object' ? (body.auth as AuthConfig) : undefined);

  const init = buildRequestInit(method, headers, body.body);

  const startedAt = Date.now();
  let responseBody: unknown = null;
  let status = 0;
  let statusText = 'Network Error';
  const responseHeaders: Record<string, string> = {};

  try {
    const response = await fetchWithGuards(target, init);
    status = response.status;
    statusText = response.statusText;
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > MAX_RESPONSE_BYTES) {
      throw new Error(`Response exceeds ${MAX_RESPONSE_BYTES} byte limit`);
    }

    const rawText = await response.text();
    const text = rawText.length > MAX_RESPONSE_BYTES ? rawText.slice(0, MAX_RESPONSE_BYTES) : rawText;
    try {
      responseBody = text ? JSON.parse(text) : null;
    } catch {
      responseBody = text;
    }
  } catch (error) {
    responseBody = { error: error instanceof Error ? error.message : 'Request failed' };
  }

  const responseTime = Date.now() - startedAt;
  const responseSize = JSON.stringify(responseBody ?? '').length;
  const record: ApiHistoryRecord = {
    id: makeId('api_hist'),
    userId: c.get('userId'),
    requestId: typeof body.requestId === 'string' ? body.requestId : undefined,
    collectionId: typeof body.collectionId === 'string' ? body.collectionId : undefined,
    method,
    url: target.toString(),
    status,
    statusText,
    responseTime,
    responseSize,
    headers: responseHeaders,
    body: responseBody,
    timestamp: now(),
  };

  history.unshift(record);
  history.splice(100);

  if (hasDb(c)) {
    try {
      await c.env.DB!.prepare(
        `INSERT INTO api_testing_history
          (id, request_id, collection_id, user_id, method, url, response_status, response_status_text, request_headers, request_body, response_headers, response_body, response_time, response_size, executed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          record.id,
          record.requestId ?? null,
          record.collectionId ?? null,
          record.userId,
          record.method,
          record.url,
          record.status,
          record.statusText,
          stringifyJson(normalizeHeaders(body.headers)),
          body.body === undefined ? null : stringifyJson(body.body),
          stringifyJson(record.headers),
          stringifyJson(record.body),
          record.responseTime,
          record.responseSize,
          epochNow(),
        )
        .run();
    } catch (error) {
      if (shouldRethrowStorageError(c)) {
        console.error('API Studio history insert failed:', error);
      }
    }
  }

  console.info('api_testing_execute_audit', {
    userId: record.userId,
    requestId: record.requestId,
    collectionId: record.collectionId,
    method: record.method,
    url: record.url,
    status: record.status,
    responseTime: record.responseTime,
  });

  return c.json(ok({
    status,
    statusText,
    headers: responseHeaders,
    body: responseBody,
    responseTime,
    responseSize,
  }));
});

route.get('/history', async (c) => {
  if (hasDb(c)) {
    try {
      const limit = Number(c.req.query('limit') || 50);
      const result = await c.env.DB!.prepare(
        'SELECT * FROM api_testing_history WHERE user_id = ? ORDER BY executed_at DESC LIMIT ?',
      )
        .bind(c.get('userId'), Number.isFinite(limit) ? Math.max(1, limit) : 50)
        .all<HistoryRow>();
      return c.json(ok((result.results || []).map(mapHistoryRow)));
    } catch (error) {
      if (shouldRethrowStorageError(c)) {
        console.error('API Studio history list failed:', error);
        return c.json({ success: false, error: 'Failed to list history' }, 500);
      }
    }
  }

  const limit = Number(c.req.query('limit') || 50);
  const userId = c.get('userId');
  const scopedHistory = history.filter((record) => record.userId === userId);
  return c.json(ok(scopedHistory.slice(0, Number.isFinite(limit) ? Math.max(1, limit) : 50)));
});

route.get('/environments', async (c) => {
  if (hasDb(c)) {
    try {
      const projectId = c.req.query('projectId');
      const statement = projectId
        ? c.env.DB!.prepare(
            'SELECT * FROM api_testing_environments WHERE user_id = ? AND project_id = ? ORDER BY created_at DESC',
          ).bind(c.get('userId'), projectId)
        : c.env.DB!.prepare('SELECT * FROM api_testing_environments WHERE user_id = ? ORDER BY created_at DESC')
            .bind(c.get('userId'));
      const result = await statement.all<EnvironmentRow>();
      return c.json(ok((result.results || []).map(mapEnvironmentRow)));
    } catch (error) {
      if (shouldRethrowStorageError(c)) {
        console.error('API Studio environment list failed:', error);
        return c.json({ success: false, error: 'Failed to list environments' }, 500);
      }
    }
  }

  if (isDemoAllowed(c.env?.ENVIRONMENT)) ensureSeedData();
  const projectId = c.req.query('projectId');
  const userId = c.get('userId');
  const isProduction = isProductionEnv(c.env?.ENVIRONMENT);
  const data = [...environments.values()]
    .filter((environment) => !isProduction || environment.id !== 'api_env_local')
    .filter((environment) => environment.userId === userId)
    .filter((environment) => !projectId || environment.projectId === projectId);
  return c.json(ok(data));
});

route.post('/environments', async (c) => {
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}));
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) {
    return c.json({ success: false, error: 'Environment name is required' }, 400);
  }

  const timestamp = now();
  const epoch = epochNow();
  const isActive = Boolean(body.isActive);

  if (hasDb(c)) {
    try {
      if (isActive) {
        await c.env.DB!.prepare('UPDATE api_testing_environments SET is_active = 0, updated_at = ? WHERE user_id = ?')
          .bind(epoch, c.get('userId'))
          .run();
      }

      const environment: ApiEnvironmentRecord = {
        id: makeId('api_env'),
        userId: c.get('userId'),
        projectId: typeof body.projectId === 'string' && body.projectId ? body.projectId : 'default',
        name,
        variables: normalizeHeaders(body.variables),
        isActive,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      await c.env.DB!.prepare(
        `INSERT INTO api_testing_environments
          (id, user_id, project_id, name, variables, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          environment.id,
          environment.userId,
          environment.projectId,
          environment.name,
          stringifyJson(environment.variables),
          environment.isActive ? 1 : 0,
          epoch,
          epoch,
        )
        .run();
      return c.json(ok(environment, 'Environment created'), 201);
    } catch (error) {
      if (shouldRethrowStorageError(c)) {
        console.error('API Studio environment create failed:', error);
        return c.json({ success: false, error: 'Failed to create environment' }, 500);
      }
    }
  }

  if (isActive) {
    for (const environment of environments.values()) {
      environment.isActive = false;
    }
  }

  const environment: ApiEnvironmentRecord = {
    id: makeId('api_env'),
    userId: c.get('userId'),
    projectId: typeof body.projectId === 'string' && body.projectId ? body.projectId : 'demo',
    name,
    variables: normalizeHeaders(body.variables),
    isActive,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  environments.set(environment.id, environment);
  return c.json(ok(environment, 'Environment created'), 201);
});

route.post('/import/postman', async (c) => {
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}));
  const collection = body.collection as Record<string, unknown> | undefined;
  const info = collection?.info as Record<string, unknown> | undefined;
  const items = Array.isArray(collection?.item) ? collection.item : [];
  const timestamp = now();
  const imported: ApiCollectionRecord = {
    id: makeId('api_coll'),
    userId: c.get('userId'),
    projectId: typeof body.projectId === 'string' && body.projectId ? body.projectId : 'demo',
    name: typeof info?.name === 'string' ? info.name : 'Imported Postman Collection',
    description: typeof collection?.description === 'string' ? collection.description : undefined,
    variables: {},
    tags: ['postman-import'],
    createdAt: timestamp,
    updatedAt: timestamp,
    requests: items.map((item, index) => {
      const row = item as Record<string, unknown>;
      const request = row.request as Record<string, unknown> | undefined;
      const url = request?.url;
      return {
        id: makeId('api_req'),
        name: typeof row.name === 'string' ? row.name : `Request ${index + 1}`,
        method: normalizeMethod(String(request?.method || 'GET')),
        url: typeof url === 'string' ? url : JSON.stringify(url ?? ''),
        headers: {},
        bodyType: 'json',
        sortOrder: index + 1,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
    }),
  };

  if (hasDb(c)) {
    try {
      const epoch = epochNow();
      await c.env.DB!.prepare(
        `INSERT INTO api_testing_collections
          (id, user_id, project_id, name, description, variables, tags, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          imported.id,
          imported.userId,
          imported.projectId,
          imported.name,
          imported.description ?? null,
          stringifyJson(imported.variables),
          stringifyJson(imported.tags),
          epoch,
          epoch,
        )
        .run();

      for (const request of imported.requests) {
        await c.env.DB!.prepare(
          `INSERT INTO api_testing_requests
            (id, collection_id, user_id, name, description, method, url, headers, body, body_type, auth, pre_request_script, test_script, sort_order, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
          .bind(
            request.id,
            imported.id,
            imported.userId,
            request.name,
            request.description ?? null,
            request.method,
            request.url,
            stringifyJson(request.headers),
            request.body === undefined ? null : stringifyJson(request.body),
            request.bodyType,
            request.auth ? stringifyJson(request.auth) : null,
            request.preRequestScript ?? null,
            request.testScript ?? null,
            request.sortOrder,
            epoch,
            epoch,
          )
          .run();
      }

      return c.json(ok(imported, 'Postman collection imported'), 201);
    } catch (error) {
      if (shouldRethrowStorageError(c)) {
        console.error('API Studio Postman import failed:', error);
        return c.json({ success: false, error: 'Failed to import Postman collection' }, 500);
      }
    }
  }

  collections.set(imported.id, imported);
  return c.json(ok(imported, 'Postman collection imported'), 201);
});

route.get('/export/postman/:id', async (c) => {
  if (hasDb(c)) {
    try {
      const collection = await getDbCollection(c.env.DB!, c.req.param('id'), c.get('userId'));
      if (!collection) {
        return c.json({ success: false, error: 'Collection not found' }, 404);
      }
      return c.json({
        info: {
          name: collection.name,
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        item: collection.requests.map((request) => ({
          name: request.name,
          request: {
            method: request.method,
            header: Object.entries(request.headers).map(([key, value]) => ({ key, value })),
            url: request.url,
            body: request.body ? { mode: request.bodyType, raw: JSON.stringify(request.body, null, 2) } : undefined,
          },
        })),
      });
    } catch (error) {
      if (shouldRethrowStorageError(c)) {
        console.error('API Studio Postman export failed:', error);
        return c.json({ success: false, error: 'Failed to export Postman collection' }, 500);
      }
    }
  }

  const collection = collections.get(c.req.param('id'));
  if (!collection || collection.userId !== c.get('userId')) {
    return c.json({ success: false, error: 'Collection not found' }, 404);
  }

  return c.json({
    info: {
      name: collection.name,
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    item: collection.requests.map((request) => ({
      name: request.name,
      request: {
        method: request.method,
        header: Object.entries(request.headers).map(([key, value]) => ({ key, value })),
        url: request.url,
        body: request.body ? { mode: request.bodyType, raw: JSON.stringify(request.body, null, 2) } : undefined,
      },
    })),
  });
});

export default route;
