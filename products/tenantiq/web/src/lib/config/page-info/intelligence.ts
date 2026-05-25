import type { PageInfo } from './types';

/** Marketing content for analytics, AI, and MSP routes. */
export const INTELLIGENCE_PAGES: Record<string, PageInfo> = {
	'/ai': {
		title: 'AI Agent',
		tagline: 'Your security analyst that never sleeps',
		description: 'Natural-language queries answered against live tenant data. Ask anything from "who has MFA disabled?" to "remediate stale admins".',
		bullets: [
			'13+ security tools integrated into one chat',
			'Grounded in your real tenant data — not hallucinations',
			'Suggests and runs remediation with rollback',
			'Exports answers as reports for your customer',
		],
	},
	'/ai/agent': {
		title: 'AI Agent',
		tagline: 'Your security analyst that never sleeps',
		description: 'Natural-language queries answered against live tenant data.',
		bullets: [
			'13+ security tools integrated',
			'Grounded in your real tenant data',
			'Suggests and runs remediation',
			'Exports answers as reports',
		],
	},
	'/backups': {
		title: 'Cloud Backups',
		tagline: 'Point-in-time restore for your Microsoft 365 data',
		description: 'Encrypted, immutable backups of mailboxes, SharePoint, OneDrive, and Teams — with granular restore.',
		bullets: [
			'End-to-end encryption at rest',
			'Hourly incremental + daily full snapshots',
			'Granular restore to any point in time',
			'Tamper-evident audit trail for every restore',
		],
	},
	'/backups/config': {
		title: 'Config Snapshots',
		tagline: 'Configuration time-travel for your tenant',
		description: 'Capture, diff, and restore the configuration of policies, roles, and settings across your tenant.',
		bullets: [
			'Automated daily configuration capture',
			'Visual diff between any two snapshots',
			'One-click restore for risky changes',
			'Compliance attestation reports',
		],
	},
	'/behavior': {
		title: 'Behavior Analytics',
		tagline: 'User behavior monitoring and risk scoring',
		description: 'Spot unusual sign-ins, impossible travel, and risky admin behavior before they become incidents.',
		bullets: [
			'Per-user behavior baselines',
			'Impossible-travel and risky sign-in detection',
			'Privileged account anomaly alerts',
			'Risk scoring mapped to MITRE ATT&CK',
		],
	},
	'/sdlc': {
		title: 'AI Compliance (SDLC)',
		tagline: 'PII redaction, data protection, and audit trails for AI workflows',
		description: 'Govern how AI tools access and process your tenant data — HIPAA, GDPR, and SOC2 ready.',
		bullets: [
			'PII detection and redaction',
			'Data-processing audit trails',
			'Per-framework compliance mapping',
			'Data residency and retention controls',
		],
	},
	'/msp': {
		title: 'MSP Dashboard',
		tagline: 'Multi-tenant command centre for MSPs',
		description: 'Profitability, SLA adherence, and engagement health across every customer in one view.',
		bullets: [
			'Cross-tenant secure score benchmarking',
			'SLA and response-time tracking',
			'Profitability per customer',
			'White-label reporting for your customers',
		],
	},
	'/portal/me': {
		title: 'Your Tenant Portal',
		tagline: 'The self-service side of TenantIQ',
		description: 'Personal dashboard for managing your own account, sessions, and notifications.',
		bullets: [
			'Session and device management',
			'Notification preferences',
			'API token management',
			'Personal activity history',
		],
	},
};
