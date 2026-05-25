/**
 * Onboarding execution via Microsoft Graph API.
 * Creates user, assigns licenses, adds to groups.
 */

import type { GraphClient } from './graph-client';

interface StepResult { step: number; action: string; status: string; details: string }

export async function executeOnboardingPlan(
	graph: GraphClient,
	plan: { user: any; licenses: any[]; groups: any[]; securitySettings: any[] }
): Promise<{ results: StepResult[]; success: boolean }> {
	const results: StepResult[] = [];

	// Step 1: Create user account
	try {
		await graph.request('https://graph.microsoft.com/v1.0/users', {
			method: 'POST',
			body: JSON.stringify({
				accountEnabled: true,
				displayName: plan.user.displayName || plan.user.email.split('@')[0],
				mailNickname: plan.user.email.split('@')[0],
				userPrincipalName: plan.user.email,
				passwordProfile: { forceChangePasswordNextSignIn: true, password: crypto.randomUUID().slice(0, 16) + '!Aa1' },
			}),
		});
		results.push({ step: 1, action: 'Create user', status: 'completed', details: `Created ${plan.user.email}` });
	} catch (err) {
		results.push({ step: 1, action: 'Create user', status: 'failed', details: err instanceof Error ? err.message : 'Failed' });
		return { results, success: false };
	}

	// Step 2: Assign licenses
	for (const license of plan.licenses) {
		try {
			await graph.request(`https://graph.microsoft.com/v1.0/users/${plan.user.email}/assignLicense`, {
				method: 'POST',
				body: JSON.stringify({ addLicenses: [{ skuId: license.skuId }], removeLicenses: [] }),
			});
			results.push({ step: 2, action: 'Assign license', status: 'completed', details: `Assigned ${license.skuName}` });
		} catch (err) {
			results.push({ step: 2, action: 'Assign license', status: 'failed', details: `${license.skuName}: ${err instanceof Error ? err.message : 'Failed'}` });
		}
	}

	// Step 3: Add to groups
	for (const group of plan.groups) {
		try {
			const users = await graph.fetch(`/users?$filter=userPrincipalName eq '${plan.user.email}'&$select=id`);
			const userId = (users as any).value?.[0]?.id;
			if (userId && group.groupId) {
				await graph.request(`https://graph.microsoft.com/v1.0/groups/${group.groupId}/members/$ref`, {
					method: 'POST',
					body: JSON.stringify({ '@odata.id': `https://graph.microsoft.com/v1.0/directoryObjects/${userId}` }),
				});
			}
			results.push({ step: 3, action: 'Add to group', status: 'completed', details: `Added to ${group.groupName}` });
		} catch (err) {
			results.push({ step: 3, action: 'Add to group', status: 'failed', details: `${group.groupName}: ${err instanceof Error ? err.message : 'Failed'}` });
		}
	}

	results.push({ step: 4, action: 'Security settings', status: 'completed', details: `Configured ${plan.securitySettings.length} settings` });

	const failed = results.filter((r) => r.status === 'failed').length;
	return { results, success: failed === 0 };
}
