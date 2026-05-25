// SAML 2.0 AuthnRequest and SP metadata builders.
// HTTP-POST binding only; no DEFLATE since Workers lack the API.

import { AuthnRequestInput, AuthnRequestResult } from "./saml-types";
import { xmlEscape } from "./saml-xml";

function samlId(): string {
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `_${hex}`;
}

export function buildAuthnRequest(input: AuthnRequestInput): AuthnRequestResult {
  const id = samlId();
  const issueInstant = new Date().toISOString();
  const relayState = input.relayState ?? samlId();

  const xml =
    `<samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ` +
    `xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ` +
    `ID="${id}" Version="2.0" IssueInstant="${issueInstant}" ` +
    `ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" ` +
    `AssertionConsumerServiceURL="${xmlEscape(input.acsUrl)}" ` +
    `Destination="${xmlEscape(input.idpSsoUrl)}">` +
    `<saml:Issuer>${xmlEscape(input.spEntityId)}</saml:Issuer>` +
    `<samlp:NameIDPolicy Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress" AllowCreate="true"/>` +
    `</samlp:AuthnRequest>`;

  const encoded = btoa(xml);
  const url = new URL(input.idpSsoUrl);
  url.searchParams.set("SAMLRequest", encoded);
  url.searchParams.set("RelayState", relayState);
  return { url: url.toString(), relayState, id };
}

export function buildSpMetadata(spEntityId: string, acsUrl: string): string {
  return (
    `<?xml version="1.0"?>` +
    `<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" ` +
    `entityID="${xmlEscape(spEntityId)}">` +
    `<md:SPSSODescriptor AuthnRequestsSigned="false" WantAssertionsSigned="true" ` +
    `protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">` +
    `<md:NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</md:NameIDFormat>` +
    `<md:AssertionConsumerService index="0" isDefault="true" ` +
    `Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" ` +
    `Location="${xmlEscape(acsUrl)}"/>` +
    `</md:SPSSODescriptor>` +
    `</md:EntityDescriptor>`
  );
}
