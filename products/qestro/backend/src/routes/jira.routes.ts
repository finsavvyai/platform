// Jira Integration Routes
// OAuth flow, project import, and synchronization

import { Router } from 'express';
import { z } from 'zod';
import { jiraAuthService } from '../services/JiraAuthService.js';
import { jiraAPIService } from '../services/JiraAPIService.js';


const router = Router();

// Handle preflight requests for Jira routes specifically
router.options('*', (req, res) => {
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.status(200).send();
});

// Middleware to ensure headers on all Jira responses
router.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
});

// Validation schemas
const importProjectSchema = z.object({
    jiraProjectKey: z.string().min(1),
    importEpics: z.boolean().default(true),
    importIssues: z.boolean().default(true),
});

// GET /api/jira/auth/url - Get OAuth authorization URL
router.get('/auth/url', async (req, res) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const state = `user:${userId}`;
        const url = jiraAuthService.getAuthorizationURL(state);

        res.json({ url });
    } catch (error) {
        console.error('Error generating auth URL:', error);
        res.status(500).json({ error: 'Failed to generate authorization URL' });
    }
});

// GET /api/jira/auth/callback - OAuth callback handler
router.get('/auth/callback', async (req, res) => {
    try {
        const { code, state } = req.query;

        if (!code || typeof code !== 'string') {
            return res.status(400).json({ error: 'Missing authorization code' });
        }

        // Extract user ID from state
        const userId = state?.toString().replace('user:', '');
        if (!userId) {
            return res.status(400).json({ error: 'Invalid state parameter' });
        }

        // Exchange code for tokens
        const tokens = await jiraAuthService.exchangeCodeForToken(code);

        // Get accessible Jira sites
        const resources = await jiraAuthService.getAccessibleResources(tokens.access_token);

        if (resources.length === 0) {
            return res.status(400).json({ error: 'No accessible Jira sites found' });
        }

        // Use the first site (users typically have one)
        const site = resources[0];

        // Store connection in database
        const db = req.app.locals.db;
        const connectionId = crypto.randomUUID();
        const now = Math.floor(Date.now() / 1000);

        await db.insert('jira_connections').values({
            id: connectionId,
            user_id: userId,
            jira_url: site.url,
            jira_cloud_id: site.id,
            access_token: jiraAuthService.encrypt(tokens.access_token),
            refresh_token: jiraAuthService.encrypt(tokens.refresh_token),
            token_expires_at: now + tokens.expires_in,
            is_active: true,
            created_at: now,
            updated_at: now,
        });

        // Redirect to frontend settings page
        res.redirect(`${process.env.FRONTEND_URL}/settings?jira=connected`);
    } catch (error) {
        console.error('Error in OAuth callback:', error);
        res.redirect(`${process.env.FRONTEND_URL}/settings?jira=error`);
    }
});

// GET /api/jira/connection - Get user's Jira connection status
router.get('/connection', async (req, res) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const db = req.app.locals.db;
        const connection = await db
            .select()
            .from('jira_connections')
            .where('user_id', userId)
            .where('is_active', true)
            .first();

        if (!connection) {
            return res.json({ connected: false });
        }

        res.json({
            connected: true,
            jiraUrl: connection.jira_url,
            connectedAt: connection.created_at,
        });
    } catch (error) {
        console.error('Error getting connection:', error);
        res.status(500).json({ error: 'Failed to get connection status' });
    }
});

// DELETE /api/jira/connection - Disconnect Jira
router.delete('/connection', async (req, res) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const db = req.app.locals.db;
        await db
            .update('jira_connections')
            .set({ is_active: false, updated_at: Math.floor(Date.now() / 1000) })
            .where('user_id', userId);

        res.status(204).send();
    } catch (error) {
        console.error('Error disconnecting:', error);
        res.status(500).json({ error: 'Failed to disconnect' });
    }
});

