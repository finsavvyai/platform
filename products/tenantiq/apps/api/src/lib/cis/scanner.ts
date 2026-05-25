/**
 * CIS Benchmark Scanner — orchestrates Graph API checks and evaluates controls.
 */

import { CIS_CONTROLS, CIS_SECTIONS, type CisControl } from './control-definitions';
import { ALL_CIS_CONTROLS, ALL_CIS_SECTIONS } from './control-registry';
import { evaluateControl } from './scanner-evaluator';
import { applyOverrides, type OverrideMap } from './overrides';
import type { ControlResult, ScanResult, GraphData, DomainDnsAuth } from './scanner-types';
import { checkAllDomainsAuth } from '../email/dns-auth';
import { evaluateFederatedCredentials, buildAuditResult, type FederatedCredential } from './federated-identity-auditor';

export type { ControlResult, ScanResult, GraphData };

export async function fetchGraphData(graphFetch: (path: string) => Promise<any>): Promise<GraphData> {
	const [
		caPolicies, dirRoles, authPolicy, secDefaults, mfaDetails, labels,
		secureScores, authMethodsPolicy, msAuthCfg, spAdminSettings, dlpPolicies, organization,
		domains, labelPolicies, informationBarrierPolicies, ediscoveryCases,
		retentionLabels, applicationsForFederated,
	] = await Promise.all([
		graphFetch('/identity/conditionalAccess/policies').catch(() => ({ value: [] })),
		graphFetch('/directoryRoles?$expand=members').catch(() => ({ value: [] })),
		graphFetch('/policies/authorizationPolicy').catch(() => ({})),
		graphFetch('/policies/identitySecurityDefaultsEnforcementPolicy').catch(() => ({})),
		graphFetch('/reports/authenticationMethods/userRegistrationDetails?$top=999').catch(() => ({ value: [] })),
		graphFetch('/informationProtection/policy/labels').catch(() => ({ value: [] })),
		// New endpoints for the 10 evaluators we are wiring up
		graphFetch('/security/secureScores?$top=1').catch(() => ({ value: [] })),
		graphFetch('/policies/authenticationMethodsPolicy').catch(() => ({})),
		graphFetch('/policies/authenticationMethodsPolicy/authenticationMethodConfigurations/MicrosoftAuthenticator').catch(() => ({})),
		// Graph beta: SharePoint tenant settings (sharing capability, default link type, etc.)
		graphFetch('/beta/admin/sharepoint/settings').catch(() => ({})),
		// Graph beta: DLP policies
		graphFetch('/beta/security/dataLossPreventionPolicies').catch(() => ({ value: [] })),
		// Verified domains for the DNS auth audit
		graphFetch('/organization').catch(() => ({ value: [] })),
		// T3.1 — additional 8 evaluators
		graphFetch('/domains').catch(() => ({ value: [] })),
		graphFetch('/beta/informationProtection/policy/labels').catch(() => ({})),
		graphFetch('/beta/informationBarrierPolicies').catch(() => ({ value: [] })),
		graphFetch('/beta/security/cases/ediscoveryCases?$top=10').catch(() => ({ value: [] })),
		// Round 5 — additional 4 evaluators
		graphFetch('/beta/security/labels/retentionLabels').catch(() => ({ value: [] })),
		// Federated credentials per app registration (workload identity audit)
		graphFetch('/applications?$select=id,displayName,appId&$top=999&$expand=federatedIdentityCredentials').catch(() => ({ value: [] })),
	]);

	// Compute aggregate federated-identity-auditor score so the CIS scanner
	// can surface a deterministic verdict for control CICD-05 instead of
	// "run the federated audit separately".
	const apps = (applicationsForFederated.value ?? []) as Array<{ id: string; appId: string; displayName: string; federatedIdentityCredentials?: any[] }>;
	const allCreds: FederatedCredential[] = [];
	for (const app of apps) {
		for (const c of app.federatedIdentityCredentials ?? []) {
			allCreds.push({
				appId: app.appId,
				appDisplayName: app.displayName,
				credentialId: c.id ?? '',
				issuer: c.issuer ?? '',
				subject: c.subject ?? '',
				audiences: c.audiences ?? [],
				description: c.description ?? '',
			});
		}
	}
	// Without role data we can't flag privileged_sp; still catches wildcard +
	// broad-repo + unknown-issuer at the catalog scan level.
	const findings = evaluateFederatedCredentials(allCreds, new Set());
	const federatedAudit = buildAuditResult(apps.length, allCreds, findings);

	const globalAdminRole = (dirRoles.value || []).find((r: any) => r.displayName === 'Global Administrator');
	const globalAdminCount = globalAdminRole?.members?.length ?? 0;

	const verifiedDomains: string[] = ((organization.value?.[0]?.verifiedDomains ?? []) as Array<{ name?: string }>)
		.map(d => d.name)
		.filter((n): n is string => !!n);

	const dnsAuthFull = await checkAllDomainsAuth(verifiedDomains).catch(() => []);
	const dnsAuthByDomain: DomainDnsAuth[] = dnsAuthFull.map(d => ({
		domain: d.domain,
		spf: d.spf,
		dmarc: d.dmarc,
		dkim: d.dkim,
		dmarcPolicy: d.dmarcPolicy,
		dkimPassingCount: d.dkimSelectors.filter(s => s.status === 'pass').length,
	}));

	return {
		conditionalAccessPolicies: caPolicies.value || [],
		directoryRoles: dirRoles.value || [],
		globalAdminCount,
		authorizationPolicy: authPolicy,
		securityDefaults: secDefaults,
		mfaRegistrationDetails: mfaDetails.value || [],
		sensitivityLabels: labels.value || [],
		sharepointSettings: null,
		secureScore: (secureScores.value || [])[0] ?? null,
		authMethodsPolicy,
		microsoftAuthenticatorConfig: msAuthCfg,
		sharepointAdminSettings: spAdminSettings,
		dlpPolicies: dlpPolicies.value || [],
		dnsAuthByDomain,
		domains: domains.value || [],
		labelPolicies,
		informationBarrierPolicies: informationBarrierPolicies.value || [],
		ediscoveryCases: ediscoveryCases.value || [],
		retentionLabels: retentionLabels.value || [],
		federatedIdentityScore: federatedAudit.score,
		federatedIdentityFindingCount: federatedAudit.findings.length,
	};
}


