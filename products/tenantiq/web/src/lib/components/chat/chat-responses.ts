/** Client-side keyword-matched responses for the free-tier AI guide chatbot. */

interface GuideResponse {
	keywords: string[];
	answer: string;
	link?: string;
}

const RESPONSES: GuideResponse[] = [
	{
		keywords: ['what is tenantiq', 'about tenantiq', 'what does tenantiq'],
		answer:
			'TenantIQ is an AI-powered Microsoft 365 security, compliance, and cost intelligence platform built for MSPs. It provides real-time anomaly detection, CIS benchmark automation, and skill-based remediation.',
	},
	{
		keywords: ['get started', 'getting started', 'start', 'setup', 'begin'],
		answer:
			'Connect your Microsoft 365 tenant via Settings, then sync your users and licenses. Your dashboard will populate automatically once the first sync completes.',
		link: '/settings',
	},
	{
		keywords: ['cis', 'benchmark', 'cis benchmark'],
		answer:
			'CIS Benchmark is a security standard with 100+ controls for Microsoft 365. TenantIQ automates scanning against CIS M365 Foundations Benchmark v3.1 and provides one-click remediation.',
		link: '/security/cis',
	},
	{
		keywords: ['run scan', 'scan', 'run a scan', 'trigger scan'],
		answer:
			'Go to Security > CIS Benchmark and click "Run CIS Scan". The scan evaluates 100+ controls and generates a compliance score with remediation steps.',
		link: '/security/cis',
	},
	{
		keywords: ['compliance', 'framework', 'soc', 'hipaa', 'gdpr', 'zero trust'],
		answer:
			'TenantIQ supports SOC 2, HIPAA, GDPR, and Zero Trust compliance frameworks. Go to Audit & Compliance to view your compliance posture across all frameworks.',
		link: '/audit',
	},
	{
		keywords: ['license', 'optimize', 'cost', 'waste', 'spend'],
		answer:
			'Go to the Licenses page to see waste analysis, unused license detection, and cost optimization recommendations. You can identify and reclaim unused licenses automatically.',
		link: '/licenses',
	},
	{
		keywords: ['ai agent', 'ai assistant', 'ask ai', 'artificial intelligence'],
		answer:
			'Go to the AI Agent page, type your question about your tenant security, and get AI-powered analysis and recommendations based on your real tenant data.',
		link: '/ai',
	},
	{
		keywords: ['permission', 'admin', 'access', 'role'],
		answer:
			'TenantIQ requires Microsoft 365 Global Admin or Security Admin permissions for full functionality. Read-only access works for monitoring, but remediation requires write permissions.',
	},
	{
		keywords: ['export', 'csv', 'json', 'download', 'report'],
		answer:
			'Use the Export button on any page to download data as CSV or JSON. Executive reports can be generated from the Dashboard with PDF export.',
	},
	{
		keywords: ['remediation', 'remediate', 'fix', 'auto-fix'],
		answer:
			'One-click remediations include a dry-run preview showing exactly what will change, plus automatic rollback if anything goes wrong. Find them on the CIS Benchmark page.',
		link: '/security/cis',
	},
	{
		keywords: ['security', 'show me security', 'security page'],
		answer: 'Here is the Security overview page with your tenant health score and security posture.',
		link: '/security',
	},
	{
		keywords: ['alert', 'show me alert', 'alerts page', 'notifications'],
		answer: 'Here is the Alerts page where you can view and manage security alerts.',
		link: '/alerts',
	},
	{
		keywords: ['dashboard', 'show me dashboard', 'home', 'overview'],
		answer: 'Here is your Dashboard with key metrics and tenant overview.',
		link: '/',
	},
	{
		keywords: ['threat', 'show me threat', 'threats page'],
		answer: 'Here is the Threats page for identity threat detection and anomaly analysis.',
		link: '/threats',
	},
	{
		keywords: ['skill', 'skills hub', 'marketplace', 'show me skills'],
		answer: 'Here is the Skills Hub where you can activate and manage your security skills.',
		link: '/skills',
	},
	{
		keywords: ['workflow', 'automation', 'show me workflow', 'automate'],
		answer:
			'Workflows automate recurring tasks across your tenant. There are 4 types: License Optimization (finds and reclaims unused licenses), Security Remediation (flags disabled and inactive accounts), User Cleanup (removes stale guests and never-signed-in users), and Compliance Check (audits active alerts and user health). You can run them manually or schedule them on a cron.',
		link: '/workflows',
	},
	{
		keywords: ['what can', 'what do', 'what does', 'capabilities', 'features'],
		answer:
			'TenantIQ can: run CIS benchmark scans with auto-remediation, detect threats from Microsoft Graph, optimize license costs, manage user lifecycle, analyze email security, track compliance posture, automate workflows, and provide AI-powered insights. Try asking about any specific feature!',
	},
	{
		keywords: ['build', 'create workflow', 'new workflow', 'make workflow'],
		answer:
			'To create a workflow: go to Workflows, click "Create Workflow", pick a name and type (License Optimization, Security Remediation, User Cleanup, or Compliance Check), choose manual or scheduled trigger, then save. Run it anytime with "Run Now".',
		link: '/workflows',
	},
	{
		keywords: ['email', 'mail', 'phishing', 'email security'],
		answer: 'Here is the Email Security page for threat detection, quarantine, and mail authentication monitoring.',
		link: '/security/email',
	},
	{
		keywords: ['team', 'invite', 'member', 'user management'],
		answer: 'Go to the Team page to invite members, manage roles, and control access to your organization.',
		link: '/team',
	},
	{
		keywords: ['settings', 'configure', 'configuration'],
		answer: 'Go to Settings to manage your tenant connections, API keys, notification preferences, and billing.',
		link: '/settings',
	},
	{
		keywords: ['help', 'support', 'contact'],
		answer:
			'I can help with basic navigation and feature questions. For advanced AI analysis of your tenant data, use the AI Agent page. For support, contact support@tenantiq.com.',
		link: '/ai',
	},
];

const DEFAULT_RESPONSE =
	"I'm not sure about that one. Try asking about: workflows, licenses, CIS benchmarks, alerts, threats, security, compliance, or any page you see in the sidebar. For AI-powered analysis of your actual tenant data, use the AI Agent.";

export function findResponse(query: string): { answer: string; link?: string } {
	const lower = query.toLowerCase().trim();
	for (const r of RESPONSES) {
		if (r.keywords.some((kw) => lower.includes(kw))) {
			return { answer: r.answer, link: r.link };
		}
	}
	return { answer: DEFAULT_RESPONSE, link: '/ai' };
}
