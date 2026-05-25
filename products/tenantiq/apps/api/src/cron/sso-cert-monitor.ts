/**
 * SSO Certificate Expiry Monitor — SSO-05
 * Daily cron: scans active SSO connections and creates D1 alerts at 60/30/7-day thresholds.
 */
import type { Env } from '../index';

const THRESHOLDS_DAYS = [60, 30, 7] as const;
const DAY_MS = 86_400_000;

interface SsoConnection {
	id: string;
	org_id: string;
	provider: 'saml' | 'oidc';
	status: string;
	certificate: string | null;
	cert_expires_at: string | null;
	metadata_url: string | null;
	display_name?: string;
}

/**
 * Fetch the metadata XML from a SAML IdP URL and extract the first X.509 cert.
 * Returns a PEM string or null on failure.
 */
async function fetchCertFromMetadata(metadataUrl: string): Promise<string | null> {
	try {
		const res = await fetch(metadataUrl);
		const xml = await res.text();
		// Match both namespaced and plain X509Certificate elements
		const match = xml.match(/<(?:[^:>]+:)?X509Certificate[^>]*>\s*([^<]+)\s*<\/(?:[^:>]+:)?X509Certificate>/);
		if (match) {
			return `-----BEGIN CERTIFICATE-----\n${match[1].trim()}\n-----END CERTIFICATE-----`;
		}
	} catch {
		// fall through to null
	}
	return null;
}

/**
 * Parse PEM-encoded X.509 cert and extract the notAfter date via ASN.1 DER walk.
 * Returns a Date or null if parsing fails.
 */
function parseCertExpiry(pem: string): Date | null {
	try {
		// Strip PEM header/footer and decode base64 to bytes
		const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
		const der = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
		const view = new DataView(der.buffer);

		// ASN.1 DER walk: find UTCTime/GeneralizedTime tags for notAfter
		// Structure: SEQUENCE { SEQUENCE { ... Validity { notBefore, notAfter } } }
		// We walk past the outer SEQUENCE tags to find the Validity sequence
		let offset = 0;

		function readLength(pos: number): { len: number; nextPos: number } {
			const first = view.getUint8(pos);
			if (first < 0x80) return { len: first, nextPos: pos + 1 };
			const numBytes = first & 0x7f;
			let len = 0;
			for (let i = 0; i < numBytes; i++) {
				len = (len << 8) | view.getUint8(pos + 1 + i);
			}
			return { len, nextPos: pos + 1 + numBytes };
		}

		function skipTag(pos: number): number {
			const { nextPos } = readLength(pos + 1);
			const { len } = readLength(pos + 1);
			return nextPos + len;
		}

		// Skip outer SEQUENCE tag
		if (view.getUint8(offset) !== 0x30) return null;
		const outer = readLength(offset + 1);
		offset = outer.nextPos;

		// Skip tbsCertificate SEQUENCE tag
		if (view.getUint8(offset) !== 0x30) return null;
		const tbs = readLength(offset + 1);
		offset = tbs.nextPos;

		// tbsCertificate fields: [0] version (optional), serialNumber, signature, issuer, validity
		// Skip optional [0] EXPLICIT version
		if (view.getUint8(offset) === 0xa0) offset = skipTag(offset);
		// Skip serialNumber (INTEGER)
		if (view.getUint8(offset) === 0x02) offset = skipTag(offset);
		// Skip signature AlgorithmIdentifier (SEQUENCE)
		if (view.getUint8(offset) === 0x30) offset = skipTag(offset);
		// Skip issuer (SEQUENCE)
		if (view.getUint8(offset) === 0x30) offset = skipTag(offset);

		// Now at Validity SEQUENCE
		if (view.getUint8(offset) !== 0x30) return null;
		const validityLen = readLength(offset + 1);
		offset = validityLen.nextPos;

		// Skip notBefore (UTCTime=0x17 or GeneralizedTime=0x18)
		const notBeforeTag = view.getUint8(offset);
		if (notBeforeTag !== 0x17 && notBeforeTag !== 0x18) return null;
		offset = skipTag(offset);

		// Read notAfter
		const notAfterTag = view.getUint8(offset);
		if (notAfterTag !== 0x17 && notAfterTag !== 0x18) return null;
		const notAfterLen = readLength(offset + 1);
		const notAfterBytes = der.slice(notAfterLen.nextPos, notAfterLen.nextPos + notAfterLen.len);
		const notAfterStr = String.fromCharCode(...notAfterBytes);

		// UTCTime: YYMMDDHHMMSSZ  GeneralizedTime: YYYYMMDDHHMMSSZ
		if (notAfterTag === 0x17) {
			// UTCTime: 2-digit year, 00-49 = 2000s, 50-99 = 1900s
			const yy = parseInt(notAfterStr.slice(0, 2), 10);
			const yyyy = yy < 50 ? 2000 + yy : 1900 + yy;
			const mm = notAfterStr.slice(2, 4);
			const dd = notAfterStr.slice(4, 6);
			const hh = notAfterStr.slice(6, 8);
			const mn = notAfterStr.slice(8, 10);
			const ss = notAfterStr.slice(10, 12);
			return new Date(`${yyyy}-${mm}-${dd}T${hh}:${mn}:${ss}Z`);
		} else {
			// GeneralizedTime: 4-digit year
			const yyyy = notAfterStr.slice(0, 4);
			const mm = notAfterStr.slice(4, 6);
			const dd = notAfterStr.slice(6, 8);
			const hh = notAfterStr.slice(8, 10);
			const mn = notAfterStr.slice(10, 12);
			const ss = notAfterStr.slice(12, 14);
			return new Date(`${yyyy}-${mm}-${dd}T${hh}:${mn}:${ss}Z`);
		}
	} catch {
		return null;
	}
}

