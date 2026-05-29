import { Router } from 'express';
import { validate } from '../middleware/validator';
import { CreateConnectionSchema } from '../types';
import * as svc from '../services/connectionService';
import type { APIResponse, ConnectionConfig, ConnectionStatus } from '../types';
import { z } from 'zod';

const router = Router();

router.get('/', (_req, res) => {
  const data = svc.listConnections();
  const body: APIResponse<ConnectionConfig[]> = { success: true, data };
  res.json(body);
});

router.post('/', validate(CreateConnectionSchema), async (req, res) => {
  const data = await svc.createConnection(req.body);
  const body: APIResponse<ConnectionConfig> = { success: true, data };
  res.status(201).json(body);
});

const IdParam = z.object({ id: z.string().uuid() });

router.get('/:id', validate(IdParam, 'params'), (req, res) => {
  const id = String(req.params.id);
  const data = svc.getConnection(id);
  const body: APIResponse<ConnectionConfig> = { success: true, data };
  res.json(body);
});

router.put('/:id', validate(IdParam, 'params'), (req, res) => {
  const id = String(req.params.id);
  const data = svc.updateConnection(id, req.body);
  const body: APIResponse<ConnectionConfig> = { success: true, data };
  res.json(body);
});

router.delete('/:id', validate(IdParam, 'params'), async (req, res) => {
  await svc.deleteConnection(String(req.params.id));
  res.json({ success: true, data: null, message: 'Connection deleted' });
});

router.post('/:id/test', validate(IdParam, 'params'), async (req, res) => {
  const data = await svc.testConnection(String(req.params.id));
  const body: APIResponse<ConnectionStatus> = { success: true, data };
  res.json(body);
});

router.post('/:id/connect', validate(IdParam, 'params'), async (req, res) => {
  await svc.connectToDatabase(String(req.params.id));
  res.json({ success: true, data: null, message: 'Connected' });
});

router.post('/:id/disconnect', validate(IdParam, 'params'), async (req, res) => {
  await svc.disconnectFromDatabase(String(req.params.id));
  res.json({ success: true, data: null, message: 'Disconnected' });
});

export default router;
