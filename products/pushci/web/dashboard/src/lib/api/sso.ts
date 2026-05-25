import { apiFetch } from '../api-client';

export interface SamlConfig {
  ssoUrl: string;
  entityId: string;
  certFingerprint: string;
  updatedAt: string;
}

export interface SamlSpDetails {
  entityId: string;
  acsUrl: string;
  metadataUrl: string;
}

export interface SamlConfigResponse {
  configured: boolean;
  config?: SamlConfig;
  sp?: SamlSpDetails;
}

export interface SamlConfigInput {
  ssoUrl: string;
  entityId: string;
  cert: string;
}

export const ssoApi = {
  getSamlConfig: (tenant: string) =>
    apiFetch<SamlConfigResponse>(`/api/saml/${tenant}/config`),
  saveSamlConfig: (tenant: string, input: SamlConfigInput) =>
    apiFetch<{ ok: boolean }>(`/api/saml/${tenant}/config`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  generateScimToken: (tenant: string) =>
    apiFetch<{ tenant: string; token: string }>(`/scim/v2/token/${tenant}`, {
      method: 'POST',
    }),
};
