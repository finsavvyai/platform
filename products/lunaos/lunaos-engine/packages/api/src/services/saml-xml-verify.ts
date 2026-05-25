/**
 * SAML XML signature verification — exclusive C14N + Web Crypto verify.
 *
 * Pipeline:
 *  1. Locate element by signedElementId (XSW: caller binds asserted ID).
 *  2. Extract & validate SignedInfo (alg/digest/transform whitelists).
 *  3. Compute digest over canonicalised referenced element; compare DigestValue.
 *  4. Verify SignedInfo signature with the IdP's X.509 SPKI.
 */

import { SamlError } from './saml-xml-errors';
import {
    children,
    b64ToBytes,
    bytesToB64,
    strToBytes,
    findFirst,
} from './saml-xml-tree';
import {
    extractSignedInfo,
    resolveSigAlg,
    resolveDigestAlg,
} from './saml-xml-algs';
import {
    canonicalizeSignedInfo,
    canonicalizeReferenced,
    findById,
} from './saml-xml-c14n';

type POChild = Record<string, any>;

// ─── PEM → SPKI bytes (X.509 cert envelope walk) ─────────────────────────────

function readTLV(
    buf: Uint8Array,
    offset: number,
): { tag: number; len: number; contentStart: number; contentEnd: number; start: number; end: number } {
    const start = offset;
    const tag = buf[offset];
    let p = offset + 1;
    let len = buf[p++];
    if (len & 0x80) {
        const n = len & 0x7f;
        if (n === 0 || n > 4) throw new SamlError('cert_parse_failed', 'bad length');
        len = 0;
        for (let i = 0; i < n; i++) len = (len << 8) | buf[p++];
    }
    const contentStart = p;
    const contentEnd = p + len;
    return { tag, len, contentStart, contentEnd, start, end: contentEnd };
}

/**
 * Extract DER SubjectPublicKeyInfo from a Certificate. Hand-rolled ASN.1
 * walk; sufficient for RSA-only certs (the only kind used by SAML IdPs in
 * practice). For non-RSA we'd reach for @peculiar/asn1-x509.
 */
function extractSpkiFromCert(certDer: Uint8Array): Uint8Array {
    const r = readTLV(certDer, 0);
    if (r.tag !== 0x30) throw new SamlError('cert_parse_failed', 'cert not SEQUENCE');
    const tbs = readTLV(certDer, r.contentStart);
    if (tbs.tag !== 0x30) throw new SamlError('cert_parse_failed', 'tbs not SEQUENCE');
    let p = tbs.contentStart;
    const end = tbs.contentEnd;
    if (certDer[p] === 0xa0) {
        p = readTLV(certDer, p).end;
    }
    // Skip serial(INTEGER), sigAlg(SEQUENCE), issuer(SEQUENCE), validity(SEQUENCE), subject(SEQUENCE).
    for (let i = 0; i < 5; i++) {
        p = readTLV(certDer, p).end;
        if (p > end) throw new SamlError('cert_parse_failed', 'cert truncated');
    }
    const spki = readTLV(certDer, p);
    if (spki.tag !== 0x30) throw new SamlError('cert_parse_failed', 'SPKI not SEQUENCE');
    return certDer.slice(spki.start, spki.end);
}

export async function pemToCryptoKey(pem: string, hash: string): Promise<CryptoKey> {
    const armoured = pem
        .replace(/-----BEGIN [^-]+-----/g, '')
        .replace(/-----END [^-]+-----/g, '')
        .replace(/\s+/g, '');
    if (!armoured) throw new SamlError('cert_invalid', 'empty PEM');
    const der = b64ToBytes(armoured);
    const spki = /-----BEGIN PUBLIC KEY-----/i.test(pem) ? der : extractSpkiFromCert(der);
    try {
        return await crypto.subtle.importKey(
            'spki',
            toArrayBuffer(spki),
            { name: 'RSASSA-PKCS1-v1_5', hash },
            false,
            ['verify'],
        );
    } catch {
        throw new SamlError('cert_import_failed', 'Web Crypto rejected SPKI');
    }
}

// ─── Top-level verify ────────────────────────────────────────────────────────

/**
 * Verify the XML signature on the element with @ID === signedElementId.
 * Returns true on success; throws SamlError on any failure.
 *
 * The signed element MUST contain a child <ds:Signature> whose
 * SignedInfo/Reference @URI === "#" + signedElementId. This is the binding
 * that defeats XSW: caller passes the ID of the asserted element; we refuse
 * to validate against any other reference.
 */
export async function verifyXmlSignature(
    parsed: { tree: POChild[] },
    signedElementId: string,
    x509Pem: string,
): Promise<boolean> {
    const signedEl = findById(parsed.tree, signedElementId);
    if (!signedEl) throw new SamlError('signed_element_not_found');

    const sig = findFirst(children(signedEl), 'Signature');
    if (!sig) throw new SamlError('sig_missing');

    const info = extractSignedInfo(sig);
    const refId = info.referenceUri.replace(/^#/, '');
    if (refId !== signedElementId) {
        throw new SamlError(
            'xsw_reference_mismatch',
            `Reference URI=${info.referenceUri} != asserted ID=${signedElementId}`,
        );
    }

    const sigAlg = resolveSigAlg(info.signatureMethod);
    const digestHash = resolveDigestAlg(info.digestMethod);

    // 1. Compute digest over canonicalised referenced element.
    const refCanon = canonicalizeReferenced(signedEl);
    const refHash = await crypto.subtle.digest(digestHash, toArrayBuffer(strToBytes(refCanon)));
    const refHashB64 = bytesToB64(new Uint8Array(refHash));
    if (refHashB64 !== info.digestValue) throw new SamlError('digest_mismatch');

    // 2. Verify SignedInfo signature.
    const siCanon = canonicalizeSignedInfo(info.signedInfoNode);
    const sigBytes = b64ToBytes(info.signatureValue);
    const key = await pemToCryptoKey(x509Pem, sigAlg.hash);
    const ok = await crypto.subtle.verify(
        sigAlg.name,
        key,
        toArrayBuffer(sigBytes),
        toArrayBuffer(strToBytes(siCanon)),
    );
    if (!ok) throw new SamlError('signature_invalid');
    return true;
}

/** Copy a Uint8Array into a fresh ArrayBuffer to satisfy strict BufferSource types. */
function toArrayBuffer(u8: Uint8Array): ArrayBuffer {
    const out = new ArrayBuffer(u8.byteLength);
    new Uint8Array(out).set(u8);
    return out;
}
