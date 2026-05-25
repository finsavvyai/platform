// Test Plans Routes
// CRUD operations for test plan management

import { Router } from 'express';
import { z } from 'zod';

const router = Router();

// Validation schemas
const createTestPlanSchema = z.object({
    name: z.string().min(3).max(255),
    description: z.string().optional(),
    projectId: z.string().uuid(),
    objectives: z.array(z.string()).optional(),
    scope: z.string().optional(),
    strategy: z.string().optional(),
    schedule: z.object({
        milestones: z.array(z.object({
            name: z.string(),
            date: z.number(),
            description: z.string().optional(),
        })).optional(),
    }).optional(),
    environments: z.array(z.string()).optional(),
    resources: z.array(z.string()).optional(),
    risks: z.array(z.object({
        description: z.string(),
        severity: z.enum(['low', 'medium', 'high', 'critical']),
        mitigation: z.string().optional(),
    })).optional(),
    startDate: z.number().int().positive().optional(),
    endDate: z.number().int().positive().optional(),
});

const updateTestPlanSchema = z.object({
    name: z.string().min(3).max(255).optional(),
    description: z.string().optional(),
    objectives: z.array(z.string()).optional(),
    scope: z.string().optional(),
    strategy: z.string().optional(),
    schedule: z.object({}).passthrough().optional(),
    environments: z.array(z.string()).optional(),
    resources: z.array(z.string()).optional(),
    risks: z.array(z.object({})).optional(),
    status: z.enum(['draft', 'active', 'completed', 'archived']).optional(),
    progress: z.number().int().min(0).max(100).optional(),
    startDate: z.number().int().positive().optional().nullable(),
    endDate: z.number().int().positive().optional().nullable(),
});

// GET /api/test-plans - List all test plans
router.get('/', async (req, res) => {
    try {
        const { projectId, status } = req.query;
        const userId = req.user?.userId;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const db = req.app.locals.db;
        let query = db
            .select()
            .from('test_plans')
            .where('user_id', userId);

        if (projectId) {
            query = query.where('project_id', projectId);
        }
        if (status) {
            query = query.where('status', status);
        }

        const plans = await query.orderBy('updated_at', 'desc');

        // Get cycle count for each plan
        for (const plan of plans) {
            const cycles = await db
                .select()
                .from('test_cycles')
                .where('test_plan_id', plan.id);

            plan.cycleCount = cycles.length;
        }

        res.json({ plans });
    } catch (error) {
        console.error('Error fetching test plans:', error);
        res.status(500).json({ error: 'Failed to fetch test plans' });
    }
});

// GET /api/test-plans/:id - Get test plan by ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.userId;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const db = req.app.locals.db;
        const plan = await db
            .select()
            .from('test_plans')
            .where('id', id)
            .where('user_id', userId)
            .first();

        if (!plan) {
            return res.status(404).json({ error: 'Test plan not found' });
        }

        // Get cycles for this plan
        const cycles = await db
            .select()
            .from('test_cycles')
            .where('test_plan_id', id);

        plan.cycles = cycles;
        plan.cycleCount = cycles.length;

        res.json({ plan });
    } catch (error) {
        console.error('Error fetching test plan:', error);
        res.status(500).json({ error: 'Failed to fetch test plan' });
    }
});

// POST /api/test-plans - Create new test plan
router.post('/', async (req, res) => {
    try {
        const userId = req.user?.userId;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const data = createTestPlanSchema.parse(req.body);

        // Validate dates
        if (data.startDate && data.endDate && data.endDate <= data.startDate) {
            return res.status(400).json({ error: 'End date must be after start date' });
        }

        const db = req.app.locals.db;
        const planId = crypto.randomUUID();
        const now = Math.floor(Date.now() / 1000);

        await db.insert('test_plans').values({
            id: planId,
            project_id: data.projectId,
            user_id: userId,
            name: data.name,
            description: data.description,
            objectives: JSON.stringify(data.objectives || []),
            scope: data.scope,
            strategy: data.strategy,
            schedule: JSON.stringify(data.schedule || {}),
            environments: JSON.stringify(data.environments || []),
            resources: JSON.stringify(data.resources || []),
            risks: JSON.stringify(data.risks || []),
            status: 'draft',
            progress: 0,
            start_date: data.startDate,
            end_date: data.endDate,
            is_active: true,
            created_at: now,
            updated_at: now,
        });

        const plan = await db
            .select()
            .from('test_plans')
            .where('id', planId)
            .first();

        res.status(201).json({ plan });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.errors });
        }
        console.error('Error creating test plan:', error);
        res.status(500).json({ error: 'Failed to create test plan' });
    }
});

// PATCH /api/test-plans/:id - Update test plan
router.patch('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.userId;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const data = updateTestPlanSchema.parse(req.body);

        const db = req.app.locals.db;

        // Check if plan exists
        const existingPlan = await db
            .select()
            .from('test_plans')
            .where('id', id)
            .where('user_id', userId)
            .first();

        if (!existingPlan) {
            return res.status(404).json({ error: 'Test plan not found' });
        }

        // Validate dates
        if (data.startDate && data.endDate && data.endDate <= data.startDate) {
            return res.status(400).json({ error: 'End date must be after start date' });
        }

        const now = Math.floor(Date.now() / 1000);
        const updateData: any = { updated_at: now };

        if (data.name) updateData.name = data.name;
        if (data.description !== undefined) updateData.description = data.description;
        if (data.objectives) updateData.objectives = JSON.stringify(data.objectives);
        if (data.scope !== undefined) updateData.scope = data.scope;
        if (data.strategy !== undefined) updateData.strategy = data.strategy;
        if (data.schedule) updateData.schedule = JSON.stringify(data.schedule);
        if (data.environments) updateData.environments = JSON.stringify(data.environments);
        if (data.resources) updateData.resources = JSON.stringify(data.resources);
        if (data.risks) updateData.risks = JSON.stringify(data.risks);
        if (data.status) updateData.status = data.status;
        if (data.progress !== undefined) updateData.progress = data.progress;
        if (data.startDate !== undefined) updateData.start_date = data.startDate;
        if (data.endDate !== undefined) updateData.end_date = data.endDate;

        await db
            .update('test_plans')
            .set(updateData)
            .where('id', id);

        const plan = await db
            .select()
            .from('test_plans')
            .where('id', id)
            .first();

        res.json({ plan });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.errors });
        }
        console.error('Error updating test plan:', error);
        res.status(500).json({ error: 'Failed to update test plan' });
    }
});

// DELETE /api/test-plans/:id - Delete test plan
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.userId;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const db = req.app.locals.db;

        // Check if plan exists
        const plan = await db
            .select()
            .from('test_plans')
            .where('id', id)
            .where('user_id', userId)
            .first();

        if (!plan) {
            return res.status(404).json({ error: 'Test plan not found' });
        }

        // Check if there are associated cycles
        const cycles = await db
            .select()
            .from('test_cycles')
            .where('test_plan_id', id);

        if (cycles.length > 0) {
            return res.status(400).json({
                error: 'Cannot delete test plan with associated cycles',
                cycleCount: cycles.length,
            });
        }

        // Delete plan
        await db.delete('test_plans').where('id', id);

        res.status(204).send();
    } catch (error) {
        console.error('Error deleting test plan:', error);
        res.status(500).json({ error: 'Failed to delete test plan' });
    }
});

export default router;
