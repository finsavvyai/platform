import express from 'express';
import request from 'supertest';
import { store } from '../../storage';
import { corsMiddleware } from '../../middleware/cors';
import { errorHandler, notFoundHandler } from '../../middleware/errorHandler';
import { initializeAIProviders } from '../../services/nlpService';
import connectionRoutes from '../../routes/connections';
import queryRoutes from '../../routes/queries';
import databaseRoutes from '../../routes/database';
import healthRoutes from '../../routes/health';
import nlpRoutes from '../../routes/nlp';

// Mock fetch for AI provider health checks
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(corsMiddleware(['http://localhost:5198']));
  app.use(healthRoutes);
  const v1 = express.Router();
  v1.use('/connections', connectionRoutes);
  v1.use('/queries', queryRoutes);
  v1.use('/database', databaseRoutes);
  v1.use('/ai', nlpRoutes);
  v1.use('/nlp', nlpRoutes);
  app.use('/api/v1', v1);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

const connPayload = {
  name: 'Test PG',
  type: 'postgresql',
  host: 'localhost',
  port: 5432,
  database: 'testdb',
  username: 'user',
  password: 'pass',
  ssl: false,
};

describe('API Integration', () => {
  let app: express.Express;

  beforeAll(() => {
    initializeAIProviders({});
  });

  beforeEach(() => {
    store.clear();
    mockFetch.mockReset();
    app = createApp();
  });

  // ── Health ───────────────────────────────────────────────────

  describe('GET /health', () => {
    it('returns 200 with status ok', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('ok');
    });
  });

  // ── Connections CRUD ─────────────────────────────────────────

  describe('Connections', () => {
    it('POST /api/v1/connections creates a connection', async () => {
      const res = await request(app).post('/api/v1/connections').send(connPayload);
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.name).toBe('Test PG');
    });

    it('GET /api/v1/connections lists connections', async () => {
      await request(app).post('/api/v1/connections').send(connPayload);
      const res = await request(app).get('/api/v1/connections');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it('GET /api/v1/connections/:id returns a connection', async () => {
      const created = await request(app).post('/api/v1/connections').send(connPayload);
      const id = created.body.data.id;
      const res = await request(app).get(`/api/v1/connections/${id}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(id);
    });

    it('GET /api/v1/connections/:id returns 400 for invalid UUID', async () => {
      const res = await request(app).get('/api/v1/connections/not-a-uuid');
      expect(res.status).toBe(400);
    });

    it('PUT /api/v1/connections/:id updates a connection', async () => {
      const created = await request(app).post('/api/v1/connections').send(connPayload);
      const id = created.body.data.id;
      const res = await request(app).put(`/api/v1/connections/${id}`).send({ name: 'Updated' });
      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Updated');
    });

    it('DELETE /api/v1/connections/:id deletes a connection', async () => {
      const created = await request(app).post('/api/v1/connections').send(connPayload);
      const id = created.body.data.id;
      const res = await request(app).delete(`/api/v1/connections/${id}`);
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Connection deleted');

      const get = await request(app).get(`/api/v1/connections/${id}`);
      expect(get.status).toBe(404);
    });

    it('POST validates required fields', async () => {
      const res = await request(app).post('/api/v1/connections').send({ name: '' });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });
  });

  // ── Queries CRUD ─────────────────────────────────────────────

  describe('Queries', () => {
    let connectionId: string;

    beforeEach(async () => {
      const res = await request(app).post('/api/v1/connections').send(connPayload);
      connectionId = res.body.data.id;
    });

    it('POST /api/v1/queries creates a saved query', async () => {
      const res = await request(app).post('/api/v1/queries').send({
        name: 'All users',
        sql: 'SELECT * FROM users',
        connectionId,
      });
      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('All users');
    });

    it('GET /api/v1/queries lists saved queries', async () => {
      await request(app).post('/api/v1/queries').send({
        name: 'Q1',
        sql: 'SELECT 1',
        connectionId,
      });
      const res = await request(app).get('/api/v1/queries');
      expect(res.body.data).toHaveLength(1);
    });

    it('GET /api/v1/queries?connectionId filters queries', async () => {
      await request(app).post('/api/v1/queries').send({
        name: 'Q1',
        sql: 'SELECT 1',
        connectionId,
      });
      const res = await request(app).get(`/api/v1/queries?connectionId=${connectionId}`);
      expect(res.body.data).toHaveLength(1);
    });

    it('DELETE /api/v1/queries/:id deletes a query', async () => {
      const created = await request(app).post('/api/v1/queries').send({
        name: 'Q1',
        sql: 'SELECT 1',
        connectionId,
      });
      const id = created.body.data.id;
      const res = await request(app).delete(`/api/v1/queries/${id}`);
      expect(res.status).toBe(200);
    });
  });

  // ── AI Status ────────────────────────────────────────────────

  describe('AI NLP', () => {
    it('GET /api/v1/ai/status returns provider status', async () => {
      const res = await request(app).get('/api/v1/ai/status');
      expect(res.status).toBe(200);
      expect(res.body.data.providers).toBeDefined();
    });

    it('GET /api/v1/nlp/health returns health (compat)', async () => {
      const res = await request(app).get('/api/v1/nlp/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBeDefined();
    });

    it('POST /api/v1/nlp/query validates input', async () => {
      const res = await request(app).post('/api/v1/nlp/query').send({});
      expect(res.status).toBe(400);
    });
  });

  // ── Database compat routes ────────────────────────────────────

  describe('Database compat routes', () => {
    it('POST /api/v1/database/schema validates connectionId', async () => {
      const res = await request(app)
        .post('/api/v1/database/schema')
        .send({ connectionId: 'not-a-uuid' });
      expect(res.status).toBe(400);
    });

    it('POST /api/v1/database/query validates input', async () => {
      const res = await request(app)
        .post('/api/v1/database/query')
        .send({ connectionId: 'bad', sql: '' });
      expect(res.status).toBe(400);
    });

    it('POST /api/v1/database/connect validates config', async () => {
      const res = await request(app)
        .post('/api/v1/database/connect')
        .send({ name: '' });
      expect(res.status).toBe(400);
    });
  });

  // ── 404 ──────────────────────────────────────────────────────

  describe('404', () => {
    it('returns 404 for unknown routes', async () => {
      const res = await request(app).get('/unknown/route');
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
    });
  });
});
