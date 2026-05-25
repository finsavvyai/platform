// Test Cycles Routes
// CRUD operations for test cycle management

import { Router } from 'express';
import { z } from 'zod';

const router = Router();

// Validation schemas
const createCycleSchema = z.object({
    name: z.string().min(3).max(255),
    description: z.string().optional(),
    projectId: z.string().uuid(),
    testPlanId: z.string().uuid(),
    environment: z.enum(['dev', 'staging', 'production']),
    startDate: z.number().int().positive(),
    endDate: z.number().int().positive(),
    assignedTo: z.string().uuid().optional(),
    testCaseIds: z.array(z.string().uuid()).min(1),
});

const updateCycleSchema = z.object({
    name: z.string().min(3).max(255).optional(),
    description: z.string().optional(),
    environment: z.enum(['dev', 'staging', 'production']).optional(),
    status: z.enum(['planned', 'active', 'completed']).optional(),
    startDate: z.number().int().positive().optional(),
    endDate: z.number().int().positive().optional(),
    assignedTo: z.string().uuid().optional().nullable(),
});

const updateTestCaseStatusSchema = z.object({
    status: z.enum(['not_run', 'passed', 'failed', 'blocked']),
    notes: z.string().optional(),
});

// GET /api/cycles - List all cycles
router.get('/', async (req, res) => {
    try {
        const { projectId, status, environment } = req.query;
        const userId = req.user?.userId;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Build query
        const db = req.app.locals.db;
        let query = db
            .select()
            .from('test_cycles')
            .where('user_id', userId);

        if (projectId) {
            query = query.where('project_id', projectId);
        }
        if (status) {
            query = query.where('status', status);
        }
        if (environment) {
            query = query.where('environment', environment);
        }

        const cycles = await query.orderBy('created_at', 'desc');

        // Fetch test case counts for each cycle
        for (const cycle of cycles) {
            const testCases = await db
                .select()
                .from('cycle_test_cases')
                .where('cycle_id', cycle.id);

            const progress = {
                total: testCases.length,
                passed: testCases.filter((tc: any) => tc.status === 'passed').length,
                failed: testCases.filter((tc: any) => tc.status === 'failed').length,
                blocked: testCases.filter((tc: any) => tc.status === 'blocked').length,
                notRun: testCases.filter((tc: any) => tc.status === 'not_run').length,
            };

            cycle.progress = JSON.stringify(progress);
        }

        res.json({ cycles });
    } catch (error) {
        console.error('Error fetching cycles:', error);
        res.status(500).json({ error: 'Failed to fetch cycles' });
    }
});

// GET /api/cycles/:id - Get cycle by ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.userId;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const db = req.app.locals.db;
        const cycle = await db
            .select()
            .from('test_cycles')
            .where('id', id)
            .where('user_id', userId)
            .first();

        if (!cycle) {
            return res.status(404).json({ error: 'Cycle not found' });
        }

        // Fetch test cases in this cycle
        const testCases = await db
            .select()
            .from('cycle_test_cases')
            .leftJoin('test_cases', 'cycle_test_cases.test_case_id', 'test_cases.id')
            .where('cycle_test_cases.cycle_id', id);

        // Calculate progress
        const progress = {
            total: testCases.length,
            passed: testCases.filter((tc: any) => tc.status === 'passed').length,
            failed: testCases.filter((tc: any) => tc.status === 'failed').length,
            blocked: testCases.filter((tc: any) => tc.status === 'blocked').length,
            notRun: testCases.filter((tc: any) => tc.status === 'not_run').length,
        };

        cycle.progress = JSON.stringify(progress);
        cycle.testCases = testCases;

        res.json({ cycle });
    } catch (error) {
        console.error('Error fetching cycle:', error);
        res.status(500).json({ error: 'Failed to fetch cycle' });
    }
});

// POST /api/cycles - Create new cycle
router.post('/', async (req, res) => {
    try {
        const userId = req.user?.userId;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const data = createCycleSchema.parse(req.body);

        // Verify test plan exists
        const db = req.app.locals.db;
        const testPlan = await db
            .select()
            .from('test_plans')
            .where('id', data.testPlanId)
            .where('user_id', userId)
            .first();

        if (!testPlan) {
            return res.status(404).json({ error: 'Test plan not found' });
        }

        // Validate dates
        if (data.endDate <= data.startDate) {
            return res.status(400).json({ error: 'End date must be after start date' });
        }

        // Create cycle
        const cycleId = crypto.randomUUID();
        const now = Math.floor(Date.now() / 1000);

        await db.insert('test_cycles').values({
            id: cycleId,
            project_id: data.projectId,
            test_plan_id: data.testPlanId,
            user_id: userId,
            name: data.name,
            description: data.description,
            environment: data.environment,
            status: 'planned',
            assigned_to: data.assignedTo,
            start_date: data.startDate,
            end_date: data.endDate,
            progress: JSON.stringify({
                total: data.testCaseIds.length,
                passed: 0,
                failed: 0,
                blocked: 0,
                notRun: data.testCaseIds.length,
            }),
            created_by: userId,
            created_at: now,
            updated_at: now,
        });

        // Add test cases to cycle
        for (const testCaseId of data.testCaseIds) {
            await db.insert('cycle_test_cases').values({
                id: crypto.randomUUID(),
                cycle_id: cycleId,
                test_case_id: testCaseId,
                status: 'not_run',
                created_at: now,
            });
        }

        // Fetch created cycle
        const cycle = await db
            .select()
            .from('test_cycles')
            .where('id', cycleId)
            .first();

        res.status(201).json({ cycle });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.errors });
        }
        console.error('Error creating cycle:', error);
        res.status(500).json({ error: 'Failed to create cycle' });
    }
});

