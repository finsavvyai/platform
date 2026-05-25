/**
 * Security posture analysis helpers.
 * Used by security.ts routes — extracted to keep route files under 200 lines.
 */

import type { GraphClient } from './graph-client';
import {
	getConditionalAccessPolicies,
	getMfaRegistrationDetails,
	getDirectoryRoles,
	getAppRegistrations,
} from './graph-client-extended';

export async function analyzeSecurityPosture(graph: GraphClient) {
	const [mfaDetails, caPolicies, directoryRoles, appRegistrations] =
		await Promise.all([
			getMfaRegistrationDetails(graph),
			getConditionalAccessPolicies(graph),
			getDirectoryRoles(graph),
			getAppRegistrations(graph),
		]);

	const mfaRegistered = mfaDetails.filter((u: any) => u.isMfaRegistered);
	const mfaCapable = mfaDetails.filter((u: any) => u.isMfaCapable);
	const passwordlessCapable = mfaDetails.filter((u: any) => u.isPasswordlessCapable);

	const caEnabled = caPolicies.filter((p: any) => p.state === 'enabled');
	const caByGrant = caEnabled.reduce(
		(acc: Record<string, number>, p: any) => {
			const grant = p.grantControls?.builtInControls?.[0] || 'other';
			acc[grant] = (acc[grant] || 0) + 1;
			return acc;
		},
		{}
	);

	const globalAdmins = directoryRoles.find(
		(r: any) => r.displayName === 'Global Administrator'
	);
	const adminCount = globalAdmins?.members?.length || 0;

	const now = new Date();
	const expiringApps = appRegistrations.filter((app: any) => {
		const creds = [...(app.passwordCredentials || []), ...(app.keyCredentials || [])];
		return creds.some((cred: any) => {
			const daysLeft = (new Date(cred.endDateTime).getTime() - now.getTime()) / 86400000;
			return daysLeft < 30 && daysLeft > 0;
		});
	});

	return {
		mfa: {
			total: mfaDetails.length,
			registered: mfaRegistered.length,
			capable: mfaCapable.length,
			passwordlessCapable: passwordlessCapable.length,
			adoptionRate: mfaDetails.length > 0
				? Math.round((mfaRegistered.length / mfaDetails.length) * 100)
				: 0,
		},
		conditionalAccess: {
			totalPolicies: caPolicies.length,
			enabled: caEnabled.length,
			grantControls: caByGrant,
		},
		adminAccounts: {
			globalAdmins: adminCount,
			recommendation: adminCount > 5
				? 'Too many global admins. Reduce to 2-4.'
				: adminCount < 2
					? 'Add a backup global admin for resilience.'
					: 'Global admin count is within best practice.',
		},
		appCredentials: {
			total: appRegistrations.length,
			expiringSoon: expiringApps.length,
			expiringApps: expiringApps.map((app: any) => ({
				name: app.displayName,
				id: app.id,
			})),
		},
	};
}