// POST /api/jira/import/project - Import Jira project
router.post('/import/project', async (req, res) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const data = importProjectSchema.parse(req.body);
        const db = req.app.locals.db;

        // Get active Jira connection
        const connection = await db
            .select()
            .from('jira_connections')
            .where('user_id', userId)
            .where('is_active', true)
            .first();

        if (!connection) {
            return res.status(404).json({ error: 'No active Jira connection' });
        }

        // Decrypt token
        const accessToken = jiraAuthService.decrypt(connection.access_token);

        // Fetch project from Jira
        const jiraProject = await jiraAPIService.getProject(
            {
                jiraUrl: connection.jira_url,
                jiraCloudId: connection.jira_cloud_id,
                accessToken,
            },
            data.jiraProjectKey
        );

        const now = Math.floor(Date.now() / 1000);
        const projectId = crypto.randomUUID();

        // Import project
        await db.insert('jira_projects').values({
            id: projectId,
            connection_id: connection.id,
            jira_project_id: jiraProject.id,
            jira_project_key: jiraProject.key,
            name: jiraProject.name,
            description: jiraProject.description,
            project_type: jiraProject.projectTypeKey,
            lead: jiraProject.lead?.displayName,
            avatar_url: jiraProject.avatarUrls?.['48x48'],
            last_sync_at: now,
            created_at: now,
            updated_at: now,
        });

        let epicCount = 0;
        let issueCount = 0;

        // Import epics
        if (data.importEpics) {
            const epics = await jiraAPIService.getEpics(
                { ...connection, accessToken },
                data.jiraProjectKey
            );

            for (const epic of epics) {
                await db.insert('jira_epics').values({
                    id: crypto.randomUUID(),
                    jira_project_id: projectId,
                    jira_epic_id: epic.id,
                    jira_epic_key: epic.key,
                    summary: epic.fields.summary,
                    description: epic.fields.description,
                    status: epic.fields.status?.name,
                    priority: epic.fields.priority?.name,
                    assignee: epic.fields.assignee?.displayName,
                    reporter: epic.fields.reporter?.displayName,
                    labels: JSON.stringify(epic.fields.labels || []),
                    created_at: now,
                    updated_at: now,
                });
                epicCount++;
            }
        }

        // Import issues
        if (data.importIssues) {
            const issues = await jiraAPIService.getIssues(
                { ...connection, accessToken },
                data.jiraProjectKey
            );

            for (const issue of issues) {
                const sprint = jiraAPIService.parseSprintField(issue.fields.sprint);

                await db.insert('jira_issues').values({
                    id: crypto.randomUUID(),
                    jira_project_id: projectId,
                    jira_epic_id: issue.fields.parent?.key ?
                        (await db.select().from('jira_epics').where('jira_epic_key', issue.fields.parent.key).first())?.id :
                        null,
                    jira_issue_id: issue.id,
                    jira_issue_key: issue.key,
                    issue_type: issue.fields.issuetype?.name,
                    summary: issue.fields.summary,
                    description: issue.fields.description,
                    status: issue.fields.status?.name,
                    priority: issue.fields.priority?.name,
                    assignee: issue.fields.assignee?.displayName,
                    reporter: issue.fields.reporter?.displayName,
                    sprint_id: sprint?.id,
                    sprint_name: sprint?.name,
                    story_points: issue.fields.customfield_10016,
                    labels: JSON.stringify(issue.fields.labels || []),
                    acceptance_criteria: jiraAPIService.extractAcceptanceCriteria(issue.fields.description),
                    created_at: now,
                    updated_at: now,
                });
                issueCount++;
            }
        }

        res.json({
            success: true,
            project: {
                id: projectId,
                key: jiraProject.key,
                name: jiraProject.name,
            },
            imported: {
                epics: epicCount,
                issues: issueCount,
            },
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.errors });
        }
        console.error('Error importing project:', error);
        res.status(500).json({ error: 'Failed to import project' });
    }
});

// GET /api/jira/projects - List imported projects
router.get('/projects', async (req, res) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const db = req.app.locals.db;
        const projects = await db
            .select()
            .from('jira_projects')
            .leftJoin('jira_connections', 'jira_projects.connection_id', 'jira_connections.id')
            .where('jira_connections.user_id', userId);

        res.json({ projects });
    } catch (error) {
        console.error('Error fetching projects:', error);
        res.status(500).json({ error: 'Failed to fetch projects' });
    }
});

// GET /api/jira/projects/:id/issues - Get issues for a project
router.get('/projects/:id/issues', async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.userId;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const db = req.app.locals.db;
        const issues = await db
            .select()
            .from('jira_issues')
            .where('jira_project_id', id);

        res.json({ issues });
    } catch (error) {
        console.error('Error fetching issues:', error);
        res.status(500).json({ error: 'Failed to fetch issues' });
    }
});

export default router;
