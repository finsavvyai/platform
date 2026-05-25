import { xml2js, js2xml } from 'xml-js';
import crypto from 'crypto';
import { SSOUserInfo } from './provider-manager';

export interface SAMLAssertion {
  id: string;
  issueInstant: string;
  issuer: string;
  subject: {
    nameId: string;
    nameIdFormat: string;
    subjectConfirmation: {
      method: string;
      notOnOrAfter?: string;
      recipient?: string;
    }[];
  };
  conditions?: {
    notBefore?: string;
    notOnOrAfter?: string;
    audienceRestrictions?: {
      audience: string;
    }[];
  };
  attributes: Record<string, string[]>;
  signature?: {
    signatureValue: string;
    keyInfo?: {
      x509Data?: {
        x509Certificate: string;
      }[];
    };
  };
}

export interface SAMLResponse {
  id: string;
  issueInstant: string;
  destination?: string;
  issuer: string;
  status: {
    statusCode: {
      value: string;
      subStatusCode?: {
        value: string;
      };
    };
    statusMessage?: string;
  };
  assertion?: SAMLAssertion;
  signature?: any;
}

export interface SAMLValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  assertion?: SAMLAssertion;
  metadata?: {
    issuer: string;
    audience: string;
    subject: string;
    attributesCount: number;
    validFrom?: Date;
    validUntil?: Date;
  };
}

export interface SAMLAttributeMapping {
  samlAttribute: string;
  userField: string;
  transform?: (value: string) => any;
  multiValue?: boolean;
  required?: boolean;
}

/**
 * SAML Assertion Parser and Validator
 * Handles SAML 2.0 assertion parsing, validation, and attribute extraction
 */
export class SAMLParser {
  private certificateCache: Map<string, string> = new Map();
  private allowedClockSkew: number = 300; // 5 minutes

  constructor(options: { allowedClockSkew?: number } = {}) {
    this.allowedClockSkew = options.allowedClockSkew || 300;
  }

  /**
   * Parse SAML Response from XML string
   */
  parseSAMLResponse(samlResponse: string): SAMLResponse {
    try {
      const decoded = Buffer.from(samlResponse, 'base64').toString();
      const xmlData = xml2js(decoded, {
        compact: true,
        alwaysArray: true,
        ignoreComment: true,
        ignoreDoctype: true
      });

      const response = xmlData['samlp:Response']?.[0] || xmlData.Response?.[0];
      if (!response) {
        throw new Error('Invalid SAML Response: No Response element found');
      }

      return this.extractResponseData(response);
    } catch (error) {
      throw new Error(`SAML Response parsing failed: ${error.message}`);
    }
  }

