import type { IntegrationDefinition } from '../types/integration.js';
import { cloudIntegrations } from './integrations/cloud.js';
import { ideIntegrations } from './integrations/ide.js';
import { aiAgentIntegrations } from './integrations/ai-agents.js';
import { devopsIntegrations } from './integrations/devops.js';
import { communicationIntegrations } from './integrations/communication.js';
import { identityIntegrations } from './integrations/identity.js';
import { productivityIntegrations } from './integrations/productivity.js';
import { monitoringIntegrations } from './integrations/monitoring.js';

export { cloudIntegrations } from './integrations/cloud.js';
export { ideIntegrations } from './integrations/ide.js';
export { aiAgentIntegrations } from './integrations/ai-agents.js';
export { devopsIntegrations } from './integrations/devops.js';
export { communicationIntegrations } from './integrations/communication.js';
export { identityIntegrations } from './integrations/identity.js';
export { productivityIntegrations } from './integrations/productivity.js';
export { monitoringIntegrations } from './integrations/monitoring.js';

export const INTEGRATIONS_CATALOG: IntegrationDefinition[] = [
  ...cloudIntegrations,
  ...ideIntegrations,
  ...aiAgentIntegrations,
  ...devopsIntegrations,
  ...communicationIntegrations,
  ...identityIntegrations,
  ...productivityIntegrations,
  ...monitoringIntegrations,
];

export function getIntegrationBySlug(
  slug: string,
): IntegrationDefinition | undefined {
  return INTEGRATIONS_CATALOG.find((i) => i.slug === slug);
}

export function getIntegrationsByCategory(
  category: string,
): IntegrationDefinition[] {
  return INTEGRATIONS_CATALOG.filter((i) => i.category === category);
}
