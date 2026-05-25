import { writable, derived } from 'svelte/store';
import { auth } from './auth';
import { meetsMinimumPlan } from '$lib/config/plan-limits';

export type SkillStatus = 'active' | 'locked' | 'trial';
export type SkillCategory = 'foundation' | 'management' | 'security' | 'analytics' | 'enterprise';
export type PlanTier = 'all' | 'core' | 'professional' | 'security_suite' | 'enterprise';

export interface Skill {
	id: string;
	name: string;
	icon: string;
	description: string;
	category: SkillCategory;
	href: string;
	status: SkillStatus;
	price: number;
	includedIn: PlanTier;
	trialDaysLeft?: number;
}

export const CATEGORY_LABELS: Record<SkillCategory, string> = {
	foundation: 'Foundation',
	management: 'Management',
	security: 'Security',
	analytics: 'Analytics',
	enterprise: 'Enterprise',
};

// Tier assignments match the landing-page pricing copy.
// Core: security visibility baseline (dashboards, reports, CIS, email, license).
// Professional: + AI Agent, remediation, workflows, compliance automation, behavior.
// Security Suite: + hardening, drift, config snapshots.
// Enterprise: + MSP multi-tenant, risk analytics.
export const SKILLS: Skill[] = [
	{ id: 'dashboard', name: 'Dashboard', icon: 'LayoutDashboard', description: 'Metrics visualization and overview', category: 'foundation', href: '/', status: 'active', price: 0, includedIn: 'all' },
	{ id: 'health', name: 'Security Monitoring', icon: 'HeartPulse', description: 'Tenant health assessment and real-time security monitoring', category: 'foundation', href: '/security', status: 'active', price: 0, includedIn: 'all' },

	{ id: 'alerts', name: 'Alert Management', icon: 'Bell', description: 'Real-time security alerts and notifications', category: 'management', href: '/alerts', status: 'active', price: 0, includedIn: 'core' },
	{ id: 'licenses', name: 'License Optimization', icon: 'CreditCard', description: 'License tracking, waste detection, cost analysis', category: 'management', href: '/licenses', status: 'active', price: 0, includedIn: 'core' },
	{ id: 'audit', name: 'Audit & Compliance', icon: 'ScrollText', description: 'Audit logging, compliance tracking, reporting', category: 'management', href: '/audit', status: 'active', price: 0, includedIn: 'core' },
	{ id: 'workflows', name: 'Workflows', icon: 'Workflow', description: 'Automated remediation and workflow builder', category: 'management', href: '/workflows', status: 'active', price: 0, includedIn: 'professional' },

	{ id: 'cis', name: 'CIS Benchmark', icon: 'ShieldCheck', description: 'Automated CIS M365 Foundations Benchmark v3.1 compliance scanning', category: 'security', href: '/security/cis', status: 'active', price: 0, includedIn: 'core' },
	{ id: 'threats', name: 'Threat Detection', icon: 'AlertTriangle', description: 'Identity threat detection and anomaly detection', category: 'security', href: '/threats', status: 'active', price: 0, includedIn: 'professional' },
	{ id: 'email', name: 'Email Security', icon: 'Mail', description: 'Threat detection, quarantine, mail auth monitoring', category: 'security', href: '/security/email', status: 'active', price: 0, includedIn: 'core' },
	{ id: 'compliance', name: 'Compliance Automation', icon: 'ShieldCheck', description: 'Policy compliance scanning and automated benchmarking', category: 'security', href: '/security/purview', status: 'active', price: 0, includedIn: 'security_suite' },
	{ id: 'signin', name: 'Zero Trust Assessment', icon: 'KeyRound', description: 'Sign-in log analysis and zero trust posture evaluation', category: 'security', href: '/security/signin-logs', status: 'active', price: 0, includedIn: 'professional' },
	{ id: 'sdlc', name: 'AI Compliance (SDLC)', icon: 'Fingerprint', description: 'AI data protection, PII redaction, HIPAA/GDPR audit trails', category: 'security', href: '/sdlc', status: 'active', price: 0, includedIn: 'professional' },

	{ id: 'ai', name: 'AI Autopilot', icon: 'Bot', description: 'AI-powered security analysis and automated recommendations', category: 'analytics', href: '/ai', status: 'active', price: 0, includedIn: 'professional' },
	{ id: 'backups', name: 'Backup & Recovery', icon: 'HardDrive', description: 'Encrypted tenant data backup and point-in-time restore', category: 'analytics', href: '/backups', status: 'active', price: 0, includedIn: 'security_suite' },
	{ id: 'reports', name: 'Executive Reports', icon: 'History', description: 'Board-ready security reports and compliance summaries', category: 'analytics', href: '/audit/history', status: 'active', price: 0, includedIn: 'professional' },
	{ id: 'behavior', name: 'Behavior Analytics', icon: 'Activity', description: 'User behavior monitoring and risk scoring', category: 'analytics', href: '/behavior', status: 'active', price: 0, includedIn: 'professional' },

	{ id: 'msp', name: 'MSP Dashboard', icon: 'Building2', description: 'Multi-tenant dashboard and SLA monitoring', category: 'enterprise', href: '/msp', status: 'active', price: 0, includedIn: 'enterprise' },
	{ id: 'pam', name: 'Privileged Access', icon: 'Shield', description: 'Admin account management and JIT access', category: 'enterprise', href: '/security', status: 'active', price: 0, includedIn: 'security_suite' },
	{ id: 'risk', name: 'Advanced Risk Analytics', icon: 'BarChart3', description: 'Risk quantification and predictive analytics', category: 'enterprise', href: '/security', status: 'active', price: 0, includedIn: 'enterprise' },
];