  /**
   * Validate SAML Response and Assertion
   */
  async validateSAMLResponse(
    samlResponse: string,
    options: {
      expectedIssuer?: string;
      expectedAudience?: string;
      expectedRecipient?: string;
      certificate?: string;
      requestId?: string;
    } = {}
  ): Promise<SAMLValidationResult> {
    const result: SAMLValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    try {
      // Parse the response
      const response = this.parseSAMLResponse(samlResponse);
      result.assertion = response.assertion;

      // Check status code
      if (response.status.statusCode.value !== 'urn:oasis:names:tc:SAML:2.0:status:Success') {
        result.isValid = false;
        result.errors.push(`SAML Response status is not Success: ${response.status.statusCode.value}`);

        if (response.status.statusCode.subStatusCode) {
          result.errors.push(`Sub-status: ${response.status.statusCode.subStatusCode.value}`);
        }

        if (response.status.statusMessage) {
          result.errors.push(`Status message: ${response.status.statusMessage}`);
        }

        return result;
      }

      if (!response.assertion) {
        result.isValid = false;
        result.errors.push('No assertion found in SAML Response');
        return result;
      }

      const assertion = response.assertion;

      // Set metadata
      result.metadata = {
        issuer: assertion.issuer,
        audience: assertion.conditions?.audienceRestrictions?.[0]?.audience || '',
        subject: assertion.subject.nameId,
        attributesCount: Object.keys(assertion.attributes).length,
      };

      // Validate issuer
      if (options.expectedIssuer && assertion.issuer !== options.expectedIssuer) {
        result.isValid = false;
        result.errors.push(`Invalid issuer: expected ${options.expectedIssuer}, got ${assertion.issuer}`);
      }

      // Validate audience
      if (options.expectedAudience && assertion.conditions?.audienceRestrictions) {
        const audiences = assertion.conditions.audienceRestrictions.map(ar => ar.audience);
        if (!audiences.includes(options.expectedAudience)) {
          result.isValid = false;
          result.errors.push(`Invalid audience: expected ${options.expectedAudience}, got ${audiences.join(', ')}`);
        }
      }

      // Validate recipient (subject confirmation)
      if (options.expectedRecipient && assertion.subject.subjectConfirmation) {
        const recipients = assertion.subject.subjectConfirmation
          .map(sc => sc.recipient)
          .filter(r => r !== undefined);

        if (recipients.length > 0 && !recipients.includes(options.expectedRecipient)) {
          result.isValid = false;
          result.errors.push(`Invalid recipient: expected ${options.expectedRecipient}, got ${recipients.join(', ')}`);
        }
      }

      // Validate timestamps
      this.validateTimestamps(assertion, result);

      // Validate signature if certificate provided
      if (options.certificate && assertion.signature) {
        await this.validateSignature(samlResponse, options.certificate, result);
      } else if (!assertion.signature) {
        result.warnings.push('No signature found in SAML assertion');
      }

      return result;
    } catch (error) {
      result.isValid = false;
      result.errors.push(`Validation error: ${error.message}`);
      return result;
    }
  }

  /**
   * Extract user information from validated SAML assertion
   */
  extractUserInfo(
    assertion: SAMLAssertion,
    attributeMapping: SAMLAttributeMapping[] = []
  ): SSOUserInfo {
    const userInfo: SSOUserInfo = {
      id: assertion.subject.nameId,
      email: '',
      name: '',
      firstName: '',
      lastName: '',
      attributes: {},
      groups: [],
      roles: [],
    };

    // Extract basic information from NameID
    if (assertion.subject.nameIdFormat === 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress') {
      userInfo.email = assertion.subject.nameId;
    }

    // Apply attribute mapping
    for (const mapping of attributeMapping) {
      const values = assertion.attributes[mapping.samlAttribute];

      if (values && values.length > 0) {
        let value = mapping.multiValue ? values : values[0];

        // Apply transformation if provided
        if (mapping.transform) {
          if (mapping.multiValue) {
            value = values.map(mapping.transform);
          } else {
            value = mapping.transform(value);
          }
        }

        // Set user field
        switch (mapping.userField) {
          case 'email':
            userInfo.email = value as string;
            break;
          case 'name':
            userInfo.name = value as string;
            break;
          case 'firstName':
            userInfo.firstName = value as string;
            break;
          case 'lastName':
            userInfo.lastName = value as string;
            break;
          case 'groups':
            userInfo.groups = Array.isArray(value) ? value as string[] : [value as string];
            break;
          case 'roles':
            userInfo.roles = Array.isArray(value) ? value as string[] : [value as string];
            break;
          default:
            userInfo.attributes[mapping.userField] = value;
        }
      } else if (mapping.required) {
        throw new Error(`Required SAML attribute missing: ${mapping.samlAttribute}`);
      }
    }

    // Try to extract name from attributes if not provided
    if (!userInfo.name && userInfo.firstName && userInfo.lastName) {
      userInfo.name = `${userInfo.firstName} ${userInfo.lastName}`;
    }

    return userInfo;
  }

