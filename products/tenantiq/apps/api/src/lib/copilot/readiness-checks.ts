/** Individual readiness checks for each of the 7 Copilot assessment categories. */
import type { Check, Recommendation, CategoryKey, Priority } from './readiness-types';

type GraphFetch = (path: string) => Promise<Record<string, unknown>>;
type CheckResult = { checks: Check[]; recs: Recommendation[] };

function rec(cat: CategoryKey, pri: Priority, title: string, desc: string): Recommendation {
	return { category: cat, priority: pri, title, description: desc };
}
function check(name: string, status: Check['status'], detail: string, errorMessage?: string): Check {
	return { name, status, detail, ...(errorMessage ? { errorMessage } : {}) };
}
function errCheck(name: string, msg: string): Check { return check(name, 'error', 'Unable to assess', msg); }

// --- Licensing ---
export async function checkLicensing(gf: GraphFetch): Promise<CheckResult> {
	const checks: Check[] = [];
	const recs: Recommendation[] = [];
	try {
		const subs = await gf('/subscribedSkus');
		const skus = (subs.value || []) as { skuPartNumber: string; prepaidUnits: { enabled: number }; consumedUnits: number }[];
		const e3e5 = skus.filter((s) => /ENTERPRISEPACK|ENTERPRISEPREMIUM|SPE_E3|SPE_E5/i.test(s.skuPartNumber));
		const copilot = skus.filter((s) => /COPILOT|M365_COPILOT/i.test(s.skuPartNumber));
		checks.push(e3e5.length > 0
			? check('M365 E3/E5', 'pass', `${e3e5.length} qualifying SKU(s) found`)
			: check('M365 E3/E5', 'fail', 'No E3/E5 licenses — required for Copilot'));
		if (e3e5.length === 0) recs.push(rec('licensing', 'critical', 'Acquire M365 E3/E5 licenses', 'Microsoft 365 Copilot requires E3 or E5 base licenses for all target users'));
		checks.push(copilot.length > 0
			? check('Copilot add-on', 'pass', `Copilot licenses available (${copilot.reduce((a, c) => a + (c.prepaidUnits?.enabled || 0), 0)} seats)`)
			: check('Copilot add-on', 'warning', 'No Copilot add-on licenses yet'));
		if (copilot.length === 0) recs.push(rec('licensing', 'high', 'Purchase Copilot add-on', 'Acquire Microsoft 365 Copilot licenses for your target user group'));
	} catch { checks.push(errCheck('Licensing', 'Graph API error — check Organization.Read.All')); }
	return { checks, recs };
}

// --- Identity & Access ---
export async function checkIdentityAccess(gf: GraphFetch): Promise<CheckResult> {
	const checks: Check[] = [];
	const recs: Recommendation[] = [];
	try {
		const mfa = await gf('/reports/authenticationMethods/userRegistrationDetails?$top=999');
		const users = (mfa.value || []) as any[];
		const registered = users.filter((u: any) => u.isMfaRegistered).length;
		const pct = users.length > 0 ? Math.round((registered / users.length) * 100) : 0;
		checks.push(pct >= 90
			? check('MFA enrollment', 'pass', `${pct}% users MFA-registered`)
			: check('MFA enrollment', pct >= 50 ? 'warning' : 'fail', `${pct}% MFA — target 90%+ before Copilot`));
		if (pct < 90) recs.push(rec('identityAccess', pct < 50 ? 'critical' : 'high', 'Increase MFA adoption', `Currently ${pct}% — enforce MFA for all users before Copilot deployment`));
	} catch { checks.push(errCheck('MFA enrollment', 'Check UserAuthenticationMethod.Read.All')); }

	try {
		const ca = await gf('/identity/conditionalAccessPolicies');
		const enabled = ((ca.value || []) as any[]).filter((p: any) => p.state === 'enabled');
		checks.push(enabled.length >= 2
			? check('Conditional Access', 'pass', `${enabled.length} active CA policies`)
			: check('Conditional Access', enabled.length >= 1 ? 'warning' : 'fail', `${enabled.length} CA policies — need 2+`));
		if (enabled.length < 2) recs.push(rec('identityAccess', 'high', 'Add Conditional Access policies', 'Create policies for MFA enforcement and location-based access'));
	} catch { checks.push(errCheck('Conditional Access', 'Check Policy.Read.All')); }

	return { checks, recs };
}

