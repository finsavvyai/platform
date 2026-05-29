import { Router } from 'express';
import { validate } from '../middleware/validator';
import { z } from 'zod';
import { getSchema } from '../services/schemaService';
import { executeQuery } from '../services/queryService';
import { createAdapter } from '../adapters/factory';
import { QueryExecutionSchema, CreateConnectionSchema } from '../types';

const router = Router();

const SchemaRequest = z.object({ connectionId: z.string().uuid() });

// Schema endpoint — wraps response into frontend-expected format
router.post('/schema', validate(SchemaRequest), async (req, res) => {
  const raw = await getSchema(req.body.connectionId);
  const wrapped = {
    databases: [{
      name: raw.databaseName,
      schemas: [{ name: 'public', tables: raw.tables }],
    }],
  };
  res.json({ success: true, data: wrapped });
});

// Query execution — frontend-compatible alias
router.post('/query', validate(QueryExecutionSchema), async (req, res) => {
  const result = await executeQuery(req.body);
  const data = {
    columns: result.columns,
    rows: result.rows,
    rowCount: result.rowCount,
    executionTime: result.executionTimeMs,
  };
  res.json({ success: true, data });
});

// Connection test — frontend sends full config, not an ID
router.post('/connect', validate(CreateConnectionSchema), async (req, res) => {
  const { type, host, port, database, username, password, ssl } = req.body;
  const adapter = createAdapter(type, { host, port, database, username, password, ssl });
  const result = await adapter.testConnection();
  await adapter.disconnect().catch(() => {});
  const data = {
    id: '',
    status: result.success ? 'connected' : 'error',
    message: result.message,
    lastChecked: new Date().toISOString(),
  };
  res.json({ success: true, data });
});

export default router;
