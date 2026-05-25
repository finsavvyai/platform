/**
 * Missions Routes
 * API for Mission Control - manages AI agent tasks
 */

import { Router, Request, Response } from 'express';
import { optionalAuth } from '../middleware/auth.js';

const router = Router();

// Types
type MissionType = 'TICKET' | 'SCOUT' | 'CONCIERGE';
type MissionStatus = 'QUEUED' | 'ACTIVE' | 'COMPLETED' | 'FAILED';

interface Mission {
    id: string;
    type: MissionType;
    title: string;
    input: string;
    status: MissionStatus;
    agent: string;
    progress: number;
    startTime: string;
    createdAt: Date;
    userId?: string;
    results?: any;
}

// In-memory store for missions (would be database in production)
const missions: Map<string, Mission> = new Map();
let missionCounter = 0;

// Initialize with some demo data
const initMissions = () => {
    const demoMissions: Mission[] = [
        {
            id: 'MSN-2025-001',
            type: 'TICKET',
            title: 'Verify Login Flow Reliability',
            input: 'As a user, I want to verify that the login flow works correctly with valid and invalid credentials',
            status: 'COMPLETED',
            agent: 'QA Architect',
            progress: 100,
            startTime: '2 hours ago',
            createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000)
        },
        {
            id: 'MSN-2025-002',
            type: 'SCOUT',
            title: 'Crawl production-app.com',
            input: 'https://production-app.com',
            status: 'COMPLETED',
            agent: 'The Scout',
            progress: 100,
            startTime: '3 hours ago',
            createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000)
        }
    ];
    demoMissions.forEach(m => missions.set(m.id, m));
    missionCounter = 2;
};
initMissions();

// Helper to format response
const formatResponse = (data: any, message?: string) => ({
    success: true,
    data,
    message,
    timestamp: new Date().toISOString()
});

// Helper to get relative time
const getRelativeTime = (date: Date): string => {
    const now = Date.now();
    const diff = now - date.getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} mins ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
    return 'Yesterday';
};

// GET /api/missions - List all missions
router.get('/', optionalAuth, async (req: Request, res: Response) => {
    try {
        const { status, type } = req.query;

        let missionList = Array.from(missions.values());

        // Filter by status
        if (status) {
            missionList = missionList.filter(m => m.status === status);
        }

        // Filter by type
        if (type) {
            missionList = missionList.filter(m => m.type === type);
        }

        // Sort by creation date, newest first
        missionList.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

        // Update relative times
        missionList = missionList.map(m => ({
            ...m,
            startTime: getRelativeTime(m.createdAt)
        }));

        res.json(formatResponse(missionList));
    } catch (error) {
        console.error('Failed to list missions:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to list missions'
        });
    }
});

// GET /api/missions/:id - Get mission by ID
router.get('/:id', optionalAuth, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const mission = missions.get(id);

        if (!mission) {
            return res.status(404).json({
                success: false,
                error: 'Mission not found'
            });
        }

        res.json(formatResponse({
            ...mission,
            startTime: getRelativeTime(mission.createdAt)
        }));
    } catch (error) {
        console.error('Failed to get mission:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get mission'
        });
    }
});

