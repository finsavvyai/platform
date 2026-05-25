/**
 * Explorations Routes
 * API for exploratory testing sessions
 */

import { Router, Request, Response } from 'express';
import { optionalAuth } from '../middleware/auth.js';

const router = Router();

// Types
interface Exploration {
    id: string;
    name: string;
    milestone: string;
    startTime: string;
    mission: string;
    status: 'Active' | 'Completed' | 'Paused';
    userId?: string;
    findings?: string[];
    createdAt: Date;
}

// In-memory store for explorations
const explorations: Map<string, Exploration> = new Map();
let explorationCounter = 0;

// Initialize with demo data
const initExplorations = () => {
    const demoExplorations: Exploration[] = [
        {
            id: 'EXP-001',
            name: 'Exploration 001',
            milestone: 'Bug resolution',
            startTime: '12/03/2025',
            mission: 'Test new payment gateway integration',
            status: 'Active',
            findings: [],
            createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000)
        },
        {
            id: 'EXP-002',
            name: 'Exploration 002',
            milestone: 'Feature Release',
            startTime: '11/28/2025',
            mission: 'Verify user authentication flows',
            status: 'Completed',
            findings: ['Found edge case in password reset flow', 'SSO integration needs testing'],
            createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        }
    ];
    demoExplorations.forEach(e => explorations.set(e.id, e));
    explorationCounter = 2;
};
initExplorations();

// Helper to format response
const formatResponse = (data: any, message?: string) => ({
    success: true,
    data,
    message,
    timestamp: new Date().toISOString()
});

// GET /api/explorations - List all explorations
router.get('/', optionalAuth, async (req: Request, res: Response) => {
    try {
        const { status } = req.query;

        let explorationList = Array.from(explorations.values());

        // Filter by status
        if (status) {
            explorationList = explorationList.filter(e => e.status === status);
        }

        // Sort by creation date, newest first
        explorationList.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

        res.json(formatResponse(explorationList));
    } catch (error) {
        console.error('Failed to list explorations:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to list explorations'
        });
    }
});

// GET /api/explorations/:id - Get exploration by ID
router.get('/:id', optionalAuth, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const exploration = explorations.get(id);

        if (!exploration) {
            return res.status(404).json({
                success: false,
                error: 'Exploration not found'
            });
        }

        res.json(formatResponse(exploration));
    } catch (error) {
        console.error('Failed to get exploration:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get exploration'
        });
    }
});

// POST /api/explorations - Create new exploration
router.post('/', optionalAuth, async (req: Request, res: Response) => {
    try {
        const { name, milestone, mission, startTime } = req.body;
        const userId = (req as any).user?.id;

        if (!name || !mission) {
            return res.status(400).json({
                success: false,
                error: 'Name and mission are required'
            });
        }

        explorationCounter++;
        const id = `EXP-${String(explorationCounter).padStart(3, '0')}`;

        const newExploration: Exploration = {
            id,
            name,
            milestone: milestone || 'General',
            startTime: startTime || new Date().toLocaleDateString(),
            mission,
            status: 'Active',
            userId,
            findings: [],
            createdAt: new Date()
        };

        explorations.set(id, newExploration);

        res.status(201).json(formatResponse(newExploration, 'Exploration created successfully'));
    } catch (error) {
        console.error('Failed to create exploration:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create exploration'
        });
    }
});

// PATCH /api/explorations/:id - Update exploration
router.patch('/:id', optionalAuth, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const exploration = explorations.get(id);

        if (!exploration) {
            return res.status(404).json({
                success: false,
                error: 'Exploration not found'
            });
        }

        const { name, milestone, mission, status, findings } = req.body;

        if (name) exploration.name = name;
        if (milestone) exploration.milestone = milestone;
        if (mission) exploration.mission = mission;
        if (status) exploration.status = status;
        if (findings) exploration.findings = findings;

        res.json(formatResponse(exploration, 'Exploration updated successfully'));
    } catch (error) {
        console.error('Failed to update exploration:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update exploration'
        });
    }
});

// DELETE /api/explorations/:id - Delete exploration
router.delete('/:id', optionalAuth, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        if (!explorations.has(id)) {
            return res.status(404).json({
                success: false,
                error: 'Exploration not found'
            });
        }

        explorations.delete(id);

        res.json(formatResponse(null, 'Exploration deleted successfully'));
    } catch (error) {
        console.error('Failed to delete exploration:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete exploration'
        });
    }
});

// POST /api/explorations/:id/findings - Add finding to exploration
router.post('/:id/findings', optionalAuth, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { finding } = req.body;
        const exploration = explorations.get(id);

        if (!exploration) {
            return res.status(404).json({
                success: false,
                error: 'Exploration not found'
            });
        }

        if (!finding) {
            return res.status(400).json({
                success: false,
                error: 'Finding content is required'
            });
        }

        if (!exploration.findings) {
            exploration.findings = [];
        }
        exploration.findings.push(finding);

        res.json(formatResponse(exploration, 'Finding added successfully'));
    } catch (error) {
        console.error('Failed to add finding:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to add finding'
        });
    }
});

export default router;
