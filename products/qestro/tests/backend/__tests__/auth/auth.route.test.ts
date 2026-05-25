import { Hono } from 'hono';
import authRoute from '../../../../backend/src/routes/auth.route';
import { signJWT } from '../../../../backend/src/auth/jwt';
import { hashPassword } from '../../../../backend/src/auth/password';

const JWT_SECRET = 'test-secret-key';
const ENVIRONMENT = 'test';

// D1 mock that satisfies drizzle-orm's internal calls (including .raw())
function createMockDB(rows: Record<string, unknown>[] = []) {
  const rawRows = rows.map((r) => Object.values(r));
  const makeStmt = () => {
    const stmt: Record<string, unknown> = {};
    stmt.bind = (..._args: unknown[]) => stmt;
    stmt.all = async () => ({ results: rows, columns: rows[0] ? Object.keys(rows[0]) : [] });
    stmt.raw = async () => rawRows;
    stmt.run = async () => ({ success: true, meta: { changes: 1 } });
    stmt.first = async () => rows[0] ?? null;
    return stmt;
  };

  return {
    prepare: () => makeStmt(),
    exec: async () => ({ success: true }),
    batch: async (stmts: unknown[]) => (stmts as unknown[]).map(() => ({ results: rows })),
    dump: async () => new ArrayBuffer(0),
  } as unknown as D1Database;
}

function buildApp(db: D1Database) {
  const app = new Hono<{
    Bindings: { DB: D1Database; ENVIRONMENT: string; JWT_SECRET: string };
  }>();
  app.route('/auth', authRoute);
  return {
    app,
    request: (path: string, init?: RequestInit) =>
      app.request(path, init, { DB: db, ENVIRONMENT, JWT_SECRET }),
  };
}

describe('Auth route - /login', () => {
  it('should return 400 on invalid body (missing email)', async () => {
    const { request } = buildApp(createMockDB());
    const res = await request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'short1' }),
    });
    expect(res.status).toBe(400);
  });

  it('should return 400 on password too short', async () => {
    const { request } = buildApp(createMockDB());
    const res = await request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.com', password: '12345' }),
    });
    expect(res.status).toBe(400);
  });

  it('should login with demo credentials in non-production env', async () => {
    const { request } = buildApp(createMockDB());
    const res = await request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@questro.io',
        password: 'testpassword123',
      }),
    });
    expect(res.status).toBe(200);
    const json = await res.json() as { success: boolean; data: { tokens: { accessToken: string } } };
    expect(json.success).toBe(true);
    expect(json.data.tokens.accessToken).toBeDefined();
  });

  it('should return 401 for non-existent user', async () => {
    const { request } = buildApp(createMockDB([]));
    const res = await request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nobody@test.com', password: 'password123' }),
    });
    expect(res.status).toBe(401);
  });
});

describe('Auth route - /me', () => {
  it('should return 401 without Authorization header', async () => {
    const { request } = buildApp(createMockDB());
    const res = await request('/auth/me');
    expect(res.status).toBe(401);
  });

  it('should return 401 with an invalid token', async () => {
    const { request } = buildApp(createMockDB());
    const res = await request('/auth/me', {
      headers: { Authorization: 'Bearer invalid.token.here' },
    });
    expect(res.status).toBe(401);
  });

  it('should return user data with a valid token', async () => {
    const token = await signJWT(
      { userId: 'u1', email: 'test@test.com', role: 'admin' },
      JWT_SECRET,
      3600,
    );
    const mockUser = {
      id: 'u1',
      email: 'test@test.com',
      name: 'Test User',
      role: 'admin',
      subscription: 'pro',
      created_at: Date.now(),
      updated_at: Date.now(),
    };

    const { request } = buildApp(createMockDB([mockUser]));
    const res = await request('/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const json = await res.json() as { success: boolean; data: { email: string } };
    expect(json.success).toBe(true);
    expect(json.data.email).toBe('test@test.com');
  });
});

describe('Auth route - /logout', () => {
  it('should return success on logout', async () => {
    const { request } = buildApp(createMockDB());
    const res = await request('/auth/logout', { method: 'POST' });
    expect(res.status).toBe(200);
    const json = await res.json() as { success: boolean };
    expect(json.success).toBe(true);
  });
});
