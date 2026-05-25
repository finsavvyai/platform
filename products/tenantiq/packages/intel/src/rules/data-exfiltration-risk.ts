/**
 * SEC-010: Data Exfiltration Risk Detection
 * Detects patterns indicating potential data exfiltration
 */

import type { Rule, Tenant, TenantData, AlertCandidate } from '@tenantiq/shared';
import type { FileActivity } from './advanced-security-types';

export const dataExfiltrationRisk: Rule = {
	id: 'SEC-010',
	name: 'Potential data exfiltration detected',
	severity: 'critical',
	category: 'security',
	remediationType: 'manual',
	async evaluate(_tenant: Tenant, data: TenantData): Promise<AlertCandidate[]> {
		const fileActivities = ((data as any).fileActivities ?? []) as FileActivity[];

		const downloads = fileActivities.filter(a => a.action === 'download');
		const last24h = Date.now() - (24 * 60 * 60 * 1000);
		const recentDownloads = downloads.filter(d =>
			new Date(d.timestamp).getTime() > last24h
		);

		const downloadsByUser = new Map<string, FileActivity[]>();
		recentDownloads.forEach(download => {
			const existing = downloadsByUser.get(download.userEmail) || [];
			existing.push(download);
			downloadsByUser.set(download.userEmail, existing);
		});

		const suspiciousUsers: Array<{
			email: string;
			fileCount: number;
			reason: string;
		}> = [];

		downloadsByUser.forEach((userDownloads, userEmail) => {
			const totalFiles = userDownloads.reduce((sum, d) => sum + d.fileCount, 0);

			if (totalFiles > 100) {
				suspiciousUsers.push({
					email: userEmail,
					fileCount: totalFiles,
					reason: 'Unusually high download volume in 24 hours'
				});
			}

			const externalDownloads = userDownloads.filter(d =>
				d.destination && !d.destination.includes('sharepoint') && !d.destination.includes('onedrive')
			);

			if (externalDownloads.length > 20) {
				suspiciousUsers.push({
					email: userEmail,
					fileCount: externalDownloads.reduce((sum, d) => sum + d.fileCount, 0),
					reason: 'High volume of downloads to external locations'
				});
			}
		});

		if (suspiciousUsers.length > 0) {
			return [{
				ruleId: 'SEC-010',
				title: `Potential data exfiltration by ${suspiciousUsers.length} user(s)`,
				description: 'Detected unusually high file download activity that may indicate data theft.',
				businessImpact: 'Critical: Sensitive data may be leaving the organization',
				affectedResources: suspiciousUsers.map(u => ({
					type: 'user',
					email: u.email,
					fileCount: u.fileCount,
					reason: u.reason
				})),
				recommendedAction: 'Investigate immediately. Consider revoking access and contacting legal/security team.'
			}];
		}

		return [];
	}
};