  /**
   * Generate SAML metadata for Service Provider
   */
  generateSPMetadata(config: {
    entityId: string;
    assertionConsumerService: string;
    sloService?: string;
    name: string;
    description?: string;
    organization?: {
      name: string;
      displayName: string;
      url: string;
    };
    contactPerson?: {
      name: string;
      email: string;
    };
  }): string {
    const metadata = {
      'md:EntityDescriptor': {
        _attributes: {
          'xmlns:md': 'urn:oasis:names:tc:SAML:2.0:metadata',
          'xmlns:ds': 'http://www.w3.org/2000/09/xmldsig#',
          'entityID': config.entityId,
        },
        'md:SPSSODescriptor': [{
          _attributes: {
            'protocolSupportEnumeration': 'urn:oasis:names:tc:SAML:2.0:protocol',
            'AuthnRequestsSigned': 'false',
            'WantAssertionsSigned': 'true',
          },
          'md:NameIDFormat': [{
            _text: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
          }],
          'md:AssertionConsumerService': [{
            _attributes: {
              'index': '0',
              'Binding': 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
              'Location': config.assertionConsumerService,
            },
          }],
          ...(config.sloService ? [{
            'md:SingleLogoutService': [{
              _attributes: {
                'Binding': 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
                'Location': config.sloService,
              },
            }],
          }] : []),
        }],
        ...(config.organization ? [{
          'md:Organization': [{
            'md:OrganizationName': [{
              _attributes: { 'xml:lang': 'en' },
              _text: config.organization.name,
            }],
            'md:OrganizationDisplayName': [{
              _attributes: { 'xml:lang': 'en' },
              _text: config.organization.displayName,
            }],
            'md:OrganizationURL': [{
              _attributes: { 'xml:lang': 'en' },
              _text: config.organization.url,
            }],
          }],
        }] : []),
        ...(config.contactPerson ? [{
          'md:ContactPerson': [{
            _attributes: {
              'contactType': 'technical',
            },
            'md:GivenName': [{ _text: config.contactPerson.name.split(' ')[0] }],
            'md:SurName': [{ _text: config.contactPerson.name.split(' ').slice(1).join(' ') }],
            'md:EmailAddress': [{ _text: `mailto:${config.contactPerson.email}` }],
          }],
        }] : []),
      },
    };

    return `<?xml version="1.0" encoding="UTF-8"?>\n${js2xml(metadata, { compact: true, spaces: 2 })}`;
  }

  /**
   * Extract response data from parsed XML
   */
  private extractResponseData(response: any): SAMLResponse {
    const result: SAMLResponse = {
      id: response._attributes.ID,
      issueInstant: response._attributes.IssueInstant,
      destination: response._attributes.Destination,
      issuer: response.Issuer?.[0]?._text || '',
      status: this.extractStatus(response.Status?.[0]),
    };

    // Extract assertion
    if (response.Assertion && response.Assertion[0]) {
      result.assertion = this.extractAssertion(response.Assertion[0]);
    }

    return result;
  }

  /**
   * Extract status information
   */
  private extractStatus(status: any): SAMLResponse['status'] {
    const result: SAMLResponse['status'] = {
      statusCode: {
        value: status.StatusCode?.[0]?._attributes?.Value || '',
      },
    };

    if (status.StatusCode?.[0]?.StatusCode?.[0]) {
      result.statusCode.subStatusCode = {
        value: status.StatusCode[0].StatusCode[0]._attributes.Value,
      };
    }

    if (status.StatusMessage?.[0]?._text) {
      result.statusMessage = status.StatusMessage[0]._text;
    }

    return result;
  }

  /**
   * Extract assertion information
   */
  private extractAssertion(assertion: any): SAMLAssertion {
    const result: SAMLAssertion = {
      id: assertion._attributes.ID,
      issueInstant: assertion._attributes.IssueInstant,
      issuer: assertion.Issuer?.[0]?._text || '',
      subject: this.extractSubject(assertion.Subject?.[0]),
      attributes: this.extractAttributes(assertion.AttributeStatement?.[0]),
    };

    if (assertion.Conditions?.[0]) {
      result.conditions = this.extractConditions(assertion.Conditions[0]);
    }

    if (assertion.Signature?.[0]) {
      result.signature = this.extractSignature(assertion.Signature[0]);
    }

    return result;
  }

