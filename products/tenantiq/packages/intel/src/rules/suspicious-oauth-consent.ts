/**
 * SEC-008: Suspicious OAuth Application Consent
 * Detects risky OAuth app permissions
 */

import type { Rule, Tenant, TenantData, AlertCandidate } from '@tenantiq/shared';
import type { ServicePrincipal } from './advanced-security-types';

const RISKY_SCOPES = [
	'Mail.Read',
	'Mail.ReadWrite',
	'Files.ReadWrite.All',
	'Sites.ReadWrite.All',
	'User.ReadWrite.All',
	'Directory.ReadWrite.All'
];

export const suspiciousOAuthConsent: Rule = {
	id: 'SEC-008',
	name: 'Suspicious OAuth application consent detected',
	severity: 'high',
	category: 'security',
	remediationType: 'manual',
	async evaluate(_tenant: Tenant, data: TenantData): Promise<AlertCandidate[]> {
		const servicePrincipals = ((data as any).servicePrincipals ?? []) as ServicePrincipal[];

		const suspiciousApps: Array<{
			name: string;
			appId: string;
			publisher: string;
			riskyPermissions: string[];
		}> = [];

		servicePrincipals.forEach(app => {
			const permissions = app.oauth2PermissionScopes?.map(s => s.value) || [];
			const foundRiskyPerms = permissions.filter(p => RISKY_SCOPES.includes(p));

			if (foundRiskyPerms.length > 0 && (!app.publisherName || app.publisherName === 'Unknown')) {
				suspiciousApps.push({
					name: app.displayName,
					appId: app.appId,
					publisher: app.publisherName || 'Unknown',
					riskyPermissions: foundRiskyPerms
				});
			}
		});

		if (suspiciousApps.length > 0) {
			return [{
				ruleId: 'SEC-008',
				title: `${suspiciousApps.length} OAuth app(s) with suspicious permissions`,
				description: 'Detected OAuth applications from unknown publishers with high-risk permission scopes.',
				businessImpact: 'High: Malicious apps can exfiltrate data or perform unauthorized actions',
				affectedResources: suspiciousApps.map(app => ({
					type: 'application',
					name: app.name,
					appId: app.appId,
					publisher: app.publisher,
					riskyPermissions: app.riskyPermissions
				})),
				recommendedAction: 'Review and revoke consent for suspicious applications. Investigate app usage.'
			}];
		}

		return [];
	}
};
