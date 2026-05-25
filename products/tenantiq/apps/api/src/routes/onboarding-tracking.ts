/**
 * Onboarding tracking routes — templates, checklists, status, progress.
 * Split from onboarding.ts to stay under 200-line limit.
 */
import {
	generateOnboardingChecklist,
	generateStatusNotification,
	generateWelcomeEmail,
	calculateProgress,
	estimateCompletion,
	type OnboardingStatus,
	type OnboardingStepStatus,
} from '@tenantiq/ai/tools/onboarding-perception';
import type { OnboardingRequest } from '@tenantiq/ai/tools/onboarding-advisor';
import { Hono } from 'hono';
import type { AppEnv } from '../index';
import { authMiddleware, tenantScopingMiddleware } from '../middleware/auth.middleware';
import { standardRateLimit } from '../middleware/rateLimit.middleware';

const onboardingTracking = new Hono<AppEnv>();

onboardingTracking.use('*', authMiddleware);
onboardingTracking.use('*', tenantScopingMiddleware);
onboardingTracking.use('*', standardRateLimit);

/** GET /api/onboarding/templates — Role-based onboarding templates */
onboardingTracking.get('/templates', async (c) => {
	const templates = [
		{ role: 'developer', displayName: 'Software Developer', description: 'Development tools, GitHub access, VPN, E3 license', estimatedCost: { monthly: 38, annual: 456 } },
		{ role: 'marketing', displayName: 'Marketing Professional', description: 'Creative tools, collaboration suite, E3 license', estimatedCost: { monthly: 23, annual: 276 } },
		{ role: 'sales', displayName: 'Sales Representative', description: 'CRM access, communication tools, E3 license', estimatedCost: { monthly: 23, annual: 276 } },
		{ role: 'executive', displayName: 'Executive/Leadership', description: 'Full suite with advanced security, analytics, E5 license', estimatedCost: { monthly: 38, annual: 456 } },
	];
	return c.json({ success: true, data: templates, timestamp: new Date().toISOString() });
});

/** POST /api/onboarding/welcome-email — Generate personalized welcome email */
onboardingTracking.post('/welcome-email', async (c) => {
	try {
		const body = await c.req.json<OnboardingRequest>();
		if (!body.userName || !body.email || !body.role || !body.department || !body.startDate) {
			return c.json({ error: 'Bad Request', message: 'Missing required fields' }, 400);
		}
		const welcomeEmail = generateWelcomeEmail(body.userName, body.email, body.role, body.department, body.startDate, body.manager);
		return c.json({ success: true, data: welcomeEmail, timestamp: new Date().toISOString() });
	} catch (error) {
		console.error('Welcome email generation failed:', error);
		return c.json({ error: 'Internal Server Error' }, 500);
	}
});

/** POST /api/onboarding/checklist — Generate Day 1/Week 1/Month 1 checklist */
onboardingTracking.post('/checklist', async (c) => {
	try {
		const body = await c.req.json<{ role: string; department: string }>();
		if (!body.role || !body.department) {
			return c.json({ error: 'Bad Request', message: 'Missing required fields: role, department' }, 400);
		}
		const checklist = generateOnboardingChecklist(body.role, body.department);
		return c.json({
			success: true,
			data: {
				checklist,
				summary: {
					day1Items: checklist.day1.length,
					week1Items: checklist.week1.length,
					month1Items: checklist.month1.length,
					totalItems: checklist.day1.length + checklist.week1.length + checklist.month1.length,
					estimatedDay1Time: checklist.day1.reduce((sum, item) => sum + (parseInt(item.estimatedTime) || 0), 0),
				},
			},
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		console.error('Checklist generation failed:', error);
		return c.json({ error: 'Internal Server Error' }, 500);
	}
});

/** POST /api/onboarding/status — Track onboarding progress */
onboardingTracking.post('/status', async (c) => {
	try {
		const body = await c.req.json<{
			onboardingId: string; steps: OnboardingStepStatus[];
			employeeName: string; employeeEmail: string; role: string; department: string; startDate: string;
		}>();
		if (!body.onboardingId || !body.steps || !body.employeeName) {
			return c.json({ error: 'Bad Request', message: 'Missing required fields' }, 400);
		}

		const progress = calculateProgress(body.steps);
		const currentStep = body.steps.findIndex((s) => s.status === 'in_progress') + 1 || body.steps.filter((s) => s.status === 'completed').length + 1;

		const status: OnboardingStatus = {
			id: body.onboardingId, employeeName: body.employeeName, employeeEmail: body.employeeEmail,
			role: body.role, department: body.department, startDate: body.startDate,
			status: progress === 100 ? 'completed' : progress > 0 ? 'in_progress' : 'pending',
			currentStep, totalSteps: body.steps.length, progress, steps: body.steps,
			createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
			estimatedCompletion: estimateCompletion(body.steps),
			completedAt: progress === 100 ? new Date().toISOString() : undefined,
		};

		const notifications = {
			employee: generateStatusNotification(status, 'employee'),
			manager: generateStatusNotification(status, 'manager'),
			hr: generateStatusNotification(status, 'hr'),
		};

		return c.json({
			success: true,
			data: { status, notifications, nextSteps: body.steps.filter((s) => s.status === 'pending').slice(0, 3) },
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		console.error('Status tracking failed:', error);
		return c.json({ error: 'Internal Server Error' }, 500);
	}
});

/** GET /api/onboarding/progress/:onboardingId — Real-time progress */
onboardingTracking.get('/progress/:onboardingId', async (c) => {
	const onboardingId = c.req.param('onboardingId');
	try {
		const cached = await c.env.KV.get(`onboarding:${onboardingId}`, 'json');
		if (cached) return c.json({ success: true, data: cached, timestamp: new Date().toISOString() });
		return c.json({ success: true, data: { id: onboardingId, progress: 0, status: 'not_started' }, timestamp: new Date().toISOString() });
	} catch (error) {
		console.error('Progress fetch failed:', error);
		return c.json({ error: 'Internal Server Error', message: 'Failed to fetch progress' }, 500);
	}
});

export default onboardingTracking;
