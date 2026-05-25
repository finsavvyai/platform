import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticateUser } from '../../middleware/auth.js';
import { logger } from '../../utils/logger.js';
import { browserMatrixEngine } from './BrowserMatrixEngine.js';
import { DevicePresets } from './DevicePresets.js';
import type { MatrixRequest } from './types.js';

export const browserMatrixRouter = Router();
browserMatrixRouter.use(authenticateUser);

const browserConfigSchema = z.object({
  type: z.enum(['chromium', 'firefox', 'webkit']),
  version: z.string().optional(),
  viewport: z
    .object({
      width: z.number().int().positive(),
      height: z.number().int().positive(),
    })
    .optional(),
});

const matrixRequestSchema = z.object({
  testId: z.string().uuid(),
  projectId: z.string().uuid(),
  browsers: z.array(browserConfigSchema).default([{ type: 'chromium' }]),
  devicePresets: z.array(z.string()).optional(),
  parallel: z.boolean().default(true),
  maxConcurrency: z.number().int().min(1).max(10).optional(),
  timeoutMs: z.number().int().positive().optional(),
});

browserMatrixRouter.post('/run', async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });

    const validatedData = matrixRequestSchema.parse(req.body);

    // Create matrix entries
    const matrix = browserMatrixEngine.createMatrix({
      ...validatedData,
      userId: req.user.userId,
    } as MatrixRequest);

    if (matrix.length === 0) {
      return res.status(400).json({ error: 'No matrix entries created' });
    }

    // Execute matrix
    logger.info(`Executing matrix with ${matrix.length} entries`, {
      testId: validatedData.testId,
      userId: req.user.userId,
    });

    const results = await browserMatrixEngine.executeMatrix(matrix);
    const summary = browserMatrixEngine.getMatrixSummary(results);

    res.status(201).json(summary);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    logger.error('Execute browser matrix error:', error);
    res.status(500).json({ error: 'Failed to execute matrix' });
  }
});

browserMatrixRouter.get('/results/:id', async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });

    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'id required' });

    // In production, this would fetch from database
    // For now, return a sample result
    res.json({
      id,
      message: 'Matrix results would be fetched from database',
      status: 'completed',
    });
  } catch (error) {
    logger.error('Get matrix results error:', error);
    res.status(500).json({ error: 'Failed to get results' });
  }
});

browserMatrixRouter.get('/devices', (req: Request, res: Response) => {
  try {
    const presets = DevicePresets.getAllPresets();
    const devices = Object.entries(presets).map(([key, config]) => ({
      id: key,
      name: config.name,
      type: config.isMobile ? 'mobile' : 'desktop',
      viewport: config.viewport,
      isMobile: config.isMobile,
      hasTouch: config.hasTouch,
    }));

    res.json({ devices, total: devices.length });
  } catch (error) {
    logger.error('Get device presets error:', error);
    res.status(500).json({ error: 'Failed to get device presets' });
  }
});

browserMatrixRouter.get('/browsers', (req: Request, res: Response) => {
  try {
    const browsers = [
      {
        type: 'chromium',
        name: 'Google Chrome',
        versions: ['latest', '119', '118', '117'],
      },
      {
        type: 'firefox',
        name: 'Mozilla Firefox',
        versions: ['latest', '120', '119', '118'],
      },
      {
        type: 'webkit',
        name: 'Safari',
        versions: ['latest', '17', '16', '15'],
      },
    ];

    res.json({ browsers });
  } catch (error) {
    logger.error('Get supported browsers error:', error);
    res.status(500).json({ error: 'Failed to get browser list' });
  }
});
