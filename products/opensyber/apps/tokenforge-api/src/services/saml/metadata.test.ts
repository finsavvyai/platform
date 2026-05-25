import { describe, it, expect } from 'vitest';
import { generateSpMetadata } from './metadata.js';

describe('generateSpMetadata', () => {
  const TENANT = 'tf_acme';

  it('emits an XML declaration and EntityDescriptor root', () => {
    const xml = generateSpMetadata(TENANT);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<md:EntityDescriptor');
    expect(xml).toContain('xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata"');
  });

  it('entityID includes a tenant-scoped path so each tenant is a distinct SP', () => {
    const xml = generateSpMetadata(TENANT);
    expect(xml).toContain(`entityID="https://tokenforge.opensyber.cloud/saml/sp/${TENANT}"`);
  });

  it('AuthnRequestsSigned and WantAssertionsSigned are both "true" (signing required)', () => {
    const xml = generateSpMetadata(TENANT);
    expect(xml).toContain('AuthnRequestsSigned="true"');
    expect(xml).toContain('WantAssertionsSigned="true"');
  });

  it('NameIDFormat is the emailAddress urn (workforce SSO standard)', () => {
    const xml = generateSpMetadata(TENANT);
    expect(xml).toContain('urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress');
  });

  it('AssertionConsumerService Location is per-tenant ACS endpoint with HTTP-POST binding', () => {
    const xml = generateSpMetadata(TENANT);
    expect(xml).toMatch(/<md:AssertionConsumerService[\s\S]*?Binding="urn:oasis:names:tc:SAML:2\.0:bindings:HTTP-POST"/);
    expect(xml).toContain(`Location="https://tokenforge.opensyber.cloud/v1/saml/acs/${TENANT}"`);
  });

  it('SingleLogoutService Location is per-tenant SLO endpoint', () => {
    const xml = generateSpMetadata(TENANT);
    expect(xml).toContain(`Location="https://tokenforge.opensyber.cloud/v1/saml/slo/${TENANT}"`);
  });

  it('produces distinct metadata for different tenants', () => {
    const a = generateSpMetadata('tf_acme');
    const b = generateSpMetadata('tf_beta');
    expect(a).not.toBe(b);
    expect(a).toContain('tf_acme');
    expect(a).not.toContain('tf_beta');
    expect(b).toContain('tf_beta');
  });
});
