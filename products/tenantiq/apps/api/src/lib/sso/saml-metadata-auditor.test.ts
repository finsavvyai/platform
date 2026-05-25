import { describe, it, expect } from 'vitest';
import { auditSamlMetadata } from './saml-metadata-auditor';

const FAKE_NOW = new Date('2026-05-03T00:00:00Z');

const STRONG_METADATA = `<?xml version="1.0"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" entityID="https://idp.example.com/saml" xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
  <md:IDPSSODescriptor WantAuthnRequestsSigned="true" protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <ds:Signature>
      <ds:SignedInfo>
        <ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>
      </ds:SignedInfo>
    </ds:Signature>
    <md:KeyDescriptor use="signing">
      <ds:KeyInfo>
        <ds:X509Data>
          <ds:X509Certificate>NOT_A_REAL_CERT</ds:X509Certificate>
        </ds:X509Data>
      </ds:KeyInfo>
    </md:KeyDescriptor>
    <md:AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="https://idp.example.com/sso" index="0"/>
  </md:IDPSSODescriptor>
</md:EntityDescriptor>`;

describe('auditSamlMetadata — surface checks', () => {
	it('extracts entityID', () => {
		const r = auditSamlMetadata(STRONG_METADATA, FAKE_NOW);
		expect(r.entityId).toBe('https://idp.example.com/saml');
	});

	it('detects ACS binding', () => {
		const r = auditSamlMetadata(STRONG_METADATA, FAKE_NOW);
		expect(r.hasAcsBinding).toBe(true);
	});

	it('flags missing ACS binding', () => {
		const xml = STRONG_METADATA.replace(/<md:AssertionConsumerService[\s\S]*?\/>/, '');
		const r = auditSamlMetadata(xml, FAKE_NOW);
		expect(r.hasAcsBinding).toBe(false);
		expect(r.findings.some(f => f.issue === 'missing_acs_binding')).toBe(true);
	});

	it('flags WantAuthnRequestsSigned=false', () => {
		const xml = STRONG_METADATA.replace('WantAuthnRequestsSigned="true"', 'WantAuthnRequestsSigned="false"');
		const r = auditSamlMetadata(xml, FAKE_NOW);
		expect(r.wantAuthnRequestsSigned).toBe(false);
		expect(r.findings.some(f => f.issue === 'authn_request_unsigned')).toBe(true);
	});

	it('flags SHA-1 signature algorithm', () => {
		const xml = STRONG_METADATA.replace(
			'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
			'http://www.w3.org/2000/09/xmldsig#rsa-sha1',
		);
		const r = auditSamlMetadata(xml, FAKE_NOW);
		expect(r.findings.some(f => f.issue === 'sha1_signature')).toBe(true);
	});

	it('does not flag SHA-256', () => {
		const r = auditSamlMetadata(STRONG_METADATA, FAKE_NOW);
		expect(r.findings.find(f => f.issue === 'sha1_signature')).toBeUndefined();
	});

	it('returns no findings for clean metadata (cert parse fails so cert findings skip)', () => {
		const r = auditSamlMetadata(STRONG_METADATA, FAKE_NOW);
		// NOT_A_REAL_CERT can't be parsed — daysUntilExpiry = null → skipped.
		const certFindings = r.findings.filter(f => f.issue.startsWith('cert_'));
		expect(certFindings).toHaveLength(0);
	});
});

// Helper to build a minimal DER-encoded fake cert with a controllable validity
// period. Uses ASN.1 minimum structure that extractValidity() can parse.
function buildFakeCertB64(notBefore: Date, notAfter: Date): string {
	const utc = (d: Date) => {
		const yy = String(d.getUTCFullYear() % 100).padStart(2, '0');
		const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
		const dd = String(d.getUTCDate()).padStart(2, '0');
		const hh = String(d.getUTCHours()).padStart(2, '0');
		const mi = String(d.getUTCMinutes()).padStart(2, '0');
		const ss = String(d.getUTCSeconds()).padStart(2, '0');
		return `${yy}${mm}${dd}${hh}${mi}${ss}Z`;
	};
	const tlv = (tag: number, value: number[]) => [tag, value.length, ...value];
	const utcStr = (s: string) => tlv(0x17, [...s].map(c => c.charCodeAt(0)));
	const seq = (children: number[]) => [0x30, children.length, ...children];

	const validity = seq([...utcStr(utc(notBefore)), ...utcStr(utc(notAfter))]);
	const intZero = tlv(0x02, [0x00]); // INTEGER 0 (serial)
	const sigAlg = seq([0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x0b, 0x05, 0x00]); // sha256WithRSA + NULL
	const issuer = seq([]);  // empty Name
	const subject = seq([]); // empty Name
	const spki = seq([sigAlg.length + 4, ...sigAlg, 0x03, 0x02, 0x00, 0x00].slice(0)); // crude SubjectPublicKeyInfo
	const tbs = seq([...intZero, ...sigAlg, ...issuer, ...validity, ...subject, ...spki]);
	const sigBytes = [0x03, 0x02, 0x00, 0x00];
	const cert = seq([...tbs, ...sigAlg, ...sigBytes]);

	const bytes = new Uint8Array(cert);
	let bin = '';
	for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
	return typeof btoa === 'function' ? btoa(bin) : Buffer.from(bytes).toString('base64');
}

function metadataWithCert(b64: string): string {
	return STRONG_METADATA.replace('NOT_A_REAL_CERT', b64);
}

describe('auditSamlMetadata — cert validity', () => {
	it('flags critical for expired cert', () => {
		const cert = buildFakeCertB64(new Date('2024-01-01'), new Date('2025-01-01'));
		const r = auditSamlMetadata(metadataWithCert(cert), FAKE_NOW);
		expect(r.findings.some(f => f.issue === 'cert_expired')).toBe(true);
	});

	it('flags 30-day expiry as high', () => {
		const expiry = new Date(FAKE_NOW.getTime() + 15 * 86400000);
		const cert = buildFakeCertB64(new Date('2024-01-01'), expiry);
		const r = auditSamlMetadata(metadataWithCert(cert), FAKE_NOW);
		const f = r.findings.find(x => x.issue === 'cert_expiring_30d');
		expect(f?.severity).toBe('high');
	});

	it('flags 90-day expiry as low', () => {
		const expiry = new Date(FAKE_NOW.getTime() + 75 * 86400000);
		const cert = buildFakeCertB64(new Date('2024-01-01'), expiry);
		const r = auditSamlMetadata(metadataWithCert(cert), FAKE_NOW);
		expect(r.findings.some(f => f.issue === 'cert_expiring_90d')).toBe(true);
	});

	it('does not flag a cert valid for >90 days', () => {
		const expiry = new Date(FAKE_NOW.getTime() + 365 * 86400000);
		const cert = buildFakeCertB64(new Date('2024-01-01'), expiry);
		const r = auditSamlMetadata(metadataWithCert(cert), FAKE_NOW);
		const certFindings = r.findings.filter(f => f.issue.startsWith('cert_'));
		expect(certFindings).toHaveLength(0);
	});
});