/**
 * Determine how many days until expiry from an ISO string or a parsed cert PEM.
 * Returns null if expiry cannot be determined.
 */
function getExpiryDate(conn: SsoConnection): Date | null {
	// Prefer the stored cert_expires_at column if present
	if (conn.cert_expires_at) {
		const d = new Date(conn.cert_expires_at);
		return isNaN(d.getTime()) ? null : d;
	}
	// Fall back to parsing the certificate PEM
	if (conn.certificate) {
		return parseCertExpiry(conn.certificate);
	}
	return null;
}

export async function runSsoCertMonitor(env: Env): Promise<void> {
	console.log('[SsoCertMonitor] Starting certificate expiry scan');

	const { results: connections } = await env.DB.prepare(
		`SELECT id, org_id, provider, status, certificate, cert_expires_at, metadata_url, display_name
		 FROM sso_connections WHERE status = 'active'`,
	).bind().all<SsoConnection>();

	const now = Date.now();

	for (const conn of connections) {
		try {
			// Skip connections with no cert data at all
			if (!conn.certificate && !conn.metadata_url) continue;

			// Re-fetch cert from metadata_url if present (prevents stale cert gap)
			let resolvedConn = conn;
			if (conn.metadata_url) {
				const freshCert = await fetchCertFromMetadata(conn.metadata_url);
				if (freshCert) {
					resolvedConn = { ...conn, certificate: freshCert, cert_expires_at: null };
				}
			}

			const expiresAt = getExpiryDate(resolvedConn);
			if (!expiresAt) continue;

			const daysLeft = Math.floor((expiresAt.getTime() - now) / DAY_MS);

			// Alert within 1-day window of each threshold (Math.floor can be 1 below due to sub-second timing)
			const matchedThreshold = THRESHOLDS_DAYS.find((t) => daysLeft <= t && daysLeft > t - 2);
			if (matchedThreshold === undefined) continue;

			const name = conn.display_name ?? conn.id;
			await env.DB.prepare(
				`INSERT INTO alerts (id, org_id, type, severity, title, description, status, created_at)
				 VALUES (?, ?, 'sso_cert_expiry', 'high', ?, ?, 'open', ?)`,
			).bind(
				crypto.randomUUID(),
				conn.org_id,
				`SSO Certificate Expiring in ${daysLeft} Days`,
				`The signing certificate for SSO connection "${name}" expires in ${daysLeft} days. Update it now to prevent lockout.`,
				Date.now(),
			).run();

			console.log(`[SsoCertMonitor] Alert created for connection ${conn.id} — ${daysLeft} days left`);
		} catch (err) {
			console.error(`[SsoCertMonitor] Failed for connection ${conn.id}:`, err);
		}
	}

	console.log('[SsoCertMonitor] Complete');
}
