// SAML 2.0 type definitions for PushCI Service Provider.

export interface AuthnRequestInput {
  spEntityId: string;
  acsUrl: string;
  idpSsoUrl: string;
  relayState?: string;
}

export interface AuthnRequestResult {
  url: string;
  relayState: string;
  id: string;
}

export interface SamlValidateInput {
  idpCert: string; // PEM-encoded x509
  spEntityId: string;
  acsUrl: string;
  clockSkewSec?: number;
}

export interface SamlAssertion {
  nameId: string;
  email: string;
  attributes: Record<string, string>;
  sessionIndex: string | null;
  issuer: string;
}
