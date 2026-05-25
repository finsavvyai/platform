/**
 * SAML Federation Metadata Auditor (T3.4).
 *
 * Parses an IdP's SAML metadata XML and flags common security issues:
 *  - Cert expiry within 30/60/90 days
 *  - SHA-1 signature algorithm (deprecated)
 *  - WantAuthnRequestsSigned=false (relaying party can replay)
 *  - Missing AssertionConsumerService binding
 *  - Embedded cert that's already expired
 *  - Multiple certs where the older one expires soon (rollover risk)
 *
 * Pure parser — no network calls. Caller fetches metadata XML and passes
 * it in. Works with Okta, Entra ID, ADFS, Ping, OneLogin metadata formats.
 *
 * NOTE: this is a string-level XML parser tuned for SAML metadata's
 * predictable shape (no DTDs, no entities, no XSLT). For arbitrary XML,
 * a real parser would be required. We avoid that dependency here.
 */

export type SamlIssue =
	| 'cert_expired'
	| 'cert_expiring_30d'
	| 'cert_expiring_60d'
	| 'cert_expiring_90d'
	| 'sha1_signature'
	| 'authn_request_unsigned'
	| 'missing_acs_binding'
	| 'multiple_certs_one_expiring';

export interface SamlFinding {
	issue: SamlIssue;
	severity: 'critical' | 'high' | 'medium' | 'low';
	detail: string;
	remediation: string;
	expiresAt?: string;
}

export interface SamlAuditResult {
	entityId: string | null;
	certificates: ParsedCertificate[];
	signatureAlgorithms: string[];
	wantAuthnRequestsSigned: boolean | null;
	hasAcsBinding: boolean;
	findings: SamlFinding[];
	auditedAt: string;
}

export interface ParsedCertificate {
	notAfter: string | null; // ISO date
	notBefore: string | null;
	daysUntilExpiry: number | null;
	subject: string | null;
}

const CERT_RE = /<(?:ds:|md:)?X509Certificate[^>]*>([^<]+)</gi;
const ENTITY_ID_RE = /<(?:md:)?EntityDescriptor[^>]*\bentityID\s*=\s*"([^"]+)"/i;
const SIG_ALG_RE = /SignatureMethod[^>]*\bAlgorithm\s*=\s*"([^"]+)"/gi;
const WANT_SIGNED_RE = /WantAuthnRequestsSigned\s*=\s*"(true|false)"/i;
const ACS_RE = /<(?:md:)?AssertionConsumerService\b/i;

function parseCertExpiry(certBase64: string): { notBefore: string | null; notAfter: string | null; subject: string | null } {
	// Decode base64 → DER, walk to find UTCTime / GeneralizedTime fields.
	// SAML metadata wraps the cert in <X509Certificate>BASE64</X509Certificate>.
	// We do a lightweight DER walk to extract notBefore/notAfter without pulling
	// in a full X.509 parser.
	try {
		const cleaned = certBase64.replace(/\s+/g, '');
		const der = base64ToBytes(cleaned);
		return extractValidity(der);
	} catch {
		return { notBefore: null, notAfter: null, subject: null };
	}
}

function base64ToBytes(b64: string): Uint8Array {
	const bin = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
	const bytes = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
	return bytes;
}

interface DerView {
	bytes: Uint8Array;
	pos: number;
}

function readLength(v: DerView): number {
	const first = v.bytes[v.pos++];
	if (first < 0x80) return first;
	const numBytes = first & 0x7f;
	let len = 0;
	for (let i = 0; i < numBytes; i++) len = (len << 8) | v.bytes[v.pos++];
	return len;
}

function readTLV(v: DerView): { tag: number; length: number; valueStart: number } {
	const tag = v.bytes[v.pos++];
	const length = readLength(v);
	const valueStart = v.pos;
	v.pos += length;
	return { tag, length, valueStart };
}