const VALID_PROMO_CODES = ['ALLACCESS', 'ENTERPRISE2026', 'DEMO'];
const PROMO_STORAGE_KEY = 'tenantiq_promo';

function loadPromoState(): boolean {
	if (typeof localStorage === 'undefined') return false;
	return localStorage.getItem(PROMO_STORAGE_KEY) !== null;
}

export const promoApplied = writable<boolean>(loadPromoState());

export function applyPromo(code: string): boolean {
	const normalized = code.toUpperCase().trim();
	if (!VALID_PROMO_CODES.includes(normalized)) return false;
	if (typeof localStorage !== 'undefined') {
		localStorage.setItem(PROMO_STORAGE_KEY, normalized);
	}
	promoApplied.set(true);
	return true;
}

// Manual overrides: user-started trials (7d) take priority over plan lock.
const overrides = writable<Record<string, SkillStatus>>({});

function createSkillsStore() {
	return {
		subscribe: overrides.subscribe,
		activate(id: string) { overrides.update(o => ({ ...o, [id]: 'active' })); },
		deactivate(id: string) { overrides.update(o => ({ ...o, [id]: 'locked' })); },
		lock(id: string) { overrides.update(o => ({ ...o, [id]: 'locked' })); },
		startTrial(id: string, _days: number) { overrides.update(o => ({ ...o, [id]: 'trial' })); },
	};
}

export const skillsControl = createSkillsStore();

/** Plan-aware skill list — authoritative for UI. */
export const skills = derived(
	[overrides, auth, promoApplied],
	([$overrides, $auth, $promo]) => {
		const plan = ($auth.user as { plan?: string })?.plan ?? 'free';
		return SKILLS.map(sk => {
			if ($overrides[sk.id] === 'trial') return { ...sk, status: 'trial' as const };
			if ($promo) return { ...sk, status: 'active' as const };
			if (sk.includedIn === 'all') return { ...sk, status: 'active' as const };
			const unlocked = meetsMinimumPlan(plan, sk.includedIn);
			if (!unlocked) return { ...sk, status: 'locked' as const };
			const manual = $overrides[sk.id];
			return { ...sk, status: (manual === 'locked' ? 'locked' : 'active') as SkillStatus };
		});
	},
);

export const activeSkills = derived(skills, $s => $s.filter(s => s.status === 'active' || s.status === 'trial'));
export const lockedSkills = derived(skills, $s => $s.filter(s => s.status === 'locked'));
export const activeCount = derived(activeSkills, $a => $a.length);
export const totalCount = derived(skills, $s => $s.length);
