/**
 * Storage Compliance Checker — retention policies, sharing settings,
 * and aggregated compliance reporting for SharePoint/OneDrive.
 */

import type { GraphClient } from '../graph-client';

export interface RetentionFinding {
	siteId: string;
	siteName: string;
	siteUrl: string;
	hasRetentionPolicy: boolean;
	retentionDays: number | null;
}

export interface SharingFinding {
	siteId: string;
	siteName: string;
	siteUrl: string;
	sharingCapability: string;
	externalSharingEnabled: boolean;
	anonymousLinksEnabled: boolean;
}

export interface ComplianceReport {
	tenantId: string;
	scannedAt: string;
	retention: { total: number; withPolicy: number; withoutPolicy: number; findings: RetentionFinding[] };
	sharing: { total: number; overShared: number; findings: SharingFinding[] };
	overallScore: number;
	recommendations: string[];
}

export async function checkRetentionPolicies(graph: GraphClient): Promise<RetentionFinding[]> {
	const findings: RetentionFinding[] = [];
	try {
		const res = await graph.fetch('/sites?$select=id,displayName,webUrl&$top=100');
		const data = await res.json() as any;
		const sites = data.value ?? [];

		for (const site of sites) {
			// Check if site has retention labels applied
			let hasPolicy = false;
			let retentionDays: number | null = null;
			try {
				const labelRes = await graph.fetch(`/sites/${site.id}/informationProtection/policy/labels`);
				const labels = await labelRes.json() as any;
				hasPolicy = (labels.value?.length ?? 0) > 0;
				if (hasPolicy && labels.value[0]?.retentionSettings) {
					retentionDays = labels.value[0].retentionSettings.retentionDurationInDays ?? null;
				}
			} catch { /* labels endpoint may not be available */ }

			findings.push({
				siteId: site.id, siteName: site.displayName ?? 'Unknown',
				siteUrl: site.webUrl ?? '', hasRetentionPolicy: hasPolicy, retentionDays,
			});
		}
	} catch { /* Graph API error — return empty */ }
	return findings;
}

export async function checkSharingSettings(graph: GraphClient): Promise<SharingFinding[]> {
	const findings: SharingFinding[] = [];
	try {
		const res = await graph.fetch('/sites?$select=id,displayName,webUrl,sharingCapability&$top=100');
		const data = await res.json() as any;
		const sites = data.value ?? [];

		for (const site of sites) {
			const cap = String(site.sharingCapability ?? 'unknown');
			findings.push({
				siteId: site.id, siteName: site.displayName ?? 'Unknown',
				siteUrl: site.webUrl ?? '', sharingCapability: cap,
				externalSharingEnabled: ['externalUserAndGuestSharing', 'externalUserSharingOnly'].includes(cap),
				anonymousLinksEnabled: cap === 'externalUserAndGuestSharing',
			});
		}
	} catch { /* Graph API error — return empty */ }
	return findings;
}

export async function generateComplianceReport(
	graph: GraphClient, tenantId: string,
): Promise<ComplianceReport> {
	const [retention, sharing] = await Promise.all([
		checkRetentionPolicies(graph),
		checkSharingSettings(graph),
	]);

	const withPolicy = retention.filter((r) => r.hasRetentionPolicy).length;
	const overShared = sharing.filter((s) => s.anonymousLinksEnabled || s.externalSharingEnabled).length;
	const total = Math.max(retention.length, sharing.length, 1);

	const retentionScore = retention.length > 0 ? (withPolicy / retention.length) * 50 : 25;
	const sharingScore = sharing.length > 0 ? ((sharing.length - overShared) / sharing.length) * 50 : 25;
	const overallScore = Math.round(retentionScore + sharingScore);

	const recommendations: string[] = [];
	if (retention.length - withPolicy > 0) {
		recommendations.push(`${retention.length - withPolicy} site(s) lack retention policies — apply organization-wide retention labels.`);
	}
	if (overShared > 0) {
		recommendations.push(`${overShared} site(s) have external or anonymous sharing — review and restrict to authorized users.`);
	}
	if (overallScore >= 90) {
		recommendations.push('Storage compliance posture is strong. Continue monitoring for drift.');
	}

	return {
		tenantId, scannedAt: new Date().toISOString(),
		retention: { total: retention.length, withPolicy, withoutPolicy: retention.length - withPolicy, findings: retention },
		sharing: { total: sharing.length, overShared, findings: sharing },
		overallScore, recommendations,
	};
}
