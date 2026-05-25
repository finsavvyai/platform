/**
 * Prospect Scan — 40-second M365 security assessment for MSP sales
 *
 * UNAUTHENTICATED: MSPs scan prospect tenants without signing up.
 * Rate limited by IP via KV (10 scans/hour).
 */

import { Hono } from 'hono';
import type { AppEnv } from '../app/types';

export const prospectScanRoutes = new Hono<AppEnv>();

const RATE_LIMIT = 10;
const RATE_WINDOW = 3600; // 1 hour in seconds
const SCAN_TTL = 86400; // 24 hours

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getClientIp(c: { req: { header: (name: string) => string | undefined } }): string {
	return c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() || 'unknown';
}

function gradeFromScore(score: number): string {
	if (score >= 95) return 'A+';
	if (score >= 90) return 'A';
	if (score >= 80) return 'B';
	if (score >= 70) return 'C';
	if (score >= 60) return 'D';
	return 'F';
}

function larryQuote(score: number): string {
	if (score >= 80) {
		return '"Pretty, pretty, pretty good." — Larry David';
	}
	return '"You know, you\'re not supposed to be able to see how bad this is from the outside." — Larry David';
}

type DnsAnswer = { type: number; data: string; name: string; TTL: number };
type DnsResponse = { Answer?: DnsAnswer[] };

