/**
 * Minimal SAML assertion parser for CF Workers.
 *
 * Extracts NameID, attributes, and issuer from a base64-decoded SAML
 * Response XML using regex (no full DOM/xml2js dependency). Workers
 * don't have DOMParser or full Node XML libs, so we use a constrained
 * regex approach that handles standard IdP responses.
 *
 * NOT a full SAML validator — signature verification is deferred to
 * the route layer which checks the XML signature against the IdP's
 * x509 cert stored in tf_workforce_apps.
 */

export interface SamlAssertion {
  issuer: string;
  nameId: string;
  nameIdFormat: string;
  sessionIndex: string | null;
  attributes: Record<string, string>;
  notBefore: string | null;
  notOnOrAfter: string | null;
}

export function parseSamlResponse(xml: string): SamlAssertion | null {
  const issuer = extractTag(xml, 'saml:Issuer') ?? extractTag(xml, 'Issuer');
  if (!issuer) return null;

  const nameIdMatch = xml.match(/<saml:NameID[^>]*>([^<]+)<\/saml:NameID>/);
  const nameId = nameIdMatch?.[1] ?? '';
  const nameIdFormatMatch = xml.match(/<saml:NameID[^>]*Format="([^"]+)"/);
  const nameIdFormat = nameIdFormatMatch?.[1] ?? '';

  const sessionIndexMatch = xml.match(/SessionIndex="([^"]+)"/);
  const conditionsMatch = xml.match(
    /<saml:Conditions[^>]*NotBefore="([^"]*)"[^>]*NotOnOrAfter="([^"]*)"/,
  );

  const attributes: Record<string, string> = {};
  const attrRegex = /<saml:Attribute\s+Name="([^"]+)"[^>]*>\s*<saml:AttributeValue[^>]*>([^<]*)<\/saml:AttributeValue>/g;
  let attrMatch: RegExpExecArray | null;
  while ((attrMatch = attrRegex.exec(xml)) !== null) {
    attributes[attrMatch[1]!] = attrMatch[2]!;
  }

  return {
    issuer,
    nameId,
    nameIdFormat,
    sessionIndex: sessionIndexMatch?.[1] ?? null,
    attributes,
    notBefore: conditionsMatch?.[1] ?? null,
    notOnOrAfter: conditionsMatch?.[2] ?? null,
  };
}

function extractTag(xml: string, tag: string): string | null {
  const re = new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`);
  return re.exec(xml)?.[1] ?? null;
}

export function decodeSamlResponse(base64: string): string | null {
  try {
    return atob(base64);
  } catch {
    return null;
  }
}
