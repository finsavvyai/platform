// Tests for the SAML 2.0 SP implementation.
//
// Strategy: we can't ship a fixture from a real IdP (licensing), so we
// generate a keypair at test time, produce a wrapping x509 cert stub that
// our SPKI extractor can parse, and sign a synthetic SignedInfo block.
//
// For end-to-end verification we construct the simplest SAMLResponse that
// our regex walker + canonicalizer accept.

import { describe, it, expect } from "vitest";
import {
  buildAuthnRequest,
  buildSpMetadata,
  parseAndValidateResponse,
} from "./saml";

// ---------- AuthnRequest ----------

describe("buildAuthnRequest", () => {
  it("produces a base64 SAMLRequest and preserves RelayState", () => {
    const r = buildAuthnRequest({
      spEntityId: "https://app.pushci.dev/api/saml/acme/metadata",
      acsUrl: "https://api.pushci.dev/api/saml/acme/acs",
      idpSsoUrl: "https://login.microsoftonline.com/tenant/saml2",
      relayState: "acme",
    });
    expect(r.id).toMatch(/^_[0-9a-f]{32}$/);
    expect(r.relayState).toBe("acme");
    const u = new URL(r.url);
    expect(u.host).toBe("login.microsoftonline.com");
    const enc = u.searchParams.get("SAMLRequest");
    expect(enc).toBeTruthy();
    const xml = atob(enc!);
    expect(xml).toContain("AuthnRequest");
    expect(xml).toContain("pushci.dev/api/saml/acme/metadata");
    expect(xml).toContain("HTTP-POST");
  });

  it("generates a fresh ID every call", () => {
    const a = buildAuthnRequest({
      spEntityId: "sp",
      acsUrl: "https://a/acs",
      idpSsoUrl: "https://idp/sso",
    });
    const b = buildAuthnRequest({
      spEntityId: "sp",
      acsUrl: "https://a/acs",
      idpSsoUrl: "https://idp/sso",
    });
    expect(a.id).not.toBe(b.id);
    expect(a.relayState).not.toBe(b.relayState);
  });
});

// ---------- Metadata ----------

describe("buildSpMetadata", () => {
  it("includes entityID and ACS URL", () => {
    const xml = buildSpMetadata(
      "https://app.pushci.dev/api/saml/acme/metadata",
      "https://api.pushci.dev/api/saml/acme/acs"
    );
    expect(xml).toContain("EntityDescriptor");
    expect(xml).toContain("entityID=\"https://app.pushci.dev/api/saml/acme/metadata\"");
    expect(xml).toContain("AssertionConsumerService");
    expect(xml).toContain("Location=\"https://api.pushci.dev/api/saml/acme/acs\"");
    expect(xml).toContain("HTTP-POST");
  });
});

// ---------- Signature verification ----------
//
// The validator expects:
//  - A valid <Signature> block with <SignedInfo>, <SignatureValue>, and a PEM
//    cert supplied OUT-OF-BAND (via the SamlValidateInput.idpCert argument).
//  - The SignedInfo content can be canonicalized (whitespace-normalized) and
//    its bytes match the signature over the IdP's RSA public key.

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

async function generateIdpKeyMaterial(): Promise<{
  keyPair: CryptoKeyPair;
  certPem: string;
}> {
  const keyPair = (await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"]
  )) as CryptoKeyPair;

  // Export SPKI then wrap it into a minimal X.509 Certificate DER so that our
  // extractSpkiFromX509 walker can find it by skipping all the TBSCertificate
  // preamble fields.
  const spkiBuf = (await crypto.subtle.exportKey("spki", keyPair.publicKey)) as ArrayBuffer;
  const spki = new Uint8Array(spkiBuf);
  const der = wrapSpkiInCertificate(spki);
  const b64 = bytesToBase64(der);
  const pem =
    "-----BEGIN CERTIFICATE-----\n" +
    (b64.match(/.{1,64}/g) ?? []).join("\n") +
    "\n-----END CERTIFICATE-----\n";
  return { keyPair, certPem: pem };
}