function decodeAsciiTime(bytes: Uint8Array, start: number, length: number, isUtcTime: boolean): string | null {
	const s = String.fromCharCode(...bytes.slice(start, start + length));
	// UTCTime: YYMMDDHHMMSSZ. GeneralizedTime: YYYYMMDDHHMMSSZ.
	if (isUtcTime && s.length >= 13) {
		const yy = parseInt(s.slice(0, 2), 10);
		const year = yy < 50 ? 2000 + yy : 1900 + yy;
		const mm = s.slice(2, 4), dd = s.slice(4, 6), hh = s.slice(6, 8), mi = s.slice(8, 10), ss = s.slice(10, 12);
		return `${year}-${mm}-${dd}T${hh}:${mi}:${ss}Z`;
	}
	if (!isUtcTime && s.length >= 15) {
		return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(8, 10)}:${s.slice(10, 12)}:${s.slice(12, 14)}Z`;
	}
	return null;
}

/**
 * Walk a DER-encoded X.509 cert just deep enough to grab the validity period.
 * Cert structure: SEQUENCE { tbsCertificate SEQUENCE { version, serialNumber, signature, issuer, validity SEQUENCE { notBefore, notAfter }, subject, ... } }
 */
function extractValidity(der: Uint8Array): { notBefore: string | null; notAfter: string | null; subject: string | null } {
	const v: DerView = { bytes: der, pos: 0 };
	const top = readTLV(v); // SEQUENCE Cert
	if (top.tag !== 0x30) return { notBefore: null, notAfter: null, subject: null };
	v.pos = top.valueStart;

	const tbs = readTLV(v); // SEQUENCE tbsCertificate
	if (tbs.tag !== 0x30) return { notBefore: null, notAfter: null, subject: null };
	v.pos = tbs.valueStart;

	// Version (optional, [0] EXPLICIT)
	if (v.bytes[v.pos] === 0xA0) {
		readTLV(v);
	}
	readTLV(v); // serialNumber INTEGER
	readTLV(v); // signature AlgorithmIdentifier
	readTLV(v); // issuer Name

	const validity = readTLV(v); // SEQUENCE validity
	if (validity.tag !== 0x30) return { notBefore: null, notAfter: null, subject: null };
	const vEnd = validity.valueStart + validity.length;

	v.pos = validity.valueStart;
	const notBeforeTLV = readTLV(v);
	const notBefore = decodeAsciiTime(der, notBeforeTLV.valueStart, notBeforeTLV.length, notBeforeTLV.tag === 0x17);

	const notAfterTLV = readTLV(v);
	const notAfter = decodeAsciiTime(der, notAfterTLV.valueStart, notAfterTLV.length, notAfterTLV.tag === 0x17);

	v.pos = vEnd;
	const subject = readTLV(v);
	const subjectStr = subject.tag === 0x30 ? readSubjectCN(der, subject.valueStart, subject.length) : null;

	return { notBefore, notAfter, subject: subjectStr };
}

function readSubjectCN(der: Uint8Array, start: number, length: number): string | null {
	const cnOid = [0x55, 0x04, 0x03];
	for (let i = start; i + cnOid.length < start + length; i++) {
		if (der[i] === 0x06 && der[i + 1] === 0x03 &&
			der[i + 2] === cnOid[0] && der[i + 3] === cnOid[1] && der[i + 4] === cnOid[2]) {
			const valTag = der[i + 5];
			if (valTag === 0x0C || valTag === 0x13) {
				const len = der[i + 6];
				return String.fromCharCode(...der.slice(i + 7, i + 7 + len));
			}
		}
	}
	return null;
}

function daysUntil(iso: string | null): number | null {
	if (!iso) return null;
	const t = Date.parse(iso);
	if (Number.isNaN(t)) return null;
	return Math.floor((t - Date.now()) / 86400000);
}

export function auditSamlMetadata(xml: string, now: Date = new Date()): SamlAuditResult {
	const entityId = ENTITY_ID_RE.exec(xml)?.[1] ?? null;
	const certificates: ParsedCertificate[] = [];
	let m: RegExpExecArray | null;
	const certRe = new RegExp(CERT_RE.source, CERT_RE.flags);
	while ((m = certRe.exec(xml)) !== null) {
		const { notBefore, notAfter, subject } = parseCertExpiry(m[1]);
		certificates.push({
			notBefore,
			notAfter,
			daysUntilExpiry: daysUntil(notAfter),
			subject,
		});
	}

	const sigAlgs: string[] = [];
	const sigRe = new RegExp(SIG_ALG_RE.source, SIG_ALG_RE.flags);
	while ((m = sigRe.exec(xml)) !== null) sigAlgs.push(m[1]);

	const wantSignedMatch = WANT_SIGNED_RE.exec(xml);
	const wantAuthnRequestsSigned = wantSignedMatch ? wantSignedMatch[1] === 'true' : null;
	const hasAcsBinding = ACS_RE.test(xml);

	const findings: SamlFinding[] = [];

	for (const c of certificates) {
		if (c.daysUntilExpiry === null) continue;
		if (c.daysUntilExpiry < 0) {
			findings.push({
				issue: 'cert_expired', severity: 'critical',
				detail: `Signing cert expired ${Math.abs(c.daysUntilExpiry)} days ago${c.subject ? ` (${c.subject})` : ''}.`,
				remediation: 'Rotate the IdP signing certificate and re-publish metadata immediately.',
				expiresAt: c.notAfter ?? undefined,
			});
		} else if (c.daysUntilExpiry <= 30) {
			findings.push({
				issue: 'cert_expiring_30d', severity: 'high',
				detail: `Signing cert expires in ${c.daysUntilExpiry} day(s).`,
				remediation: 'Coordinate cert rollover with the IdP within the next 30 days.',
				expiresAt: c.notAfter ?? undefined,
			});
		} else if (c.daysUntilExpiry <= 60) {
			findings.push({
				issue: 'cert_expiring_60d', severity: 'medium',
				detail: `Signing cert expires in ${c.daysUntilExpiry} day(s).`,
				remediation: 'Plan IdP cert rotation in the next maintenance window.',
				expiresAt: c.notAfter ?? undefined,
			});
		} else if (c.daysUntilExpiry <= 90) {
			findings.push({
				issue: 'cert_expiring_90d', severity: 'low',
				detail: `Signing cert expires in ${c.daysUntilExpiry} day(s).`,
				remediation: 'Add cert rotation to the upcoming-quarter calendar.',
				expiresAt: c.notAfter ?? undefined,
			});
		}
	}

	if (sigAlgs.some(a => /sha1|rsa-sha1/i.test(a))) {
		findings.push({
			issue: 'sha1_signature', severity: 'high',
			detail: 'IdP metadata advertises SHA-1 signature algorithm. SHA-1 is deprecated for SAML signatures.',
			remediation: 'Reconfigure the IdP to use rsa-sha256 (or stronger).',
		});
	}

	if (wantAuthnRequestsSigned === false) {
		findings.push({
			issue: 'authn_request_unsigned', severity: 'medium',
			detail: 'WantAuthnRequestsSigned=false — IdP accepts unsigned AuthnRequests, opening replay surface.',
			remediation: 'Set WantAuthnRequestsSigned=true at the IdP and configure the SP to sign requests.',
		});
	}

	if (!hasAcsBinding) {
		findings.push({
			issue: 'missing_acs_binding', severity: 'medium',
			detail: 'No <AssertionConsumerService> binding present in metadata — relying party may not have a defined response endpoint.',
			remediation: 'Verify the IdP exposes AssertionConsumerService bindings (HTTP-POST is standard).',
		});
	}

	if (certificates.length > 1) {
		const expiring = certificates.find(c => c.daysUntilExpiry !== null && c.daysUntilExpiry > 0 && c.daysUntilExpiry <= 60);
		if (expiring) {
			findings.push({
				issue: 'multiple_certs_one_expiring', severity: 'low',
				detail: 'Metadata contains multiple signing certs and at least one is expiring soon — rollover may be in progress.',
				remediation: 'Confirm rollover completes before the older cert expires.',
				expiresAt: expiring.notAfter ?? undefined,
			});
		}
	}

	return {
		entityId,
		certificates,
		signatureAlgorithms: [...new Set(sigAlgs)],
		wantAuthnRequestsSigned,
		hasAcsBinding,
		findings,
		auditedAt: now.toISOString(),
	};
}