  /**
   * Extract subject information
   */
  private extractSubject(subject: any): SAMLAssertion['subject'] {
    const result: SAMLAssertion['subject'] = {
      nameId: subject.NameID?.[0]?._text || '',
      nameIdFormat: subject.NameID?.[0]?._attributes?.Format || '',
      subjectConfirmation: [],
    };

    if (subject.SubjectConfirmation?.[0]) {
      result.subjectConfirmation = subject.SubjectConfirmation.map((sc: any) => ({
        method: sc._attributes?.Method || '',
        notOnOrAfter: sc.SubjectConfirmationData?.[0]?._attributes?.NotOnOrAfter,
        recipient: sc.SubjectConfirmationData?.[0]?._attributes?.Recipient,
      }));
    }

    return result;
  }

  /**
   * Extract conditions information
   */
  private extractConditions(conditions: any): SAMLAssertion['conditions'] {
    const result: SAMLAssertion['conditions'] = {
      notBefore: conditions._attributes?.NotBefore,
      notOnOrAfter: conditions._attributes?.NotOnOrAfter,
      audienceRestrictions: [],
    };

    if (conditions.AudienceRestriction) {
      result.audienceRestrictions = conditions.AudienceRestriction.map((ar: any) => ({
        audience: ar.Audience?.[0]?._text || '',
      }));
    }

    return result;
  }

  /**
   * Extract attributes from assertion
   */
  private extractAttributes(attributeStatement: any): Record<string, string[]> {
    const attributes: Record<string, string[]> = {};

    if (attributeStatement && attributeStatement.Attribute) {
      for (const attr of attributeStatement.Attribute) {
        const name = attr._attributes?.Name;
        const values = attr.AttributeValue?.map((av: any) => av._text || '') || [];

        if (name) {
          attributes[name] = values;
        }
      }
    }

    return attributes;
  }

  /**
   * Extract signature information
   */
  private extractSignature(signature: any): SAMLAssertion['signature'] {
    const result: SAMLAssertion['signature'] = {
      signatureValue: signature.SignatureValue?.[0]?._text || '',
    };

    if (signature.KeyInfo?.[0]?.X509Data?.[0]?.X509Certificate?.[0]?._text) {
      result.keyInfo = {
        x509Data: [{
          x509Certificate: signature.KeyInfo[0].X509Data[0].X509Certificate[0]._text,
        }],
      };
    }

    return result;
  }

  /**
   * Validate assertion timestamps
   */
  private validateTimestamps(assertion: SAMLAssertion, result: SAMLValidationResult): void {
    const now = new Date();
    const skewMs = this.allowedClockSkew * 1000;

    // Check Conditions notBefore
    if (assertion.conditions?.notBefore) {
      const notBefore = new Date(assertion.conditions.notBefore);
      if (now < new Date(notBefore.getTime() - skewMs)) {
        result.isValid = false;
        result.errors.push(`Assertion is not yet valid: ${assertion.conditions.notBefore}`);
      }
      result.metadata.validFrom = notBefore;
    }

    // Check Conditions notOnOrAfter
    if (assertion.conditions?.notOnOrAfter) {
      const notOnOrAfter = new Date(assertion.conditions.notOnOrAfter);
      if (now > new Date(notOnOrAfter.getTime() + skewMs)) {
        result.isValid = false;
        result.errors.push(`Assertion has expired: ${assertion.conditions.notOnOrAfter}`);
      }
      result.metadata.validUntil = notOnOrAfter;
    }

    // Check SubjectConfirmation notOnOrAfter
    for (const sc of assertion.subject.subjectConfirmation) {
      if (sc.notOnOrAfter) {
        const notOnOrAfter = new Date(sc.notOnOrAfter);
        if (now > new Date(notOnOrAfter.getTime() + skewMs)) {
          result.isValid = false;
          result.errors.push(`SubjectConfirmation has expired: ${sc.notOnOrAfter}`);
        }
      }
    }
  }

