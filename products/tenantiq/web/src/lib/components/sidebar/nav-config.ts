import {
	LayoutDashboard, AlertTriangle, Activity, Bell, CreditCard, Shield, ShieldCheck, Mail,
	KeyRound, History, HardDrive, Bot, Workflow, ScrollText, Building2, Settings, Users,
	Sparkles, HeartPulse, Fingerprint, BarChart3, Database, FileText,
	ShieldAlert, Crown, KeySquare, Search, Send, FlaskConical, Link, ScanLine, Smartphone, ShieldEllipsis
} from 'lucide-svelte';

export interface NavItem {
	href: string;
	label: string;
	icon: typeof LayoutDashboard;
}

export interface NavGroup {
	label: string;
	items: NavItem[];
	open?: boolean;
}

export const quickAccess: NavItem[] = [
	{ href: '/skills', label: 'Skills Hub', icon: Sparkles },
	{ href: '/', label: 'Dashboard', icon: LayoutDashboard },
	{ href: '/security', label: 'Health Check', icon: HeartPulse },
];

export function buildNavGroups(isAdmin: boolean): NavGroup[] {
	return [
		{ label: 'Management', items: [
			{ href: '/alerts', label: 'Alerts', icon: Bell },
			{ href: '/licenses', label: 'Licenses', icon: CreditCard },
			{ href: '/audit', label: 'Audit & Compliance', icon: ScrollText },
			{ href: '/workflows', label: 'Workflows', icon: Workflow },
		]},
		{ label: 'Security', items: [
			{ href: '/security/dashboard', label: 'Security Dashboard', icon: ShieldAlert },
			{ href: '/security/cis', label: 'CIS Benchmark', icon: ShieldCheck },
			{ href: '/security/compliance', label: 'Compliance Frameworks', icon: Shield },
			{ href: '/threats', label: 'Threats', icon: AlertTriangle },
			{ href: '/behavior', label: 'Behavior', icon: Activity },
			{ href: '/security/email', label: 'Email Security', icon: Mail },
			{ href: '/security/inbox-rules', label: 'Mailbox Rule Audit', icon: ShieldAlert },
			{ href: '/security/purview', label: 'Purview', icon: ShieldCheck },
			{ href: '/security/signin-logs', label: 'Sign-in Logs', icon: KeyRound },
			{ href: '/sdlc', label: 'AI Compliance', icon: Fingerprint },
			{ href: '/security/copilot', label: 'Copilot Readiness', icon: Bot },
			{ href: '/security/intune', label: 'Intune Endpoint', icon: Smartphone },
			{ href: '/security/pim', label: 'Privileged Identity', icon: KeyRound },
			{ href: '/security/defender', label: 'Defender Coverage', icon: ShieldEllipsis },
			{ href: '/security/timewarp', label: 'Tenant Timewarp', icon: History },
		]},
		{ label: 'Analytics', items: [
			{ href: '/ai', label: 'AI Agent', icon: Bot },
			{ href: '/agents', label: 'Agent Activity', icon: Activity },
			{ href: '/seo', label: 'AI SEO Optimizer', icon: Search },
			{ href: '/seo/lab', label: 'AI SEO Lab', icon: FlaskConical },
			{ href: '/seo/publish', label: 'AI Publisher', icon: Send },
			{ href: '/reports', label: 'Executive Reports', icon: FileText },
			{ href: '/backups', label: 'Cloud Backups', icon: HardDrive },
			{ href: '/backups/config', label: 'Config Snapshots', icon: History },
			{ href: '/audit/history', label: 'Config History', icon: History },
		]},
		{ label: 'Governance', items: [
			{ href: '/governance', label: 'Workspaces', icon: Building2 },
			{ href: '/governance/storage', label: 'Storage', icon: Database },
			{ href: '/workflows/lifecycle', label: 'User Lifecycle', icon: Workflow },
			{ href: '/security/copilot-usage', label: 'Copilot Usage', icon: Bot },
		]},
		{ label: 'Partner', items: [
			{ href: '/gdap', label: 'GDAP Management', icon: Link },
			{ href: '/prospect', label: 'Prospect Scan', icon: ScanLine },
		]},
		{ label: 'Enterprise', items: [
			{ href: '/msp', label: 'MSP', icon: Building2 },
			{ href: '/msp/backups', label: 'All-Tenant Backups', icon: HardDrive },
			{ href: '/msp/benchmark', label: 'Benchmark', icon: BarChart3 },
			{ href: '/team', label: 'Team', icon: Users },
			{ href: '/settings', label: 'Settings', icon: Settings },
			{ href: '/settings/sso', label: 'Enterprise SSO', icon: KeySquare },
			{ href: '/settings/api-keys', label: 'MCP API Keys', icon: KeyRound },
			{ href: '/settings/mcp-clients', label: 'External MCP', icon: Link },
			...(isAdmin ? [{ href: '/platform/admin', label: 'Admin', icon: Crown }] : []),
		]},
	];
}
