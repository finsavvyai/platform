/**
 * Demo-mode MCP key. Anyone can paste `tiq_demo_visitor_2026` into Claude
 * Desktop and get a working synthetic MSP org. Maps to a fixed orgId of
 * `demo-org` with three pre-seeded synthetic tenants. Used by /api/mcp.
 */
export const DEMO_KEY = 'tiq_demo_visitor_2026';

export const DEMO_ORG_ID = 'demo-org';

export interface DemoUser {
	sub: string; orgId: string; email: string; role: string; tenantIds: string[];
}

export const DEMO_USER: DemoUser = {
	sub: 'demo-user',
	orgId: DEMO_ORG_ID,
	email: 'demo@tenantiq.app',
	role: 'admin',
	tenantIds: ['demo-tenant-acme', 'demo-tenant-globex', 'demo-tenant-initech'],
};

interface DemoTenant {
	id: string; display_name: string; domain: string; status: string; last_sync_at: number | null;
}

export const DEMO_TENANTS: DemoTenant[] = [
	{ id: 'demo-tenant-acme', display_name: 'Acme Corp (demo)', domain: 'acme.example', status: 'active', last_sync_at: Date.now() - 3 * 3600_000 },
	{ id: 'demo-tenant-globex', display_name: 'Globex Industries (demo)', domain: 'globex.example', status: 'active', last_sync_at: Date.now() - 18 * 3600_000 },
	{ id: 'demo-tenant-initech', display_name: 'Initech (demo)', domain: 'initech.example', status: 'active', last_sync_at: Date.now() - 8 * 86400_000 },
];

export const DEMO_CIS_POSTURE = JSON.stringify({
	overallScore: 72, passCount: 87, failCount: 18, partialCount: 11, errorCount: 5,
	totalControls: 121,
	topFindings: [
		{ id: 'CIS-1.1.1', severity: 'critical', title: 'Global Administrators count exceeds 4', current: 7, expected: '≤ 4' },
		{ id: 'CIS-2.1.4', severity: 'high', title: 'DMARC policy is p=none — not enforcing', current: 'p=none', expected: 'p=quarantine or p=reject' },
		{ id: 'CIS-3.1.2', severity: 'high', title: 'Audit log retention < 180 days', current: '90d', expected: '≥ 180d' },
		{ id: 'CIS-5.1.6', severity: 'medium', title: 'Conditional Access policy missing for legacy auth', current: 'absent', expected: 'block' },
		{ id: 'CIS-6.4.1', severity: 'medium', title: 'External sharing not restricted to allowlist', current: 'any', expected: 'allowlist' },
	],
}, null, 2);

export const DEMO_DRIFT_EVENTS = JSON.stringify({
	drifts: [
		{ id: 'd-1', tenant_id: 'demo-tenant-acme', category: 'conditionalAccess', severity: 'high', summary: 'CA policy "Block legacy auth" set to report-only by alex@acme.example', attributed_actor: 'alex@acme.example', detected_at: new Date(Date.now() - 4 * 3600_000).toISOString() },
		{ id: 'd-2', tenant_id: 'demo-tenant-globex', category: 'authMethods', severity: 'medium', summary: 'Authenticator method policy weakened: Push notifications enabled for all users', attributed_actor: 'amy@globex.example', detected_at: new Date(Date.now() - 22 * 3600_000).toISOString() },
	],
	windowHours: 168,
}, null, 2);

export function isDemoKey(token: string): boolean {
	return token === DEMO_KEY;
}
