// Backend route additions for test plan linking and test case creation

import { Router } from 'express';
import { z } from 'zod';

const router = Router();

// Link test plan to Jira epic
router.post('/:id/link-jira', async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.userId;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const schema = z.object({
            jiraProjectId: z.string().optional(),
            jiraEpicId: z.string().optional(),
        });

        const data = schema.parse(req.body);
        const db = req.app.locals.db;

        // Verify test plan exists and belongs to user
        const testPlan = await db
            .select()
            .from('test_plans')
            .where('id', id)
            .where('user_id', userId)
            .first();

        if (!testPlan) {
            return res.status(404).json({ error: 'Test plan not found' });
        }

        // Create link
        const linkId = crypto.randomUUID();
        const now = Math.floor(Date.now() / 1000);

        await db.insert('test_plan_jira_links').values({
            id: linkId,
            test_plan_id: id,
            jira_project_id: data.jiraProjectId,
            jira_epic_id: data.jiraEpicId,
            created_at: now,
        });

        res.json({ success: true, linkId });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.errors });
        }
        console.error('Error linking test plan:', error);
        res.status(500).json({ error: 'Failed to link test plan' });
    }
});

// Get Jira links for a test plan
router.get('/:id/jira-links', async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.userId;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const db = req.app.locals.db;

        const links = await db
            .select()
            .from('test_plan_jira_links')
            .leftJoin('jira_projects', 'test_plan_jira_links.jira_project_id', 'jira_projects.id')
            .leftJoin('jira_epics', 'test_plan_jira_links.jira_epic_id', 'jira_epics.id')
            .where('test_plan_jira_links.test_plan_id', id);

        res.json({ links });
    } catch (error) {
        console.error('Error fetching links:', error);
        res.status(500).json({ error: 'Failed to fetch links' });
    }
});

// Create test cases from Jira story
router.post('/create-from-jira', async (req, res) => {
    try {
        const userId = req.user?.userId;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const schema = z.object({
            jiraIssueId: z.string(),
            projectId: z.string(),
            generateFromAcceptanceCriteria: z.boolean().default(true),
        });

        const data = schema.parse(req.body);
        const db = req.app.locals.db;

        // Get Jira issue
        const jiraIssue = await db
            .select()
            .from('jira_issues')
            .where('id', data.jiraIssueId)
            .first();

        if (!jiraIssue) {
            return res.status(404).json({ error: 'Jira issue not found' });
        }

        const now = Math.floor(Date.now() / 1000);
        const testCases = [];

        if (data.generateFromAcceptanceCriteria && jiraIssue.acceptance_criteria) {
            // Parse acceptance criteria and create test cases
            const criteria = jiraIssue.acceptance_criteria.split('\n').filter(c => c.trim());

            for (let i = 0; i < criteria.length; i++) {
                const criterion = criteria[i].trim();
                if (!criterion) continue;

                const testCaseId = crypto.randomUUID();

                await db.insert('test_cases').values({
                    id: testCaseId,
                    project_id: data.projectId,
                    user_id: userId,
                    title: `${jiraIssue.summary} - AC${i + 1}`,
                    description: criterion,
                    type: 'functional',
                    priority: jiraIssue.priority?.toLowerCase() || 'medium',
                    status: 'draft',
                    steps: JSON.stringify([
                        {
                            stepNumber: 1,
                            action: 'Verify: ' + criterion,
                            expected: 'Criterion is met',
                        },
                    ]),
                    created_at: now,
                    updated_at: now,
                });

                // Link to Jira issue
                await db.insert('test_case_jira_links').values({
                    id: crypto.randomUUID(),
                    test_case_id: testCaseId,
                    jira_issue_id: data.jiraIssueId,
                    created_at: now,
                });

                testCases.push({ id: testCaseId });
            }
        } else {
            // Create single test case for the story
            const testCaseId = crypto.randomUUID();

            await db.insert('test_cases').values({
                id: testCaseId,
                project_id: data.projectId,
                user_id: userId,
                title: jiraIssue.summary,
                description: jiraIssue.description || '',
                type: 'functional',
                priority: jiraIssue.priority?.toLowerCase() || 'medium',
                status: 'draft',
                steps: JSON.stringify([
                    {
                        stepNumber: 1,
                        action: 'Test the story: ' + jiraIssue.summary,
                        expected: 'Story requirements are met',
                    },
                ]),
                created_at: now,
                updated_at: now,
            });

            // Link to Jira issue
            await db.insert('test_case_jira_links').values({
                id: crypto.randomUUID(),
                test_case_id: testCaseId,
                jira_issue_id: data.jiraIssueId,
                created_at: now,
            });

            testCases.push({ id: testCaseId });
        }

        res.json({
            success: true,
            testCases,
            count: testCases.length,
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.errors });
        }
        console.error('Error creating test cases:', error);
        res.status(500).json({ error: 'Failed to create test cases' });
    }
});

export { router as testPlanExtensions };
