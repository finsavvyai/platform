/**
 * Impact Analysis REST API Routes
 */

import { Router, Request, Response } from 'express';
import { impactAnalyzer } from './ImpactAnalyzer.js';
import { coverageMapper } from './CoverageMapper.js';
import { sendSuccess, sendError, validateParams } from './routeHelpers.js';
import type { CodeChange } from './types.js';

export const impactAnalysisRouter = Router();

impactAnalysisRouter.post('/analyze', async (req: Request, res: Response) => {
  try {
    const error = validateParams(req.body, ['projectId', 'changes']);
    if (error) return sendError(res, 400, error);

    const result = await impactAnalyzer.analyzeImpact(
      req.body.projectId as string,
      req.body.changes as CodeChange[]
    );
    sendSuccess(res, 200, { result });
  } catch (error) {
    sendError(res, 500, error);
  }
});

impactAnalysisRouter.get('/tests/:filePath(*)', async (req: Request, res: Response) => {
  try {
    const projectId = req.query.projectId as string;
    const affectedTests = await impactAnalyzer.getAffectedTests(req.params.filePath, projectId);
    sendSuccess(res, 200, {
      filePath: req.params.filePath,
      affectedTests,
      count: affectedTests.length,
    });
  } catch (error) {
    sendError(res, 500, error);
  }
});

impactAnalysisRouter.get('/graph/:projectId', async (req: Request, res: Response) => {
  try {
    const graph = await impactAnalyzer.buildDependencyGraph(req.params.projectId);
    sendSuccess(res, 200, {
      projectId: req.params.projectId,
      graph,
      stats: { nodes: Object.keys(graph.nodes).length, edges: graph.edges.length },
    });
  } catch (error) {
    sendError(res, 500, error);
  }
});

impactAnalysisRouter.post('/coverage', async (req: Request, res: Response) => {
  try {
    const error = validateParams(req.body, ['testId', 'coveredFiles']);
    if (error) return sendError(res, 400, error);

    await coverageMapper.updateCoverage(
      req.body.testId as string,
      req.body.coveredFiles as string[],
      req.body.projectId as string
    );
    sendSuccess(res, 200, {
      message: 'Coverage updated',
      testId: req.body.testId,
      filesCount: (req.body.coveredFiles as string[]).length,
    });
  } catch (error) {
    sendError(res, 500, error);
  }
});

impactAnalysisRouter.get('/coverage/:projectId', async (req: Request, res: Response) => {
  try {
    const stats = await coverageMapper.getCoverageStats(req.params.projectId);
    sendSuccess(res, 200, { projectId: req.params.projectId, stats });
  } catch (error) {
    sendError(res, 500, error);
  }
});

impactAnalysisRouter.post('/register-test', (req: Request, res: Response) => {
  try {
    const error = validateParams(req.body, ['testId', 'testName', 'testPath']);
    if (error) return sendError(res, 400, error);

    impactAnalyzer.registerTest(
      req.body.testId as string,
      req.body.testName as string,
      req.body.testPath as string,
      (req.body.estimatedRunTime as number) ?? 5000
    );
    sendSuccess(res, 200, { message: 'Test registered', testId: req.body.testId });
  } catch (error) {
    sendError(res, 500, error);
  }
});

impactAnalysisRouter.get('/coverage-files/:filePath(*)', async (req: Request, res: Response) => {
  try {
    const tests = await coverageMapper.getTestsForFile(req.params.filePath);
    sendSuccess(res, 200, { filePath: req.params.filePath, tests, count: tests.length });
  } catch (error) {
    sendError(res, 500, error);
  }
});

impactAnalysisRouter.post('/batch-coverage', async (req: Request, res: Response) => {
  try {
    const error = validateParams(req.body, ['projectId', 'coverageData']);
    if (error) return sendError(res, 400, error);

    const results = await Promise.allSettled(
      (req.body.coverageData as Array<{ testId: string; coveredFiles: string[] }>).map(item =>
        coverageMapper.updateCoverage(item.testId, item.coveredFiles, req.body.projectId as string)
      )
    );

    const successes = results.filter(r => r.status === 'fulfilled').length;
    sendSuccess(res, 200, {
      message: `Coverage updated for ${successes}/${(req.body.coverageData as any[]).length} tests`,
      projectId: req.body.projectId,
    });
  } catch (error) {
    sendError(res, 500, error);
  }
});

export default impactAnalysisRouter;
