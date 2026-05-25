import type { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import {
  health, instanceRoutes, instanceActionRoutes, instanceSkillRoutes, instanceEventRoutes, instanceTokenRoutes, skillRoutes,
  securityDashboardRoutes, securityNetworkRoutes, securityVulnRoutes,
  gatewaySecurityRoutes, gatewaySecurityInfraRoutes, policyRoutes, gatewayPolicyRoutes,
  incidentRoutes, incidentEventRoutes, alertRoutes, notificationChannelRoutes,
  complianceRoutes, complianceExportRoutes, userRoutes, webhookRoutes, agentRoutes,
  badgeRoutes, vaultRoutes, gatewayVaultRoutes, orgRoutes, orgInvitationRoutes,
  orgMemberRoutes, ssoConfigRoutes, ssoSamlRoutes, ssoOidcRoutes, uptimeRoutes,
  slaConfigRoutes, dataResidencyRoutes, threatRoutes, scoreRoutes,
  achievementAuthRoutes, achievementPublicRoutes, agentMonitorRoutes, agentMonitorSyncRoutes,
  cloudAccountRoutes, cloudSetupRoutes, cloudValidateRoutes,
  cspmScanRoutes, cspmFindingRoutes, unifiedFindingRoutes, ztnaAppRoutes, dnsTenantRoutes, runbookRoutes, cspmRiskRoutes, saasAccountRoutes, saasOauthRoutes,
  agentTeamRoutes, agentTeamUserRoutes, agentRiskTrendRoutes, teamTrendRoutes,
  teamUserTrendRoutes, agentSessionRoutes, agentPolicyRoutes, agentReportRoutes,
  alertChannelRoutes, agentActivityFindingsRoutes, assetRoutes, assetRelationRoutes,
  attackPathRoutes, oasfComplianceRoutes, vaultRotationRoutes, jitAccessRoutes,
  agentSecretAccessRoutes, aiQueryRoutes, aiTriageRoutes, aiInsightRoutes,
  remediationPlaybookRoutes, remediationRunRoutes, agentSuspendRoutes, multiCloudRoutes,
  soc2EvidenceRoutes, platformHealthRoutes, trustEventRoutes, registerAdminRoutes,
  integrationRoutes, integrationHealthRoutes, integrationWebhookRoutes, rulePackRoutes,
  dlqRoutes, ingestRoutes, apiKeyRoutes, sloDashboardRoutes, killChainRoutes,
  mcpMonitoringRoutes, otelIngestRoutes, complianceAiRoutes, agentRegistryRoutes,
  supplyChainRoutes, skillRecommendationRoutes, connectorRoutes, dataExportRoutes,
  webhookLogRoutes, metricsDataroomRoutes, semanticSearchRoutes, traceRoutes,
  aiExplainRoutes, aiChatRoutes, registerFeatureRoutes, customRoleRoutes,
  complianceEvidenceRoutes, agentDiscoveryRoutes, skillSignatureRoutes,
  detectionTestRoutes, threatIntelRoutes, tfBindRoutes, onboardingRoutes,
} from './register-imports.js';

type App = Hono<{ Bindings: Env; Variables: Variables }>;

export function registerRoutes(app: App): void {
  app.route('/api/tf', tfBindRoutes);
  app.route('/api/agent', agentRoutes);
  app.route('/api/agent/security', gatewaySecurityRoutes);
  app.route('/api/agent/security', gatewaySecurityInfraRoutes);
  app.route('/api/agent/security', gatewayPolicyRoutes);
  app.route('/api/agent', gatewayVaultRoutes);
  app.route('/health', health);
  app.route('/webhooks', webhookRoutes);
  app.route('/api/badges', badgeRoutes);
  app.route('/api/threats', threatRoutes);
  app.route('/api/score', scoreRoutes);
  app.route('/api/achievements', achievementPublicRoutes);
  app.route('/api/trust', trustEventRoutes);
  app.route('/api/user', userRoutes);
  app.route('/api/onboarding', onboardingRoutes);
  app.route('/api/instances', instanceEventRoutes);
  app.route('/api/instances', instanceTokenRoutes);
  app.route('/api/instances', instanceRoutes);
  app.route('/api/instances', instanceActionRoutes);
  app.route('/api/instances', instanceSkillRoutes);
  app.route('/api/skills', skillRoutes);
  app.route('/api/security', achievementAuthRoutes);
  app.route('/api/security', securityDashboardRoutes);
  app.route('/api/security', securityNetworkRoutes);
  app.route('/api/security', securityVulnRoutes);
  app.route('/api/security', policyRoutes);
  app.route('/api/security', incidentRoutes);
  app.route('/api/security', incidentEventRoutes);
  app.route('/api/security', alertRoutes);
  app.route('/api/security', complianceRoutes);
  app.route('/api/security', notificationChannelRoutes);
  app.route('/api/security', complianceExportRoutes);
  app.route('/api/security', uptimeRoutes);
  app.route('/api/organizations', orgRoutes);
  app.route('/api/organizations', orgInvitationRoutes);
  app.route('/api/organizations', orgMemberRoutes);
  app.route('/api/organizations', ssoConfigRoutes);
  app.route('/api/organizations', slaConfigRoutes);
  app.route('/api/organizations', dataResidencyRoutes);
  app.route('/api/organizations', customRoleRoutes);
  app.route('/api/sso', ssoSamlRoutes);
  app.route('/api/sso', ssoOidcRoutes);
  app.route('/api/cloud', cloudAccountRoutes);
  app.route('/api/cloud', cloudSetupRoutes);
  app.route('/api/cloud', cloudValidateRoutes);
  app.route('/api/cloud', cspmScanRoutes);
  app.route('/api/cloud', cspmFindingRoutes);
  app.route('/api/cloud', cspmRiskRoutes);
  app.route('/api/findings', unifiedFindingRoutes);
  app.route('/api/ztna', ztnaAppRoutes);
  app.route('/api/dns', dnsTenantRoutes);
  // WIP: uncomment when orchestrator packages are built
  // app.route('/api/swg', swgTenantRoutes);
  // app.route('/api/wlp', wlpAgentRoutes);
  // app.route('/api/rbi', rbiTenantRoutes);
  // app.route('/api/rbi', rbiSessionRoutes);
  app.route('/api/runbooks', runbookRoutes);
  // WIP: uncomment when tokenforge WebAuthn export is ready
  // app.route('/api/tf', tfBindRoutes);
  app.route('/api/saas', saasAccountRoutes);
  app.route('/api/saas', saasOauthRoutes);
  app.route('/api/agents', agentTeamRoutes);
  app.route('/api/agents', agentTeamUserRoutes);
  app.route('/api/agents', agentRiskTrendRoutes);
  app.route('/api/agents/team', teamTrendRoutes);
  app.route('/api/agents/team', teamUserTrendRoutes);
  app.route('/api/agents', agentSessionRoutes);
  app.route('/api/agents', agentPolicyRoutes);
  app.route('/api/agents', agentReportRoutes);
  app.route('/api/agents', agentMonitorRoutes);
  app.route('/api/agents/monitor', agentMonitorSyncRoutes);
  app.route('/api/activity', agentActivityFindingsRoutes);
  app.route('/api/agents', agentSecretAccessRoutes);
  app.route('/api/alert-channels', alertChannelRoutes);
  app.route('/api/assets', assetRoutes);
  app.route('/api/asset-relations', assetRelationRoutes);
  app.route('/api/attack-paths', attackPathRoutes);
  app.route('/api/oasf', oasfComplianceRoutes);
  app.route('/api/vault', vaultRotationRoutes);
  app.route('/api/vault', jitAccessRoutes);
  app.route('/api/ai', aiQueryRoutes);
  app.route('/api/ai', aiTriageRoutes);
  app.route('/api/ai', aiInsightRoutes);
  app.route('/api/ai', aiExplainRoutes);
  app.route('/api/ai', aiChatRoutes);
  app.route('/api/remediation', remediationPlaybookRoutes);
  app.route('/api/remediation', remediationRunRoutes);
  app.route('/api/agents', agentSuspendRoutes);
  app.route('/api/cloud', multiCloudRoutes);
  app.route('/api/soc2', soc2EvidenceRoutes);
  app.route('/api/platform', platformHealthRoutes);
  app.route('/api/integrations', integrationRoutes);
  app.route('/api/integrations/health', integrationHealthRoutes);
  app.route('/api/integrations/slo', sloDashboardRoutes);
  app.route('/api/kill-chain', killChainRoutes);
  app.route('/webhooks/integrations', integrationWebhookRoutes);
  app.route('/api/rule-packs', rulePackRoutes);
  app.route('/api/dlq', dlqRoutes);
  app.route('/api/ingest', ingestRoutes);
  app.route('/api/keys', apiKeyRoutes);
  app.route('/api/mcp', mcpMonitoringRoutes);
  app.route('/api/otel', otelIngestRoutes);
  app.route('/api/compliance/ai', complianceAiRoutes);
  app.route('/api/compliance/evidence', complianceEvidenceRoutes);
  app.route('/api/registry', agentRegistryRoutes);
  app.route('/api/supply-chain', supplyChainRoutes);
  app.route('/api/marketplace', skillRecommendationRoutes);
  app.route('/api/search', semanticSearchRoutes);
  app.route('/api/admin/traces', traceRoutes);
  app.route('/api/connectors', connectorRoutes);
  app.route('/api/export', dataExportRoutes);
  app.route('/api/webhooks', webhookLogRoutes);
  app.route('/api/metrics', metricsDataroomRoutes);
  app.route('/api/discovery', agentDiscoveryRoutes);
  app.route('/api/skills', skillSignatureRoutes);
  app.route('/api/detection-tests', detectionTestRoutes);
  app.route('/api/threat-intel', threatIntelRoutes);
  registerFeatureRoutes(app);
  registerAdminRoutes(app);
  app.route('/api', vaultRoutes);
}
