/** Helper functions for generating remediation plan data from alert metadata. */

export function generateImpactExplanation(title: string, severity: string): string {
	if (title.includes('MFA')) return 'Admin accounts without MFA are the #1 target for credential attacks. A compromised admin can access all tenant data.';
	if (title.includes('guest')) return 'Stale guest accounts maintain access to shared files and Teams channels without oversight.';
	if (title.includes('license') || title.includes('License')) return 'Unused licenses represent direct monthly cost with no business value.';
	if (title.includes('Legacy') || title.includes('legacy')) return 'Legacy authentication bypasses conditional access policies and MFA protections.';
	if (title.includes('audit')) return 'Without comprehensive audit logging, security incidents cannot be properly investigated.';
	return `This ${severity}-severity issue requires attention to maintain your security posture.`;
}

export function generateAffectedResources(title: string): string[] {
	if (title.includes('MFA')) return ['Azure Active Directory', 'Admin Portal', 'Exchange Online', 'SharePoint Online'];
	if (title.includes('guest')) return ['SharePoint Online', 'Microsoft Teams', 'OneDrive for Business'];
	if (title.includes('license') || title.includes('License')) return ['Microsoft 365 Licensing', 'Azure AD'];
	if (title.includes('Legacy') || title.includes('legacy')) return ['Exchange Online', 'Azure Active Directory'];
	if (title.includes('audit')) return ['Microsoft Purview', 'SharePoint Online', 'OneDrive'];
	return ['Microsoft 365 Tenant'];
}

interface RemediationStep { title: string; description: string; effect: string }

export function generateRemediationSteps(title: string): RemediationStep[] {
	if (title.includes('MFA')) return [
		{ title: 'Create Conditional Access policy', description: 'Configure a policy requiring MFA for all admin roles', effect: 'Admins will be prompted to register MFA methods on next sign-in' },
		{ title: 'Enable Security Defaults', description: 'Ensure baseline security defaults are active as a fallback', effect: 'All users get baseline MFA protection' },
		{ title: 'Notify affected admins', description: 'Send email notification about the upcoming MFA requirement', effect: 'Admins can prepare and set up authenticator apps proactively' },
	];
	if (title.includes('guest')) return [
		{ title: 'Review guest access', description: 'Audit which resources each stale guest account can access', effect: 'Visibility into current exposure from inactive guests' },
		{ title: 'Revoke stale guest sessions', description: 'Disable sign-in for guests inactive for 90+ days', effect: 'Immediate removal of unauthorized access paths' },
		{ title: 'Configure guest expiration policy', description: 'Set automatic guest access review every 30 days', effect: 'Prevents future accumulation of stale guest accounts' },
	];
	if (title.includes('license') || title.includes('License')) return [
		{ title: 'Identify unused licenses', description: 'List all licenses with no activity in 60+ days', effect: 'Clear picture of reclaimable licenses' },
		{ title: 'Unassign unused licenses', description: 'Remove license assignments from inactive users', effect: 'Licenses become available for reassignment' },
		{ title: 'Reduce subscription count', description: 'Adjust license quantity in Microsoft admin center', effect: 'Direct cost savings on next billing cycle' },
	];
	return [
		{ title: 'Assess current state', description: 'Review the current configuration and affected resources', effect: 'Understanding of the full scope of the issue' },
		{ title: 'Apply recommended fix', description: 'Implement the security best practice', effect: 'Issue resolved according to Microsoft guidelines' },
		{ title: 'Verify and monitor', description: 'Confirm the fix is in place and set up ongoing monitoring', effect: 'Continuous protection against recurrence' },
	];
}

export function generatePositiveOutcomes(title: string): string[] {
	if (title.includes('MFA')) return ['Admin accounts protected against credential theft', 'Compliance with security baseline requirements', 'Reduced risk of tenant-wide compromise'];
	if (title.includes('guest')) return ['Reduced external attack surface', 'Clean guest directory', 'Automated future cleanup'];
	if (title.includes('license') || title.includes('License')) return ['Immediate cost savings', 'Accurate license utilization reporting', 'Budget freed for needed services'];
	return ['Improved security posture', 'Reduced risk exposure', 'Better compliance standing'];
}

export function generateNegativeOutcomes(title: string, severity: string): string[] {
	if (title.includes('MFA')) return ['Admin accounts remain vulnerable to phishing', 'Single password compromise = full tenant access', 'Non-compliant with most security frameworks'];
	if (title.includes('guest')) return ['External users retain access indefinitely', 'Potential data exfiltration via inactive accounts', 'Audit findings on access controls'];
	if (title.includes('license') || title.includes('License')) return ['Continued monthly cost waste', 'Inaccurate usage reporting', 'Budget constraints on needed tools'];
	return [`Continued ${severity}-level risk exposure`, 'Potential compliance violations', 'Increased attack surface'];
}

export function generateUserEffects(title: string, count: number): string[] {
	if (title.includes('MFA')) return [`${count || 3} admin(s) will need to register an MFA method`, 'Admins will see an MFA prompt on their next sign-in', 'No impact on regular users'];
	if (title.includes('guest')) return [`${count || 12} guest account(s) will lose access`, 'Affected guests can request re-invitation if still needed', 'Internal users are not affected'];
	if (title.includes('license') || title.includes('License')) return [`${count || 3} user(s) will have license unassigned`, 'Users can request reassignment if they need the service', 'Active users are not affected'];
	return count > 0 ? [`${count} user(s) may be affected`, 'Users will be notified of any changes'] : ['No direct user impact expected'];
}
