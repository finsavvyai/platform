/**
 * SAML XML facade — re-exports the parsing API and split helpers.
 *
 * Cloudflare Workers runtime: NO DOMParser, NO node:crypto. Web Crypto only.
 *
 * Modules behind this facade:
 *  - saml-xml-errors:  SamlError typed errors.
 *  - saml-xml-tree:    fast-xml-parser preserveOrder tree-walk + b64 helpers.
 *  - saml-xml-algs:    Signature/Digest/Transform whitelists + SignedInfo.
 *  - saml-xml-c14n:    Minimal exclusive-c14n serializer + findById.
 *  - saml-xml-verify:  Top-level verifyXmlSignature + pemToCryptoKey.
 *
 * NOTE: The exclusive-c14n implementation is hand-rolled and narrower than
 * full XML-Exc-C14N (no comment/PI preservation, no InclusiveNamespaces
 * propagation). Sufficient for Okta/Azure/Google SAML responses where the
 * IdP canonicalises before signing and prefix sets round-trip.
 */

import { XMLParser } from 'fast-xml-parser';
import { SamlError } from './saml-xml-errors';

const PARSER_OPTS = {
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    preserveOrder: true,
    processEntities: false,
    htmlEntities: false,
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: false,
} as const;

export function parseSamlXml(xml: string): unknown {
    if (/<!DOCTYPE|<!ENTITY/i.test(xml)) {
        throw new SamlError('xxe_blocked', 'DOCTYPE/ENTITY rejected');
    }
    try {
        const parser = new XMLParser(PARSER_OPTS);
        return parser.parse(xml);
    } catch {
        throw new SamlError('xml_parse_failed', 'Malformed XML');
    }
}

// Re-export everything callers expect to find under './saml-xml'.
export { SamlError } from './saml-xml-errors';
export {
    stripNs,
    findFirst,
    findAll,
    attrs,
    children,
    text,
    b64ToBytes,
    bytesToB64,
    strToBytes,
} from './saml-xml-tree';
export { resolveSigAlg, resolveDigestAlg, extractSignedInfo } from './saml-xml-algs';
export type { SignedInfo } from './saml-xml-algs';
export { verifyXmlSignature, pemToCryptoKey } from './saml-xml-verify';
