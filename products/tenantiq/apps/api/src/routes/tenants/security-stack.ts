/**
 * Microsoft Security Stack routes — shows built-in M365 security products,
 * their configuration status, and value compared to third-party alternatives.
 * GET /api/tenants/:id/security/stack
 * Also mounts configuration action endpoints.
 */
import { Hono } from 'hono';
import type { AppEnv } from '../../app/types';
import { securityStackActionsRoutes } from './security-stack-actions';
import { securityStackMonitorRoutes } from './security-stack-monitor';

export const securityStackRoutes = new Hono<AppEnv>();

// Mount action and monitor routes
securityStackRoutes.route('/', securityStackActionsRoutes);
securityStackRoutes.route('/', securityStackMonitorRoutes);

interface StackProduct {
	id: string;
	title: string;
	replaces: string;
	status: 'active' | 'partial' | 'not_configured';
	score: number;
	features: Array<{ name: string; active: boolean }>;
	requiresLicense?: boolean;
	configUrl?: string;
}

interface SecurityStackData {
	products: StackProduct[];
	totalValue: number;
	thirdPartyEquivalent: number;
}

// GET /api/tenants/:id/security/stack
securityStackRoutes.get('/:id/security/stack', async (c) => {
	const id = c.req.param('id');
	const db = c.env.DB;

	// Get tenant to verify access
	const tenant = await db.prepare('SELECT id FROM tenants WHERE id = ?').bind(id).first();
	if (!tenant) return c.json({ error: 'Tenant not found' }, 404);

	// Get CIS control results for Defender for Office 365
	const cisControls = await db
		.prepare(`
			SELECT control_id, result FROM cis_scan_results
			WHERE tenant_id = ? AND control_id LIKE 'EM%'
			ORDER BY scanned_at DESC LIMIT 100
		`)
		.bind(id)
		.all()
		.catch(() => ({ results: [] }));

	// Get Purview data for DLP and labels
	const purviewData = await db
		.prepare(`
			SELECT data FROM purview_scans
			WHERE tenant_id = ? ORDER BY scanned_at DESC LIMIT 1
		`)
		.bind(id)
		.first()
		.catch(() => null);

	let dlpCount = 0, labelCount = 0;
	if (purviewData?.data) {
		try {
			const data = JSON.parse(purviewData.data as string);
			dlpCount = data.dlpPolicies?.length ?? 0;
			labelCount = data.sensitivityLabels?.length ?? 0;
		} catch {}
	}

	// Parse data from cache or derive from scans
	// TODO: Query Entra MFA policies from cache — will be dynamic
	const mfaStatus = 'partial' as StackProduct['status'];
	const caCount = 0; // TODO: Query Conditional Access policies count
	const cisEmailStatus = cisControls.results.length > 0 ? 'active' : 'not_configured';

	// Build security stack products (realistic defaults)
	const products: StackProduct[] = [
		{
			id: 'defender-office',
			title: 'Microsoft Defender for Office 365',
			replaces: 'Email Gateway (Proofpoint, Mimecast)',
			status: cisEmailStatus === 'active' ? 'active' : 'partial',
			score: cisEmailStatus === 'active' ? 75 : 40,
			features: [
				{ name: 'Safe Links protection', active: cisEmailStatus === 'active' },
				{ name: 'Safe Attachments', active: cisEmailStatus === 'active' },
				{ name: 'Anti-phishing policies', active: cisEmailStatus === 'active' },
				{ name: 'DKIM/SPF/DMARC', active: cisEmailStatus === 'active' },
			],
			requiresLicense: false,
		},
		{
			id: 'entra-protection',
			title: 'Microsoft Entra ID Protection',
			replaces: 'Cisco Duo / Okta Adaptive MFA',
			status: mfaStatus,
			score: mfaStatus === 'active' ? 85 : mfaStatus === 'partial' ? 50 : 20,
			features: [
				{ name: 'MFA enforcement', active: mfaStatus !== 'not_configured' },
				{ name: 'Conditional Access', active: caCount > 0 },
				{ name: 'Sign-in risk detection', active: mfaStatus !== 'not_configured' },
				{ name: 'User risk policies', active: mfaStatus === 'active' },
			],
			requiresLicense: false,
		},
		{
			id: 'purview-dlp',
			title: 'Microsoft Purview DLP',
			replaces: 'Cisco DLP / Digital Guardian',
			status: dlpCount > 0 ? 'active' : 'not_configured',
			score: dlpCount > 0 ? 70 : 0,
			features: [
				{ name: `DLP policies (${dlpCount})`, active: dlpCount > 0 },
				{ name: `Sensitivity labels (${labelCount})`, active: labelCount > 0 },
				{ name: 'Data classification', active: labelCount > 0 },
				{ name: 'Endpoint DLP', active: false },
			],
			requiresLicense: false,
		},
		{
			id: 'defender-cloud-apps',
			title: 'Microsoft Defender for Cloud Apps',
			replaces: 'Cisco Secure Access / Netskope',
			status: 'not_configured',
			score: 0,
			features: [
				{ name: 'App discovery', active: false },
				{ name: 'Session controls', active: false },
				{ name: 'OAuth app governance', active: false },
				{ name: 'Real-time threat detection', active: false },
			],
			requiresLicense: true,
			configUrl: 'https://security.microsoft.com/cloudapps',
		},
		{
			id: 'conditional-access',
			title: 'Conditional Access',
			replaces: 'Cisco Secure Access / Zscaler',
			status: caCount > 0 ? 'active' : 'partial',
			score: caCount > 0 ? 80 : 30,
			features: [
				{ name: `Active policies (${caCount})`, active: caCount > 0 },
				{ name: 'MFA enforcement scope', active: true },
				{ name: 'Device compliance', active: caCount > 0 },
				{ name: 'Location-based rules', active: false },
			],
			requiresLicense: false,
			configUrl: 'https://entra.microsoft.com/#view/Microsoft_AAD_ConditionalAccess/ConditionalAccessBlade/~/Policies',
		},
		{
			id: 'purview-compliance',
			title: 'Microsoft Purview Compliance',
			replaces: 'Third-party compliance / eDiscovery',
			status: 'partial',
			score: 60,
			features: [
				{ name: 'Retention policies', active: true },
				{ name: 'eDiscovery', active: true },
				{ name: 'Audit logging', active: true },
				{ name: 'Communication compliance', active: false },
			],
			requiresLicense: false,
			configUrl: 'https://compliance.microsoft.com',
		},
	];

	// Calculate value (simplified: each active feature = $50/mo baseline cost per product)
	const totalValue = products.reduce((sum, p) => {
		const activeFeatures = p.features.filter(f => f.active).length;
		const productValue = activeFeatures * 50;
		return sum + productValue;
	}, 0);

	// Equivalent third-party costs (industry standard estimates per product)
	const thirdPartyEquivalent = 1500; // ~$1500/mo for equivalent Cisco/Proofpoint/etc stack

	const response: SecurityStackData = {
		products,
		totalValue: Math.round(totalValue / 100) * 100, // Round to nearest hundred
		thirdPartyEquivalent,
	};

	return c.json(response);
});
