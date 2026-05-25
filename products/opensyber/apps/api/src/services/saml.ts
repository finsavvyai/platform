import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import type { SamlAttributes } from '@opensyber/shared';

const SAML_NS = 'urn:oasis:names:tc:SAML:2.0:assertion';
const SAMLP_NS = 'urn:oasis:names:tc:SAML:2.0:protocol';

/** Build a SAML 2.0 AuthnRequest XML string. */
export function buildAuthnRequest(
  entityId: string,
  acsUrl: string,
  ssoUrl: string,
): string {
  const id = `_${crypto.randomUUID()}`;
  const issueInstant = new Date().toISOString();
  const builder = new XMLBuilder({ ignoreAttributes: false, suppressEmptyNode: true });
  const xml = builder.build({
    'samlp:AuthnRequest': {
      '@_xmlns:samlp': SAMLP_NS,
      '@_xmlns:saml': SAML_NS,
      '@_ID': id,
      '@_Version': '2.0',
      '@_IssueInstant': issueInstant,
      '@_Destination': ssoUrl,
      '@_AssertionConsumerServiceURL': acsUrl,
      '@_ProtocolBinding': 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
      'saml:Issuer': entityId,
    },
  });
  return xml;
}

/** Build SP metadata XML. */
export function buildSpMetadata(entityId: string, acsUrl: string): string {
  const builder = new XMLBuilder({ ignoreAttributes: false, suppressEmptyNode: true });
  return builder.build({
    'md:EntityDescriptor': {
      '@_xmlns:md': 'urn:oasis:names:tc:SAML:2.0:metadata',
      '@_entityID': entityId,
      'md:SPSSODescriptor': {
        '@_AuthnRequestsSigned': 'false',
        '@_WantAssertionsSigned': 'true',
        '@_protocolSupportEnumeration': SAMLP_NS,
        'md:AssertionConsumerService': {
          '@_Binding': 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
          '@_Location': acsUrl,
          '@_index': '0',
        },
      },
    },
  });
}

/** Decode a base64-encoded SAML Response and parse it. */
export function parseSamlResponse(base64Response: string): Record<string, unknown> {
  const xml = atob(base64Response);
  const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true });
  return parser.parse(xml);
}

/** Extract the certificate's public key from PEM and verify RSA-SHA256 signature. */
export async function validateSignature(
  signedXml: string,
  signatureValue: string,
  certificate: string,
): Promise<boolean> {
  try {
    const pemBody = certificate
      .replace(/-----BEGIN CERTIFICATE-----/g, '')
      .replace(/-----END CERTIFICATE-----/g, '')
      .replace(/\s/g, '');
    const certDer = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
    const key = await crypto.subtle.importKey(
      'spki',
      certDer,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const sigBytes = Uint8Array.from(atob(signatureValue), (c) => c.charCodeAt(0));
    const dataBytes = new TextEncoder().encode(signedXml);
    return await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, sigBytes, dataBytes);
  } catch {
    return false;
  }
}

/** Extract user attributes from a parsed SAML assertion. */
export function extractAttributes(parsed: Record<string, unknown>): SamlAttributes | null {
  try {
    const response = getNestedValue(parsed, 'Response') as Record<string, unknown>;
    if (!response) return null;
    const assertion = getNestedValue(response, 'Assertion') as Record<string, unknown>;
    if (!assertion) return null;

    const subject = getNestedValue(assertion, 'Subject') as Record<string, unknown>;
    const nameId = subject ? getNestedValue(subject, 'NameID') : null;
    const email = typeof nameId === 'string' ? nameId
      : (nameId as Record<string, unknown>)?.['#text'] as string ?? '';

    const attrStatement = getNestedValue(assertion, 'AttributeStatement') as Record<string, unknown>;
    const attrs = attrStatement ? normalizeArray(getNestedValue(attrStatement, 'Attribute')) : [];

    let name: string | null = null;
    let groups: string[] = [];

    for (const attr of attrs) {
      const attrName = (attr as Record<string, unknown>)['@_Name'] as string ?? '';
      const value = (attr as Record<string, unknown>)['AttributeValue'];
      if (attrName.includes('givenname') || attrName.includes('displayname') || attrName === 'name') {
        name = typeof value === 'string' ? value : (value as Record<string, unknown>)?.['#text'] as string ?? null;
      }
      if (attrName.includes('groups') || attrName.includes('memberOf')) {
        groups = normalizeArray(value).map((v) => typeof v === 'string' ? v : (v as Record<string, unknown>)['#text'] as string);
      }
    }

    if (!email) return null;
    return { email, name, groups };
  } catch {
    return null;
  }
}

function getNestedValue(obj: Record<string, unknown>, key: string): unknown {
  if (obj[key] !== undefined) return obj[key];
  for (const k of Object.keys(obj)) {
    if (k.endsWith(`:${key}`) || k === key) return obj[k];
  }
  return undefined;
}

function normalizeArray(val: unknown): unknown[] {
  if (Array.isArray(val)) return val;
  if (val !== null && val !== undefined) return [val];
  return [];
}
