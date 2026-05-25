import { Router } from 'express';
import { validate } from '../middleware/validator';
import { NLQuerySchema } from '../types';
import * as nlpSvc from '../services/nlpService';
import type { APIResponse, NLQueryResult } from '../types';
import { z } from 'zod';

const router = Router();

// Natural language to SQL
router.post('/generate-sql', validate(NLQuerySchema), async (req, res) => {
  const data = await nlpSvc.convertNLToSQL(req.body);
  const body: APIResponse<NLQueryResult> = { success: true, data };
  res.json(body);
});

// Optimize existing SQL
const OptimizeSchema = z.object({
  connectionId: z.string().uuid(),
  sql: z.string().min(1).max(10000),
});

router.post('/optimize', validate(OptimizeSchema), async (req, res) => {
  const data = await nlpSvc.optimizeSQL(req.body.connectionId, req.body.sql);
  res.json({ success: true, data });
});

// Explain SQL
const ExplainSchema = z.object({ sql: z.string().min(1).max(10000) });

router.post('/explain', validate(ExplainSchema), async (req, res) => {
  const explanation = await nlpSvc.explainSQL(req.body.sql);
  res.json({ success: true, data: { explanation } });
});

// Frontend-compatible NLP query (QueryLens format)
const FrontendNLPSchema = z.object({
  question: z.string().min(1).max(2000),
  schema: z.string().optional(),
  databaseId: z.string().optional(),
});

router.post('/query', validate(FrontendNLPSchema), async (req, res) => {
  const { question, schema: schemaCtx, databaseId } = req.body;
  const connectionId = databaseId;
  const result = connectionId
    ? await nlpSvc.convertNLToSQL({ connectionId, prompt: question, execute: false })
    : await nlpSvc.convertNLToSQLWithContext(question, schemaCtx || '');
  res.json({
    sql: result.sql,
    confidence: 0.85,
    explanation: result.explanation,
  });
});

// AI provider status
router.get('/status', async (_req, res) => {
  const data = await nlpSvc.getAIStatus();
  res.json({ success: true, data });
});

// Health check (frontend QueryLens compat)
router.get('/health', async (_req, res) => {
  const status = await nlpSvc.getAIStatus();
  res.json({ status: status.providers.length > 0 ? 'healthy' : 'no_providers' });
});

export default router;