// --- Data Protection ---
export async function checkDataProtection(gf: GraphFetch): Promise<CheckResult> {
	const checks: Check[] = [];
	const recs: Recommendation[] = [];
	try {
		const labels = await gf('/informationProtection/policy/labels');
		const count = ((labels.value || []) as any[]).length;
		checks.push(count >= 3
			? check('Sensitivity labels', 'pass', `${count} labels published`)
			: check('Sensitivity labels', 'fail', `${count} labels — publish 3+ (Public, Internal, Confidential)`));
		if (count < 3) recs.push(rec('dataProtection', 'critical', 'Publish sensitivity labels', 'Create at least Public, Internal, and Confidential labels before Copilot'));
	} catch { checks.push(errCheck('Sensitivity labels', 'Check InformationProtection.Read')); }

	try {
		const dlp = await gf('/informationProtection/policy/labels?$top=1');
		checks.push(check('DLP policies', 'warning', 'DLP assessment requires Security & Compliance API'));
		recs.push(rec('dataProtection', 'medium', 'Review DLP policies', 'Ensure DLP policies protect sensitive data from Copilot surfacing'));
	} catch { checks.push(errCheck('DLP policies', 'Check DLP policy permissions')); }

	return { checks, recs };
}

// --- Compliance ---
export async function checkCompliance(gf: GraphFetch): Promise<CheckResult> {
	const checks: Check[] = [];
	const recs: Recommendation[] = [];
	try {
		const dir = await gf('/organization');
		const org = ((dir.value || []) as any[])[0];
		checks.push(org
			? check('Audit logging', 'pass', 'Organization audit logging accessible')
			: check('Audit logging', 'warning', 'Cannot verify audit log configuration'));
	} catch { checks.push(errCheck('Audit logging', 'Check AuditLog.Read.All')); }

	try {
		const authPolicy = await gf('/policies/authorizationPolicy');
		const guestAccess = authPolicy?.guestUserRoleId;
		const restricted = guestAccess === '2af84b1e-32c8-42b7-82bc-daa82404023b';
		checks.push(restricted
			? check('Guest access controls', 'pass', 'Guest access appropriately restricted')
			: check('Guest access controls', 'warning', 'Guest access may be too permissive for Copilot'));
		if (!restricted) recs.push(rec('compliance', 'medium', 'Restrict guest access', 'Limit guest user permissions to prevent data exposure via Copilot'));
	} catch { checks.push(errCheck('Guest access controls', 'Check Policy.Read.All')); }

	return { checks, recs };
}

// --- Security ---
export async function checkSecurity(gf: GraphFetch): Promise<CheckResult> {
	const checks: Check[] = [];
	const recs: Recommendation[] = [];
	try {
		const ss = await gf('/security/secureScores?$top=1');
		const latest = ((ss.value || []) as any[])[0];
		const pct = latest ? Math.round((latest.currentScore / latest.maxScore) * 100) : 0;
		checks.push(pct >= 60
			? check('Secure Score', 'pass', `${pct}% Microsoft Secure Score`)
			: check('Secure Score', pct >= 30 ? 'warning' : 'fail', `${pct}% Secure Score — improve before Copilot`));
		if (pct < 60) recs.push(rec('security', 'high', 'Improve Secure Score', `Current score ${pct}% — target 60%+ for Copilot readiness`));
	} catch { checks.push(errCheck('Secure Score', 'Check SecurityEvents.Read.All')); }

	try {
		const alertsResp = await gf('/security/alerts_v2?$top=5&$filter=status ne \'resolved\'');
		const count = ((alertsResp.value || []) as any[]).length;
		checks.push(count === 0
			? check('Active alerts', 'pass', 'No unresolved security alerts')
			: check('Active alerts', count <= 2 ? 'warning' : 'fail', `${count} unresolved alerts`));
		if (count > 2) recs.push(rec('security', 'high', 'Resolve security alerts', `${count} active alerts — resolve before Copilot deployment`));
	} catch { checks.push(errCheck('Active alerts', 'Check SecurityAlert.Read.All')); }

	return { checks, recs };
}

