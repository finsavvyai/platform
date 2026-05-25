export type { IntegrationCategory, Integration, ConfigField } from './integrations-types';
export { CATEGORY_META } from './integrations-types';

import type { Integration } from './integrations-types';
import { cloudIntegrations } from './data/cloud';
import { ideIntegrations, aiAgentIntegrations } from './data/ide-and-agents';
import { devopsIntegrations, communicationIntegrations, identityIntegrations } from './data/devops-comm-identity';
import { productivityIntegrations, monitoringIntegrations } from './data/productivity-monitoring';

export const INTEGRATIONS: Integration[] = [
  ...cloudIntegrations,
  ...ideIntegrations,
  ...aiAgentIntegrations,
  ...devopsIntegrations,
  ...communicationIntegrations,
  ...identityIntegrations,
  ...productivityIntegrations,
  ...monitoringIntegrations,
];

export function getIntegrationBySlug(slug: string): Integration | undefined {
  return INTEGRATIONS.find((i) => i.slug === slug);
}
