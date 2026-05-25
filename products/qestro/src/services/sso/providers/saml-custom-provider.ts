import { ISSOProvider, SSOConfig, SSOUserInfo, SSOTokenResponse, SSOProviderType, SSOSamlConfig } from '../provider-manager';
import { SSOUtils } from '../utils/sso-utils';

export interface SamlCustomConfig extends SSOConfig {
  type: SSOProviderType.SAML_CUSTOM;
  saml: SSOSamlConfig;
  skipSignatureValidation?: boolean;
  allowedClockSkew?: number;
  authnRequestsSigned?: boolean;
  wantAssertionsSigned?: boolean;
  wantMessagesSigned?: boolean;
}

export interface SamlCustomUserInfo extends SSOUserInfo {
  sessionIndex?: string;
  nameId?: string;
  nameIdFormat?: string;
  nameIdNameQualifier?: string;
  nameIdSPNameQualifier?: string;
  authnInstant?: string;
  notOnOrAfter?: string;
  authnContextClassRef?: string[];
  attributes?: Record<string, string[]>;
}

export class SamlCustomProvider implements ISSOProvider {
  private config: SamlCustomConfig;
  private utils: SSOUtils;

  constructor(config: SamlCustomConfig) {
    this.config = config;
    this.utils = new SSOUtils(config);
  }

  async initialize(): Promise<void> {
    try {
      // Validate configuration
      await this.validateConfiguration();

      // Test IdP connection by fetching metadata
      await this.testConnection();
    } catch (error) {
      throw new Error(`SAML Custom provider initialization failed: ${error.message}`);
    }
  }

