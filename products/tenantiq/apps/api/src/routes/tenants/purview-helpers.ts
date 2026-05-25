/**
 * Purview helpers — Conditional Access policy analysis utilities.
 */

export function describeCaTarget(conditions: any): string {
	const parts: string[] = [];
	const users = conditions?.users;
	if (users?.includeUsers?.includes('All')) parts.push('All users');
	else if (users?.includeGroups?.length) parts.push(`${users.includeGroups.length} groups`);
	else if (users?.includeUsers?.length) parts.push(`${users.includeUsers.length} users`);
	const apps = conditions?.applications;
	if (apps?.includeApplications?.includes('All')) parts.push('All apps');
	else if (apps?.includeApplications?.length) parts.push(`${apps.includeApplications.length} apps`);
	return parts.join(', ') || 'Custom scope';
}

export function describeCaControls(grant: any, session: any): string[] {
	const controls: string[] = [];
	if (grant?.builtInControls?.includes('mfa')) controls.push('Require MFA');
	if (grant?.builtInControls?.includes('compliantDevice')) controls.push('Require compliant device');
	if (grant?.builtInControls?.includes('domainJoinedDevice')) controls.push('Require domain-joined device');
	if (grant?.builtInControls?.includes('approvedApplication')) controls.push('Require approved app');
	if (grant?.builtInControls?.includes('passwordChange')) controls.push('Require password change');
	if (grant?.operator === 'AND') controls.push('(All required)');
	if (session?.signInFrequency) controls.push(`Sign-in frequency: ${session.signInFrequency.value}${session.signInFrequency.type}`);
	if (session?.persistentBrowser?.mode) controls.push(`Persistent browser: ${session.persistentBrowser.mode}`);
	if (grant?.operator === 'OR' && controls.length === 0) controls.push('Block access');
	if (controls.length === 0) controls.push('Grant access');
	return controls;
}

function describeList(items: string[] | undefined, allLabel: string): string {
	if (!items?.length) return 'None';
	if (items.includes('All') || items.includes('all')) return allLabel;
	if (items.length <= 3) return items.join(', ');
	return `${items.slice(0, 2).join(', ')} +${items.length - 2} more`;
}

export function buildConditionDetails(conditions: any): Record<string, string> {
	if (!conditions) return {};
	const u = conditions.users || {};
	const a = conditions.applications || {};
	const details: Record<string, string> = {};
	details.includedUsers = describeList(u.includeUsers, 'All users');
	if (u.excludeUsers?.length) details.excludedUsers = describeList(u.excludeUsers, 'None');
	if (u.includeGroups?.length) details.includedGroups = `${u.includeGroups.length} group(s)`;
	if (u.includeRoles?.length) details.includedRoles = `${u.includeRoles.length} role(s)`;
	details.applications = describeList(a.includeApplications, 'All cloud apps');
	if (a.excludeApplications?.length) details.excludedApps = `${a.excludeApplications.length} excluded`;
	if (conditions.platforms?.includePlatforms?.length) details.platforms = conditions.platforms.includePlatforms.join(', ');
	if (conditions.locations?.includeLocations?.length) details.locations = describeList(conditions.locations.includeLocations, 'All locations');
	if (conditions.signInRiskLevels?.length) details.signInRisk = conditions.signInRiskLevels.join(', ');
	if (conditions.userRiskLevels?.length) details.userRisk = conditions.userRiskLevels.join(', ');
	if (conditions.clientAppTypes?.length) details.clientApps = conditions.clientAppTypes.join(', ');
	return details;
}

export function buildSessionDetails(session: any): string[] {
	if (!session) return [];
	const items: string[] = [];
	if (session.signInFrequency?.isEnabled) items.push(`Sign-in frequency: every ${session.signInFrequency.value} ${session.signInFrequency.type}`);
	if (session.persistentBrowser?.isEnabled) items.push(`Persistent browser: ${session.persistentBrowser.mode}`);
	if (session.cloudAppSecurity?.isEnabled) items.push('Cloud App Security: enabled');
	if (session.applicationEnforcedRestrictions?.isEnabled) items.push('App-enforced restrictions: enabled');
	if (session.continuousAccessEvaluation?.mode) items.push(`Continuous access eval: ${session.continuousAccessEvaluation.mode}`);
	return items;
}

export function checkMissingPolicies(policies: any[]): string[] {
	const gaps: string[] = [];
	const enabled = policies.filter((p: any) => p.state === 'enabled');
	const hasMfa = enabled.some((p: any) => p.grantControls?.builtInControls?.includes('mfa'));
	const hasDevice = enabled.some((p: any) => p.grantControls?.builtInControls?.includes('compliantDevice'));
	const hasLocation = enabled.some((p: any) => p.conditions?.locations);
	const hasRisk = enabled.some((p: any) => p.conditions?.signInRiskLevels?.length > 0 || p.conditions?.userRiskLevels?.length > 0);
	const hasBlock = enabled.some((p: any) => p.grantControls?.builtInControls?.includes('block'));
	if (!hasMfa) gaps.push('No policy requires MFA — create a CA policy requiring MFA for all users');
	if (!hasDevice) gaps.push('No device compliance policy — require compliant/managed devices');
	if (!hasLocation) gaps.push('No location-based policy — restrict access from untrusted locations');
	if (!hasRisk) gaps.push('No risk-based policy — block or require MFA for risky sign-ins');
	if (!hasBlock) gaps.push('No block policy — consider blocking legacy authentication protocols');
	return gaps;
}
