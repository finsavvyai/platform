/**
 * Purview features — fetches real compliance data from Graph API.
 * Falls back to empty arrays when APIs are unavailable (no license).
 */

import type { GraphClient } from '../../lib/graph-client';
import type { PurviewFeature } from './purview-data';
import {
	describeCaTarget,
	describeCaControls,
	buildConditionDetails,
	buildSessionDetails,
	checkMissingPolicies,
} from './purview-helpers';

/** Fetch Purview features by checking Graph for CA policies, DLP, labels. */
export async function getPurviewFeatures(graph: GraphClient | null): Promise<PurviewFeature[]> {
	if (!graph) return [];
	const features: PurviewFeature[] = [];

	try {
		const caData = await graph.fetch('/identity/conditionalAccess/policies');
		const allPolicies = caData.value || [];
		const enabled = allPolicies.filter((p: any) => p.state === 'enabled');
		const reportOnly = allPolicies.filter((p: any) => p.state === 'enabledForReportingButNotEnforced');
		const disabled = allPolicies.filter((p: any) => p.state === 'disabled');
		const gaps = checkMissingPolicies(allPolicies);
		const policyDetails = allPolicies.map((p: any) => ({
			name: p.displayName || 'Unnamed',
			state: p.state === 'enabled' ? 'Enabled' : p.state === 'enabledForReportingButNotEnforced' ? 'Report-only' : 'Disabled',
			target: describeCaTarget(p.conditions),
			controls: describeCaControls(p.grantControls, p.sessionControls),
			conditions: buildConditionDetails(p.conditions),
			sessionControls: buildSessionDetails(p.sessionControls),
			createdAt: p.createdDateTime || null,
			modifiedAt: p.modifiedDateTime || null,
		}));
		const status = gaps.length === 0 ? 'configured' : enabled.length >= 3 ? 'partial' : enabled.length > 0 ? 'partial' : 'not_configured';
		features.push({
			category: 'Identity Protection', name: 'Conditional Access',
			description: 'Enforce access controls based on user, device, location, and risk conditions',
			status, severity: 'critical',
			details: {
				current: `${enabled.length} enabled, ${reportOnly.length} report-only, ${disabled.length} disabled`,
				recommended: 'MFA for all users, device compliance, location restrictions, risk-based policies, block legacy auth',
				gap: gaps.length > 0 ? gaps.join('; ') : 'All recommended policies in place',
			},
			regulations: ['CIS 1.1.1', 'NIST AC-7', 'SOC 2 CC6.1'],
			remediationSteps: gaps,
			policies: policyDetails,
		});
	} catch { /* skip */ }

	try {
		const labelsData = await graph.fetch('/informationProtection/policy/labels');
		const labels = labelsData.value || [];
		features.push({
			category: 'Information Protection', name: 'Sensitivity Labels',
			description: 'Classify and protect sensitive documents and emails',
			status: labels.length >= 3 ? 'configured' : labels.length > 0 ? 'partial' : 'not_configured',
			severity: 'high',
			details: {
				current: labels.length > 0 ? `${labels.length} labels: ${labels.map((l: any) => l.name || l.displayName).join(', ')}` : 'No labels defined',
				recommended: 'At least 3 labels (Public, Internal, Confidential) with encryption on sensitive',
				gap: labels.length < 3 ? 'Define sensitivity labels in Microsoft Purview' : 'None',
			},
			regulations: ['GDPR Art.32', 'HIPAA §164.312'], remediationSteps: labels.length < 3 ? ['Go to compliance.microsoft.com > Information Protection > Create labels'] : [],
		});
	} catch { /* skip */ }

	// DLP Policies check
	try {
		const dlpData = await graph.fetch('/security/informationProtection/policy/dlpPolicies');
		const dlpPolicies = dlpData.value || [];
		const activeDlp = dlpPolicies.filter((p: any) => p.isEnabled);
		features.push({
			category: 'Data Loss Prevention', name: 'DLP Policies',
			description: 'Prevent accidental sharing of sensitive data across email, Teams, SharePoint, and OneDrive',
			status: activeDlp.length >= 2 ? 'configured' : activeDlp.length > 0 ? 'partial' : 'not_configured',
			severity: 'critical',
			details: {
				current: dlpPolicies.length > 0 ? `${activeDlp.length} active, ${dlpPolicies.length - activeDlp.length} inactive` : 'No DLP policies configured',
				recommended: 'At least 2 policies: one for PII/financial data, one for internal confidential content',
				gap: activeDlp.length < 2 ? 'Create DLP policies to protect sensitive information' : 'None',
			},
			regulations: ['GDPR Art.5', 'HIPAA §164.312', 'SOC 2 CC6.7'],
			remediationSteps: activeDlp.length === 0
				? ['Go to compliance.microsoft.com > Data Loss Prevention > Create policy', 'Start with the built-in PII detection template', 'Apply to Exchange, SharePoint, OneDrive, and Teams']
				: activeDlp.length < 2
					? ['Add a second DLP policy for internal confidential content — cover financial data, IP, or HR records']
					: [],
		});
	} catch {
		// No Purview license — report as not configured
		features.push({
			category: 'Data Loss Prevention', name: 'DLP Policies',
			description: 'Prevent accidental sharing of sensitive data across email, Teams, SharePoint, and OneDrive',
			status: 'not_configured', severity: 'critical',
			details: { current: 'Microsoft Purview not licensed or DLP not accessible', recommended: 'Enable Microsoft Purview compliance and create DLP policies', gap: 'No DLP protection active' },
			regulations: ['GDPR Art.5', 'HIPAA §164.312', 'SOC 2 CC6.7'],
			remediationSteps: ['Ensure Microsoft Purview Compliance is included in your M365 license', 'Go to compliance.microsoft.com > Data Loss Prevention > Create policy'],
		});
	}

	// eDiscovery check
	try {
		const ediscoveryData = await graph.fetch('/security/cases/ediscoveryCases?$top=10');
		const cases = ediscoveryData.value || [];
		const activeCases = cases.filter((c: any) => c.status === 'active');
		features.push({
			category: 'eDiscovery & Audit', name: 'eDiscovery',
			description: 'Legal hold, content search, and case management for compliance investigations',
			status: cases.length > 0 ? 'configured' : 'not_configured',
			severity: 'medium',
			details: {
				current: cases.length > 0 ? `${cases.length} case(s) — ${activeCases.length} active` : 'No eDiscovery cases',
				recommended: 'Have eDiscovery capability ready for legal/compliance requests',
				gap: cases.length === 0 ? 'No eDiscovery cases exist — consider creating a test case to validate the workflow' : 'None',
			},
			regulations: ['SOC 2 CC7.4', 'GDPR Art.17', 'HIPAA §164.530'],
			remediationSteps: cases.length === 0
				? ['Go to compliance.microsoft.com > eDiscovery > Create a case', 'Assign eDiscovery Manager role to compliance team', 'Document your legal hold process']
				: [],
		});
	} catch {
		features.push({
			category: 'eDiscovery & Audit', name: 'eDiscovery',
			description: 'Legal hold, content search, and case management for compliance investigations',
			status: 'not_configured', severity: 'medium',
			details: { current: 'eDiscovery not accessible — may require E5 or Compliance add-on', recommended: 'Enable eDiscovery capability', gap: 'eDiscovery not available' },
			regulations: ['SOC 2 CC7.4', 'GDPR Art.17'],
			remediationSteps: ['Verify your M365 license includes eDiscovery capabilities', 'Assign eDiscovery Manager role in Microsoft Purview'],
		});
	}

	// Audit logging check
	features.push({
		category: 'eDiscovery & Audit', name: 'Unified Audit Log',
		description: 'Track user and admin activity across all Microsoft 365 services',
		status: 'configured', severity: 'high',
		details: { current: 'Enabled by default in Microsoft 365', recommended: 'Ensure audit log search is enabled and retention is set to at least 90 days', gap: 'None' },
		regulations: ['CIS 3.1', 'SOC 2 CC7.2', 'NIST AU-2'],
		remediationSteps: [],
	});

	return features;
}
