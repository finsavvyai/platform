/**
 * Algorithm whitelists + SignedInfo extraction for SAML XML-DSig.
 *
 * SHA-1 / DSA / HMAC / ECDSA-with-SHA-1 are absent on purpose. Any URI not in
 * these maps fails the resolve* helpers with SamlError.
 */

import { SamlError } from './saml-xml-errors';
import { findFirst, findAll, attrs, text, children } from './saml-xml-tree';

const SIG_ALGS: Record<string, { name: 'RSASSA-PKCS1-v1_5'; hash: string }> = {
    'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256': { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    'http://www.w3.org/2001/04/xmldsig-more#rsa-sha384': { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-384' },
    'http://www.w3.org/2001/04/xmldsig-more#rsa-sha512': { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-512' },
};

const DIGEST_ALGS: Record<string, string> = {
    'http://www.w3.org/2001/04/xmlenc#sha256': 'SHA-256',
    'http://www.w3.org/2001/04/xmldsig-more#sha384': 'SHA-384',
    'http://www.w3.org/2001/04/xmlenc#sha512': 'SHA-512',
};

const ALLOWED_TRANSFORMS = new Set([
    'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
    'http://www.w3.org/2001/10/xml-exc-c14n#',
    'http://www.w3.org/2001/10/xml-exc-c14n#WithComments',
]);

export function resolveSigAlg(uri: string): { name: 'RSASSA-PKCS1-v1_5'; hash: string } {
    const a = SIG_ALGS[uri];
    if (!a) throw new SamlError('sig_alg_disallowed', `signature alg: ${uri}`);
    return a;
}

export function resolveDigestAlg(uri: string): string {
    const a = DIGEST_ALGS[uri];
    if (!a) throw new SamlError('digest_alg_disallowed', `digest alg: ${uri}`);
    return a;
}

export interface SignedInfo {
    canonicalizationMethod: string;
    signatureMethod: string;
    referenceUri: string;        // e.g. "#assertion-id"
    transforms: string[];
    digestMethod: string;
    digestValue: string;
    signedInfoNode: Record<string, any>;
    signatureValue: string;
    keyInfoCert?: string;        // PEM-stripped base64 from X509Certificate
}

export function extractSignedInfo(signatureNode: Record<string, any>): SignedInfo {
    const sigChildren = children(signatureNode);
    const si = findFirst(sigChildren, 'SignedInfo');
    if (!si) throw new SamlError('sig_no_signedinfo');
    const siChildren = children(si);

    const canon = findFirst(siChildren, 'CanonicalizationMethod');
    const sm = findFirst(siChildren, 'SignatureMethod');
    const ref = findFirst(siChildren, 'Reference');
    if (!canon || !sm || !ref) throw new SamlError('sig_signedinfo_incomplete');

    const refChildren = children(ref);
    const transformsNode = findFirst(refChildren, 'Transforms');
    const digestMethodNode = findFirst(refChildren, 'DigestMethod');
    const digestValueNode = findFirst(refChildren, 'DigestValue');
    if (!transformsNode || !digestMethodNode || !digestValueNode) {
        throw new SamlError('sig_reference_incomplete');
    }

    const transforms = findAll(children(transformsNode), 'Transform').map(
        (t) => attrs(t)['@_Algorithm'] || '',
    );
    for (const t of transforms) {
        if (!ALLOWED_TRANSFORMS.has(t)) {
            throw new SamlError('sig_transform_disallowed', `transform: ${t}`);
        }
    }

    const sigValueNode = findFirst(sigChildren, 'SignatureValue');
    if (!sigValueNode) throw new SamlError('sig_no_signaturevalue');

    const keyInfoNode = findFirst(sigChildren, 'KeyInfo');
    let keyInfoCert: string | undefined;
    if (keyInfoNode) {
        const x509Data = findFirst(children(keyInfoNode), 'X509Data');
        if (x509Data) {
            const certNode = findFirst(children(x509Data), 'X509Certificate');
            if (certNode) keyInfoCert = text(certNode).replace(/\s+/g, '');
        }
    }

    return {
        canonicalizationMethod: attrs(canon)['@_Algorithm'] || '',
        signatureMethod: attrs(sm)['@_Algorithm'] || '',
        referenceUri: attrs(ref)['@_URI'] || '',
        transforms,
        digestMethod: attrs(digestMethodNode)['@_Algorithm'] || '',
        digestValue: text(digestValueNode).replace(/\s+/g, ''),
        signedInfoNode: si,
        signatureValue: text(sigValueNode).replace(/\s+/g, ''),
        keyInfoCert,
    };
}
