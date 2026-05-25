import { jest } from '@jest/globals';
import { Hono } from 'hono';

import missionsRoute from '../../../../backend/src/routes/missions.route';
import { signJWT } from '../../../../backend/src/auth/jwt';

const app = new Hono<any>();
app.route('/api/missions', missionsRoute);

describe('Missions API Integration Tests', () => {
    const JWT_SECRET = 'test-secret';
    const env = { DB: {} as any, ENVIRONMENT: 'test', JWT_SECRET };
    let token: string;

    beforeAll(async () => {
        token = await signJWT({ userId: 'user-001', email: 'test@questro.io', role: 'admin' }, JWT_SECRET, 3600);
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('lists seeded missions for the authenticated user', async () => {
        const response = await app.request('/api/missions', {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` },
        }, env);

        const body: any = await response.json();
        expect(response.status).toBe(200);
        expect(body.success).toBe(true);
        expect(body.data.length).toBeGreaterThanOrEqual(2);
    });

    it('creates a mission', async () => {
        const response = await app.request('/api/missions', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                type: 'TICKET',
                input: 'Validate checkout recovery after a payment retry.',
            }),
        }, env);

        const body: any = await response.json();
        expect(response.status).toBe(201);
        expect(body.success).toBe(true);
        expect(body.data.type).toBe('TICKET');
        expect(body.data.status).toBe('ACTIVE');
    });

    it('cancels an existing mission', async () => {
        const createResponse = await app.request('/api/missions', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                type: 'SCOUT',
                input: 'https://staging.qestro.app',
            }),
        }, env);

        const created: any = await createResponse.json();
        const response = await app.request(`/api/missions/${created.data.id}/cancel`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
        }, env);

        const body: any = await response.json();
        expect(response.status).toBe(200);
        expect(body.success).toBe(true);
        expect(body.data.status).toBe('CANCELLED');
    });

    it('deletes a mission', async () => {
        const createResponse = await app.request('/api/missions', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                type: 'CONCIERGE',
                input: 'https://github.com/qestro/platform',
            }),
        }, env);

        const created: any = await createResponse.json();
        const response = await app.request(`/api/missions/${created.data.id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
        }, env);

        const body: any = await response.json();
        expect(response.status).toBe(200);
        expect(body.success).toBe(true);
    });

    it('rejects unauthenticated access', async () => {
        const response = await app.request('/api/missions', { method: 'GET' }, env);
        expect(response.status).toBe(401);
    });
});
