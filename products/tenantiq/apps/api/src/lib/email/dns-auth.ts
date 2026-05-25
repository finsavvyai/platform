/**
 * DNS-based mail authentication checker.
 * Used by both the per-tenant email-security route and the CIS scanner
 * (so both surface the same SPF/DMARC/DKIM verdict from the same source).
 *
 * Pure DoH (Cloudflare 1.1.1.1) — no Graph credentials needed.
 */

const DOH_BASE = 'https://cloudflare-dns.com/dns-query';

export const DKIM_SELECTORS: Array<{ name: string; type: 'CNAME' | 'TXT' }> = [
	{ name: 'selector1', type: 'CNAME' },
	{ name: 'selector2', type: 'CNAME' },
	{ name: 'google', type: 'TXT' },
	{ name: 'k1', type: 'TXT' },
	{ name: 's1', type: 'TXT' },
	{ name: 's2', type: 'TXT' },
];

export interface DkimSelectorResult {
	selector: string;
	recordType: 'CNAME' | 'TXT';
	records: string[];
	status: 'pass' | 'none';
}

export interface DnsAuthDomain {
	domain: string;
	spfRecords: string[];
	dmarcRecords: string[];
	dkimSelectors: DkimSelectorResult[];
	spf: 'pass' | 'none';
	dmarc: 'pass' | 'none';
	dkim: 'pass' | 'none';
	dmarcPolicy: string; // 'none' | 'quarantine' | 'reject'
}

async function dnsQuery(name: string, type: 'TXT' | 'CNAME'): Promise<string[]> {
	try {
		const res = await fetch(`${DOH_BASE}?name=${encodeURIComponent(name)}&type=${type}`, {
			headers: { Accept: 'application/dns-json' },
		});
		if (!res.ok) return [];
		const data = await res.json() as { Answer?: Array<{ data: string }> };
		return (data.Answer ?? []).map(a => a.data);
	} catch {
		return [];
	}
}

/** Audit a single domain's mail-auth posture. */
export async function checkDomainAuth(domain: string): Promise<DnsAuthDomain> {
	const [spfRecords, dmarcRecords, ...dkimResults] = await Promise.all([
		dnsQuery(domain, 'TXT'),
		dnsQuery(`_dmarc.${domain}`, 'TXT'),
		...DKIM_SELECTORS.map(s => dnsQuery(`${s.name}._domainkey.${domain}`, s.type)),
	]);

	const dkimSelectors: DkimSelectorResult[] = DKIM_SELECTORS.map((s, i) => ({
		selector: s.name,
		recordType: s.type,
		records: dkimResults[i],
		status: dkimResults[i].length > 0 ? 'pass' : 'none',
	}));

	const spf = spfRecords.some(r => r.includes('v=spf1')) ? 'pass' : 'none';
	const dmarc = dmarcRecords.some(r => r.includes('v=DMARC1')) ? 'pass' : 'none';
	const dkim = dkimSelectors.some(s => s.status === 'pass') ? 'pass' : 'none';
	const dmarcPolicy = dmarcRecords.find(r => r.includes('v=DMARC1'))?.match(/p=(\w+)/)?.[1] || 'none';

	return { domain, spfRecords, dmarcRecords, dkimSelectors, spf, dmarc, dkim, dmarcPolicy };
}

/** Audit all supplied domains in parallel. */
export async function checkAllDomainsAuth(domains: string[]): Promise<DnsAuthDomain[]> {
	if (domains.length === 0) return [];
	return Promise.all(domains.map(d => checkDomainAuth(d)));
}
