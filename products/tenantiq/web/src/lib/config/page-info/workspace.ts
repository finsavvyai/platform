import type { PageInfo } from './types';

/** Marketing content for workflow, governance, and management routes. */
export const WORKSPACE_PAGES: Record<string, PageInfo> = {
	'/alerts': {
		title: 'Alert Management',
		tagline: 'Real-time visibility into every security event',
		description: 'Triage and act on security alerts as they happen across every connected Microsoft 365 tenant.',
		bullets: [
			'Real-time alerts via Slack, Teams, Email',
			'Severity-based triage and auto-assignment',
			'One-click remediation for common threats',
			'SLA tracking and escalation rules',
		],
	},
	'/audit': {
		title: 'Audit & Compliance',
		tagline: 'A defensible record of every tenant change',
		description: 'Complete activity log with search, export, and compliance reporting for SOC2, HIPAA, and GDPR audits.',
		bullets: [
			'Immutable audit log across Entra, SharePoint, Exchange',
			'Full-text search and advanced filters',
			'PDF/CSV export ready for auditors',
			'Retention policies mapped to frameworks',
		],
	},
	'/audit/history': {
		title: 'Configuration History',
		tagline: 'Every configuration change, visualised over time',
		description: 'See exactly what changed, who changed it, and when — with side-by-side diffs between any two snapshots.',
		bullets: [
			'Daily snapshots of every policy and setting',
			'Visual diff viewer for any two points in time',
			'Drift alerts when unapproved changes happen',
			'Rollback guidance for risky changes',
		],
	},
	'/licenses': {
		title: 'License Optimization',
		tagline: 'Stop paying for licenses no-one uses',
		description: 'Track, reclaim, and right-size Microsoft 365 licenses across every tenant — with auto-remediation for inactive users.',
		bullets: [
			'Inactive-user detection with configurable threshold',
			'Waste calculator with monthly savings estimate',
			'Auto-reclaim workflow with approvals',
			'E3 vs E5 downgrade recommendations',
		],
	},
	'/threats': {
		title: 'Threat Detection',
		tagline: 'Identity threats spotted before they become incidents',
		description: 'Behavior-based anomaly detection with correlation across sign-ins, mail, and admin activity.',
		bullets: [
			'Impossible-travel and risky sign-in signals',
			'Admin privilege escalation detection',
			'Mail-based attack correlation',
			'Automated quarantine and remediation',
		],
	},
	'/workflows': {
		title: 'Workflows',
		tagline: 'Automate the remediation playbooks you run every week',
		description: 'Visual workflow builder for user lifecycle, license reclamation, group cleanup, and custom automations.',
		bullets: [
			'Visual drag-drop workflow builder',
			'Pre-built templates for common MSP tasks',
			'Approval gates for destructive actions',
			'Scheduled and event-triggered runs',
		],
	},
	'/workflows/lifecycle': {
		title: 'User Lifecycle',
		tagline: 'Automated joiner / mover / leaver workflows',
		description: 'Provision, transfer, and offboard users across Microsoft 365 with one reusable workflow per role.',
		bullets: [
			'10 built-in Graph actions',
			'Role-based provisioning templates',
			'Approval gates for sensitive changes',
			'Full audit trail of every action',
		],
	},
	'/workflows/guest-review': {
		title: 'Guest Review',
		tagline: 'Access reviews for every external guest',
		description: 'Quarterly review campaigns that prove every guest still needs access.',
		bullets: [
			'Scheduled review campaigns',
			'Owner-delegated attestation',
			'Auto-removal for abandoned accounts',
			'Compliance export for SOC2/ISO 27001',
		],
	},
	'/workflows/group-cleanup': {
		title: 'Group Cleanup',
		tagline: 'Find and fix stale, empty, and orphaned groups',
		description: 'Bulk operations to tidy up the groups and distribution lists that accumulate over years.',
		bullets: [
			'Stale group detection',
			'Empty and orphaned group flags',
			'Bulk archive / delete with approvals',
			'Membership health reports',
		],
	},
	'/workflows/approvals': {
		title: 'Workflow Approvals',
		tagline: 'Gate destructive changes behind approvals',
		description: 'Queue, approve, and audit every workflow that modifies production tenant configuration.',
		bullets: [
			'Multi-approver rules per workflow',
			'Slack / Teams / Email approval routing',
			'Full audit trail',
			'SLA tracking for approvers',
		],
	},
	'/governance': {
		title: 'Workspace Governance',
		tagline: 'Own your Teams, SharePoint, and Groups sprawl',
		description: 'Inventory, classify, and enforce governance policies across every Workspace, Team, and SharePoint site.',
		bullets: [
			'Full inventory of workspaces and owners',
			'External sharing and guest visibility',
			'Lifecycle policies with auto-expiration',
			'Orphaned workspace detection',
		],
	},
	'/governance/storage': {
		title: 'Storage Analytics',
		tagline: 'Find the 20% of users using 80% of the storage',
		description: 'Per-user OneDrive and SharePoint usage with quota alerts and over-90% flagging.',
		bullets: [
			'Top-20 consumers leaderboard',
			'≥90% quota flag with upgrade guidance',
			'Growth trend analysis',
			'License optimization recommendations',
		],
	},
};