// Build a DER structure that looks enough like an X.509 cert for our walker:
// SEQUENCE { SEQUENCE { [0] version, serial, sigAlg, issuer, validity, subject, SPKI } }
function wrapSpkiInCertificate(spki: Uint8Array): Uint8Array {
  // Minimal placeholder fields, each a SEQUENCE/INTEGER of length 0.
  const version = derTaggedLen(0xa0, der(0x02, new Uint8Array([0x02]))); // [0] INTEGER 2
  const serial = der(0x02, new Uint8Array([0x01])); // INTEGER 1
  const sigAlg = der(0x30, new Uint8Array()); // SEQUENCE {}
  const issuer = der(0x30, new Uint8Array()); // SEQUENCE {}
  const validity = der(0x30, new Uint8Array()); // SEQUENCE {}
  const subject = der(0x30, new Uint8Array()); // SEQUENCE {}

  const tbs = concat(version, serial, sigAlg, issuer, validity, subject, spki);
  const tbsSeq = der(0x30, tbs);

  // Outer cert also needs signatureAlgorithm and signatureValue for real
  // X.509 but our extractor only reads as far as SPKI, so we can stop here.
  const cert = der(0x30, tbsSeq);
  return cert;
}

function der(tag: number, body: Uint8Array): Uint8Array {
  return concat(new Uint8Array([tag]), encodeLen(body.length), body);
}
function derTaggedLen(tag: number, body: Uint8Array): Uint8Array {
  return concat(new Uint8Array([tag]), encodeLen(body.length), body);
}
function encodeLen(n: number): Uint8Array {
  if (n < 0x80) return new Uint8Array([n]);
  if (n < 0x100) return new Uint8Array([0x81, n]);
  return new Uint8Array([0x82, (n >> 8) & 0xff, n & 0xff]);
}
function concat(...parts: Uint8Array[]): Uint8Array {
  let len = 0;
  for (const p of parts) len += p.length;
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

async function signSignedInfo(
  signedInfo: string,
  privateKey: CryptoKey
): Promise<string> {
  // Canonicalize exactly the way our validator does
  const canon = signedInfo.replace(/>\s+</g, "><").trim();
  const sig = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    privateKey,
    new TextEncoder().encode(canon)
  );
  return bytesToBase64(new Uint8Array(sig));
}

