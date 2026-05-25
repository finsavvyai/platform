import { jest } from '@jest/globals';
import { Hono } from 'hono';

import authRoute from '../../../../backend/src/routes/auth.route';
import { signJWT } from '../../../../backend/src/auth/jwt';

// D1 mock that satisfies drizzle-orm's internal calls
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
    } as unknown as any;
}

const app = new Hono<any>();
app.route('/api/auth', authRoute);

describe('Authentication API Integration Tests', () => {
    const JWT_SECRET = 'test-secret';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('POST /api/auth/login', () => {
        it('should login successfully with the demo account', async () => {
            const env = { DB: createMockDB(), ENVIRONMENT: 'test', JWT_SECRET };
            const response = await app.request('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: 'test@questro.io',
                    password: 'testpassword123'
                })
            }, env);

            const body: any = await response.json();
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.tokens.accessToken).toBeDefined();
        });

        it('should return 401 for invalid credentials', async () => {
            const env = { DB: createMockDB([]), ENVIRONMENT: 'production', JWT_SECRET };
            const response = await app.request('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: 'wrong@questro.io',
                    password: 'wrongpassword'
                })
            }, env);

            expect(response.status).toBe(401);
        });
    });

    describe('POST /api/auth/register', () => {
        it('should successfully register a new user', async () => {
            // Mock empty DB so "existing user" check passes
            const env = { DB: createMockDB([]), ENVIRONMENT: 'test', JWT_SECRET };
            const response = await app.request('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: 'newuser@questro.io',
                    password: 'securepassword123',
                    name: 'New User'
                })
            }, env);

            const body: any = await response.json();
            expect(response.status).toBe(201);
            expect(body.success).toBe(true);
            expect(body.data.tokens.accessToken).toBeDefined();
        });

        it('should return 409 if email already exists', async () => {
            const env = { DB: createMockDB([{ id: 'existing-id' }]), ENVIRONMENT: 'test', JWT_SECRET };
            const response = await app.request('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: 'existing@questro.io',
                    password: 'securepassword123',
                    name: 'Existing User'
                })
            }, env);

            expect(response.status).toBe(409);
        });
    });

    describe('GET /api/auth/me', () => {
        it('should return user details with a valid token', async () => {
            const token = await signJWT({ userId: 'test-id', email: 'test@questro.io', role: 'admin' }, JWT_SECRET, 3600);
            const env = { DB: createMockDB([{ id: 'test-id', email: 'test@questro.io', name: 'Test User' }]), ENVIRONMENT: 'test', JWT_SECRET };

            const response = await app.request('/api/auth/me', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }, env);

            const body: any = await response.json();
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.email).toBe('test@questro.io');
        });

        it('should return 401 without token', async () => {
            const env = { DB: createMockDB([]), ENVIRONMENT: 'test', JWT_SECRET };
            const response = await app.request('/api/auth/me', {
                method: 'GET'
            }, env);

            expect(response.status).toBe(401);
        });
    });

    describe('POST /api/auth/logout', () => {
        it('should successfully logout', async () => {
            const env = { DB: createMockDB([]), ENVIRONMENT: 'test', JWT_SECRET };
            const response = await app.request('/api/auth/logout', {
                method: 'POST'
            }, env);

            const body: any = await response.json();
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
        });
    });
});
