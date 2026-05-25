/**
 * SEC-007: Privileged Account Activity Anomaly Detection
 * Detects unusual activity from admin accounts
 */

import type { Rule, Tenant, TenantData, AlertCandidate } from '@tenantiq/shared';
import type { SignInLog, AdminUser } from './advanced-security-types';

export const privilegedAccountAnomaly: Rule = {
	id: 'SEC-007',
	name: 'Privileged account activity anomaly detected',
	severity: 'critical',
	category: 'security',
	remediationType: 'manual',
	async evaluate(_tenant: Tenant, data: TenantData): Promise<AlertCandidate[]> {
		const signIns = (data.signInLogs ?? []) as unknown as SignInLog[];
		const adminUsers = (data.users ?? []) as unknown as AdminUser[];

		const adminEmails = new Set(
			adminUsers
				.filter(u => u.assignedRoles && u.assignedRoles.length > 0)
				.map(u => u.userPrincipalName)
		);

		const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
		const adminSignIns = signIns.filter(s =>
			adminEmails.has(s.userPrincipalName) &&
			new Date(s.createdDateTime).getTime() > sevenDaysAgo
		);

		const anomalies: Array<{ user: string; reason: string; details: string }> = [];

		const signInsByUser = new Map<string, SignInLog[]>();
		adminSignIns.forEach(signIn => {
			const existing = signInsByUser.get(signIn.userPrincipalName) || [];
			existing.push(signIn);
			signInsByUser.set(signIn.userPrincipalName, existing);
		});

		signInsByUser.forEach((userSignIns, userEmail) => {
			const nightSignIns = userSignIns.filter(s => {
				const hour = new Date(s.createdDateTime).getHours();
				return hour >= 22 || hour <= 5;
			});

			if (nightSignIns.length > 5) {
				anomalies.push({
					user: userEmail,
					reason: 'Unusual sign-in times',
					details: `${nightSignIns.length} sign-ins between 10 PM and 5 AM`
				});
			}

			const locations = new Set(userSignIns.map(s =>
				s.location?.city || 'Unknown'
			));

			if (locations.size > 3) {
				anomalies.push({
					user: userEmail,
					reason: 'Multiple locations',
					details: `Sign-ins from ${locations.size} different cities in 7 days`
				});
			}

			if (userSignIns.length > 50) {
				anomalies.push({
					user: userEmail,
					reason: 'Unusually high sign-in frequency',
					details: `${userSignIns.length} sign-ins in 7 days (avg: ${(userSignIns.length / 7).toFixed(1)}/day)`
				});
			}
		});

		if (anomalies.length > 0) {
			return [{
				ruleId: 'SEC-007',
				title: `Anomalous activity detected for ${anomalies.length} privileged account(s)`,
				description: 'Detected unusual sign-in patterns for admin accounts that may indicate compromise.',
				businessImpact: 'Critical: Privileged accounts with anomalous behavior pose significant security risk',
				affectedResources: anomalies.map(a => ({
					type: 'user',
					email: a.user,
					reason: a.reason,
					details: a.details
				})),
				recommendedAction: 'Investigate immediately. Consider revoking sessions and forcing password reset.'
			}];
		}

		return [];
	}
};
