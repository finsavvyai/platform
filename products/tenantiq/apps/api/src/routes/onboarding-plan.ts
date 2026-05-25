/**
 * Onboarding plan generation handler.
 * Split from onboarding.ts to stay under 200-line limit.
 */
import {
	analyzePeerUsers,
	generateProvisioningPlan,
	type OnboardingRequest,
} from '@tenantiq/ai/tools/onboarding-advisor';
import { getUsersByTenant } from '@tenantiq/db';
import type { Context } from 'hono';
import type { AppEnv } from '../index';
import { getDb } from '../lib/db';

/**
 * POST /api/onboarding/plan
 * Generate intelligent onboarding plan for a new employee
 */
export async function handlePlan(c: Context<AppEnv>) {
	const tenantId = c.get('tenantId');
	const db = getDb(c.env);

	try {
		const body = await c.req.json<OnboardingRequest>();

		if (!body.userName || !body.email || !body.role || !body.department || !body.startDate) {
			return c.json(
				{
					error: 'Bad Request',
					message: 'Missing required fields: userName, email, role, department, startDate',
				},
				400
			);
		}

		let peerData;
		if (body.similarUserEmail) {
			peerData = await analyzePeers(db, tenantId, body);
		}

		const plan = generateProvisioningPlan(body, peerData);

		return c.json({
			success: true,
			data: plan,
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		console.error('Onboarding plan generation failed:', error);
		return c.json(
			{
				error: 'Internal Server Error',
			},
			500
		);
	}
}

async function analyzePeers(db: ReturnType<typeof getDb>, tenantId: string, body: OnboardingRequest) {
	const users = await getUsersByTenant(db as any, tenantId);
	const similarUser = users.find((u) => u.email === body.similarUserEmail);

	if (!similarUser) return undefined;

	const similarLicenses = (similarUser.assignedLicenses as string[]) || [];
	const peerUsers = users.filter((u) => {
		const userLicenses = (u.assignedLicenses as string[]) || [];
		return userLicenses.some((l) => similarLicenses.includes(l));
	});

	const peerDataForAnalysis = peerUsers.map((u) => ({
		displayName: u.displayName || '',
		email: u.email || '',
		jobTitle: body.role,
		department: body.department,
		assignedLicenses: (u.assignedLicenses as string[]) || [],
		groups: [],
	}));

	return analyzePeerUsers(peerDataForAnalysis);
}
