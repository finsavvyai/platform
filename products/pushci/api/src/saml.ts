// SAML 2.0 Service Provider for PushCI. WebCrypto only — no Node deps.
// Supports Azure AD + Okta HTTP-POST binding, signed assertions. No SLO.

import { SamlAssertion, SamlValidateInput } from "./saml-types";
import { extractTagText, extractTagBlock, extractAttr, extractAttributes } from "./saml-xml";
import { verifySignature } from "./saml-crypto";

export type {
  AuthnRequestInput,
  AuthnRequestResult,
  SamlValidateInput,
  SamlAssertion,
} from "./saml-types";
export { buildAuthnRequest, buildSpMetadata } from "./saml-authn";

export async function parseAndValidateResponse(
  samlResponseB64: string,
  opts: SamlValidateInput
): Promise<SamlAssertion> {
  const xml = atob(samlResponseB64);

  const issuer = extractTagText(xml, "Issuer") ?? "";
  const assertion = extractTagBlock(xml, "Assertion");
  if (!assertion) throw new Error("saml: no Assertion element");

  if (!(await verifySignature(xml, opts.idpCert))) {
    throw new Error("saml: signature verification failed");
  }

  const audience = extractTagText(assertion, "Audience");
  if (audience && audience !== opts.spEntityId) {
    throw new Error(`saml: audience mismatch (got ${audience})`);
  }
  const recipient = extractAttr(assertion, "SubjectConfirmationData", "Recipient");
  if (recipient && recipient !== opts.acsUrl) {
    throw new Error(`saml: recipient mismatch (got ${recipient})`);
  }

  const skew = (opts.clockSkewSec ?? 300) * 1000;
  const now = Date.now();
  const notBefore = extractAttr(assertion, "Conditions", "NotBefore");
  const notOnOrAfter = extractAttr(assertion, "Conditions", "NotOnOrAfter");
  if (notBefore && Date.parse(notBefore) - skew > now) {
    throw new Error("saml: assertion not yet valid");
  }
  if (notOnOrAfter && Date.parse(notOnOrAfter) + skew < now) {
    throw new Error("saml: assertion expired");
  }

  const nameId = extractTagText(assertion, "NameID") ?? "";
  const sessionIndex = extractAttr(assertion, "AuthnStatement", "SessionIndex");
  const attributes = extractAttributes(assertion);
  const email =
    attributes["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"] ||
    attributes["urn:oid:0.9.2342.19200300.100.1.3"] ||
    attributes["email"] ||
    attributes["mail"] ||
    attributes["Email"] ||
    nameId;

  if (!email || !email.includes("@")) {
    throw new Error("saml: no email in assertion");
  }

  return { nameId, email, attributes, sessionIndex, issuer };
}
