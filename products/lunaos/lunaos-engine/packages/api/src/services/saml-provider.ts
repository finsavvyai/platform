/**
 * SamlProvider — SAML 2.0 SP service: AuthnRequest builder + Response verifier.
 * Cloudflare Workers runtime. Web Crypto + fast-xml-parser only.
 * Threat model: XXE pre-parse-rejected; XSW via signed-element ID binding;
 *   replay via KV ledger; audience/recipient binding; alg whitelists.
 * v1 does NOT sign AuthnRequests (no SP signing key wired).
 */

import type { IdentityProvider } from '../types/sso';
import {
    SamlError,
    parseSamlXml,
    findFirst,
    findAll,
    children,
    attrs,
    text,
} from './saml-xml';
import { verifyXmlSignature } from './saml-xml-verify';
import {
    checkConditions,
    checkSubjectConfirmation,
    checkReplay,
    extractAttributes,
    pickFirst,
    pickEmail,
} from './saml-assertion';

export interface SamlEnv {
    KV: KVNamespace;
    SP_ENTITY_ID?: string;
    SP_ACS_URL?: string;
    SAML_BINDING?: string;
}

export interface SamlAssertionResult {
    nameId: string;
    nameIdFormat: string;
    email: string;
    firstName?: string;
    lastName?: string;
    displayName?: string;
    sessionIndex?: string;
    attributes: Record<string, string | string[]>;
}

export class SamlProvider {
    /** Build an unsigned SAML AuthnRequest XML string. */
    buildAuthnRequest(
        idp: IdentityProvider,
        requestId: string,
        spEntityId: string,
        spAcsUrl: string,
    ): string {
        const issueInstant = new Date().toISOString();
        return [
            `<samlp:AuthnRequest`,
            ` xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"`,
            ` xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"`,
            ` ID="${escAttr(requestId)}"`,
            ` Version="2.0"`,
            ` IssueInstant="${issueInstant}"`,
            ` Destination="${escAttr(idp.samlSsoUrl || '')}"`,
            ` ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"`,
            ` AssertionConsumerServiceURL="${escAttr(spAcsUrl)}">`,
            `<saml:Issuer>${escText(spEntityId)}</saml:Issuer>`,
            `<samlp:NameIDPolicy AllowCreate="true"`,
            ` Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress"/>`,
            `</samlp:AuthnRequest>`,
        ].join('');
    }

    /**
     * Decode + verify + extract a SAML Response. Throws SamlError on any
     * failure; never echoes XML or IdP details to the caller.
     */
    async parseAndVerifyResponse(
        idp: IdentityProvider,
        samlResponseB64: string,
        expectedRequestId: string,
        env: SamlEnv,
    ): Promise<SamlAssertionResult> {
        const spEntityId = env.SP_ENTITY_ID || 'lunaos.ai';
        const spAcsUrl = env.SP_ACS_URL;
        if (!spAcsUrl) throw new SamlError('config_missing', 'SP_ACS_URL unset');
        if (!idp.samlCertificate) throw new SamlError('idp_missing_cert');

        const xml = safeAtob(samlResponseB64);
        // FIND-006 / FIND-007 fail-safe pre-checks (raw-XML before tree walk).
        rejectUnsupportedXml(xml);

        const parsedRaw = parseSamlXml(xml) as Record<string, any>[];
        const parsed = { tree: parsedRaw };

        const responseNode = findFirst(parsedRaw, 'Response');
        if (!responseNode) throw new SamlError('no_response_element');
        const responseAttrs = attrs(responseNode);
        const responseId = responseAttrs['@_ID'];
        if (!responseId) throw new SamlError('no_response_id');

        // FIND-008: replay check BEFORE signature verify (cheap reject path).
        const replayPre = await env.KV.get(`saml:resp:${responseId}`);
        if (replayPre) throw new SamlError('replay_detected');

        const statusNode = findFirst(children(responseNode), 'Status');
        const statusCode = statusNode
            ? attrs(findFirst(children(statusNode), 'StatusCode'))['@_Value'] || ''
            : '';
        if (!statusCode.endsWith(':status:Success')) {
            throw new SamlError('idp_failure');
        }

        const assertions = findAll(children(responseNode), 'Assertion');
        if (assertions.length === 0) throw new SamlError('no_assertion');
        if (assertions.length > 1) throw new SamlError('multiple_assertions');
        const assertion = assertions[0];
        const assertionId = attrs(assertion)['@_ID'];
        if (!assertionId) throw new SamlError('no_assertion_id');

        // XSW guard: signed element ID == asserted element ID.
        const responseSig = findFirst(children(responseNode), 'Signature');
        const assertionSig = findFirst(children(assertion), 'Signature');
        if (!responseSig && !assertionSig) throw new SamlError('unsigned_response');
        const signedElementId = assertionSig ? assertionId : responseId;

        await verifyXmlSignature(parsed, signedElementId, idp.samlCertificate);

        await checkConditions(assertion, spEntityId);

        const subject = findFirst(children(assertion), 'Subject');
        if (!subject) throw new SamlError('no_subject');
        await checkSubjectConfirmation(subject, spAcsUrl, expectedRequestId, env);

        await checkReplay(env, responseId, assertion);

        const nameIdNode = findFirst(children(subject), 'NameID');
        if (!nameIdNode) throw new SamlError('no_nameid');
        const nameIdFormat = attrs(nameIdNode)['@_Format'] || '';
        const nameId = text(nameIdNode);
        if (!nameId) throw new SamlError('empty_nameid');

        const authnStmts = findAll(children(assertion), 'AuthnStatement');
        if (authnStmts.length > 1) throw new SamlError('multiple_authnstatements');
        const sessionIndex = authnStmts[0]
            ? attrs(authnStmts[0])['@_SessionIndex'] || undefined
            : undefined;

        const attrMap = extractAttributes(assertion);
        const email = pickEmail(nameId, nameIdFormat, attrMap);
        if (!email) throw new SamlError('no_email');

        return {
            nameId,
            nameIdFormat,
            email,
            firstName: pickFirst(attrMap, [
                'firstName',
                'givenName',
                'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname',
            ]),
            lastName: pickFirst(attrMap, [
                'lastName',
                'sn',
                'surname',
                'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname',
            ]),
            displayName: pickFirst(attrMap, [
                'displayName',
                'name',
                'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name',
            ]),
            sessionIndex,
            attributes: attrMap,
        };
    }
}

// ─── helpers ────────────────────────────────────────────────────────────────

/**
 * FIND-006 / FIND-007 fail-safe: reject Responses we don't fully support.
 * Performed on raw XML *before* parser tree walk so namespace-prefix tricks
 * cannot hide the element.
 */
function rejectUnsupportedXml(xml: string): void {
    if (/<\s*[\w:-]*EncryptedAssertion\b/i.test(xml)) {
        throw new SamlError('encrypted_assertion_unsupported');
    }
    if (/<\s*[\w:-]*InclusiveNamespaces\b[^>]*PrefixList\s*=\s*"[^"]+"/i.test(xml)) {
        throw new SamlError('inclusive_namespaces_unsupported');
    }
}

function safeAtob(b64: string): string {
    try {
        return atob(b64.replace(/\s+/g, ''));
    } catch {
        throw new SamlError('base64_decode_failed');
    }
}
function escAttr(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}
function escText(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
