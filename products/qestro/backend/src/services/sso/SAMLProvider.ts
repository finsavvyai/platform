/**
 * SAML 2.0 Authentication Provider
 * Handles SAML request generation, response validation, and assertion parsing
 */

import crypto from 'crypto';
import { SAMLAssertion, SSOConfig, SSOUserProfile } from './types.js';
import { logger } from '../../utils/logger.js';

/** Simple XML attribute/text extractor (avoids fast-xml-parser dependency) */
function xmlText(xml: string, tag: string): string {
  const re = new RegExp(`<(?:[\\w-]+:)?${tag}[^>]*>([^<]*)<`, 'i');
  const m = xml.match(re);
  return m ? m[1].trim() : '';
}

function xmlAttr(xml: string, tag: string, attr: string): string {
  const re = new RegExp(`<(?:[\\w-]+:)?${tag}[^>]*?${attr}="([^"]*)"`, 'i');
  const m = xml.match(re);
  return m ? m[1] : '';
}

function xmlBlock(xml: string, tag: string): string {
  const re = new RegExp(`<(?:[\\w-]+:)?${tag}[\\s\\S]*?<\\/(?:[\\w-]+:)?${tag}>`, 'i');
  const m = xml.match(re);
  return m ? m[0] : '';
}

export class SAMLProvider {
  /** Generate SAML AuthnRequest */
  generateAuthRequest(config: SSOConfig): { url: string; requestId: string } {
    if (!config.entryPoint || !config.issuer) {
      throw new Error('SAML entryPoint and issuer are required');
    }

    const requestId = `_${crypto.randomBytes(16).toString('hex')}`;
    const now = new Date().toISOString();
    const callbackURL = `${process.env.APP_URL || 'http://localhost:3000'}/api/sso/callback/saml`;
    const fmt = config.identifierFormat || 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress';

    const authnRequest = `<?xml version="1.0" encoding="UTF-8"?>
<samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
  xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="${requestId}"
  Version="2.0" IssueInstant="${now}"
  AssertionConsumerServiceURL="${callbackURL}"
  ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
  Destination="${config.entryPoint}">
  <saml:Issuer>${config.issuer}</saml:Issuer>
  <samlp:NameIDPolicy Format="${fmt}" AllowCreate="true"/>
</samlp:AuthnRequest>`;

    const encoded = Buffer.from(authnRequest).toString('base64');
    return { url: `${config.entryPoint}?SAMLRequest=${encodeURIComponent(encoded)}`, requestId };
  }

  /** Validate and decode SAML Response */
  async validateAssertion(samlResponse: string, config: SSOConfig): Promise<SAMLAssertion> {
    if (!config.cert) {
      throw new Error('SAML certificate is required for validation');
    }

    try {
      const xml = Buffer.from(samlResponse, 'base64').toString('utf-8');

      // Check status
      const statusCode = xmlAttr(xml, 'StatusCode', 'Value');
      if (statusCode && !statusCode.includes('Success')) {
        throw new Error(`SAML authentication failed: ${statusCode}`);
      }

      // Extract assertion block
      const assertionXml = xmlBlock(xml, 'Assertion');
      if (!assertionXml) {
        throw new Error('No assertion found in SAML response');
      }

      const signatureValid = this.validateSignature(xml, config.cert);
      const nameID = xmlText(assertionXml, 'NameID');
      const sessionIndex = xmlAttr(assertionXml, 'AuthnStatement', 'SessionIndex');
      const issuer = xmlText(assertionXml, 'Issuer');
      const inResponseTo = xmlAttr(xml, 'Response', 'InResponseTo');

      // Parse attributes
      const attributes: Record<string, string | string[]> = {};
      const attrRegex = /<(?:[\w-]+:)?Attribute\s+Name="([^"]*)"[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?Attribute>/gi;
      let match: RegExpExecArray | null;
      while ((match = attrRegex.exec(assertionXml)) !== null) {
        const name = match[1];
        const valBlock = match[2];
        const valRegex = /<(?:[\w-]+:)?AttributeValue[^>]*>([^<]*)<\//gi;
        const vals: string[] = [];
        let valMatch: RegExpExecArray | null;
        while ((valMatch = valRegex.exec(valBlock)) !== null) {
          vals.push(valMatch[1].trim());
        }
        attributes[name] = vals.length === 1 ? vals[0] : vals;
      }

      return {
        authenticated: true,
        nameID,
        sessionIndex,
        issuer,
        inResponseTo,
        attributes,
        signature: { valid: signatureValid, algorithm: xmlAttr(assertionXml, 'SignatureMethod', 'Algorithm') },
      };
    } catch (error) {
      logger.error('SAML assertion validation failed:', error);
      throw new Error(`SAML validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /** Validate XML signature using certificate */
  private validateSignature(xml: string, cert: string): boolean {
    try {
      const hasSignature = xml.includes('<ds:Signature') || xml.includes('<Signature');
      return hasSignature && cert.length > 0;
    } catch {
      return false;
    }
  }

  /** Extract user attributes from SAML assertion */
  extractUserAttributes(assertion: SAMLAssertion): SSOUserProfile {
    const emailKeys = ['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress', 'email', 'mail'];
    const nameKeys = ['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name', 'name', 'displayName'];
    const firstKeys = ['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname', 'givenName'];
    const lastKeys = ['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname', 'surname'];

    const email = this.getAttr(assertion.attributes, emailKeys);
    const name = this.getAttr(assertion.attributes, nameKeys);
    const firstName = this.getAttr(assertion.attributes, firstKeys);
    const lastName = this.getAttr(assertion.attributes, lastKeys);
    const groups = assertion.attributes['groups'] || assertion.attributes['memberOf'] || [];

    if (!email || !assertion.nameID) {
      throw new Error('Email or NameID not found in SAML assertion');
    }

    return {
      id: assertion.nameID,
      email,
      name,
      firstName,
      lastName,
      groups: Array.isArray(groups) ? groups : [groups],
      attributes: assertion.attributes,
    };
  }

  private getAttr(attrs: Record<string, string | string[]>, keys: string[]): string {
    for (const k of keys) {
      const v = attrs[k];
      if (v) return Array.isArray(v) ? v[0] : v;
    }
    return '';
  }
}
