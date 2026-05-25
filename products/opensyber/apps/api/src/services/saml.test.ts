import { describe, it, expect } from 'vitest';
import {
  buildAuthnRequest,
  buildSpMetadata,
  parseSamlResponse,
  extractAttributes,
} from './saml.js';

describe('SAML service', () => {
  describe('buildAuthnRequest', () => {
    it('generates valid AuthnRequest XML', () => {
      const xml = buildAuthnRequest(
        'https://sp.opensyber.cloud',
        'https://sp.opensyber.cloud/sso/acs',
        'https://idp.example.com/sso',
      );
      expect(xml).toContain('AuthnRequest');
      expect(xml).toContain('https://sp.opensyber.cloud');
      expect(xml).toContain('https://idp.example.com/sso');
      expect(xml).toContain('HTTP-POST');
    });
  });

  describe('buildSpMetadata', () => {
    it('generates SP metadata XML', () => {
      const xml = buildSpMetadata(
        'https://sp.opensyber.cloud',
        'https://sp.opensyber.cloud/sso/acs',
      );
      expect(xml).toContain('EntityDescriptor');
      expect(xml).toContain('SPSSODescriptor');
      expect(xml).toContain('AssertionConsumerService');
    });
  });

  describe('parseSamlResponse', () => {
    it('decodes and parses base64 SAML response', () => {
      const xml = '<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"><Status>ok</Status></samlp:Response>';
      const base64 = btoa(xml);
      const parsed = parseSamlResponse(base64);
      expect(parsed).toBeDefined();
      // removeNSPrefix strips 'samlp:' → key is 'Response'
      expect(parsed['Response']).toBeDefined();
    });

    it('throws on invalid base64', () => {
      expect(() => parseSamlResponse('not-valid-base64!!!')).toThrow();
    });
  });

  describe('extractAttributes', () => {
    it('extracts email from NameID', () => {
      const parsed = {
        Response: {
          Assertion: {
            Subject: { NameID: 'user@example.com' },
            AttributeStatement: { Attribute: [] },
          },
        },
      };
      const attrs = extractAttributes(parsed);
      expect(attrs).not.toBeNull();
      expect(attrs!.email).toBe('user@example.com');
    });

    it('extracts name and groups from attributes', () => {
      const parsed = {
        Response: {
          Assertion: {
            Subject: { NameID: 'user@example.com' },
            AttributeStatement: {
              Attribute: [
                { '@_Name': 'displayname', AttributeValue: 'John Doe' },
                { '@_Name': 'groups', AttributeValue: ['engineering', 'security'] },
              ],
            },
          },
        },
      };
      const attrs = extractAttributes(parsed);
      expect(attrs!.name).toBe('John Doe');
      expect(attrs!.groups).toEqual(['engineering', 'security']);
    });

    it('returns null for missing assertion', () => {
      expect(extractAttributes({ Response: {} })).toBeNull();
    });

    it('returns null for missing email', () => {
      const parsed = {
        Response: {
          Assertion: {
            Subject: {},
            AttributeStatement: { Attribute: [] },
          },
        },
      };
      expect(extractAttributes(parsed)).toBeNull();
    });
  });
});
