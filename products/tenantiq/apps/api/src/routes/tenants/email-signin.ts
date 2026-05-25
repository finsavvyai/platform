/**
 * Tenant email security and sign-in log routes.
 */
import { Hono } from 'hono';
import type { AppEnv } from '../../app/types';

export const emailSigninRoutes = new Hono<AppEnv>();

// GET /api/tenants/:id/email-security — DNS-based mail auth check + Graph data
emailSigninRoutes.get('/:id/email-security', async (c) => {
	const id = c.req.param('id');
	const tenant = await c.env.DB.prepare('SELECT azure_tenant_id, domain FROM tenants WHERE id = ?').bind(id).first<{ azure_tenant_id: string; domain: string }>().catch(() => null);

	let domain = tenant?.domain ?? 'unknown';
	if (tenant?.azure_tenant_id) {
		try {
			const { GraphClient } = await import('../../lib/graph-client');
			const graph = new GraphClient(c.env as any, tenant.azure_tenant_id);
			const orgData = await graph.fetch('/organization');
			const verifiedDomains = orgData?.value?.[0]?.verifiedDomains ?? [];
			const primary = verifiedDomains.find((d: any) => d.isDefault) || verifiedDomains[0];
			if (primary?.name) domain = primary.name;
		} catch { /* use stored domain */ }
	}

	const dnsCheck = async (name: string, type: string): Promise<string[]> => {
		try {
			const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`, {
				headers: { Accept: 'application/dns-json' },
			});
			const data = await res.json() as { Answer?: Array<{ data: string }> };
			return (data.Answer ?? []).map(a => a.data);
		} catch { return []; }
	};

	// DKIM: probe common selectors. M365 publishes selector1/selector2;
	// Google Workspace uses 'google'; many MTAs ship with k1/s1/s2.
	// CNAME for M365 selectors, TXT for direct keys (Google, custom).
	const DKIM_SELECTORS: Array<{ name: string; type: 'CNAME' | 'TXT' }> = [
		{ name: 'selector1', type: 'CNAME' },
		{ name: 'selector2', type: 'CNAME' },
		{ name: 'google', type: 'TXT' },
		{ name: 'k1', type: 'TXT' },
		{ name: 's1', type: 'TXT' },
		{ name: 's2', type: 'TXT' },
	];

	const [spfRecords, dmarcRecords, ...dkimResults] = await Promise.all([
		dnsCheck(domain, 'TXT'),
		dnsCheck(`_dmarc.${domain}`, 'TXT'),
		...DKIM_SELECTORS.map(s => dnsCheck(`${s.name}._domainkey.${domain}`, s.type)),
	]);

	const dkimSelectors = DKIM_SELECTORS.map((s, i) => ({
		selector: s.name,
		recordType: s.type,
		records: dkimResults[i],
		status: dkimResults[i].length > 0 ? 'pass' as const : 'none' as const,
	}));
	const dkimPasses = dkimSelectors.filter(s => s.status === 'pass');
	const dkimRecords = dkimPasses.flatMap(s => s.records);

	const spf = spfRecords.some(r => r.includes('v=spf1')) ? 'pass' : 'none';
	const dmarc = dmarcRecords.some(r => r.includes('v=DMARC1')) ? 'pass' : 'none';
	const dkim = dkimPasses.length > 0 ? 'pass' : 'none';
	const dmarcPolicy = dmarcRecords.find(r => r.includes('v=DMARC1'))?.match(/p=(\w+)/)?.[1] || 'none';

	return c.json({
		threats: [],
		summary: { totalScanned: 0, blocked: 0, quarantined: 0, delivered: 0 },
		authStatus: { spf, dkim, dmarc },
		authDetails: {
			domain,
			spfRecords,
			dmarcRecords,
			dkimRecords,
			dkimSelectors,
			dmarcPolicy,
			lastChecked: new Date().toISOString(),
		},
		relayPatterns: [],
	});
});

// GET /api/tenants/:id/signin-logs — Real sign-in data from Graph API
emailSigninRoutes.get('/:id/signin-logs', async (c) => {
	const id = c.req.param('id');
	const q = c.req.query();
	const status = q.status;
	const riskLevel = q.riskLevel;
	const userFilter = (q.user ?? '').toLowerCase();
	const page = Math.max(1, parseInt(q.page ?? '1', 10) || 1);
	const limit = Math.max(1, Math.min(200, parseInt(q.limit ?? '50', 10) || 50));

	const applyFilters = <T extends { status: string; riskLevel: string; userPrincipalName: string; userDisplayName: string }>(rows: T[]): T[] =>
		rows.filter((r) => {
			if (status && r.status !== status) return false;
			if (riskLevel && r.riskLevel !== riskLevel) return false;
			if (userFilter && !r.userPrincipalName.toLowerCase().includes(userFilter) && !r.userDisplayName.toLowerCase().includes(userFilter)) return false;
			return true;
		});
	const paginate = <T,>(rows: T[]): { logs: T[]; total: number } => {
		const start = (page - 1) * limit;
		return { logs: rows.slice(start, start + limit), total: rows.length };
	};

	const tenant = await c.env.DB.prepare('SELECT azure_tenant_id FROM tenants WHERE id = ?')
		.bind(id).first<{ azure_tenant_id: string }>();

	if (tenant?.azure_tenant_id) {
		try {
			const { GraphClient } = await import('../../lib/graph-client');
			const graph = new GraphClient(c.env as any, tenant.azure_tenant_id);
			const signIns = await graph.getAuditLogs();
			if (signIns.length > 0) {
				const mapped = signIns.map((s: any) => ({
					id: s.id,
					userDisplayName: s.userDisplayName || 'Unknown',
					userPrincipalName: s.userPrincipalName || '',
					appDisplayName: s.appDisplayName || 'Unknown App',
					ipAddress: s.ipAddress || '',
					location: [s.location?.city, s.location?.countryOrRegion].filter(Boolean).join(', ') || 'Unknown',
					status: s.status?.errorCode === 0 ? 'success' : 'failure',
					riskLevel: s.riskLevelDuringSignIn || 'none',
					clientApp: s.clientAppUsed || 'Unknown',
					createdAt: s.createdDateTime || null,
				}));
				return c.json(paginate(applyFilters(mapped)));
			}
		} catch { /* fall through to DB-based approach */ }
	}

	const db = c.env.DB;
	const users = await db.prepare('SELECT display_name, mail, user_principal_name, last_sign_in_at FROM users_cache WHERE tenant_id = ? AND last_sign_in_at IS NOT NULL ORDER BY last_sign_in_at DESC LIMIT 500')
		.bind(id).all().catch(() => ({ results: [] }));

	const mapped = users.results.map((u: any, i: number) => ({
		id: `db-${i}`,
		userDisplayName: u.display_name || 'Unknown',
		userPrincipalName: u.user_principal_name || u.mail || '',
		appDisplayName: 'Microsoft 365',
		ipAddress: '', location: '',
		status: 'success', riskLevel: 'none', clientApp: 'Unknown',
		createdAt: u.last_sign_in_at ? new Date(u.last_sign_in_at).toISOString() : null,
	}));

	return c.json(paginate(applyFilters(mapped)));
});

// GET /api/tenants/:id/signin-logs/summary — Real summary from Graph
emailSigninRoutes.get('/:id/signin-logs/summary', async (c) => {
	const id = c.req.param('id');
	const db = c.env.DB;

	const tenant = await db.prepare('SELECT azure_tenant_id FROM tenants WHERE id = ?')
		.bind(id).first<{ azure_tenant_id: string }>();
	if (tenant?.azure_tenant_id) {
		try {
			const { GraphClient } = await import('../../lib/graph-client');
			const graph = new GraphClient(c.env as any, tenant.azure_tenant_id);
			const signIns = await graph.getAuditLogs();
			if (signIns.length > 0) {
				const successful = signIns.filter((s: any) => s.status?.errorCode === 0).length;
				const failed = signIns.filter((s: any) => s.status?.errorCode !== 0).length;
				const risky = signIns.filter((s: any) => s.riskLevelDuringSignIn && s.riskLevelDuringSignIn !== 'none').length;
				const uniqueUsers = new Set(signIns.map((s: any) => s.userPrincipalName)).size;
				return c.json({ total: signIns.length, successful, failed, risky, uniqueUsers, retentionDays: 30 });
			}
		} catch { /* fall through */ }
	}

	const userResult = await db.prepare('SELECT COUNT(*) as total FROM users_cache WHERE tenant_id = ?').bind(id).first().catch(() => null);
	const userCount = Number((userResult as any)?.total ?? 0);
	if (userCount === 0) {
		return c.json({ total: 0, successful: 0, failed: 0, risky: 0, uniqueUsers: 0, retentionDays: 365, syncRequired: true, message: 'Sync your tenant to populate sign-in log data.' });
	}
	return c.json({ total: 0, successful: 0, failed: 0, risky: 0, uniqueUsers: userCount, retentionDays: 365, message: 'Grant AuditLog.Read.All permission for real sign-in data.' });
});
