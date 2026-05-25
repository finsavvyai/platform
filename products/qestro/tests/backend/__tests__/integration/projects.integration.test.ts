import { jest } from '@jest/globals';
import { Hono } from 'hono';

import projectsRoute from '../../../../backend/src/routes/projects.route';
import { signJWT } from '../../../../backend/src/auth/jwt';

// D1 mock that satisfies drizzle-orm's internal calls
function createMockDB(rows: Record<string, unknown>[] = [], insertId = 'new-id') {
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
// For testing, append the route normally
app.route('/api/projects', projectsRoute);

describe('Projects API Integration Tests', () => {
    const JWT_SECRET = 'test-secret';
    let token: string;

    beforeAll(async () => {
        token = await signJWT({ userId: 'user-001', email: 'test@questro.io', role: 'admin' }, JWT_SECRET, 3600);
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /api/projects', () => {
        it('should list projects for the authenticated user', async () => {
            const mockProjects = [
                { id: 'proj-1', name: 'Project Alpha', ownerId: 'user-001' },
                { id: 'proj-2', name: 'Project Beta', ownerId: 'user-001' }
            ];
            const env = { DB: createMockDB(mockProjects), ENVIRONMENT: 'test', JWT_SECRET };

            const response = await app.request('/api/projects', {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            }, env);

            const body: any = await response.json();
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.length).toBe(2);
            expect(body.data[0].name).toBe('Project Alpha');
        });

        it('should return 401 without authentication', async () => {
            const env = { DB: createMockDB([]), ENVIRONMENT: 'test', JWT_SECRET };
            const response = await app.request('/api/projects', {
                method: 'GET'
            }, env);

            expect(response.status).toBe(401);
        });
    });

    describe('POST /api/projects', () => {
        it('should successfully create a new project', async () => {
            const env = { DB: createMockDB([]), ENVIRONMENT: 'test', JWT_SECRET };
            const response = await app.request('/api/projects', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name: 'New API Project' })
            }, env);

            const body: any = await response.json();
            expect(response.status).toBe(201);
            expect(body.success).toBe(true);
            expect(body.data.name).toBe('New API Project');
            expect(body.data.id).toBeDefined();
        });

        it('should fail with invalid payload', async () => {
            const env = { DB: createMockDB([]), ENVIRONMENT: 'test', JWT_SECRET };
            const response = await app.request('/api/projects', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name: '' }) // empty string invalidates min(1)
            }, env);

            expect(response.status).toBe(400); // Zod validator failure
        });
    });

    describe('GET /api/projects/:id', () => {
        it('should return a specific project', async () => {
            const project = { id: 'proj-1', name: 'Project Alpha', ownerId: 'user-001' };
            const env = { DB: createMockDB([project]), ENVIRONMENT: 'test', JWT_SECRET };

            const response = await app.request('/api/projects/proj-1', {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            }, env);

            const body: any = await response.json();
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.name).toBe('Project Alpha');
        });

        it('should return 404 for unknown project', async () => {
            const env = { DB: createMockDB([]), ENVIRONMENT: 'test', JWT_SECRET };
            const response = await app.request('/api/projects/unknown-proj', {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            }, env);

            expect(response.status).toBe(404);
        });
    });

    describe('PATCH /api/projects/:id', () => {
        it('should successfully update a project', async () => {
            const existingProject = { id: 'proj-1', name: 'Project Alpha', ownerId: 'user-001' };
            const env = { DB: createMockDB([existingProject]), ENVIRONMENT: 'test', JWT_SECRET };
            const response = await app.request('/api/projects/proj-1', {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name: 'Project Alpha V2' })
            }, env);

            const body: any = await response.json();
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.message).toBe('Project updated');
        });
    });

    describe('DELETE /api/projects/:id', () => {
        it('should successfully delete a project', async () => {
            const env = { DB: createMockDB([]), ENVIRONMENT: 'test', JWT_SECRET };
            const response = await app.request('/api/projects/proj-1', {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            }, env);

            const body: any = await response.json();
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.message).toBe('Project deleted');
        });
    });
});
