/**
 * Prospect scan — runs entirely against public sources.
 * No tenant credentials needed. Inputs: a domain. Outputs: gap report.
 *
 * Sources:
 *  1. DoH (Cloudflare 1.1.1.1) — SPF/DMARC/DKIM via existing dns-auth helper
 *  2. https://login.microsoftonline.com/{domain}/v2.0/.well-known/openid-configuration
 *     → confirms M365 tenant exists, returns tenant ID
 *  3. https://login.microsoftonline.com/getuserrealm.srf?login=*@{domain}&xml=1
 *     → federation/identity-provider type, brand info
 *  4. DoH MX records → mail-provider classification (Microsoft, Google, other)
 */

import { checkDomainAuth, type DnsAuthDomain } from '../email/dns-auth';

export type MailProvider = 'microsoft365' | 'google' | 'other' | 'none';

export interface TenantSignal {
	tenantId: string | null;
	federationType: 'Managed' | 'Federated' | 'Unknown';
	federationBrandName?: string;
	tenantExists: boolean;
}

export interface MailProviderSignal {
	provider: MailProvider;
	mxRecords: string[];
}

export interface ProspectFinding {
	id: string;
	severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
	title: string;
	detail: string;
	remediation: string;
}

export interface ProspectScanResult {
	domain: string;
	scannedAt: string;
	mailProvider: MailProviderSignal;
	tenant: TenantSignal;
	dnsAuth: DnsAuthDomain;
	findings: ProspectFinding[];
	score: number; // 0-100, higher = healthier
	estimatedRiskUsd: { low: number; high: number };
}

const DOH_BASE = 'https://cloudflare-dns.com/dns-query';

async function dnsQuery(name: string, type: 'TXT' | 'MX'): Promise<string[]> {
	try {
		const res = await fetch(`${DOH_BASE}?name=${encodeURIComponent(name)}&type=${type}`, {
			headers: { Accept: 'application/dns-json' },
		});
		if (!res.ok) return [];
		const data = await res.json() as { Answer?: Array<{ data: string }> };
		return (data.Answer ?? []).map(a => a.data);
	} catch { return []; }
}

async function fetchTenantSignal(domain: string): Promise<TenantSignal> {
	let tenantId: string | null = null;
	try {
		const res = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(domain)}/v2.0/.well-known/openid-configuration`);
		if (res.ok) {
			const cfg = await res.json() as { issuer?: string };
			const m = cfg.issuer?.match(/login\.microsoftonline\.com\/([0-9a-f-]{36})\//i);
			if (m) tenantId = m[1];
		}
	} catch { /* tenant likely doesn't exist on M365 */ }

	let federationType: TenantSignal['federationType'] = 'Unknown';
	let federationBrandName: string | undefined;
	try {
		const res = await fetch(`https://login.microsoftonline.com/getuserrealm.srf?login=${encodeURIComponent(`probe@${domain}`)}&xml=1`);
		if (res.ok) {
			const xml = await res.text();
			if (/<NameSpaceType>Managed<\/NameSpaceType>/i.test(xml)) federationType = 'Managed';
			else if (/<NameSpaceType>Federated<\/NameSpaceType>/i.test(xml)) federationType = 'Federated';
			const brand = xml.match(/<FederationBrandName>([^<]+)<\/FederationBrandName>/i);
			if (brand) federationBrandName = brand[1];
		}
	} catch { /* ignore */ }

	return {
		tenantId,
		federationType,
		federationBrandName,
		tenantExists: tenantId !== null || federationType !== 'Unknown',
	};
}

async function fetchMailProviderSignal(domain: string): Promise<MailProviderSignal> {
	const mxRecords = await dnsQuery(domain, 'MX');
	const lower = mxRecords.map(r => r.toLowerCase());
	let provider: MailProvider = 'none';
	if (lower.length > 0) {
		if (lower.some(r => r.includes('outlook.com') || r.includes('protection.outlook.com'))) provider = 'microsoft365';
		else if (lower.some(r => r.includes('google.com') || r.includes('aspmx.l.google.com'))) provider = 'google';
		else provider = 'other';
	}
	return { provider, mxRecords };
}

