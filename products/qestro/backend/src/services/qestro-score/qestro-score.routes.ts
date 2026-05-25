/**
 * Qestro Score Routes
 * Endpoints for score calculation, badges, and analytics
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { scoreCalculator } from './ScoreCalculator.js';
import { badgeGenerator } from './BadgeGenerator.js';
import { authenticateUser } from '../../middleware/auth.js';
import { logger } from '../../utils/logger.js';

export const qestroScoreRouter = Router();

const calcSchema = z.object({
  testCoveragePercent: z.number().min(0).max(100).optional(),
  testPassRate: z.number().min(0).max(100).optional(),
  flakinessRate: z.number().min(0).max(100).optional(),
  meanTimeToFix: z.number().min(0).optional(),
  pipelineReliability: z.number().min(0).max(1).optional(),
  deployFrequency: z.number().min(0).optional(),
  lintScore: z.number().min(0).max(100).optional(),
  typeScoreCoverage: z.number().min(0).max(100).optional(),
  codeComplexity: z.number().min(0).optional(),
  avgTestTime: z.number().min(0).optional(),
  p95TestTime: z.number().min(0).optional(),
});

qestroScoreRouter.get('/api/score/:projectId', authenticateUser, async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    const score = await scoreCalculator.getLatestScore(req.params.projectId);
    if (!score) return res.json(await scoreCalculator.calculateScoreFromDefaults(req.params.projectId));
    res.json(score);
  } catch (error) {
    logger.error('Get score error:', error);
    res.status(500).json({ error: 'Failed to fetch score' });
  }
});

qestroScoreRouter.post('/api/score/:projectId/calculate', authenticateUser, async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    const metrics = calcSchema.parse(req.body);
    const score = await scoreCalculator.calculateScoreFromDefaults(req.params.projectId, metrics);
    res.json(score);
  } catch (error) {
    logger.error('Calculate score error:', error);
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid metrics', details: error.errors });
    res.status(500).json({ error: 'Failed to calculate score' });
  }
});

qestroScoreRouter.get('/api/score/:projectId/badge.svg', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { style, includeGrade } = req.query;
    let score = await scoreCalculator.getLatestScore(projectId);
    if (!score) score = await scoreCalculator.calculateScoreFromDefaults(projectId);
    const svg = badgeGenerator.generateBadge(score, {
      format: 'svg',
      style: (style as any) || 'flat',
      includeGrade: includeGrade !== 'false',
    });
    res.type('image/svg+xml').send(svg);
  } catch (error) {
    logger.error('Generate badge error:', error);
    res.status(500).json({ error: 'Failed to generate badge' });
  }
});

qestroScoreRouter.get('/api/score/:projectId/badge.json', authenticateUser, async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    let score = await scoreCalculator.getLatestScore(req.params.projectId);
    if (!score) score = await scoreCalculator.calculateScoreFromDefaults(req.params.projectId);
    res.json(badgeGenerator.generateMetadata(score));
  } catch (error) {
    logger.error('Get badge metadata error:', error);
    res.status(500).json({ error: 'Failed to fetch badge metadata' });
  }
});

qestroScoreRouter.get('/api/score/:projectId/history', authenticateUser, async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    const { projectId } = req.params;
    const { days = '30' } = req.query;
    const history = await scoreCalculator.getHistory(projectId, Number(days));
    res.json({ history, count: history.length, days: Number(days) });
  } catch (error) {
    logger.error('Get history error:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

qestroScoreRouter.get('/api/score/:projectId/embed', authenticateUser, async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    const { projectId } = req.params;
    const { format = 'html', baseUrl } = req.query;
    let score = await scoreCalculator.getLatestScore(projectId);
    if (!score) score = await scoreCalculator.calculateScoreFromDefaults(projectId);
    if (format === 'markdown') {
      return res.json({ code: badgeGenerator.generateMarkdown(projectId, score, baseUrl as string), type: 'markdown' });
    }
    res.json({ code: badgeGenerator.getEmbedCode(projectId, baseUrl as string), type: 'html' });
  } catch (error) {
    logger.error('Get embed code error:', error);
    res.status(500).json({ error: 'Failed to generate embed code' });
  }
});

qestroScoreRouter.post('/api/score/:projectId/recalculate', authenticateUser, async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    const metrics = calcSchema.parse(req.body);
    const score = await scoreCalculator.calculateScoreFromDefaults(req.params.projectId, metrics);
    res.json({ score, message: 'Score recalculated successfully' });
  } catch (error) {
    logger.error('Recalculate error:', error);
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid metrics', details: error.errors });
    res.status(500).json({ error: 'Failed to recalculate score' });
  }
});

qestroScoreRouter.delete('/api/score/:projectId/history', authenticateUser, async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    await scoreCalculator.clearHistory(req.params.projectId);
    res.json({ success: true, message: 'History cleared' });
  } catch (error) {
    logger.error('Clear history error:', error);
    res.status(500).json({ error: 'Failed to clear history' });
  }
});

qestroScoreRouter.get('/api/score/:projectId/breakdown', authenticateUser, async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    let score = await scoreCalculator.getLatestScore(req.params.projectId);
    if (!score) score = await scoreCalculator.calculateScoreFromDefaults(req.params.projectId);
    res.json({ breakdown: score.breakdown, weights: score.weights });
  } catch (error) {
    logger.error('Get breakdown error:', error);
    res.status(500).json({ error: 'Failed to fetch breakdown' });
  }
});
