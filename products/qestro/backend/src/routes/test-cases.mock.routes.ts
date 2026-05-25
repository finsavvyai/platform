/**
 * Test Cases Mock Routes
 * In-memory CRUD for test cases — used by the mock backend
 * Supports the frontend TestCases page and dashboard stats
 */
import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';

const router = Router();

// ─── In-memory store ───────────────────────────────────────────
export interface MockTestCase {
  id: string;
  name: string;
  title: string;
  description: string;
  type: string;
  status: string;
  priority: string;
  jiraIssue: string | null;
  projectId: string;
  userId: string;
  tags: string[];
  expectedResults: string[];
  testData: Record<string, unknown>;
  targetUrl?: string;
  steps?: Array<{ action: string; selector?: string; value?: string }>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const testCaseStore: MockTestCase[] = [];

// ─── GET /api/test-cases ───────────────────────────────────────
router.get('/', (req: Request, res: Response) => {
  const { projectId, status, type, limit = '50' } = req.query;
  let filtered = testCaseStore.filter((tc) => tc.isActive);

  if (projectId) filtered = filtered.filter((tc) => tc.projectId === projectId);
  if (status) filtered = filtered.filter((tc) => tc.status === status);
  if (type) filtered = filtered.filter((tc) => tc.type === type);

  const limited = filtered.slice(0, parseInt(limit as string, 10));

  res.json({
    success: true,
    data: limited,
    total: filtered.length,
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/test-cases/:id ───────────────────────────────────
router.get('/:id', (req: Request, res: Response) => {
  const tc = testCaseStore.find((t) => t.id === req.params.id && t.isActive);
  if (!tc) {
    return res.status(404).json({ success: false, error: 'Test case not found' });
  }
  res.json({ success: true, data: tc });
});

// ─── POST /api/test-cases ──────────────────────────────────────
router.post('/', (req: Request, res: Response) => {
  const {
    title, name, description = '', type = 'web', status = 'Active',
    priority = 'Medium', jiraIssue = null, projectId = 'default',
    tags = [], expectedResults = [], testData = {}, targetUrl, steps,
  } = req.body;

  const displayTitle = title || name;
  if (!displayTitle || displayTitle.length < 3) {
    return res.status(400).json({
      success: false,
      error: 'Title is required (min 3 chars)',
    });
  }

  const tc: MockTestCase = {
    id: randomUUID(),
    name: displayTitle,
    title: displayTitle,
    description,
    type,
    status,
    priority,
    jiraIssue,
    projectId,
    userId: 'mock-user-1',
    tags,
    expectedResults,
    testData: { ...testData, status, priority, jiraIssue },
    targetUrl,
    steps,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  testCaseStore.push(tc);

  res.status(201).json({
    success: true,
    data: {
      id: tc.id,
      title: tc.title,
      description: tc.description,
      status: tc.status,
      priority: tc.priority,
      type: tc.type,
      jiraIssue: tc.jiraIssue,
      createdAt: tc.createdAt,
    },
    message: 'Test case created successfully',
    timestamp: new Date().toISOString(),
  });
});

// ─── POST /api/test-cases/bulk ─────────────────────────────────
router.post('/bulk', (req: Request, res: Response) => {
  const { testCases: cases } = req.body;
  if (!Array.isArray(cases)) {
    return res.status(400).json({ success: false, error: 'testCases array required' });
  }

  const created: MockTestCase[] = [];
  for (const c of cases) {
    const displayTitle = c.title || c.name;
    if (!displayTitle || displayTitle.length < 3) continue;

    const tc: MockTestCase = {
      id: randomUUID(),
      name: displayTitle,
      title: displayTitle,
      description: c.description || '',
      type: c.type || 'web',
      status: c.status || 'Active',
      priority: c.priority || 'Medium',
      jiraIssue: c.jiraIssue || null,
      projectId: c.projectId || 'default',
      userId: 'mock-user-1',
      tags: c.tags || [],
      expectedResults: c.expectedResults || [],
      testData: { status: c.status || 'Active', priority: c.priority || 'Medium' },
      targetUrl: c.targetUrl,
      steps: c.steps,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    testCaseStore.push(tc);
    created.push(tc);
  }

  res.status(201).json({
    success: true,
    data: created,
    count: created.length,
    message: `${created.length} test cases created`,
    timestamp: new Date().toISOString(),
  });
});

// ─── PUT /api/test-cases/:id ───────────────────────────────────
router.put('/:id', (req: Request, res: Response) => {
  const idx = testCaseStore.findIndex((t) => t.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, error: 'Test case not found' });
  }

  const updates = req.body;
  const tc = testCaseStore[idx];
  if (updates.title) { tc.title = updates.title; tc.name = updates.title; }
  if (updates.description !== undefined) tc.description = updates.description;
  if (updates.status) { tc.status = updates.status; tc.testData.status = updates.status; }
  if (updates.priority) { tc.priority = updates.priority; tc.testData.priority = updates.priority; }
  if (updates.type) tc.type = updates.type;
  if (updates.jiraIssue !== undefined) tc.jiraIssue = updates.jiraIssue;
  if (updates.tags) tc.tags = updates.tags;
  if (updates.expectedResults) tc.expectedResults = updates.expectedResults;
  tc.updatedAt = new Date().toISOString();
  testCaseStore[idx] = tc;

  res.json({ success: true, data: tc, message: 'Test case updated' });
});

// ─── DELETE /api/test-cases/:id ────────────────────────────────
router.delete('/:id', (req: Request, res: Response) => {
  const idx = testCaseStore.findIndex((t) => t.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, error: 'Test case not found' });
  }
  testCaseStore[idx].isActive = false;
  res.json({ success: true, message: 'Test case deleted' });
});

// ─── POST /api/test-cases/:id/run ──────────────────────────────
router.post('/:id/run', (req: Request, res: Response) => {
  const tc = testCaseStore.find((t) => t.id === req.params.id && t.isActive);
  if (!tc) {
    return res.status(404).json({ success: false, error: 'Test case not found' });
  }

  // Simulate a test run
  const runId = randomUUID();
  const passed = Math.random() > 0.2; // 80% pass rate simulation

  res.json({
    success: true,
    data: {
      runId,
      testCaseId: tc.id,
      testCaseTitle: tc.title,
      status: passed ? 'passed' : 'failed',
      duration: Math.floor(Math.random() * 5000) + 500,
      startedAt: new Date().toISOString(),
      completedAt: new Date(Date.now() + 2000).toISOString(),
      targetUrl: tc.targetUrl || 'https://opensyber.cloud',
      steps: tc.steps?.length || 0,
      screenshots: passed ? [] : [`screenshot-${runId}.png`],
    },
    message: `Test ${passed ? 'passed' : 'failed'}`,
  });
});

export default router;
