/**
 * SharePoint Site Lifecycle Management
 *
 * Provides site inventory, expiry detection, archival, and renewal notifications.
 */

type GraphFetch = (path: string, init?: RequestInit) => Promise<any>;

export interface SiteInfo {
	id: string;
	displayName: string;
	webUrl: string;
	lastActivityDate: string | null;
	owner: string | null;
	ownerEmail: string | null;
	storageUsedBytes: number;
	storageAllocatedBytes: number;
	status: 'active' | 'expiring' | 'archived';
	createdDateTime: string;
}

interface GraphSite {
	id: string;
	displayName: string;
	webUrl: string;
	createdDateTime: string;
	lastModifiedDateTime?: string;
	siteCollection?: { root?: Record<string, unknown> };
}

interface GraphUsage {
	siteId?: string;
	storageUsedInBytes?: number;
	storageAllocatedInBytes?: number;
	lastActivityDate?: string;
	ownerDisplayName?: string;
	ownerPrincipalName?: string;
}

/** Fetch all SharePoint sites with last activity metadata. */
export async function getSiteInventory(graphFetch: GraphFetch): Promise<SiteInfo[]> {
	const [sitesRes, usageRes] = await Promise.all([
		graphFetch('/sites?search=*&$top=200&$select=id,displayName,webUrl,createdDateTime,lastModifiedDateTime'),
		graphFetch("/reports/getSharePointSiteUsageDetail(period='D30')").catch(() => null),
	]);

	const sites: GraphSite[] = sitesRes?.value ?? [];
	const usageMap = new Map<string, GraphUsage>();

	if (Array.isArray(usageRes)) {
		for (const u of usageRes as GraphUsage[]) {
			if (u.siteId) usageMap.set(u.siteId, u);
		}
	}

	return sites.map((s) => {
		const usage = usageMap.get(s.id);
		return {
			id: s.id,
			displayName: s.displayName,
			webUrl: s.webUrl,
			lastActivityDate: usage?.lastActivityDate ?? s.lastModifiedDateTime ?? null,
			owner: usage?.ownerDisplayName ?? null,
			ownerEmail: usage?.ownerPrincipalName ?? null,
			storageUsedBytes: usage?.storageUsedInBytes ?? 0,
			storageAllocatedBytes: usage?.storageAllocatedInBytes ?? 0,
			status: 'active',
			createdDateTime: s.createdDateTime,
		};
	});
}

/** Filter sites that have been inactive longer than thresholdDays. */
export function getExpiringSites(sites: SiteInfo[], thresholdDays: number): SiteInfo[] {
	const cutoff = Date.now() - thresholdDays * 86_400_000;
	return sites
		.filter((s) => {
			if (!s.lastActivityDate) return true;
			return new Date(s.lastActivityDate).getTime() < cutoff;
		})
		.map((s) => ({ ...s, status: 'expiring' as const }));
}

/** Archive a SharePoint site by setting it to read-only via Graph. */
export async function archiveSite(graphFetch: GraphFetch, siteId: string): Promise<boolean> {
	const res = await graphFetch(`/sites/${siteId}`, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ isReadOnly: true }),
	});
	return res !== null;
}

/** Send a renewal notification to the site owner. */
export async function sendRenewalNotification(
	env: { KV: KVNamespace; RESEND_API_KEY?: string; FRONTEND_URL?: string },
	site: SiteInfo,
	owner: { email: string; name: string },
): Promise<boolean> {
	const baseUrl = env.FRONTEND_URL ?? 'https://app.tenantiq.com';
	const renewUrl = `${baseUrl}/governance/sites?renew=${site.id}`;

	// Store notification record in KV for tracking
	const notifId = crypto.randomUUID();
	await env.KV.put(
		`site-renewal:${notifId}`,
		JSON.stringify({ siteId: site.id, owner: owner.email, sentAt: new Date().toISOString(), renewUrl }),
		{ expirationTtl: 30 * 86_400 },
	);

	if (!env.RESEND_API_KEY) return true; // skip actual send in dev

	await fetch('https://api.resend.com/emails', {
		method: 'POST',
		headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
		body: JSON.stringify({
			from: 'TenantIQ <noreply@tenantiq.com>',
			to: owner.email,
			subject: `Action Required: SharePoint site "${site.displayName}" is expiring`,
			html: `<p>Hi ${owner.name},</p><p>The site <strong>${site.displayName}</strong> has been inactive. <a href="${renewUrl}">Renew it</a> or it will be archived.</p>`,
		}),
	});

	return true;
}
