export interface SkillMetric {
	label: string;
	value: string;
}

export interface Skill {
	id: string;
	name: string;
	description: string;
	category: 'foundation' | 'management' | 'security' | 'analytics' | 'enterprise';
	icon: string;
	status: 'active' | 'trial' | 'locked';
	price: number;
	href: string;
	metrics?: SkillMetric;
}

export interface SkillRecommendation {
	skillId: string;
	reason: string;
	benefit: string;
}

export const BASE_SKILLS: Omit<Skill, 'status'>[] = [
	// Foundation
	{ id: 'dashboard', name: 'Dashboard', description: 'Metrics visualization and overview', category: 'foundation', icon: 'LayoutDashboard', price: 0, href: '/' },
	{ id: 'health', name: 'Health Check', description: 'Tenant health assessment and scoring', category: 'foundation', icon: 'HeartPulse', price: 0, href: '/security' },
	// Management
	{ id: 'alerts', name: 'Alert Management', description: 'Real-time security alerts and notifications', category: 'management', icon: 'Bell', price: 99, href: '/alerts' },
	{ id: 'licenses', name: 'License Optimizer', description: 'License tracking, waste detection, cost analysis', category: 'management', icon: 'CreditCard', price: 79, href: '/licenses' },
	{ id: 'audit', name: 'Audit & Compliance', description: 'Audit logging, compliance tracking, reporting', category: 'management', icon: 'ScrollText', price: 99, href: '/audit' },
	{ id: 'workflows', name: 'Workflows', description: 'Automated remediation and workflow builder', category: 'management', icon: 'Workflow', price: 119, href: '/workflows' },
	// Security
	{ id: 'threats', name: 'Threat Detection', description: 'Identity threat detection and anomaly detection', category: 'security', icon: 'AlertTriangle', price: 199, href: '/threats' },
	{ id: 'behavior', name: 'Behavior Analytics', description: 'User behavior monitoring and risk scoring', category: 'security', icon: 'Activity', price: 129, href: '/behavior' },
	{ id: 'email', name: 'Email Security', description: 'Threat detection, quarantine, mail auth monitoring', category: 'security', icon: 'Mail', price: 89, href: '/security/email' },
	{ id: 'compliance', name: 'Compliance Scanner', description: 'Policy compliance scanning and benchmarking', category: 'security', icon: 'ShieldCheck', price: 149, href: '/security/purview' },
	{ id: 'signin', name: 'Sign-in Monitoring', description: 'Sign-in log analysis and anomaly detection', category: 'security', icon: 'KeyRound', price: 89, href: '/security/signin-logs' },
	// Analytics
	{ id: 'ai', name: 'AI Assistant', description: 'AI-powered analysis and recommendations', category: 'analytics', icon: 'Bot', price: 129, href: '/ai' },
	{ id: 'backups', name: 'Cloud Backups', description: 'Encrypted tenant data backup and restore', category: 'analytics', icon: 'HardDrive', price: 89, href: '/backups' },
	{ id: 'history', name: 'Config History', description: 'Configuration change tracking and diffing', category: 'analytics', icon: 'History', price: 79, href: '/audit/history' },
	// Enterprise
	{ id: 'msp', name: 'MSP Dashboard', description: 'Multi-tenant dashboard and SLA monitoring', category: 'enterprise', icon: 'Building2', price: 199, href: '/msp' },
	{ id: 'pam', name: 'Privileged Access', description: 'Admin account management and JIT access', category: 'enterprise', icon: 'Shield', price: 179, href: '/security' },
	{ id: 'risk', name: 'Advanced Risk Analytics', description: 'Risk quantification and predictive analytics', category: 'enterprise', icon: 'BarChart3', price: 169, href: '/security' },
];

export function getSkillsData(_tenantId: string): Skill[] {
	return BASE_SKILLS.map((s) => ({ ...s, status: 'active' as const }));
}

export function getSkillRecommendations(tenantId: string): SkillRecommendation[] {
	const skills = getSkillsData(tenantId);
	const locked = skills.filter((s) => s.status === 'locked');
	if (locked.length === 0) return [];

	const recs: SkillRecommendation[] = [];
	const threats = locked.find((s) => s.id === 'threats');
	if (threats) {
		recs.push({
			skillId: 'threats',
			reason: 'Based on your alert volume, threat detection would reduce triage time.',
			benefit: 'Detects identity threats 40% faster with behavioral analytics',
		});
	}
	const msp = locked.find((s) => s.id === 'msp');
	if (msp && recs.length < 2) {
		recs.push({
			skillId: 'msp',
			reason: 'Manage multiple tenants from a single unified dashboard.',
			benefit: 'Reduce cross-tenant management overhead by 60%',
		});
	}
	return recs.slice(0, 2);
}