  /**
   * Validate SAML signature
   */
  private async validateSignature(
    samlResponse: string,
    certificate: string,
    result: SAMLValidationResult
  ): Promise<void> {
    try {
      // In a real implementation, you would use a proper XML signature library
      // This is a placeholder for signature validation

      // For now, we'll just verify that a signature exists
      const decoded = Buffer.from(samlResponse, 'base64').toString();
      if (!decoded.includes('<Signature>')) {
        result.isValid = false;
        result.errors.push('No signature found in SAML response');
        return;
      }

      // Placeholder: actual signature validation would go here
      // You would typically use libraries like 'xml-crypto' or 'xml-encryption'

      result.warnings.push('Signature validation not fully implemented');
    } catch (error) {
      result.isValid = false;
      result.errors.push(`Signature validation failed: ${error.message}`);
    }
  }

  /**
   * Create SAML AuthnRequest
   */
  createAuthnRequest(config: {
    destination: string;
    requestId: string;
    ssoUrl: string;
    issuer: string;
    assertionConsumerService: string;
    nameIdFormat?: string;
    forceAuthn?: boolean;
    passive?: boolean;
  }): string {
    const authnRequest = {
      'samlp:AuthnRequest': {
        _attributes: {
          'xmlns:samlp': 'urn:oasis:names:tc:SAML:2.0:protocol',
          'xmlns:saml': 'urn:oasis:names:tc:SAML:2.0:assertion',
          'ID': config.requestId,
          'Version': '2.0',
          'IssueInstant': new Date().toISOString(),
          'Destination': config.destination,
          'ProtocolBinding': 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
          'AssertionConsumerServiceURL': config.assertionConsumerService,
          ...(config.forceAuthn && { 'ForceAuthn': 'true' }),
          ...(config.passive && { 'IsPassive': 'true' }),
        },
        'saml:Issuer': [{ _text: config.issuer }],
        'samlp:NameIDPolicy': [{
          _attributes: {
            'Format': config.nameIdFormat || 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
            'AllowCreate': 'true',
          },
        }],
        'samlp:RequestedAuthnContext': [{
          _attributes: {
            'Comparison': 'minimum',
          },
          'saml:AuthnContextClassRef': [{
            _text: 'urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport',
          }],
        }],
      },
    };

    const xml = js2xml(authnRequest, { compact: true, spaces: 2 });
    return Buffer.from(xml).toString('base64');
  }

  /**
   * Generate SAML logout request
   */
  createLogoutRequest(config: {
    destination: string;
    requestId: string;
    issuer: string;
    nameId: string;
    nameIdFormat?: string;
    sessionIndex?: string;
  }): string {
    const logoutRequest = {
      'samlp:LogoutRequest': {
        _attributes: {
          'xmlns:samlp': 'urn:oasis:names:tc:SAML:2.0:protocol',
          'xmlns:saml': 'urn:oasis:names:tc:SAML:2.0:assertion',
          'ID': config.requestId,
          'Version': '2.0',
          'IssueInstant': new Date().toISOString(),
          'Destination': config.destination,
        },
        'saml:Issuer': [{ _text: config.issuer }],
        'saml:NameID': [{
          _attributes: {
            'Format': config.nameIdFormat || 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
          },
          _text: config.nameId,
        }],
        ...(config.sessionIndex ? [{
          'samlp:SessionIndex': [{ _text: config.sessionIndex }],
        }] : []),
      },
    };

    const xml = js2xml(logoutRequest, { compact: true, spaces: 2 });
    return Buffer.from(xml).toString('base64');
  }
}