function deriveFindings(
	domain: string,
	dns: DnsAuthDomain,
	tenant: TenantSignal,
	mail: MailProviderSignal,
): ProspectFinding[] {
	const f: ProspectFinding[] = [];

	if (mail.provider === 'none') {
		f.push({
			id: 'mx_missing', severity: 'high',
			title: 'No MX records found',
			detail: `Domain ${domain} has no MX records — either no email is configured, or DNS resolution failed.`,
			remediation: 'Verify domain has mail routing configured.',
		});
	}

	if (dns.spf === 'none') {
		f.push({
			id: 'spf_missing', severity: 'high',
			title: 'SPF record not published',
			detail: 'No v=spf1 record found. Spoofing protection requires SPF.',
			remediation: 'Add a TXT record: v=spf1 include:spf.protection.outlook.com -all (or your provider equivalent).',
		});
	}

	if (dns.dmarc === 'none') {
		f.push({
			id: 'dmarc_missing', severity: 'high',
			title: 'DMARC record not published',
			detail: 'No v=DMARC1 record found. Without DMARC, spoofed mail goes through.',
			remediation: 'Add TXT record at _dmarc.<domain>: v=DMARC1; p=quarantine; rua=mailto:dmarc@<domain>.',
		});
	} else if (dns.dmarcPolicy === 'none') {
		f.push({
			id: 'dmarc_p_none', severity: 'medium',
			title: 'DMARC policy is p=none',
			detail: 'DMARC is published but in monitor-only mode (p=none) — receivers won\'t reject spoofed mail.',
			remediation: 'Move from p=none to p=quarantine after monitoring DMARC reports for 30 days, then to p=reject.',
		});
	}

	if (dns.dkim === 'none') {
		f.push({
			id: 'dkim_missing', severity: 'medium',
			title: 'No DKIM signing detected',
			detail: 'Probed common selectors (selector1, selector2, google, k1, s1, s2) — none returned a key.',
			remediation: 'Enable DKIM signing for each sending domain in Exchange Online or your mail provider.',
		});
	}

	if (mail.provider === 'microsoft365' && !tenant.tenantExists) {
		f.push({
			id: 'm365_mx_no_tenant', severity: 'medium',
			title: 'Microsoft 365 mail routing without discoverable tenant',
			detail: 'MX points at Microsoft, but the OIDC discovery endpoint did not return a tenant — unusual configuration.',
			remediation: 'Verify M365 tenant configuration and domain verification status.',
		});
	}

	if (tenant.federationType === 'Federated') {
		f.push({
			id: 'federated_tenant', severity: 'info',
			title: 'Federated identity provider in use',
			detail: `Authentication is federated${tenant.federationBrandName ? ` to ${tenant.federationBrandName}` : ''}.`,
			remediation: 'Federated tenants must verify SAML cert expiry, SHA-1 deprecation, and signed AuthnRequests separately.',
		});
	}

	return f;
}

function deriveScore(findings: ProspectFinding[]): number {
	const weights: Record<ProspectFinding['severity'], number> = {
		critical: 25, high: 12, medium: 6, low: 2, info: 0,
	};
	const deductions = findings.reduce((s, f) => s + weights[f.severity], 0);
	return Math.max(0, 100 - deductions);
}

/** Annual breach risk in USD per category — rough industry estimates. */
function deriveRiskUsd(findings: ProspectFinding[]): { low: number; high: number } {
	let low = 0, high = 0;
	if (findings.some(f => f.id === 'spf_missing' || f.id === 'dmarc_missing')) {
		low += 5_000; high += 50_000; // BEC fraud baseline
	}
	if (findings.some(f => f.id === 'dkim_missing')) {
		low += 2_000; high += 15_000;
	}
	if (findings.some(f => f.id === 'dmarc_p_none')) {
		low += 1_000; high += 10_000;
	}
	return { low, high };
}

const DOMAIN_RE = /^(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.[A-Za-z0-9-]{1,63}(?<!-))*\.[A-Za-z]{2,}$/;

export function isValidDomain(input: string): boolean {
	const trimmed = input.trim().toLowerCase();
	if (!trimmed || trimmed.length > 253) return false;
	return DOMAIN_RE.test(trimmed);
}

export async function runProspectScan(domain: string): Promise<ProspectScanResult> {
	const normalized = domain.trim().toLowerCase();
	if (!isValidDomain(normalized)) {
		throw new Error('Invalid domain format');
	}

	const [dnsAuth, tenant, mail] = await Promise.all([
		checkDomainAuth(normalized),
		fetchTenantSignal(normalized),
		fetchMailProviderSignal(normalized),
	]);

	const findings = deriveFindings(normalized, dnsAuth, tenant, mail);

	return {
		domain: normalized,
		scannedAt: new Date().toISOString(),
		mailProvider: mail,
		tenant,
		dnsAuth,
		findings,
		score: deriveScore(findings),
		estimatedRiskUsd: deriveRiskUsd(findings),
	};
}