// --- Collaboration ---
export async function checkCollaboration(gf: GraphFetch): Promise<CheckResult> {
	const checks: Check[] = [];
	const recs: Recommendation[] = [];
	try {
		const groups = await gf("/groups?$filter=groupTypes/any(c:c eq 'Unified') and visibility eq 'Public'&$top=999&$count=true");
		const groupCount = ((groups.value || []) as any[]).length;
		checks.push(groupCount <= 5
			? check('Public groups', groupCount === 0 ? 'pass' : 'warning', `${groupCount} public groups`)
			: check('Public groups', 'fail', `${groupCount} public groups — Copilot will surface this content`));
		if (groupCount > 5) recs.push(rec('collaboration', 'critical', 'Reduce public groups', `Convert ${groupCount} public groups to private to limit Copilot data exposure`));
	} catch { checks.push(errCheck('Public groups', 'Check Group.Read.All')); }

	try {
		const authPolicy = await gf('/policies/authorizationPolicy');
		const invites = authPolicy?.allowInvitesFrom;
		const restricted = invites === 'adminsAndGuestInviters' || invites === 'none';
		checks.push(restricted
			? check('Guest invitations', 'pass', `Restricted: ${invites}`)
			: check('Guest invitations', 'warning', `Open: ${invites || 'everyone'} — guests may see Copilot results`));
		if (!restricted) recs.push(rec('collaboration', 'medium', 'Restrict guest invitations', 'Limit who can invite guests to prevent uncontrolled data sharing'));
	} catch { checks.push(errCheck('Guest invitations', 'Check Policy.Read.All')); }

	return { checks, recs };
}

// --- Data Quality ---
export async function checkDataQuality(gf: GraphFetch): Promise<CheckResult> {
	const checks: Check[] = [];
	const recs: Recommendation[] = [];
	try {
		const users = await gf('/users?$select=id,accountEnabled,signInActivity&$top=999');
		const all = (users.value || []) as any[];
		const now = Date.now();
		const stale = all.filter((u: any) => {
			const last = u.signInActivity?.lastSignInDateTime;
			return last && (now - new Date(last).getTime()) > 90 * 86400000;
		});
		const pct = all.length > 0 ? Math.round((stale.length / all.length) * 100) : 0;
		checks.push(pct <= 10
			? check('Stale accounts', 'pass', `${stale.length} stale accounts (${pct}%)`)
			: check('Stale accounts', pct <= 25 ? 'warning' : 'fail', `${stale.length} stale accounts (${pct}%) — clean up before Copilot`));
		if (pct > 10) recs.push(rec('dataQuality', 'high', 'Clean up stale accounts', `${stale.length} users inactive 90+ days — disable or remove to reduce Copilot noise`));
	} catch { checks.push(errCheck('Stale accounts', 'Check User.Read.All + AuditLog.Read.All')); }

	try {
		const groups = await gf("/groups?$filter=groupTypes/any(c:c eq 'Unified')&$select=id,displayName,createdDateTime,mail&$top=999");
		const allGroups = (groups.value || []) as any[];
		const now = Date.now();
		const old = allGroups.filter((g: any) => (now - new Date(g.createdDateTime).getTime()) > 365 * 86400000);
		checks.push(old.length <= 5
			? check('Orphaned groups', 'pass', `${old.length} groups older than 1 year`)
			: check('Orphaned groups', 'warning', `${old.length} groups older than 1 year — review for relevance`));
		if (old.length > 5) recs.push(rec('dataQuality', 'medium', 'Review old groups', `${old.length} groups created 1+ years ago — archive or delete stale ones`));
	} catch { checks.push(errCheck('Orphaned groups', 'Check Group.Read.All')); }

	return { checks, recs };
}
