/**
 * OpenSyber API Reference — auto-generated from route files.
 *
 * Auth types:
 *   none         — public, no auth required
 *   bearer       — JWT in Authorization header
 *   bearer (X)   — JWT + specific RBAC permission X
 *   admin        — JWT + admin role required
 *   gateway-token — X-Gateway-Token + X-Instance-Id headers
 *   api-key      — X-API-Key header
 *   scim-token   — Bearer SCIM provisioning token
 *   svix-signature — Svix HMAC webhook verification
 *   hmac-signature — HMAC webhook verification
 */

import { authSection } from './api-reference-auth';
import {
  instancesSection,
  agentRegistrySection,
} from './api-reference-instances';
import {
  securityDashboardSection,
  vulnerabilitySection,
  alertSection,
} from './api-reference-security';
import { incidentSection } from './api-reference-incidents';
import {
  complianceSection,
  policySection,
} from './api-reference-compliance';
import { vaultSection } from './api-reference-vault';
import {
  marketplaceBrowseSection,
  marketplaceInstallSection,
  marketplacePublishSection,
  marketplaceRateSection,
  bundleSection,
  publicSkillSection,
} from './api-reference-marketplace';
import {
  orgSection,
  orgMemberSection,
  invitationSection,
  customRoleSection,
} from './api-reference-organizations';
import {
  ssoSection,
  dataResidencySection,
  slaSection,
} from './api-reference-org-access';
import {
  cloudAccountSection,
  cspmSection,
} from './api-reference-cloud';
import {
  multiCloudSection,
  saasSection,
} from './api-reference-cloud-saas';
import {
  agentMonitorSection,
  agentTeamSection,
} from './api-reference-agents';
import {
  agentReportSection,
  agentSecretAccessSection,
  nhiSection,
} from './api-reference-agents-extras';
import {
  integrationSection,
  connectorSection,
  notificationSection,
  apiKeySection,
  webhookLogSection,
} from './api-reference-integrations';
import { aiSection } from './api-reference-ai';
import { adminSection } from './api-reference-admin';
import {
  marketplaceAdminSection,
  scimSection,
} from './api-reference-admin-mp-scim';
import {
  webhookSection,
  gatewaySection,
} from './api-reference-webhooks';
import { publicSection } from './api-reference-public';
import {
  killChainSection,
  remediationSection,
  mcpSection,
  supplyChainSection,
} from './api-reference-advanced';
import {
  dataExportSection,
  ingestSection,
  costSection,
} from './api-reference-operations';
import {
  rulePackSection,
  uptimeSection,
  dlqSection,
} from './api-reference-ops-runtime';

export const apiReference = {
  sections: [
    publicSection,
    authSection,
    instancesSection,
    agentRegistrySection,
    securityDashboardSection,
    vulnerabilitySection,
    alertSection,
    incidentSection,
    policySection,
    complianceSection,
    vaultSection,
    agentMonitorSection,
    agentTeamSection,
    agentReportSection,
    agentSecretAccessSection,
    nhiSection,
    cloudAccountSection,
    cspmSection,
    multiCloudSection,
    saasSection,
    marketplaceBrowseSection,
    marketplaceInstallSection,
    marketplacePublishSection,
    marketplaceRateSection,
    bundleSection,
    publicSkillSection,
    orgSection,
    orgMemberSection,
    invitationSection,
    ssoSection,
    customRoleSection,
    dataResidencySection,
    slaSection,
    integrationSection,
    connectorSection,
    notificationSection,
    apiKeySection,
    webhookLogSection,
    aiSection,
    killChainSection,
    remediationSection,
    mcpSection,
    supplyChainSection,
    rulePackSection,
    uptimeSection,
    costSection,
    ingestSection,
    dlqSection,
    gatewaySection,
    webhookSection,
    adminSection,
    marketplaceAdminSection,
    scimSection,
    dataExportSection,
  ],
} as const;

export type ApiSection = (typeof apiReference.sections)[number];
export type ApiEndpoint = ApiSection['endpoints'][number];