describe("parseAndValidateResponse", () => {
  it("accepts a well-formed signed assertion and extracts email + attributes", async () => {
    const { keyPair, certPem } = await generateIdpKeyMaterial();

    const spEntityId = "https://app.pushci.dev/api/saml/acme/metadata";
    const acsUrl = "https://api.pushci.dev/api/saml/acme/acs";
    const email = "alice@norlys.dk";
    const notBefore = new Date(Date.now() - 60_000).toISOString();
    const notOnOrAfter = new Date(Date.now() + 600_000).toISOString();

    const signedInfo =
      `<ds:SignedInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">` +
      `<ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>` +
      `<ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>` +
      `<ds:Reference URI="#assertion">` +
      `<ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>` +
      `<ds:DigestValue>stub</ds:DigestValue>` +
      `</ds:Reference>` +
      `</ds:SignedInfo>`;
    const signatureValue = await signSignedInfo(signedInfo, keyPair.privateKey);

    const xml =
      `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">` +
      `<saml:Issuer>https://login.microsoftonline.com/tenant/</saml:Issuer>` +
      `<saml:Assertion ID="assertion" Version="2.0">` +
      `<saml:Issuer>https://login.microsoftonline.com/tenant/</saml:Issuer>` +
      `<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#">` +
      signedInfo +
      `<ds:SignatureValue>${signatureValue}</ds:SignatureValue>` +
      `</ds:Signature>` +
      `<saml:Subject>` +
      `<saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">${email}</saml:NameID>` +
      `<saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer">` +
      `<saml:SubjectConfirmationData Recipient="${acsUrl}" NotOnOrAfter="${notOnOrAfter}"/>` +
      `</saml:SubjectConfirmation>` +
      `</saml:Subject>` +
      `<saml:Conditions NotBefore="${notBefore}" NotOnOrAfter="${notOnOrAfter}">` +
      `<saml:AudienceRestriction><saml:Audience>${spEntityId}</saml:Audience></saml:AudienceRestriction>` +
      `</saml:Conditions>` +
      `<saml:AuthnStatement AuthnInstant="${notBefore}" SessionIndex="_sess123"/>` +
      `<saml:AttributeStatement>` +
      `<saml:Attribute Name="http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress">` +
      `<saml:AttributeValue>${email}</saml:AttributeValue>` +
      `</saml:Attribute>` +
      `<saml:Attribute Name="displayname">` +
      `<saml:AttributeValue>Alice Norlys</saml:AttributeValue>` +
      `</saml:Attribute>` +
      `</saml:AttributeStatement>` +
      `</saml:Assertion>` +
      `</samlp:Response>`;

    const b64 = bytesToBase64(new TextEncoder().encode(xml));
    const result = await parseAndValidateResponse(b64, {
      idpCert: certPem,
      spEntityId,
      acsUrl,
    });
    expect(result.email).toBe(email);
    expect(result.nameId).toBe(email);
    expect(result.sessionIndex).toBe("_sess123");
    expect(result.attributes["displayname"]).toBe("Alice Norlys");
  });

  it("rejects when the signature does not match", async () => {
    const { certPem } = await generateIdpKeyMaterial();
    // Build a response with a bogus signature value
    const xml =
      `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">` +
      `<saml:Issuer>idp</saml:Issuer>` +
      `<saml:Assertion ID="a">` +
      `<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#">` +
      `<ds:SignedInfo><ds:SignatureMethod Algorithm="rsa-sha256"/></ds:SignedInfo>` +
      `<ds:SignatureValue>AAAA</ds:SignatureValue>` +
      `</ds:Signature>` +
      `<saml:Subject><saml:NameID>x@y.com</saml:NameID></saml:Subject>` +
      `</saml:Assertion>` +
      `</samlp:Response>`;
    const b64 = bytesToBase64(new TextEncoder().encode(xml));
    await expect(
      parseAndValidateResponse(b64, {
        idpCert: certPem,
        spEntityId: "sp",
        acsUrl: "https://a/acs",
      })
    ).rejects.toThrow(/signature/i);
  });

  it("rejects when the assertion has expired", async () => {
    const { keyPair, certPem } = await generateIdpKeyMaterial();
    const spEntityId = "sp";
    const acsUrl = "https://a/acs";
    const notBefore = new Date(Date.now() - 3600_000).toISOString();
    const notOnOrAfter = new Date(Date.now() - 1800_000).toISOString();
    const signedInfo =
      `<ds:SignedInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">` +
      `<ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>` +
      `</ds:SignedInfo>`;
    const sig = await signSignedInfo(signedInfo, keyPair.privateKey);
    const xml =
      `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">` +
      `<saml:Assertion>` +
      `<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#">` +
      signedInfo +
      `<ds:SignatureValue>${sig}</ds:SignatureValue>` +
      `</ds:Signature>` +
      `<saml:Subject><saml:NameID>x@y.com</saml:NameID></saml:Subject>` +
      `<saml:Conditions NotBefore="${notBefore}" NotOnOrAfter="${notOnOrAfter}">` +
      `<saml:AudienceRestriction><saml:Audience>${spEntityId}</saml:Audience></saml:AudienceRestriction>` +
      `</saml:Conditions>` +
      `<saml:AttributeStatement><saml:Attribute Name="email"><saml:AttributeValue>x@y.com</saml:AttributeValue></saml:Attribute></saml:AttributeStatement>` +
      `</saml:Assertion>` +
      `</samlp:Response>`;
    const b64 = bytesToBase64(new TextEncoder().encode(xml));
    await expect(
      parseAndValidateResponse(b64, { idpCert: certPem, spEntityId, acsUrl, clockSkewSec: 0 })
    ).rejects.toThrow(/expired/);
  });
});