export function runEvaluation(data: GraphData, overrides?: OverrideMap): ScanResult {
	const start = Date.now();
	const controls: ControlResult[] = ALL_CIS_CONTROLS.map(c => {
		const { status, currentValue } = evaluateControl(c, data);
		return { controlId: c.id, section: c.section, title: c.title, status, severity: c.severity, currentValue, expectedValue: c.expectedValue, remediationHint: c.remediationHint, portalUrl: c.portalUrl, remediationGuide: c.remediationGuide, autoRemediable: c.autoRemediable };
	});

	const passCount = controls.filter(c => c.status === 'pass').length;
	const failCount = controls.filter(c => c.status === 'fail').length;
	const partialCount = controls.filter(c => c.status === 'partial').length;

	const sectionScores: ScanResult['sectionScores'] = {};
	for (const section of ALL_CIS_SECTIONS) {
		const sc = controls.filter(c => c.section === section);
		const p = sc.filter(c => c.status === 'pass').length;
		sectionScores[section] = { pass: p, fail: sc.filter(c => c.status === 'fail').length, total: sc.length, score: sc.length > 0 ? Math.round((p / sc.length) * 100) : 0 };
	}

	const overallScore = controls.length > 0 ? Math.round(((passCount + partialCount * 0.5) / controls.length) * 100) : 0;

	const baseResult: ScanResult = { overallScore, passCount, failCount, partialCount, errorCount: controls.filter(c => c.status === 'error').length, totalControls: controls.length, sectionScores, controls, scanDurationMs: Date.now() - start };
	return overrides && overrides.size > 0 ? applyOverrides(baseResult, overrides) : baseResult;
}