// PATCH /api/cycles/:id - Update cycle
router.patch('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.userId;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const data = updateCycleSchema.parse(req.body);

        const db = req.app.locals.db;

        // Check if cycle exists and user has access
        const existingCycle = await db
            .select()
            .from('test_cycles')
            .where('id', id)
            .where('user_id', userId)
            .first();

        if (!existingCycle) {
            return res.status(404).json({ error: 'Cycle not found' });
        }

        // Validate dates if being updated
        if (data.startDate && data.endDate && data.endDate <= data.startDate) {
            return res.status(400).json({ error: 'End date must be after start date' });
        }

        const now = Math.floor(Date.now() / 1000);

        await db
            .update('test_cycles')
            .set({
                ...data,
                updated_at: now,
            })
            .where('id', id);

        // Fetch updated cycle
        const cycle = await db
            .select()
            .from('test_cycles')
            .where('id', id)
            .first();

        res.json({ cycle });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.errors });
        }
        console.error('Error updating cycle:', error);
        res.status(500).json({ error: 'Failed to update cycle' });
    }
});

// DELETE /api/cycles/:id - Delete cycle
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.userId;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const db = req.app.locals.db;

        // Check if cycle exists and user has access
        const cycle = await db
            .select()
            .from('test_cycles')
            .where('id', id)
            .where('user_id', userId)
            .first();

        if (!cycle) {
            return res.status(404).json({ error: 'Cycle not found' });
        }

        // Delete cycle (cascade will delete cycle_test_cases)
        await db.delete('test_cycles').where('id', id);

        res.status(204).send();
    } catch (error) {
        console.error('Error deleting cycle:', error);
        res.status(500).json({ error: 'Failed to delete cycle' });
    }
});

// POST /api/cycles/:id/test-cases - Add test cases to cycle
router.post('/:id/test-cases', async (req, res) => {
    try {
        const { id } = req.params;
        const { testCaseIds } = req.body;
        const userId = req.user?.userId;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (!Array.isArray(testCaseIds) || testCaseIds.length === 0) {
            return res.status(400).json({ error: 'testCaseIds must be a non-empty array' });
        }

        const db = req.app.locals.db;

        // Check if cycle exists
        const cycle = await db
            .select()
            .from('test_cycles')
            .where('id', id)
            .where('user_id', userId)
            .first();

        if (!cycle) {
            return res.status(404).json({ error: 'Cycle not found' });
        }

        const now = Math.floor(Date.now() / 1000);


        // Add test cases
        for (const testCaseId of testCaseIds) {
            // Check if already exists
            const existing = await db
                .select()
                .from('cycle_test_cases')
                .where('cycle_id', id)
                .where('test_case_id', testCaseId)
                .first();

            if (!existing) {
                await db.insert('cycle_test_cases').values({
                    id: crypto.randomUUID(),
                    cycle_id: id,
                    test_case_id: testCaseId,
                    status: 'not_run',
                    created_at: now,
                });
            }
        }

        res.status(201).json({ message: 'Test cases added successfully' });
    } catch (error) {
        console.error('Error adding test cases:', error);
        res.status(500).json({ error: 'Failed to add test cases' });
    }
});

// DELETE /api/cycles/:id/test-cases/:testCaseId - Remove test case from cycle
router.delete('/:id/test-cases/:testCaseId', async (req, res) => {
    try {
        const { id, testCaseId } = req.params;
        const userId = req.user?.userId;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const db = req.app.locals.db;

        // Check if cycle exists
        const cycle = await db
            .select()
            .from('test_cycles')
            .where('id', id)
            .where('user_id', userId)
            .first();

        if (!cycle) {
            return res.status(404).json({ error: 'Cycle not found' });
        }

        // Remove test case from cycle
        await db
            .delete('cycle_test_cases')
            .where('cycle_id', id)
            .where('test_case_id', testCaseId);

        res.status(204).send();
    } catch (error) {
        console.error('Error removing test case:', error);
        res.status(500).json({ error: 'Failed to remove test case' });
    }
});

// PATCH /api/cycles/:id/test-cases/:testCaseId - Update test case status in cycle
router.patch('/:id/test-cases/:testCaseId', async (req, res) => {
    try {
        const { id, testCaseId } = req.params;
        const userId = req.user?.userId;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const data = updateTestCaseStatusSchema.parse(req.body);

        const db = req.app.locals.db;

        // Check if cycle exists
        const cycle = await db
            .select()
            .from('test_cycles')
            .where('id', id)
            .where('user_id', userId)
            .first();

        if (!cycle) {
            return res.status(404).json({ error: 'Cycle not found' });
        }

        const now = Math.floor(Date.now() / 1000);

        // Update test case status
        await db
            .update('cycle_test_cases')
            .set({
                status: data.status,
                notes: data.notes,
                last_run_at: now,
            })
            .where('cycle_id', id)
            .where('test_case_id', testCaseId);

        res.json({ message: 'Test case status updated successfully' });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.errors });
        }
        console.error('Error updating test case status:', error);
        res.status(500).json({ error: 'Failed to update test case status' });
    }
});

export default router;
