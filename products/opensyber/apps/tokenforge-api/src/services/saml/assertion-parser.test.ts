import { describe, it, expect } from 'vitest';
import { parseSamlResponse, decodeSamlResponse } from './assertion-parser.js';

const SAMPLE_XML = `
<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
  xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">
  <saml:Issuer>https://acme.okta.com</saml:Issuer>
  <samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>
  <saml:Assertion>
    <saml:Conditions NotBefore="2026-05-01T10:00:00Z" NotOnOrAfter="2026-05-01T11:00:00Z"/>
    <saml:AuthnStatement SessionIndex="sess-123"/>
    <saml:Subject>
      <saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">alice@acme.com</saml:NameID>
    </saml:Subject>
    <saml:AttributeStatement>
      <saml:Attribute Name="displayName"><saml:AttributeValue>Alice Example</saml:AttributeValue></saml:Attribute>
      <saml:Attribute Name="department"><saml:AttributeValue>Engineering</saml:AttributeValue></saml:Attribute>
    </saml:AttributeStatement>
  </saml:Assertion>
</samlp:Response>`;

describe('parseSamlResponse', () => {
  it('extracts issuer, nameId, attributes from valid SAML response', () => {
    const result = parseSamlResponse(SAMPLE_XML);
    expect(result).not.toBeNull();
    expect(result!.issuer).toBe('https://acme.okta.com');
    expect(result!.nameId).toBe('alice@acme.com');
    expect(result!.nameIdFormat).toContain('emailAddress');
    expect(result!.sessionIndex).toBe('sess-123');
    expect(result!.attributes['displayName']).toBe('Alice Example');
    expect(result!.attributes['department']).toBe('Engineering');
  });

  it('extracts time conditions', () => {
    const result = parseSamlResponse(SAMPLE_XML);
    expect(result!.notBefore).toBe('2026-05-01T10:00:00Z');
    expect(result!.notOnOrAfter).toBe('2026-05-01T11:00:00Z');
  });

  it('returns null on garbage input', () => {
    expect(parseSamlResponse('<html>not saml</html>')).toBeNull();
  });

  it('returns null on empty string', () => {
    expect(parseSamlResponse('')).toBeNull();
  });

  it('falls back to non-prefixed Issuer tag when saml: prefix is absent (some IdPs)', () => {
    const xml = `
      <Response xmlns="urn:oasis:names:tc:SAML:2.0:protocol">
        <Issuer>https://idp.example.com</Issuer>
        <Subject><saml:NameID xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">u1</saml:NameID></Subject>
      </Response>`;
    const r = parseSamlResponse(xml);
    expect(r).not.toBeNull();
    expect(r!.issuer).toBe('https://idp.example.com');
  });

  it('returns nameId="" when NameID tag is absent (assertion without subject)', () => {
    const xml = `<Response><saml:Issuer>https://i</saml:Issuer></Response>`;
    const r = parseSamlResponse(xml);
    expect(r).not.toBeNull();
    expect(r!.nameId).toBe('');
    expect(r!.nameIdFormat).toBe('');
  });

  it('sessionIndex is null when AuthnStatement omits it', () => {
    const xml = `<Response><saml:Issuer>https://i</saml:Issuer></Response>`;
    const r = parseSamlResponse(xml);
    expect(r!.sessionIndex).toBeNull();
  });

  it('Conditions block is optional — notBefore + notOnOrAfter both null when absent', () => {
    const xml = `<Response><saml:Issuer>https://i</saml:Issuer></Response>`;
    const r = parseSamlResponse(xml);
    expect(r!.notBefore).toBeNull();
    expect(r!.notOnOrAfter).toBeNull();
  });

  it('parses an empty AttributeValue as ""', () => {
    const xml = `
      <Response>
        <saml:Issuer>https://i</saml:Issuer>
        <saml:Attribute Name="empty"><saml:AttributeValue></saml:AttributeValue></saml:Attribute>
      </Response>`;
    const r = parseSamlResponse(xml);
    expect(r!.attributes['empty']).toBe('');
  });
});

describe('decodeSamlResponse', () => {
  it('decodes valid base64', () => {
    const encoded = btoa('<saml>test</saml>');
    expect(decodeSamlResponse(encoded)).toBe('<saml>test</saml>');
  });

  it('returns null on invalid base64', () => {
    expect(decodeSamlResponse('not-valid-b64!!!')).toBeNull();
  });
});
