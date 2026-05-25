import type { PageInfo } from './types';

/** Marketing content for /security/* routes. */
export const SECURITY_PAGES: Record<string, PageInfo> = {
	'/security': {
		title: 'Security Monitoring',
		tagline: 'A single pane of glass for your Microsoft 365 security posture',
		description: 'Real-time health check, secure score trends, and one-click remediation for every connected tenant.',
		bullets: [
			'Live secure score across tenants',
			'Real-time threat signals from Defender and Entra',
			'One-click remediation for common risks',
			'Weekly health-check reports',
		],
	},
	'/security/cis': {
		title: 'CIS Benchmark',
		tagline: '100+ CIS M365 Foundations v3.1 controls, automated',
		description: 'Continuous CIS benchmark scanning with per-control remediation guidance and one-click fixes.',
		bullets: [
			'100+ controls across all CIS categories',
			'Per-control evidence and remediation steps',
			'Score trending over time',
			'Auto-remediation with approval gates',
		],
	},
	'/security/email': {
		title: 'Email Security',
		tagline: 'Defend against phishing, spoofing, and malicious mail',
		description: 'Threat detection, quarantine triage, and mail-auth (SPF, DKIM, DMARC) enforcement.',
		bullets: [
			'Real-time phishing and spoofing detection',
			'Quarantine review and release workflow',
			'SPF / DKIM / DMARC posture scoring',
			'Mail flow anomaly detection',
		],
	},
	'/security/purview': {
		title: 'Compliance Automation',
		tagline: 'Purview-driven policy scanning and evidence capture',
		description: 'Automated compliance scanning mapped to SOC2, HIPAA, GDPR, and ISO 27001 frameworks.',
		bullets: [
			'Framework-mapped control evidence',
			'DLP policy monitoring',
			'Retention and legal-hold visibility',
			'Auditor-ready export bundles',
		],
	},
	'/security/signin-logs': {
		title: 'Zero Trust Assessment',
		tagline: 'Sign-in log analysis and posture scoring',
		description: 'Understand and harden your conditional access and sign-in posture tenant-wide.',
		bullets: [
			'Sign-in risk scoring per user',
			'Legacy authentication detection',
			'MFA coverage gap analysis',
			'Conditional access simulation',
		],
	},
	'/security/copilot': {
		title: 'Copilot Readiness',
		tagline: 'Is your tenant actually ready for M365 Copilot?',
		description: 'Seven-category assessment with PDF export — know exactly what to fix before rolling Copilot out.',
		bullets: [
			'Identity, data, and labeling readiness',
			'Oversharing and permissions audit',
			'License and quota gap analysis',
			'Stakeholder-ready PDF report',
		],
	},
	'/security/copilot-usage': {
		title: 'Copilot Usage',
		tagline: 'Prove the ROI of your Copilot rollout',
		description: 'Per-user Copilot adoption, frequency, and productivity signals.',
		bullets: [
			'Active user and seat utilization',
			'Adoption trends over time',
			'Per-app usage breakdown',
			'Cost-per-active-user reports',
		],
	},
	'/security/harden': {
		title: 'Security Hardening',
		tagline: 'Guided, repeatable hardening for every tenant you onboard',
		description: 'Playbooks that turn new tenants from default settings into production-grade hardened configurations.',
		bullets: [
			'Wizard for first-time hardening',
			'Idempotent — safe to re-run',
			'Per-control evidence and rollback',
			'Standard templates per customer segment',
		],
	},
	'/security/stack': {
		title: 'Microsoft Security Stack',
		tagline: 'Inventory every security tool your tenant is entitled to',
		description: 'See which Microsoft security capabilities you own, which are configured, and which are sitting idle.',
		bullets: [
			'Per-license entitlement map',
			'Configured vs available gap analysis',
			'Quick-enable playbooks',
			'Monthly "unused capability" alerts',
		],
	},
	'/security/zero-trust': {
		title: 'Zero Trust Posture',
		tagline: 'Measure and improve your zero-trust alignment',
		description: 'Pillar-by-pillar zero-trust scoring across identity, devices, apps, data, and networks.',
		bullets: [
			'Five-pillar zero-trust scorecard',
			'Control gap identification',
			'Guided improvement roadmap',
			'Executive-ready summary report',
		],
	},
	'/security/sessions': {
		title: 'Active Sessions',
		tagline: 'See and revoke any active session, live',
		description: 'Token and session visibility across every user, with one-click revocation for incident response.',
		bullets: [
			'Live session inventory per user',
			'Suspicious session flagging',
			'One-click revoke-all for compromised accounts',
			'Token lifetime policy review',
		],
	},
	'/security/dashboard': {
		title: 'Security Dashboard',
		tagline: 'Executive view of your security posture',
		description: 'KPIs, trends, and risk indicators in one executive-ready dashboard.',
		bullets: [
			'Tenant health summary',
			'Trend analysis over 30/90 days',
			'Open-risk inventory',
			'Exportable for board packs',
		],
	},
};