// POST /api/missions - Create new mission
router.post('/', optionalAuth, async (req: Request, res: Response) => {
    try {
        const { type, input } = req.body;
        const userId = (req as any).user?.id;

        if (!type || !input) {
            return res.status(400).json({
                success: false,
                error: 'Type and input are required'
            });
        }

        // Validate type
        if (!['TICKET', 'SCOUT', 'CONCIERGE'].includes(type)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid mission type'
            });
        }

        missionCounter++;
        const id = `MSN-2025-${String(missionCounter).padStart(3, '0')}`;

        // Determine title based on type
        let title: string;
        let agent: string;

        switch (type) {
            case 'TICKET':
                title = input.slice(0, 50) + (input.length > 50 ? '...' : '');
                agent = 'QA Architect';
                break;
            case 'SCOUT':
                try {
                    const url = new URL(input);
                    title = `Explore ${url.hostname}`;
                } catch {
                    title = `Explore ${input.slice(0, 30)}`;
                }
                agent = 'The Scout';
                break;
            case 'CONCIERGE':
                title = `Onboard ${input.split('/').pop() || input.slice(0, 30)}`;
                agent = 'The Concierge';
                break;
            default:
                title = input.slice(0, 50);
                agent = 'Unknown Agent';
        }

        const newMission: Mission = {
            id,
            type: type as MissionType,
            title,
            input,
            status: 'QUEUED',
            agent,
            progress: 0,
            startTime: 'Just now',
            createdAt: new Date(),
            userId
        };

        missions.set(id, newMission);

        // Simulate mission processing
        setTimeout(() => {
            const mission = missions.get(id);
            if (mission && mission.status === 'QUEUED') {
                mission.status = 'ACTIVE';
                mission.progress = 10;
            }
        }, 2000);

        // Simulate mission progress
        simulateMissionProgress(id);

        res.status(201).json(formatResponse(newMission, 'Mission created successfully'));
    } catch (error) {
        console.error('Failed to create mission:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create mission'
        });
    }
});

// Simulate mission progress
const simulateMissionProgress = (id: string) => {
    const interval = setInterval(() => {
        const mission = missions.get(id);
        if (!mission) {
            clearInterval(interval);
            return;
        }

        if (mission.status === 'ACTIVE' && mission.progress < 100) {
            mission.progress = Math.min(mission.progress + Math.random() * 15, 100);

            if (mission.progress >= 100) {
                mission.status = 'COMPLETED';
                mission.progress = 100;
                clearInterval(interval);
            }
        } else if (mission.status === 'QUEUED') {
            mission.status = 'ACTIVE';
            mission.progress = 5;
        } else if (mission.status === 'COMPLETED' || mission.status === 'FAILED') {
            clearInterval(interval);
        }
    }, 3000);
};

// DELETE /api/missions/:id - Delete mission
router.delete('/:id', optionalAuth, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        if (!missions.has(id)) {
            return res.status(404).json({
                success: false,
                error: 'Mission not found'
            });
        }

        missions.delete(id);

        res.json(formatResponse(null, 'Mission deleted successfully'));
    } catch (error) {
        console.error('Failed to delete mission:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete mission'
        });
    }
});

// POST /api/missions/:id/cancel - Cancel mission
router.post('/:id/cancel', optionalAuth, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const mission = missions.get(id);

        if (!mission) {
            return res.status(404).json({
                success: false,
                error: 'Mission not found'
            });
        }

        if (mission.status === 'COMPLETED' || mission.status === 'FAILED') {
            return res.status(400).json({
                success: false,
                error: 'Cannot cancel a completed or failed mission'
            });
        }

        mission.status = 'FAILED';

        res.json(formatResponse(mission, 'Mission cancelled'));
    } catch (error) {
        console.error('Failed to cancel mission:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to cancel mission'
        });
    }
});

// GET /api/missions/stats - Get mission statistics
router.get('/stats/summary', optionalAuth, async (req: Request, res: Response) => {
    try {
        const missionList = Array.from(missions.values());

        const stats = {
            total: missionList.length,
            active: missionList.filter(m => m.status === 'ACTIVE').length,
            completed: missionList.filter(m => m.status === 'COMPLETED').length,
            failed: missionList.filter(m => m.status === 'FAILED').length,
            queued: missionList.filter(m => m.status === 'QUEUED').length,
            byType: {
                TICKET: missionList.filter(m => m.type === 'TICKET').length,
                SCOUT: missionList.filter(m => m.type === 'SCOUT').length,
                CONCIERGE: missionList.filter(m => m.type === 'CONCIERGE').length
            }
        };

        res.json(formatResponse(stats));
    } catch (error) {
        console.error('Failed to get mission stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get mission stats'
        });
    }
});

export default router;
