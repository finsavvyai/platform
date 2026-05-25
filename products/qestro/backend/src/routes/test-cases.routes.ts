/**
 * Test Cases CRUD Routes
 * Complete test case management with database persistence
 */

import { Router, Request, Response } from 'express';
import { eq, desc, and } from 'drizzle-orm';
import db from '../lib/db.js';
import { testCases, projects } from '../schema/index.js';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';

const router = Router();

// Helper to format response
const formatResponse = (data: any, message?: string) => ({
    success: true,
    data,
    message,
    timestamp: new Date().toISOString()
});

/**
 * GET /api/test-cases
 * List all test cases for current user/project
 */
router.get('/', optionalAuth, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        const { projectId, status, type, limit = 50 } = req.query;

        const conditions: any[] = [];

        if (userId) {
            conditions.push(eq(testCases.userId, userId));
        }
        if (projectId) {
            conditions.push(eq(testCases.projectId, projectId as string));
        }

        const cases = await db.select()
            .from(testCases)
            .where(conditions.length > 0 ? and(...conditions) : undefined)
            .orderBy(desc(testCases.createdAt))
            .limit(Number(limit));

        res.json(formatResponse(cases));
    } catch (error) {
        console.error('Failed to list test cases:', error);
        res.json(formatResponse([]));
    }
});

/**
 * GET /api/test-cases/:id
 * Get a specific test case
 */
router.get('/:id', optionalAuth, async (req: Request, res: Response) => {
    try {
        const [testCase] = await db.select()
            .from(testCases)
            .where(eq(testCases.id, req.params.id));

        if (!testCase) {
            return res.status(404).json({ success: false, error: 'Test case not found' });
        }

        res.json(formatResponse(testCase));
    } catch (error) {
        console.error('Failed to get test case:', error);
        res.status(500).json({ success: false, error: 'Failed to get test case' });
    }
});

/**
 * POST /api/test-cases
 * Create a new test case
 */
router.post('/', optionalAuth, async (req: Request, res: Response) => {
    try {
        const {
            title,
            description,
            status,
            priority,
            type,
            jiraIssue,
            projectId,
            testData,
            tags
        } = req.body;

        if (!title || title.trim().length < 3) {
            return res.status(400).json({
                success: false,
                error: 'Title is required and must be at least 3 characters'
            });
        }

        // Get existing project or find/create with existing user
        let finalProjectId = projectId;
        let userId = (req as any).user?.id;

        if (!finalProjectId) {
            // Get the first existing project
            const [existingProject] = await db.select()
                .from(projects)
                .limit(1);

            if (existingProject) {
                finalProjectId = existingProject.id;
                userId = userId || existingProject.userId;
            } else {
                return res.status(400).json({
                    success: false,
                    error: 'No project available. Please create a project first or login.'
                });
            }
        } else {
            // Get the project to get its userId
            const [project] = await db.select()
                .from(projects)
                .where(eq(projects.id, finalProjectId))
                .limit(1);

            if (project) {
                userId = userId || project.userId;
            }
        }

        const [testCase] = await db.insert(testCases)
            .values({
                projectId: finalProjectId,
                userId,
                name: title.trim(),
                description: description || '',
                type: type || 'web',
                platform: 'web',
                testData: testData || {
                    status: status || 'Active',
                    priority: priority || 'Medium',
                    jiraIssue: jiraIssue || null
                },
                tags: tags || [],
                isActive: true
            })
            .returning();

        // Transform response to match frontend expected format
        const responseData = {
            id: testCase.id,
            title: testCase.name,
            description: testCase.description,
            status: (testCase.testData as any)?.status || 'Active',
            priority: (testCase.testData as any)?.priority || 'Medium',
            type: testCase.type,
            jiraIssue: (testCase.testData as any)?.jiraIssue || null,
            createdAt: testCase.createdAt
        };

        res.status(201).json(formatResponse(responseData, 'Test case created successfully'));
    } catch (error) {
        console.error('Failed to create test case:', error);
        res.status(500).json({ success: false, error: 'Failed to create test case' });
    }
});

/**
 * PUT /api/test-cases/:id
 * Update a test case
 */
router.put('/:id', optionalAuth, async (req: Request, res: Response) => {
    try {
        const [existingCase] = await db.select()
            .from(testCases)
            .where(eq(testCases.id, req.params.id));

        if (!existingCase) {
            return res.status(404).json({ success: false, error: 'Test case not found' });
        }

        const { title, description, status, priority, type, jiraIssue, tags } = req.body;

        const existingTestData = existingCase.testData as any || {};

        const [updated] = await db.update(testCases)
            .set({
                name: title || existingCase.name,
                description: description !== undefined ? description : existingCase.description,
                type: type || existingCase.type,
                testData: {
                    ...existingTestData,
                    status: status || existingTestData.status,
                    priority: priority || existingTestData.priority,
                    jiraIssue: jiraIssue !== undefined ? jiraIssue : existingTestData.jiraIssue
                },
                tags: tags || existingCase.tags,
                updatedAt: new Date()
            })
            .where(eq(testCases.id, req.params.id))
            .returning();

        const responseData = {
            id: updated.id,
            title: updated.name,
            description: updated.description,
            status: (updated.testData as any)?.status || 'Active',
            priority: (updated.testData as any)?.priority || 'Medium',
            type: updated.type,
            jiraIssue: (updated.testData as any)?.jiraIssue || null,
            updatedAt: updated.updatedAt
        };

        res.json(formatResponse(responseData, 'Test case updated successfully'));
    } catch (error) {
        console.error('Failed to update test case:', error);
        res.status(500).json({ success: false, error: 'Failed to update test case' });
    }
});

/**
 * DELETE /api/test-cases/:id
 * Delete a test case
 */
router.delete('/:id', optionalAuth, async (req: Request, res: Response) => {
    try {
        const [existingCase] = await db.select()
            .from(testCases)
            .where(eq(testCases.id, req.params.id));

        if (!existingCase) {
            return res.status(404).json({ success: false, error: 'Test case not found' });
        }

        await db.delete(testCases)
            .where(eq(testCases.id, req.params.id));

        res.json({ success: true, message: 'Test case deleted successfully' });
    } catch (error) {
        console.error('Failed to delete test case:', error);
        res.status(500).json({ success: false, error: 'Failed to delete test case' });
    }
});

export default router;
