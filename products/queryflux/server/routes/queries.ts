import { Router } from 'express';
import { validate } from '../middleware/validator';
import { QueryExecutionSchema, SavedQuerySchema } from '../types';
import * as svc from '../services/queryService';
import type { APIResponse, QueryResult, SavedQuery } from '../types';
import { z } from 'zod';

const router = Router();

const IdParam = z.object({ id: z.string().uuid() });

// Execute a query
router.post('/execute', validate(QueryExecutionSchema), async (req, res) => {
  const data = await svc.executeQuery(req.body);
  const body: APIResponse<QueryResult> = { success: true, data };
  res.json(body);
});

// Saved queries CRUD
router.get('/', (req, res) => {
  const connectionId = req.query.connectionId as string | undefined;
  const data = svc.listSavedQueries(connectionId);
  const body: APIResponse<SavedQuery[]> = { success: true, data };
  res.json(body);
});

const CreateSavedQuery = SavedQuerySchema.omit({ id: true, createdAt: true, updatedAt: true });

router.post('/', validate(CreateSavedQuery), (req, res) => {
  const data = svc.createSavedQuery(req.body);
  const body: APIResponse<SavedQuery> = { success: true, data };
  res.status(201).json(body);
});

router.get('/:id', validate(IdParam, 'params'), (req, res) => {
  const data = svc.getSavedQuery(String(req.params.id));
  const body: APIResponse<SavedQuery> = { success: true, data };
  res.json(body);
});

router.put('/:id', validate(IdParam, 'params'), (req, res) => {
  const data = svc.updateSavedQuery(String(req.params.id), req.body);
  const body: APIResponse<SavedQuery> = { success: true, data };
  res.json(body);
});

router.delete('/:id', validate(IdParam, 'params'), (req, res) => {
  svc.deleteSavedQuery(String(req.params.id));
  res.json({ success: true, data: null, message: 'Query deleted' });
});

export default router;