  async authenticate(samlRequest?: string, relayState?: string): Promise<{ redirectUrl: string; state?: string }> {
    try {
      // Generate SAML AuthnRequest
      const authnRequest = await this.generateAuthnRequest();

      // Encode and redirect to IdP
      const encodedRequest = await this.utils.encodeSAMLRequest(authnRequest);

      const redirectUrl = new URL(this.config.saml.idpSSOUrl);
      redirectUrl.searchParams.set('SAMLRequest', encodedRequest);

      if (relayState) {
        redirectUrl.searchParams.set('RelayState', relayState);
      }

      return {
        redirectUrl: redirectUrl.toString(),
        state: relayState,
      };
    } catch (error) {
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }

  async exchangeCodeForToken(code: string, state?: string): Promise<SSOTokenResponse> {
    // SAML doesn't use code exchange - this method is not applicable
    throw new Error('Code exchange not supported for SAML providers');
  }

  async getUserInfo(token: string): Promise<SamlCustomUserInfo> {
    try {
      // Parse SAML response (token is actually the SAML response)
      const samlResponse = await this.parseSAMLResponse(token);

      if (!samlResponse) {
        throw new Error('Failed to parse SAML response');
      }

      const assertions = samlResponse.assertions || [];
      if (assertions.length === 0) {
        throw new Error('No assertions found in SAML response');
      }

      const assertion = assertions[0];
      const subject = assertion.subject || {};
      const attributeStatement = assertion.attributeStatement || [];
      const authnStatement = assertion.authnStatement || [];
      const conditions = assertion.conditions || {};

      // Extract user information
      const userInfo: SamlCustomUserInfo = {
        id: subject.nameID || '',
        email: this.extractAttribute(attributeStatement, 'email') || '',
        name: this.extractAttribute(attributeStatement, 'name') ||
              this.extractAttribute(attributeStatement, 'displayName') ||
              this.extractAttribute(attributeStatement, 'cn') || '',
        firstName: this.extractAttribute(attributeStatement, 'firstName') ||
                  this.extractAttribute(attributeStatement, 'givenName') || '',
        lastName: this.extractAttribute(attributeStatement, 'lastName') ||
                 this.extractAttribute(attributeStatement, 'surname') || '',
        sessionIndex: authnStatement[0]?.sessionIndex,
        nameId: subject.nameID,
        nameIdFormat: subject.nameIDFormat,
        nameIdNameQualifier: subject.nameIDNameQualifier,
        nameIdSPNameQualifier: subject.nameIDSPNameQualifier,
        authnInstant: authnStatement[0]?.authnInstant,
        notOnOrAfter: conditions.notOnOrAfter,
        authnContextClassRef: authnStatement[0]?.authnContext?.authnContextClassRef,
        attributes: this.extractAllAttributes(attributeStatement),
      };

      // Map attributes based on configuration
      if (this.config.attributeMapping) {
        for (const [samlAttribute, userField] of Object.entries(this.config.attributeMapping)) {
          const value = this.extractAttribute(attributeStatement, samlAttribute);
          if (value) {
            (userInfo.attributes as any)[userField] = value;
          }
        }
      }

      return userInfo;
    } catch (error) {
      throw new Error(`User info extraction failed: ${error.message}`);
    }
  }

  async refreshToken(refreshToken: string): Promise<SSOTokenResponse> {
    // SAML doesn't use refresh tokens
    throw new Error('Refresh tokens not supported for SAML providers');
  }

  async revokeToken(token: string): Promise<void> {
    // SAML doesn't have token revocation - sessions are managed by IdP
    // Could implement Single Logout if supported by IdP
    await this.initiateSingleLogout(token);
  }

  async validateToken(token: string): Promise<boolean> {
    try {
      const samlResponse = await this.parseSAMLResponse(token);

      if (!samlResponse) {
        return false;
      }

      // Validate signature if required
      if (!this.config.skipSignatureValidation && !await this.validateSignature(samlResponse)) {
        return false;
      }

      // Validate conditions
      const conditions = samlResponse.assertions?.[0]?.conditions || {};

      // Check notBefore
      if (conditions.notBefore) {
        const notBefore = new Date(conditions.notBefore);
        const now = new Date();
        const allowedSkew = this.config.allowedClockSkew || 300000; // 5 minutes default

        if (now.getTime() < notBefore.getTime() - allowedSkew) {
          return false;
        }
      }

      // Check notOnOrAfter
      if (conditions.notOnOrAfter) {
        const notOnOrAfter = new Date(conditions.notOnOrAfter);
        const now = new Date();
        const allowedSkew = this.config.allowedClockSkew || 300000;

        if (now.getTime() > notOnOrAfter.getTime() + allowedSkew) {
          return false;
        }
      }

      // Validate audience
      if (conditions.audienceRestriction?.length > 0) {
        const validAudiences = conditions.audienceRestriction.map((ar: any) => ar.audience);
        if (!validAudiences.includes(this.config.saml.spEntityId)) {
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('Token validation failed:', error);
      return false;
    }
  }

  async logout(): Promise<void> {
    try {
      // Generate SAML LogoutRequest
      const logoutRequest = await this.generateLogoutRequest();

      // Encode and redirect to IdP
      const encodedRequest = await this.utils.encodeSAMLRequest(logoutRequest);

      const logoutUrl = new URL(this.config.saml.idpSLOUrl || this.config.saml.idpSSOUrl);
      logoutUrl.searchParams.set('SAMLRequest', encodedRequest);

      // Redirect to logout URL
      window.location.href = logoutUrl.toString();
    } catch (error) {
      throw new Error(`Logout failed: ${error.message}`);
    }
  }

  async getMetadata(): Promise<any> {
    try {
      // Generate SP metadata
      const metadata = {
        EntityDescriptor: {
          '@xmlns': 'urn:oasis:names:tc:SAML:2.0:metadata',
          '@xmlns:md': 'urn:oasis:names:tc:SAML:2.0:metadata',
          '@entityID': this.config.saml.spEntityId,
          'SPSSODescriptor': {
            '@protocolSupportEnumeration': 'urn:oasis:names:tc:SAML:2.0:protocol',
            '@AuthnRequestsSigned': this.config.authnRequestsSigned || false,
            '@WantAssertionsSigned': this.config.wantAssertionsSigned || false,
            'NameIDFormat': [
              'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
              'urn:oasis:names:tc:SAML:2.0:nameid-format:transient',
              'urn:oasis:names:tc:SAML:2.0:nameid-format:persistent',
            ],
            'AssertionConsumerService': [
              {
                '@index': '0',
                '@isDefault': 'true',
                '@Binding': 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
                '@Location': this.config.saml.spAssertionConsumerService,
              },
              {
                '@index': '1',
                '@Binding': 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect',
                '@Location': this.config.saml.spAssertionConsumerService,
              },
            ],
            'SingleLogoutService': [
              {
                '@Binding': 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect',
                '@Location': this.config.saml.spSingleLogoutService,
              },
              {
                '@Binding': 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
                '@Location': this.config.saml.spSingleLogoutService,
              },
            ],
          },
        },
      };

      return {
        metadata,
        supportedNameIdFormats: [
          'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
          'urn:oasis:names:tc:SAML:2.0:nameid-format:transient',
          'urn:oasis:names:tc:SAML:2.0:nameid-format:persistent',
          'urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified',
        ],
        supportedProtocols: ['urn:oasis:names:tc:SAML:2.0:protocol'],
        supportedBindings: [
          'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
          'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect',
        ],
        providerFeatures: {
          supportsSAML: true,
          supportsOIDC: false,
          supportsSingleLogout: !!this.config.saml.idpSLOUrl,
          supportsSignedAssertions: this.config.wantAssertionsSigned || false,
          supportsSignedRequests: this.config.authnRequestsSigned || false,
          supportsEncryptedAssertions: false, // Could be implemented
          supportsNameIdMapping: true,
          supportsAttributeMapping: true,
        },
      };
    } catch (error) {
      throw new Error(`Metadata generation failed: ${error.message}`);
    }
  }

  async healthCheck(): Promise<{ status: string; details?: any }> {
    try {
      // Test IdP metadata availability
      const response = await fetch(this.config.saml.idpMetadataUrl);

      if (!response.ok) {
        return {
          status: 'unhealthy',
          details: { error: 'IdP metadata not accessible', status: response.status },
        };
      }

      const metadata = await response.text();

      // Parse metadata to validate structure
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(metadata, 'text/xml');

      if (xmlDoc.querySelector('parsererror')) {
        return {
          status: 'unhealthy',
          details: { error: 'Invalid IdP metadata XML' },
        };
      }

      // Check for required SSO service
      const ssoService = xmlDoc.querySelector('IDPSSODescriptor SingleSignOnService[Binding*="HTTP-Redirect"]');
      if (!ssoService) {
        return {
          status: 'degraded',
          details: { error: 'SSO service not found in metadata' },
        };
      }

      return {
        status: 'healthy',
        details: {
          idpEntityId: xmlDoc.querySelector('EntityDescriptor')?.getAttribute('entityID'),
          ssoBinding: ssoService.getAttribute('Binding'),
          ssoLocation: ssoService.getAttribute('Location'),
          supportsSLO: !!xmlDoc.querySelector('IDPSSODescriptor SingleLogoutService'),
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: { error: error.message },
      };
    }
  }

  async updateConfig(newConfig: Partial<SamlCustomConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    await this.initialize();
  }

  getProviderType(): SSOProviderType {
    return SSOProviderType.SAML_CUSTOM;
  }

  getConfig(): SamlCustomConfig {
    return { ...this.config };
  }

  private async validateConfiguration(): Promise<void> {
    const required = ['saml'];
    const missing = required.filter(field => !this.config[field as keyof SamlCustomConfig]);

    if (missing.length > 0) {
      throw new Error(`Missing required configuration: ${missing.join(', ')}`);
    }

    const samlRequired = ['idpMetadataUrl', 'spEntityId', 'spAssertionConsumerService'];
    const samlMissing = samlRequired.filter(field => !this.config.saml[field as keyof SSOSamlConfig]);

    if (samlMissing.length > 0) {
      throw new Error(`Missing required SAML configuration: ${samlMissing.join(', ')}`);
    }
  }

  private async testConnection(): Promise<void> {
    try {
      const response = await fetch(this.config.saml.idpMetadataUrl);

      if (!response.ok) {
        throw new Error(`IdP metadata not accessible: ${response.statusText}`);
      }
    } catch (error) {
      throw new Error(`Connection test failed: ${error.message}`);
    }
  }

  private async generateAuthnRequest(): Promise<string> {
    const id = this.utils.generateId();
    const timestamp = new Date().toISOString();

    // This is a simplified SAML AuthnRequest template
    // In practice, you'd use a proper SAML library like xml-crypto or passport-saml
    const authnRequest = `
      <samlp:AuthnRequest
        xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
        xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
        ID="${id}"
        Version="2.0"
        IssueInstant="${timestamp}"
        Destination="${this.config.saml.idpSSOUrl}"
        AssertionConsumerServiceURL="${this.config.saml.spAssertionConsumerService}"
        ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST">
        <saml:Issuer>${this.config.saml.spEntityId}</saml:Issuer>
        <samlp:NameIDPolicy AllowCreate="true" Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress"/>
        <samlp:RequestedAuthnContext Comparison="minimum">
          <saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef>
        </samlp:RequestedAuthnContext>
      </samlp:AuthnRequest>
    `.trim();

    return authnRequest;
  }

  private async generateLogoutRequest(): Promise<string> {
    const id = this.utils.generateId();
    const timestamp = new Date().toISOString();

    const logoutRequest = `
      <samlp:LogoutRequest
        xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
        xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
        ID="${id}"
        Version="2.0"
        IssueInstant="${timestamp}"
        Destination="${this.config.saml.idpSLOUrl || this.config.saml.idpSSOUrl}">
        <saml:Issuer>${this.config.saml.spEntityId}</saml:Issuer>
        <saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">user@example.com</saml:NameID>
      </samlp:LogoutRequest>
    `.trim();

    return logoutRequest;
  }

  private async parseSAMLResponse(samlResponse: string): Promise<any> {
    // This is a simplified parser - in practice, use a proper SAML library
    try {
      // Decode if URL encoded
      if (samlResponse.startsWith('%') || samlResponse.includes('%')) {
        samlResponse = decodeURIComponent(samlResponse);
      }

      // Parse XML
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(samlResponse, 'text/xml');

      if (xmlDoc.querySelector('parsererror')) {
        throw new Error('Invalid SAML response XML');
      }

      // Extract basic information (simplified)
      const assertion = xmlDoc.querySelector('Assertion');
      if (!assertion) {
        throw new Error('No assertion found in SAML response');
      }

      return {
        assertions: [{
          subject: {
            nameID: assertion.querySelector('Subject NameID')?.textContent,
            nameIDFormat: assertion.querySelector('Subject NameID')?.getAttribute('Format'),
          },
          attributeStatement: Array.from(assertion.querySelectorAll('AttributeStatement Attribute')).map(attr => ({
            name: attr.getAttribute('Name'),
            values: Array.from(attr.querySelectorAll('AttributeValue')).map(value => value.textContent),
          })),
          authnStatement: [{
            sessionIndex: assertion.querySelector('AuthnStatement')?.getAttribute('SessionIndex'),
            authnInstant: assertion.querySelector('AuthnStatement')?.getAttribute('AuthnInstant'),
          }],
          conditions: {
            notBefore: assertion.querySelector('Conditions')?.getAttribute('NotBefore'),
            notOnOrAfter: assertion.querySelector('Conditions')?.getAttribute('NotOnOrAfter'),
          },
        }],
      };
    } catch (error) {
      throw new Error(`SAML response parsing failed: ${error.message}`);
    }
  }

  private async validateSignature(samlResponse: any): Promise<boolean> {
    // In practice, you'd validate the signature using the IdP's certificate
    // This is a placeholder that should be implemented with proper crypto
    return true;
  }

  private extractAttribute(attributeStatement: any[], attributeName: string): string | null {
    const attribute = attributeStatement.find(attr => attr.name === attributeName);
    return attribute?.values?.[0] || null;
  }

  private extractAllAttributes(attributeStatement: any[]): Record<string, string[]> {
    const attributes: Record<string, string[]> = {};

    for (const attribute of attributeStatement) {
      attributes[attribute.name] = attribute.values || [];
    }

    return attributes;
  }

  private async initiateSingleLogout(samlResponse: string): Promise<void> {
    try {
      const parsedResponse = await this.parseSAMLResponse(samlResponse);
      const sessionIndex = parsedResponse.assertions[0]?.authnStatement[0]?.sessionIndex;

      if (sessionIndex) {
        await this.generateLogoutRequest();
      }
    } catch (error) {
      console.warn('Single logout failed:', error.message);
    }
  }
}
