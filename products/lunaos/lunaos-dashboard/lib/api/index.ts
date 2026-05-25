/**
 * LunaOS Dashboard — API barrel export
 * Re-exports all service modules for backward-compatible `@/lib/api` imports.
 */

export { getAuthToken, setAuthToken, removeAuthToken } from './client';
export { authApi } from './auth';
export { agentsApi } from './agents';
export { healthApi } from './health';
export { billingApi } from './billing';
export { apiKeysApi } from './api-keys';
export { githubApi } from './github';
export { telemetryApi } from './telemetry';
export { chainsApi } from './chains';
export { servicesApi } from './services';
export { kbApi } from './kb';

export type { User, Agent, Execution, PromptVariant, CustomAgent } from './types';
export type { Subscription, Usage } from './billing';
export type { ApiKey } from './api-keys';
export type { GitHubStatus, GitHubRepo, IndexedRepo } from './github';
export type { VariantStats, AgentStats, ProviderStats, OverviewMetrics } from './telemetry';
export type { ChainNode, PresetChain, ChainExecution } from './chains';
export type { ServiceInfo, ServicesCatalog, ChannelConnection, ProviderInfo, ServiceHealth } from './services';
export type { KBDocument } from './kb';
export { ssoApi } from './sso';
export type { IdentityProvider, CreateIdpInput, SsoDiscoveryResult, SsoInitiateResult, IdpType, DefaultRole } from './sso';
