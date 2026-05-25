export interface HardeningAction {
	id: string;
	title: string;
	description: string;
	impact: 'Critical' | 'High' | 'Medium';
	affectedCount: number;
	reversible: boolean;
	enabled: boolean;
	status: 'pending' | 'running' | 'success' | 'failed';
	error?: string;
	apiAction?: string;
	product?: string;
	options?: Record<string, unknown>;
}

export const DEFAULT_ACTIONS: HardeningAction[] = [
	{
		id: 'mfa-enforcement',
		title: 'Enforce MFA for all users without it',
		description: 'Require multi-factor authentication across all accounts',
		impact: 'Critical',
		affectedCount: 12,
		reversible: true,
		enabled: true,
		status: 'pending',
		apiAction: 'createMfaEnforcementPolicy',
		product: 'entra',
		options: { allUsers: true }
	},
	{
		id: 'legacy-auth-block',
		title: 'Block legacy authentication protocols',
		description: 'Disable IMAP, POP3, and other legacy protocols',
		impact: 'Critical',
		affectedCount: 5,
		reversible: true,
		enabled: true,
		status: 'pending',
		apiAction: 'blockLegacyAuthPolicy',
		product: 'conditional-access'
	},
	{
		id: 'conditional-access',
		title: 'Enable Conditional Access policies',
		description: 'Enforce device compliance and risk-based access',
		impact: 'High',
		affectedCount: 45,
		reversible: true,
		enabled: true,
		status: 'pending',
		apiAction: 'createConditionalAccessPolicy',
		product: 'conditional-access'
	},
	{
		id: 'email-safe-links',
		title: 'Configure email Safe Links & Safe Attachments',
		description: 'Enable advanced threat protection for email',
		impact: 'High',
		affectedCount: 0,
		reversible: true,
		enabled: true,
		status: 'pending',
		apiAction: 'enableSafeLinksPolicy',
		product: 'exchange'
	},
	{
		id: 'block-external-forwarding',
		title: 'Block external email auto-forwarding',
		description: 'Prevent data exfiltration via email rules',
		impact: 'High',
		affectedCount: 8,
		reversible: true,
		enabled: true,
		status: 'pending',
		apiAction: 'blockExternalForwardingPolicy',
		product: 'exchange'
	},
	{
		id: 'mailbox-audit',
		title: 'Enable mailbox audit logging',
		description: 'Track access and changes to user mailboxes',
		impact: 'Medium',
		affectedCount: 45,
		reversible: false,
		enabled: true,
		status: 'pending',
		apiAction: 'enableMailboxAudit',
		product: 'exchange'
	},
	{
		id: 'remove-stale-guests',
		title: 'Remove stale guest accounts (inactive >90 days)',
		description: 'Clean up unused external collaboration accounts',
		impact: 'High',
		affectedCount: 3,
		reversible: true,
		enabled: true,
		status: 'pending',
		apiAction: 'removeStaleGuests',
		product: 'entra',
		options: { inactiveDays: 90 }
	},
	{
		id: 'revoke-risky-sessions',
		title: 'Revoke sessions for risky users',
		description: 'Force re-authentication for compromised accounts',
		impact: 'Critical',
		affectedCount: 2,
		reversible: false,
		enabled: true,
		status: 'pending',
		apiAction: 'revokeRiskySessions',
		product: 'identity-protection'
	},
	{
		id: 'restrict-external-sharing',
		title: 'Restrict external sharing',
		description: 'Limit SharePoint and OneDrive external sharing',
		impact: 'High',
		affectedCount: 0,
		reversible: true,
		enabled: true,
		status: 'pending',
		apiAction: 'restrictExternalSharing',
		product: 'sharepoint'
	}
];
