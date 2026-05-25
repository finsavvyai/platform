/**
 * Cycles Routes (Drizzle ORM version)
 * Manages test cycles - groups of test executions
 */

import { Router, Request, Response } from 'express';
import { optionalAuth } from '../middleware/auth.js';

const router = Router();

// Types
interface Cycle {
    id: string;
    name: string;
    description: string;
    status: 'active' | 'completed' | 'paused';
    progress: number;
    startDate: string;
    endDate?: string;
    totalTests: number;
    passedTests: number;
    failedTests: number;
    createdAt: Date;
}

// In-memory store for cycles
const cycles: Map<string, Cycle> = new Map();
let cycleCounter = 0;

// Initialize with demo data
const initCycles = () => {
    const demoCycles: Cycle[] = [
        {
            id: 'CYC-001',
            name: 'Sprint 42 Regression',
            description: 'Full regression suite for Sprint 42 release',
            status: 'active',
            progress: 68,
            startDate: '2025-01-20',
            totalTests: 156,
            passedTests: 106,
            failedTests: 12,
            createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
        },
        {
            id: 'CYC-002',
            name: 'Payment Integration Tests',
            description: 'End-to-end payment flow validation',
            status: 'completed',
            progress: 100,
            startDate: '2025-01-15',
            endDate: '2025-01-18',
            totalTests: 45,
            passedTests: 43,
            failedTests: 2,
            createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
        },
        {
            id: 'CYC-003',
            name: 'API Smoke Tests',
            description: 'Quick API health verification',
            status: 'paused',
            progress: 35,
            startDate: '2025-01-22',
            totalTests: 28,
            passedTests: 10,
            failedTests: 0,
            createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
        }
    ];
    demoCycles.forEach(c => cycles.set(c.id, c));
    cycleCounter = 3;
};
initCycles();

// Helper to format response
const formatResponse = (data: any, message?: string) => ({
    success: true,
    data,
    message,
    timestamp: new Date().toISOString()
});

// GET /api/cycles - List all cycles
router.get('/', optionalAuth, async (req: Request, res: Response) => {
    try {
        const { status } = req.query;

        let cycleList = Array.from(cycles.values());

        if (status) {
            cycleList = cycleList.filter(c => c.status === status);
        }

        cycleList.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

        res.json(formatResponse(cycleList));
    } catch (error) {
        console.error('Failed to list cycles:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to list cycles'
        });
    }
});

// GET /api/cycles/:id - Get cycle by ID
router.get('/:id', optionalAuth, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const cycle = cycles.get(id);

        if (!cycle) {
            return res.status(404).json({
                success: false,
                error: 'Cycle not found'
            });
        }

        res.json(formatResponse(cycle));
    } catch (error) {
        console.error('Failed to get cycle:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get cycle'
        });
    }
});

// POST /api/cycles - Create new cycle
router.post('/', optionalAuth, async (req: Request, res: Response) => {
    try {
        const { name, description, totalTests = 0 } = req.body;

        if (!name) {
            return res.status(400).json({
                success: false,
                error: 'Name is required'
            });
        }

        cycleCounter++;
        const id = `CYC-${String(cycleCounter).padStart(3, '0')}`;

        const newCycle: Cycle = {
            id,
            name,
            description: description || '',
            status: 'active',
            progress: 0,
            startDate: new Date().toISOString().split('T')[0],
            totalTests,
            passedTests: 0,
            failedTests: 0,
            createdAt: new Date()
        };

        cycles.set(id, newCycle);

        res.status(201).json(formatResponse(newCycle, 'Cycle created successfully'));
    } catch (error) {
        console.error('Failed to create cycle:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create cycle'
        });
    }
});

// PATCH /api/cycles/:id - Update cycle
router.patch('/:id', optionalAuth, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const cycle = cycles.get(id);

        if (!cycle) {
            return res.status(404).json({
                success: false,
                error: 'Cycle not found'
            });
        }

        const { name, description, status, progress, passedTests, failedTests } = req.body;

        if (name) cycle.name = name;
        if (description) cycle.description = description;
        if (status) {
            cycle.status = status;
            if (status === 'completed') {
                cycle.endDate = new Date().toISOString().split('T')[0];
                cycle.progress = 100;
            }
        }
        if (typeof progress === 'number') cycle.progress = progress;
        if (typeof passedTests === 'number') cycle.passedTests = passedTests;
        if (typeof failedTests === 'number') cycle.failedTests = failedTests;

        res.json(formatResponse(cycle, 'Cycle updated successfully'));
    } catch (error) {
        console.error('Failed to update cycle:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update cycle'
        });
    }
});

// DELETE /api/cycles/:id - Delete cycle
router.delete('/:id', optionalAuth, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        if (!cycles.has(id)) {
            return res.status(404).json({
                success: false,
                error: 'Cycle not found'
            });
        }

        cycles.delete(id);

        res.json(formatResponse(null, 'Cycle deleted successfully'));
    } catch (error) {
        console.error('Failed to delete cycle:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete cycle'
        });
    }
});

// GET /api/cycles/stats/summary - Get cycle statistics
router.get('/stats/summary', optionalAuth, async (req: Request, res: Response) => {
    try {
        const cycleList = Array.from(cycles.values());

        const stats = {
            total: cycleList.length,
            active: cycleList.filter(c => c.status === 'active').length,
            completed: cycleList.filter(c => c.status === 'completed').length,
            paused: cycleList.filter(c => c.status === 'paused').length,
            totalTests: cycleList.reduce((sum, c) => sum + c.totalTests, 0),
            overallPassRate: cycleList.length > 0
                ? Math.round(
                    (cycleList.reduce((sum, c) => sum + c.passedTests, 0) /
                        Math.max(cycleList.reduce((sum, c) => sum + c.passedTests + c.failedTests, 0), 1)) * 100
                )
                : 0
        };

        res.json(formatResponse(stats));
    } catch (error) {
        console.error('Failed to get cycle stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get cycle stats'
        });
    }
});

export default router;
