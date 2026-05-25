import { Router } from 'express';
import { getActiveAdapterCount } from '../adapters/factory';
import { getAIStatus } from '../services/nlpService';

const router = Router();

router.get('/health', async (_req, res) => {
  const ai = await getAIStatus().catch(() => ({ providers: [] }));

  res.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      activeConnections: getActiveAdapterCount(),
      aiProviders: ai.providers,
    },
  });
});

export default router;
