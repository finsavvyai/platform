/**
 * Integrations Routes
 * Manages third-party integrations (Jira, Slack, GitHub, etc.)
 */

import { Router, Request, Response } from 'express';
import { optionalAuth } from '../middleware/auth.js';

const router = Router();

// Types
interface Integration {
    id: string;
    name: string;
    type: 'jira' | 'slack' | 'github' | 'gitlab' | 'jenkins' | 'azure_devops' | 'testrail';
    status: 'connected' | 'disconnected' | 'error';
    config?: Record<string, any>;
    lastSync?: string;
    createdAt: Date;
}

// In-memory store for integrations
const integrations: Map<string, Integration> = new Map();

// Initialize with demo data
const initIntegrations = () => {
    const demoIntegrations: Integration[] = [
        {
            id: 'INT-001',
            name: 'Jira Cloud',
            type: 'jira',
            status: 'connected',
            config: { domain: 'yourcompany.atlassian.net' },
            lastSync: '5 mins ago',
            createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        },
        {
            id: 'INT-002',
            name: 'Slack Workspace',
            type: 'slack',
            status: 'connected',
            config: { channel: '#qestro-alerts' },
            lastSync: '2 mins ago',
            createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
        },
        {
            id: 'INT-003',
            name: 'GitHub',
            type: 'github',
            status: 'disconnected',
            createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        },
        {
            id: 'INT-004',
            name: 'Jenkins CI',
            type: 'jenkins',
            status: 'error',
            config: { url: 'https://jenkins.example.com' },
            lastSync: '1 hour ago',
            createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
        }
    ];
    demoIntegrations.forEach(i => integrations.set(i.id, i));
};
initIntegrations();

// Helper to format response
const formatResponse = (data: any, message?: string) => ({
    success: true,
    data,
    message,
    timestamp: new Date().toISOString()
});

// GET /api/integrations - List all integrations
router.get('/', optionalAuth, async (req: Request, res: Response) => {
    try {
        const { type, status } = req.query;

        let integrationList = Array.from(integrations.values());

        if (type) {
            integrationList = integrationList.filter(i => i.type === type);
        }
        if (status) {
            integrationList = integrationList.filter(i => i.status === status);
        }

        res.json(formatResponse(integrationList));
    } catch (error) {
        console.error('Failed to list integrations:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to list integrations'
        });
    }
});

// GET /api/integrations/available - List available integration types
router.get('/available', optionalAuth, async (req: Request, res: Response) => {
    try {
        const availableIntegrations = [
            { type: 'jira', name: 'Jira', description: 'Import tickets and sync test results', icon: 'jira' },
            { type: 'slack', name: 'Slack', description: 'Receive notifications and alerts', icon: 'slack' },
            { type: 'github', name: 'GitHub', description: 'Sync with repositories and CI/CD', icon: 'github' },
            { type: 'gitlab', name: 'GitLab', description: 'Sync with repositories and CI/CD', icon: 'gitlab' },
            { type: 'jenkins', name: 'Jenkins', description: 'Trigger builds and pipelines', icon: 'settings' },
            { type: 'azure_devops', name: 'Azure DevOps', description: 'Sync with Azure boards and pipelines', icon: 'cloud' },
            { type: 'testrail', name: 'TestRail', description: 'Import and export test cases', icon: 'clipboard' }
        ];

        res.json(formatResponse(availableIntegrations));
    } catch (error) {
        console.error('Failed to list available integrations:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to list available integrations'
        });
    }
});

// GET /api/integrations/:id - Get integration by ID
router.get('/:id', optionalAuth, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const integration = integrations.get(id);

        if (!integration) {
            return res.status(404).json({
                success: false,
                error: 'Integration not found'
            });
        }

        res.json(formatResponse(integration));
    } catch (error) {
        console.error('Failed to get integration:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get integration'
        });
    }
});

// POST /api/integrations - Create/connect new integration
router.post('/', optionalAuth, async (req: Request, res: Response) => {
    try {
        const { type, name, config } = req.body;

        if (!type || !name) {
            return res.status(400).json({
                success: false,
                error: 'Type and name are required'
            });
        }

        const id = `INT-${String(integrations.size + 1).padStart(3, '0')}`;

        const newIntegration: Integration = {
            id,
            name,
            type,
            status: 'connected',
            config: config || {},
            lastSync: 'Just now',
            createdAt: new Date()
        };

        integrations.set(id, newIntegration);

        res.status(201).json(formatResponse(newIntegration, 'Integration connected successfully'));
    } catch (error) {
        console.error('Failed to create integration:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create integration'
        });
    }
});

// PATCH /api/integrations/:id - Update integration
router.patch('/:id', optionalAuth, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const integration = integrations.get(id);

        if (!integration) {
            return res.status(404).json({
                success: false,
                error: 'Integration not found'
            });
        }

        const { name, config, status } = req.body;

        if (name) integration.name = name;
        if (config) integration.config = { ...integration.config, ...config };
        if (status) integration.status = status;

        res.json(formatResponse(integration, 'Integration updated successfully'));
    } catch (error) {
        console.error('Failed to update integration:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update integration'
        });
    }
});

// DELETE /api/integrations/:id - Disconnect/delete integration
router.delete('/:id', optionalAuth, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        if (!integrations.has(id)) {
            return res.status(404).json({
                success: false,
                error: 'Integration not found'
            });
        }

        integrations.delete(id);

        res.json(formatResponse(null, 'Integration disconnected successfully'));
    } catch (error) {
        console.error('Failed to delete integration:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete integration'
        });
    }
});

// POST /api/integrations/:id/sync - Trigger sync
router.post('/:id/sync', optionalAuth, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const integration = integrations.get(id);

        if (!integration) {
            return res.status(404).json({
                success: false,
                error: 'Integration not found'
            });
        }

        integration.lastSync = 'Just now';

        res.json(formatResponse(integration, 'Sync triggered successfully'));
    } catch (error) {
        console.error('Failed to sync integration:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to sync integration'
        });
    }
});

export default router;
