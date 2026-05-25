/**
 * SSRF guardrails — reject URLs that resolve to private / link-local / metadata IPs
 * and forbid non-https protocols.
 */

const BLOCKED_HOSTNAMES = new Set([
	'localhost',
	'localhost.localdomain',
	'127.0.0.1',
	'0.0.0.0',
	'::1',
	'[::1]',
	'169.254.169.254', // cloud metadata
	'metadata.google.internal',
]);

function isPrivateIPv4(host: string): boolean {
	const m = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
	if (!m) return false;
	const o = m.slice(1).map(Number) as [number, number, number, number];
	if (o.some((n) => n < 0 || n > 255)) return false;
	// 10.0.0.0/8
	if (o[0] === 10) return true;
	// 172.16.0.0/12
	if (o[0] === 172 && o[1] >= 16 && o[1] <= 31) return true;
	// 192.168.0.0/16
	if (o[0] === 192 && o[1] === 168) return true;
	// 169.254.0.0/16 link-local (AWS/GCP metadata)
	if (o[0] === 169 && o[1] === 254) return true;
	// 100.64.0.0/10 CGNAT
	if (o[0] === 100 && o[1] >= 64 && o[1] <= 127) return true;
	// Loopback
	if (o[0] === 127) return true;
	// 0.0.0.0/8
	if (o[0] === 0) return true;
	return false;
}

function isPrivateIPv6(host: string): boolean {
	const h = host.toLowerCase().replace(/^\[|\]$/g, '');
	if (h === '::1') return true;
	if (h === '::') return true;
	// Unique local fc00::/7  (fc.. or fd..)
	if (/^f[cd][0-9a-f]{2}:/.test(h)) return true;
	// Link-local fe80::/10
	if (/^fe[89ab][0-9a-f]:/.test(h)) return true;
	// IPv4-mapped  ::ffff:a.b.c.d — strip and re-check as v4
	const mapped = h.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
	if (mapped) return isPrivateIPv4(mapped[1]);
	return false;
}

export interface SsrfOptions {
	requireHttps?: boolean;
	allowedHosts?: string[] | null;
}

export interface SsrfCheckResult {
	ok: boolean;
	reason?: string;
	url?: URL;
}

export function checkOutboundUrl(input: string, options: SsrfOptions = {}): SsrfCheckResult {
	let url: URL;
	try {
		url = new URL(input);
	} catch {
		return { ok: false, reason: 'Invalid URL' };
	}

	if (options.requireHttps !== false && url.protocol !== 'https:') {
		return { ok: false, reason: 'HTTPS required' };
	}

	const hostname = url.hostname.toLowerCase();

	if (BLOCKED_HOSTNAMES.has(hostname)) {
		return { ok: false, reason: 'Blocked hostname' };
	}

	if (isPrivateIPv4(hostname) || isPrivateIPv6(hostname)) {
		return { ok: false, reason: 'Private or link-local IP not allowed' };
	}

	if (options.allowedHosts && options.allowedHosts.length > 0) {
		const match = options.allowedHosts.some((h) => {
			if (h.startsWith('.')) return hostname.endsWith(h) && hostname !== h.slice(1);
			return hostname === h;
		});
		if (!match) {
			return { ok: false, reason: 'Host not in allowlist' };
		}
	}

	return { ok: true, url };
}
