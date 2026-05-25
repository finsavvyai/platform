/**
 * Admin-consent leg of the OAuth flow.
 *
 * /api/auth/onboard-org redirects to Microsoft's adminconsent endpoint, then
 * Microsoft sends the browser to /api/auth/callback?admin_consent=True&tenant=X
 * &state=Y. The state was stashed by onboard-org as `auth:onboard:<state>` →
 * { orgId, userSub }. We use that here to link the newly-consented Azure
 * tenant to the caller's TenantIQ org by upserting a `tenants` row — without
 * this step the user sees the "Permissions granted" page but the app's
 * tenants list stays empty.
 */
import type { Context } from 'hono';
import type { AppEnv } from '../index';

function genId(): string {
	const bytes = new Uint8Array(16);
	crypto.getRandomValues(bytes);
	return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function handleAdminConsent(
	c: Context<AppEnv>,
	consentTenant: string,
	frontendUrl: string,
	state: string | undefined,
) {
	const db = c.env.DB;

	let resolvedOrgId: string | null = null;
	if (state) {
		const stash = await c.env.KV.get(`auth:onboard:${state}`, 'json') as { orgId?: string } | null;
		if (stash?.orgId) {
			resolvedOrgId = stash.orgId;
			await c.env.KV.delete(`auth:onboard:${state}`);
		}
	}

	const existing = await db
		.prepare('SELECT id, organization_id FROM tenants WHERE azure_tenant_id = ? LIMIT 1')
		.bind(consentTenant)
		.first<{ id: string; organization_id: string }>();

	if (existing) {
		await c.env.KV.put(`consent:${existing.id}`, 'true');
	} else if (resolvedOrgId) {
		const tenantId = genId();
		const now = Date.now();
		await db
			.prepare(
				'INSERT INTO tenants (id, organization_id, azure_tenant_id, display_name, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
			)
			.bind(tenantId, resolvedOrgId, consentTenant, `Tenant ${consentTenant.slice(0, 8)}`, 'active', now)
			.run()
			.catch((err: unknown) => console.error('[adminConsent] tenant insert failed', err));
		await c.env.KV.put(`consent:${tenantId}`, 'true');
	}

	const target = `${frontendUrl}?onboarded=${encodeURIComponent(consentTenant)}`;
	return c.html(renderConsentPage(target));
}

function renderConsentPage(target: string): string {
	return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<meta http-equiv="refresh" content="2;url=${target}">
<title>Permissions Granted</title>
<style>body{font-family:-apple-system,system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f5f5f7;color:#1d1d1f}.card{text-align:center;max-width:420px;padding:2rem}h2{margin:0 0 .5rem}p{margin:0 0 1.5rem;color:#6e6e73}.btn{display:inline-block;background:#0071e3;color:#fff;padding:.625rem 1.25rem;border-radius:8px;text-decoration:none;font-weight:500;font-size:.9375rem}.btn:hover{background:#0077ed}.hint{font-size:.8125rem;color:#86868b;margin-top:1rem}</style>
</head><body>
<div class="card">
<h2>Permissions granted</h2>
<p>Tenant connected. Returning to TenantIQ…</p>
<a class="btn" href="${target}">Open dashboard</a>
<p class="hint">You'll be redirected automatically in 2 seconds.</p>
</div>
<script>
// window.close() silently no-ops for non-popup tabs, so don't rely on it.
// Always redirect after a short delay; the meta-refresh above is a fallback.
setTimeout(function(){ window.location.replace(${JSON.stringify(target)}); }, 1500);
</script>
</body></html>`;
}