async function queryDns(domain: string, type: string): Promise<DnsAnswer[]> {
	const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=${type}`;
	const resp = await fetch(url, {
		headers: { Accept: 'application/dns-json' },
		signal: AbortSignal.timeout(5000),
	});
	if (!resp.ok) return [];
	const data = (await resp.json()) as DnsResponse;
	return data.Answer || [];
}

async function checkEndpoint(url: string): Promise<boolean> {
	try {
		const resp = await fetch(url, {
			method: 'GET',
			signal: AbortSignal.timeout(5000),
			redirect: 'follow',
		});
		return resp.ok || resp.status === 401 || resp.status === 403;
	} catch {
		return false;
	}
}

type Severity = 'critical' | 'high' | 'medium' | 'info';
type Finding = { severity: Severity; title: string; description: string; impact: string };

// ─── POST /scan ───────────────────────────────────────────────────────────────

prospectScanRoutes.post('/scan', async (c) => {
	const start = Date.now();
	const body = await c.req.json<{ domain?: string }>().catch(() => ({} as { domain?: string }));
	const domain = body.domain?.replace(/^https?:\/\//, '').replace(/\/+$/, '').toLowerCase();

	if (!domain || !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z]{2,})+$/.test(domain)) {
		return c.json({ error: 'A valid domain is required (e.g. contoso.com)' }, 400);
	}

	// Rate limiting by IP
	const ip = getClientIp(c);
	const rateKey = `prospect:rate:${ip}`;
	const current = parseInt((await c.env.KV.get(rateKey)) || '0', 10);
	if (current >= RATE_LIMIT) {
		return c.json({ error: 'Rate limit exceeded — 10 scans per hour' }, 429);
	}
	await c.env.KV.put(rateKey, String(current + 1), { expirationTtl: RATE_WINDOW });

	// Run all DNS checks in parallel
	const [mxRecords, txtRecords, dmarcRecords, autodiscoverUp, federationUp] =
		await Promise.all([
			queryDns(domain, 'MX'),
			queryDns(domain, 'TXT'),
			queryDns(`_dmarc.${domain}`, 'TXT'),
			checkEndpoint(`https://autodiscover.${domain}/autodiscover/autodiscover.xml`),
			checkEndpoint(`https://login.microsoftonline.com/${domain}/.well-known/openid-configuration`),
		]);

	// Parse email security signals
	const exchangeOnline = mxRecords.some((r) => r.data?.includes('.mail.protection.outlook.com'));
	const spfRecord = txtRecords.find((r) => r.data?.includes('v=spf1'));
	const hasSpf = !!spfRecord;
	const spfIncludesMs = spfRecord?.data?.includes('include:spf.protection.outlook.com') ?? false;
	const dkimSelector = txtRecords.find((r) => r.data?.includes('v=DKIM1'));
	const hasDkim = !!dkimSelector;
	const hasDmarc = dmarcRecords.some((r) => r.data?.includes('v=DMARC1'));
	const dmarcReject = dmarcRecords.some((r) => r.data?.includes('p=reject'));
	const dmarcQuarantine = dmarcRecords.some((r) => r.data?.includes('p=quarantine'));

	// M365 signals — check for Teams and SharePoint via DNS
	const [teamsRecords, sipRecords] = await Promise.all([
		queryDns(`_sipfederationtls._tcp.${domain}`, 'SRV'),
		queryDns(`lyncdiscover.${domain}`, 'CNAME'),
	]);
	const teamsPresence = teamsRecords.length > 0 || sipRecords.length > 0;
	const sharepointDetected = txtRecords.some((r) =>
		r.data?.includes('MS=ms') || r.data?.includes('include:sharepointonline.com')
	);

	// Build findings
	const findings: Finding[] = [];

	if (!hasSpf) {
		findings.push({ severity: 'critical', title: 'No SPF Record', description: 'Domain lacks an SPF DNS record, allowing anyone to spoof emails from this domain.', impact: 'Email spoofing, phishing attacks targeting employees and customers' });
	} else if (!spfIncludesMs && exchangeOnline) {
		findings.push({ severity: 'high', title: 'SPF Missing Microsoft Include', description: 'SPF record exists but does not include spf.protection.outlook.com.', impact: 'Legitimate M365 emails may fail SPF checks and be rejected' });
	}

	if (!hasDmarc) {
		findings.push({ severity: 'critical', title: 'No DMARC Policy', description: 'No DMARC record found. Attackers can spoof this domain with no reporting or enforcement.', impact: 'Brand impersonation, phishing campaigns go undetected' });
	} else if (!dmarcReject && !dmarcQuarantine) {
		findings.push({ severity: 'high', title: 'DMARC Policy Not Enforcing', description: 'DMARC exists but is set to p=none — no spoofed emails are blocked.', impact: 'Spoofed emails still delivered to recipients despite DMARC presence' });
	}

	if (!hasDkim) {
		findings.push({ severity: 'medium', title: 'No DKIM Detected', description: 'No DKIM selector found in public DNS. Email integrity cannot be verified.', impact: 'Recipients cannot verify emails genuinely originated from this domain' });
	}

	if (exchangeOnline && !autodiscoverUp) {
		findings.push({ severity: 'medium', title: 'Autodiscover Not Responding', description: 'Exchange Online detected but autodiscover endpoint is unreachable.', impact: 'Email client auto-configuration may fail for new users' });
	}

	if (!federationUp) {
		findings.push({ severity: 'info', title: 'No Entra ID Federation', description: 'Domain is not federated with Microsoft Entra ID (Azure AD).', impact: 'Users may not have SSO — potential for password sprawl' });
	} else {
		findings.push({ severity: 'info', title: 'Entra ID Federation Detected', description: 'Domain is federated with Microsoft Entra ID — SSO is likely configured.', impact: 'Positive signal: centralized identity management in place' });
	}

	if (exchangeOnline) {
		findings.push({ severity: 'info', title: 'Exchange Online Detected', description: 'MX records point to Microsoft 365 Exchange Online.', impact: 'Confirms active M365 email usage — full security assessment recommended' });
	}

	// Score calculation
	const emailScore = [hasSpf ? 30 : 0, hasDkim ? 20 : 0, hasDmarc ? 30 : 0, dmarcReject ? 20 : dmarcQuarantine ? 10 : 0].reduce((a, b) => a + b, 0);
	const identityScore = [federationUp ? 60 : 0, autodiscoverUp ? 40 : 0].reduce((a, b) => a + b, 0);
	const overallScore = Math.round(emailScore * 0.6 + identityScore * 0.3 + (exchangeOnline ? 10 : 0));
	const grade = gradeFromScore(overallScore);

	const recommendations: string[] = [];
	if (!hasSpf) recommendations.push('Publish an SPF record to prevent email spoofing');
	if (!hasDmarc) recommendations.push('Add a DMARC policy (start with p=none, escalate to p=reject)');
	if (!hasDkim) recommendations.push('Configure DKIM signing for all outbound email');
	if (hasDmarc && !dmarcReject) recommendations.push('Strengthen DMARC policy to p=quarantine or p=reject');
	if (!federationUp) recommendations.push('Consider federating domain with Entra ID for SSO');
	if (exchangeOnline) recommendations.push('Run a full CIS benchmark scan for comprehensive M365 hardening');

	const scanId = crypto.randomUUID();
	const scan = {
		id: scanId,
		domain,
		score: overallScore,
		grade,
		quote: larryQuote(overallScore),
		emailSecurity: { spf: hasSpf, dkim: hasDkim, dmarc: hasDmarc, score: emailScore },
		identitySecurity: { federationDetected: federationUp, autodiscoverFound: autodiscoverUp, score: identityScore },
		m365Signals: { exchangeOnline, teamsPresence, sharepointDetected },
		findings,
		recommendations,
		scanDuration: Date.now() - start,
		scannedAt: new Date().toISOString(),
	};

	// Cache in KV for 24 hours
	await c.env.KV.put(`prospect:scan:${scanId}`, JSON.stringify(scan), { expirationTtl: SCAN_TTL });

	return c.json({ scan });
});

// ─── GET /report/:scanId ─────────────────────────────────────────────────────

prospectScanRoutes.get('/report/:scanId', async (c) => {
	const scanId = c.req.param('scanId');
	const cached = await c.env.KV.get(`prospect:scan:${scanId}`);
	if (!cached) {
		return c.json({ error: 'Scan not found or expired (results cached for 24 hours)' }, 404);
	}
	return c.json({ scan: JSON.parse(cached) });
});
