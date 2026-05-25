/**
 * Test Plans Routes (Drizzle ORM version)
 * Manages test plans - organized collections of test cases
 */

import { Router, Request, Response } from 'express';
import { optionalAuth } from '../middleware/auth.js';

const router = Router();

// Types
interface TestPlan {
    id: string;
    name: string;
    description: string;
    status: 'draft' | 'active' | 'archived';
    testCaseCount: number;
    coverage: number;
    lastRun?: string;
    createdAt: Date;
    updatedAt: Date;
}

// In-memory store for test plans
const testPlans: Map<string, TestPlan> = new Map();
let planCounter = 0;

// Initialize with demo data
const initTestPlans = () => {
    const demoPlans: TestPlan[] = [
        {
            id: 'TP-001',
            name: 'E-Commerce Checkout Flow',
            description: 'Complete checkout process validation including cart, payment, and order confirmation',
            status: 'active',
            testCaseCount: 45,
            coverage: 92,
            lastRun: '2 hours ago',
            createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
            updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000)
        },
        {
            id: 'TP-002',
            name: 'User Authentication Suite',
            description: 'Login, registration, password reset, and SSO integration tests',
            status: 'active',
            testCaseCount: 32,
            coverage: 88,
            lastRun: '1 day ago',
            createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000)
        },
        {
            id: 'TP-003',
            name: 'API Integration Tests',
            description: 'RESTful API endpoint validation and error handling',
            status: 'draft',
            testCaseCount: 18,
            coverage: 65,
            createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
        },
        {
            id: 'TP-004',
            name: 'Mobile Responsiveness',
            description: 'Cross-device and viewport testing for mobile compatibility',
            status: 'archived',
            testCaseCount: 24,
            coverage: 100,
            lastRun: '1 week ago',
            createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
            updatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        }
    ];
    demoPlans.forEach(p => testPlans.set(p.id, p));
    planCounter = 4;
};
initTestPlans();

// Helper to format response
const formatResponse = (data: any, message?: string) => ({
    success: true,
    data,
    message,
    timestamp: new Date().toISOString()
});

// GET /api/test-plans - List all test plans
router.get('/', optionalAuth, async (req: Request, res: Response) => {
    try {
        const { status } = req.query;

        let planList = Array.from(testPlans.values());

        if (status) {
            planList = planList.filter(p => p.status === status);
        }

        planList.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

        res.json(formatResponse(planList));
    } catch (error) {
        console.error('Failed to list test plans:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to list test plans'
        });
    }
});

// GET /api/test-plans/:id - Get test plan by ID
router.get('/:id', optionalAuth, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const plan = testPlans.get(id);

        if (!plan) {
            return res.status(404).json({
                success: false,
                error: 'Test plan not found'
            });
        }

        res.json(formatResponse(plan));
    } catch (error) {
        console.error('Failed to get test plan:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get test plan'
        });
    }
});

// POST /api/test-plans - Create new test plan
router.post('/', optionalAuth, async (req: Request, res: Response) => {
    try {
        const { name, description } = req.body;

        if (!name) {
            return res.status(400).json({
                success: false,
                error: 'Name is required'
            });
        }

        planCounter++;
        const id = `TP-${String(planCounter).padStart(3, '0')}`;

        const newPlan: TestPlan = {
            id,
            name,
            description: description || '',
            status: 'draft',
            testCaseCount: 0,
            coverage: 0,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        testPlans.set(id, newPlan);

        res.status(201).json(formatResponse(newPlan, 'Test plan created successfully'));
    } catch (error) {
        console.error('Failed to create test plan:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create test plan'
        });
    }
});

// PATCH /api/test-plans/:id - Update test plan
router.patch('/:id', optionalAuth, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const plan = testPlans.get(id);

        if (!plan) {
            return res.status(404).json({
                success: false,
                error: 'Test plan not found'
            });
        }

        const { name, description, status, testCaseCount, coverage } = req.body;

        if (name) plan.name = name;
        if (description) plan.description = description;
        if (status) plan.status = status;
        if (typeof testCaseCount === 'number') plan.testCaseCount = testCaseCount;
        if (typeof coverage === 'number') plan.coverage = coverage;
        plan.updatedAt = new Date();

        res.json(formatResponse(plan, 'Test plan updated successfully'));
    } catch (error) {
        console.error('Failed to update test plan:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update test plan'
        });
    }
});

// DELETE /api/test-plans/:id - Delete test plan
router.delete('/:id', optionalAuth, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        if (!testPlans.has(id)) {
            return res.status(404).json({
                success: false,
                error: 'Test plan not found'
            });
        }

        testPlans.delete(id);

        res.json(formatResponse(null, 'Test plan deleted successfully'));
    } catch (error) {
        console.error('Failed to delete test plan:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete test plan'
        });
    }
});

// POST /api/test-plans/:id/run - Run test plan
router.post('/:id/run', optionalAuth, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const plan = testPlans.get(id);

        if (!plan) {
            return res.status(404).json({
                success: false,
                error: 'Test plan not found'
            });
        }

        plan.lastRun = 'Just now';
        plan.updatedAt = new Date();

        res.json(formatResponse({
            plan,
            runId: `RUN-${Date.now()}`
        }, 'Test plan execution started'));
    } catch (error) {
        console.error('Failed to run test plan:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to run test plan'
        });
    }
});

export default router;
