/**
 * Per-action remediation guides for the Security Hardening Wizard.
 * Used by HardeningActionItem to render a RemediationDetailPanel drill-down.
 */

export interface HardeningGuide {
	steps: string[];
	portalUrl?: string;
	portalLabel?: string;
	whyItMatters?: string;
}

export const HARDENING_GUIDES: Record<string, HardeningGuide> = {
	'mfa-enforcement': {
		whyItMatters: 'Over 99% of account compromises involve accounts without MFA. Enforcing MFA is the single highest-ROI hardening action.',
		steps: [
			'Go to Entra ID > Security > Conditional Access.',
			'Create a new policy. Set Users to All users, excluding a break-glass admin.',
			'Under Grant controls, require "Multi-factor authentication".',
			'Enable the policy in Report-only mode for 24h to gauge impact.',
			'Flip to On once sign-in reports show no expected failures.',
		],
		portalUrl: 'https://entra.microsoft.com/#view/Microsoft_AAD_ConditionalAccess/ConditionalAccessBlade/~/Policies',
		portalLabel: 'Open Conditional Access',
	},
	'legacy-auth-block': {
		whyItMatters: 'Legacy authentication protocols (IMAP, POP, SMTP-AUTH) bypass MFA. They are the #1 vector in password-spray attacks.',
		steps: [
			'Entra ID > Sign-in logs. Filter Client app = "Exchange ActiveSync" + "Other clients". Confirm no legitimate usage.',
			'Create a Conditional Access policy blocking Client apps = "Exchange ActiveSync clients" + "Other clients".',
			'Pilot on 10 users for 48h.',
			'Roll out to All users. Keep a break-glass exemption.',
		],
		portalUrl: 'https://entra.microsoft.com/#view/Microsoft_AAD_ConditionalAccess/ConditionalAccessBlade/~/Policies',
		portalLabel: 'Open Conditional Access',
	},
	'conditional-access': {
		whyItMatters: 'Conditional Access is the enforcement plane for Zero Trust. Without it, device compliance and risk signals are advisory only.',
		steps: [
			'Start with Microsoft templates: Block legacy auth, Require MFA for admins, Require compliant device.',
			'Add a location-based policy flagging untrusted countries as high-risk.',
			'Enable "sign-in risk" policy requiring MFA on medium+ risk.',
			'Enable "user risk" policy forcing password reset on high risk.',
			'Run each policy in Report-only for 24h before enabling.',
		],
		portalUrl: 'https://entra.microsoft.com/#view/Microsoft_AAD_ConditionalAccess/ConditionalAccessBlade/~/Policies',
		portalLabel: 'Open Conditional Access',
	},
	'email-safe-links': {
		whyItMatters: 'Safe Links rewrites URLs in email, Teams, and Office apps to check against the latest threat intel at click-time — catching phishing that slipped through initial scans.',
		steps: [
			'Microsoft 365 Defender > Policies > Safe Links. Create a new policy.',
			'Scope to All users. Enable: Use Safe Links in email, Track clicks, Do not let users click through to original URL.',
			'Enable Safe Attachments: Dynamic Delivery to avoid inbox blocking.',
			'Confirm preset policy "Standard" or "Strict" is assigned tenant-wide.',
		],
		portalUrl: 'https://security.microsoft.com/safelinksv2',
		portalLabel: 'Open Defender Safe Links',
	},
	'block-external-forwarding': {
		whyItMatters: 'Attackers set up mailbox forwarding rules after account compromise to exfiltrate data silently. Blocking external forwarding breaks this pattern.',
		steps: [
			'Exchange admin center > Mail flow > Remote domains > Default.',
			'Set "Automatic forwarding" to "Automatic forwarding is disabled".',
			'Create an anti-spam outbound policy blocking automatic forwarding externally.',
			'Audit existing mailbox rules: run Get-InboxRule | ForEach-Object { Get-InboxRule -Mailbox $_.MailboxOwnerID -Identity $_.Name } and review ForwardTo entries.',
		],
		portalUrl: 'https://admin.exchange.microsoft.com/#/remotedomains',
		portalLabel: 'Open Exchange Admin',
	},
	'mailbox-audit': {
		whyItMatters: 'Without mailbox audit logging, post-compromise investigation is blind. Audit logs are your ground truth for "what did they access?".',
		steps: [
			'Connect to Exchange Online PowerShell.',
			'Run: Set-OrganizationConfig -AuditDisabled $false',
			'For each mailbox: Set-Mailbox -Identity <user> -AuditEnabled $true',
			'Verify: Get-Mailbox | Select Name,AuditEnabled,AuditLogAgeLimit',
			'Ensure retention is at least 90 days (180d recommended for regulated industries).',
		],
		portalUrl: 'https://compliance.microsoft.com/auditlogsearch',
		portalLabel: 'Open Audit Log Search',
	},
	'remove-stale-guests': {
		whyItMatters: 'Each stale guest is a dormant credential an attacker can hijack. Most M365 tenants accumulate hundreds of unused guest accounts from old projects.',
		steps: [
			'Entra ID > Users > All users > Filter by User type = Guest.',
			'Sort by Last sign-in. Export list of guests with last sign-in >90 days.',
			'Email each sponsor (inviter) to confirm access still needed.',
			'Disable (don\'t delete) accounts that don\'t respond within 7 days.',
			'Delete disabled guests after 30-day grace period.',
		],
		portalUrl: 'https://entra.microsoft.com/#view/Microsoft_AAD_UsersAndTenants/UserManagementMenuBlade/~/AllUsers',
		portalLabel: 'Open User Management',
	},
	'revoke-risky-sessions': {
		whyItMatters: 'Active sessions survive password resets. If a user is compromised, revoking sessions is the only way to kick the attacker out.',
		steps: [
			'Entra ID > Security > Risky users.',
			'Select each high-risk user > Confirm user compromised.',
			'Revoke sessions: use the "Revoke sessions" action OR run PowerShell: Revoke-AzureADUserAllRefreshToken -ObjectId <oid>',
			'Force password reset for the same users.',
			'Enable automatic remediation via Azure AD Identity Protection "User risk" CA policy.',
		],
		portalUrl: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/SecurityMenuBlade/~/RiskyUsers',
		portalLabel: 'Open Risky Users',
	},
	'restrict-external-sharing': {
		whyItMatters: 'Anonymous "anyone with link" sharing leaks sensitive documents. Restricting sharing to specific people creates an audit trail and limits blast radius.',
		steps: [
			'SharePoint admin center > Policies > Sharing.',
			'Set external sharing to "New and existing guests" (not "Anyone").',
			'Limit file and folder links to "Specific people" by default.',
			'Set link expiration to 30 days. Require MFA for external guests.',
			'Repeat for OneDrive sharing settings.',
		],
		portalUrl: 'https://admin.microsoft.com/sharepoint?page=sharing',
		portalLabel: 'Open SharePoint Sharing',
	},
};
