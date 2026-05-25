/**
 * CIS Microsoft 365 Foundations Benchmark v3.1 — Control Catalog
 * Each control defines what to check, expected value, severity, and remediation metadata.
 */

export type { CisControl } from './control-types';
import type { CisControl } from './control-types';
import { CIS_PORTAL_URLS } from './control-types';

const { PORTAL, ENTRA, COMPLIANCE, DEFENDER } = CIS_PORTAL_URLS;

export const CIS_CONTROLS: CisControl[] = [
	// 1. Account / Authentication
	{
		id: '1.1.1', section: 'Identity', title: 'MFA enabled for all users',
		description: 'Ensure MFA is enforced for all users via Conditional Access',
		severity: 'critical', level: 'L1', graphCheck: 'mfa_all_users', expectedValue: 'Enforced via CA policy',
		remediationHint: 'Create a Conditional Access policy requiring MFA for all users',
		portalUrl: `${PORTAL}/ConditionalAccessBlade/~/Policies`,
		remediationGuide: 'Navigate to Conditional Access and create a new policy targeting All Users. Under Grant, select "Require multifactor authentication". Enable the policy and verify with a test sign-in.',
		autoRemediable: true,
	},
	{
		id: '1.1.3', section: 'Identity', title: 'MFA for admin accounts',
		description: 'All accounts with admin roles must have MFA',
		severity: 'critical', level: 'L1', graphCheck: 'mfa_admins', expectedValue: 'All admins MFA-registered',
		remediationHint: 'Verify all Global/Exchange/Security admins have MFA registered',
		portalUrl: `${ENTRA}/AuthenticationMethodsMenuBlade/~/AdminAuthMethods`,
		remediationGuide: 'Go to Azure AD > Security > Authentication Methods. Ensure all admin accounts have registered at least one MFA method. Contact individual admins to register if missing.',
		autoRemediable: false,
	},
	{
		id: '1.1.6', section: 'Identity', title: 'Block legacy authentication',
		description: 'Legacy auth protocols should be blocked via Conditional Access',
		severity: 'high', level: 'L1', graphCheck: 'block_legacy_auth', expectedValue: 'CA policy blocking legacy auth',
		remediationHint: 'Create CA policy blocking legacy authentication protocols',
		portalUrl: `${PORTAL}/ConditionalAccessBlade/~/Policies`,
		remediationGuide: 'Create a Conditional Access policy targeting All Users. Under Conditions > Client apps, select "Exchange ActiveSync" and "Other clients". Set Grant to "Block access".',
		autoRemediable: true,
	},
	{
		id: '1.2.1', section: 'Identity', title: 'Security defaults or CA policies',
		description: 'Either security defaults or Conditional Access must be configured',
		severity: 'critical', level: 'L1', graphCheck: 'security_defaults_or_ca',
		expectedValue: 'At least one CA policy or security defaults enabled',
		remediationHint: 'Enable security defaults or configure Conditional Access policies',
		portalUrl: `${ENTRA}/SecurityDefaultsBlade`,
		remediationGuide: 'Enable Security Defaults in Azure AD Properties, or create CA policies for MFA and legacy auth blocking.',
		autoRemediable: true,
	},
	{
		id: '1.3.1', section: 'Identity', title: 'Limit Global Administrators',
		description: 'No more than 4 Global Admins, minimum 2 for break-glass',
		severity: 'high', level: 'L1', graphCheck: 'global_admin_count', expectedValue: '2-4 Global Admins',
		remediationHint: 'Reduce Global Admin count to 2-4. Use PIM for just-in-time access',
		portalUrl: `${ENTRA}/RolesManagementMenuBlade/~/AllRoles`,
		remediationGuide: 'Review Global Admin assignments and remove unnecessary ones. Assign scoped roles instead. Set up PIM for just-in-time elevation.',
		autoRemediable: false,
	},
	{
		id: '1.3.6', section: 'Identity', title: 'Password expiration policy',
		description: 'Passwords should not expire per NIST 800-63B',
		severity: 'medium', level: 'L1', graphCheck: 'password_expiration',
		expectedValue: 'No forced password expiration',
		remediationHint: 'Set password expiration to "never" per NIST 800-63B guidance',
		portalUrl: `${ENTRA}/AuthenticationMethodsMenuBlade/~/PasswordProtection`,
		remediationGuide: 'Go to Azure AD > Authentication Methods > Password Protection. Set password expiration to "never expire".',
		autoRemediable: false,
	},
	{
		id: '1.4.1', section: 'Identity', title: 'Self-service password reset',
		description: 'SSPR should be enabled for all users',
		severity: 'medium', level: 'L1', graphCheck: 'sspr_enabled', expectedValue: 'Enabled for all users',
		remediationHint: 'Enable self-service password reset in Azure AD',
		portalUrl: `${ENTRA}/PasswordResetMenuBlade/~/Properties`,
		remediationGuide: 'Navigate to Azure AD > Password Reset > Properties. Set SSPR to "All" to enable it for all users.',
		autoRemediable: false,
	},
	// 2. Application
	{
		id: '2.1.1', section: 'Application', title: 'User consent to apps restricted',
		description: 'Users should not be able to consent to apps accessing org data',
		severity: 'high', level: 'L1', graphCheck: 'user_consent_disabled',
		expectedValue: 'User consent disabled or limited',
		remediationHint: 'Set user consent to "Do not allow user consent" or approved publishers only',
		portalUrl: `${ENTRA}/ConsentPoliciesMenuBlade/~/UserSettings`,
		remediationGuide: 'Go to Azure AD > Enterprise Applications > Consent and permissions. Set "User consent" to "Do not allow user consent".',
		autoRemediable: true,
	},
	{
		id: '2.1.2', section: 'Application', title: 'Guest invite restrictions',
		description: 'Only admins should be able to invite external guests',
		severity: 'medium', level: 'L1', graphCheck: 'guest_invite_restricted',
		expectedValue: 'Only admins can invite guests',
		remediationHint: 'Restrict guest invitations to admins in Azure AD settings',
		portalUrl: `${ENTRA}/ExternalIdentitiesBlade/~/ExternalCollaborationSettings`,
		remediationGuide: 'Navigate to Azure AD > External Identities > External Collaboration Settings. Set "Guest invite restrictions" to admins only.',
		autoRemediable: true,
	},
	// 3. Data Management
	{
		id: '3.1.1', section: 'Data', title: 'SharePoint external sharing restricted',
		description: 'External sharing should be limited to authenticated guests',
		severity: 'high', level: 'L1', graphCheck: 'sharepoint_sharing',
		expectedValue: 'Existing guests only or less permissive',
		remediationHint: 'Restrict SharePoint sharing to existing guests or org-only',
		portalUrl: 'https://admin.microsoft.com/sharepoint?page=sharing',
		remediationGuide: 'Open SharePoint Admin Center > Policies > Sharing. Set external sharing to "Existing guests" or "Only people in your organization".',
		autoRemediable: false,
	},
	{
		id: '3.2.1', section: 'Data', title: 'DLP policies configured',
		description: 'At least one DLP policy should protect sensitive data',
		severity: 'high', level: 'L2', graphCheck: 'dlp_policies_exist',
		expectedValue: 'At least 1 active DLP policy',
		remediationHint: 'Create DLP policies for PII, financial data, and health information',
		portalUrl: `${COMPLIANCE}/datalossprevention/policies`,
		remediationGuide: 'Go to Microsoft 365 Compliance > Data Loss Prevention > Policies. Create policies using built-in templates.',
		autoRemediable: false,
	},
	{
		id: '3.3.1', section: 'Data', title: 'Sensitivity labels published',
		description: 'Sensitivity labels should be published for classification',
		severity: 'medium', level: 'L1', graphCheck: 'sensitivity_labels',
		expectedValue: 'Labels published to users',
		remediationHint: 'Create and publish sensitivity labels (Public, Internal, Confidential, Restricted)',
		portalUrl: `${COMPLIANCE}/informationprotection/labels`,
		remediationGuide: 'Navigate to Compliance Center > Information Protection > Labels. Create and publish labels via a label policy.',
		autoRemediable: false,
	},
	// 4. Email / Exchange
	{
		id: '4.1.1', section: 'Email', title: 'Anti-phishing policy',
		description: 'Custom anti-phishing policy with impersonation protection',
		severity: 'high', level: 'L1', graphCheck: 'anti_phishing',
		expectedValue: 'Custom policy with impersonation protection',
		remediationHint: 'Configure Defender for Office 365 anti-phishing policy',
		portalUrl: `${DEFENDER}/antiphishing`,
		remediationGuide: 'Open Microsoft Defender > Policies > Anti-phishing. Create a custom policy with impersonation protection.',
		autoRemediable: false,
	},
	{
		id: '4.2.1', section: 'Email', title: 'DMARC record configured',
		description: 'DMARC DNS record with reject or quarantine policy',
		severity: 'medium', level: 'L1', graphCheck: 'dmarc_configured',
		expectedValue: 'DMARC p=quarantine or p=reject',
		remediationHint: 'Add DMARC DNS record with at least p=quarantine',
		remediationGuide: 'Add a TXT DNS record for _dmarc.yourdomain.com with "v=DMARC1; p=quarantine". Upgrade to p=reject after monitoring.',
		autoRemediable: false,
	},
	{
		id: '4.3.1', section: 'Email', title: 'External email tagging',
		description: 'External emails should be tagged with [EXTERNAL]',
		severity: 'low', level: 'L1', graphCheck: 'external_tagging',
		expectedValue: 'Transport rule tags external mail',
		remediationHint: 'Create mail flow rule to prepend [EXTERNAL] to external emails',
		portalUrl: 'https://admin.exchange.microsoft.com/#/transportrules',
		remediationGuide: 'Go to Exchange Admin Center > Mail Flow > Rules. Create a rule prepending "[EXTERNAL]" to external messages.',
		autoRemediable: false,
	},
	// CI/CD Security
	{
		id: 'CICD-05', section: 'CI/CD', title: 'Federated identity credentials are repo-scoped',
		description: 'Federated identity credentials must use repo-scoped subject constraints',
		severity: 'critical', level: 'L2', graphCheck: 'federated_identity_scoped',
		expectedValue: 'All federated credentials scoped to specific repo + branch/environment',
		remediationHint: 'Update federated identity credential subject to scope to repo:org/repo:ref:refs/heads/main',
		portalUrl: `${ENTRA}/RegisteredApps`,
		remediationGuide: 'Navigate to Azure AD > App Registrations > Certificates & Secrets > Federated Credentials. Scope each credential to a specific repository.',
		autoRemediable: false,
	},
	// 5. Auditing
	{
		id: '5.1.1', section: 'Audit', title: 'Unified audit logging enabled',
		description: 'Audit logging must be enabled across all workloads',
		severity: 'critical', level: 'L1', graphCheck: 'audit_logging',
		expectedValue: 'Audit logging enabled',
		remediationHint: 'Enable unified audit logging in Microsoft 365 compliance center',
		portalUrl: `${COMPLIANCE}/auditlogsearch`,
		remediationGuide: 'Navigate to Microsoft 365 Compliance > Audit. Click "Start recording user and admin activity".',
		autoRemediable: false,
	},
	{
		id: '5.2.1', section: 'Audit', title: 'Alert policies for admins',
		description: 'Alerts for privilege escalation and suspicious activity',
		severity: 'high', level: 'L1', graphCheck: 'admin_alert_policies',
		expectedValue: 'Alert policies configured',
		remediationHint: 'Configure alert policies for admin role changes and suspicious sign-ins',
		portalUrl: `${DEFENDER}/alertpoliciesv2`,
		remediationGuide: 'Go to Microsoft Defender > Policies > Alert Policies. Create alerts for admin role assignments and suspicious sign-ins.',
		autoRemediable: false,
	},
];

export const CIS_SECTIONS = [...new Set(CIS_CONTROLS.map(c => c.section))];

// Re-export from registry for new code
export { ALL_CIS_CONTROLS, ALL_CIS_SECTIONS, CONTROLS_BY_SECTION, CONTROL_COUNTS } from './control-registry';
