/**
 * LunaOS Dashboard — API Client
 * Split into focused modules under ./api/. This file re-exports everything
 * so existing `@/lib/api` imports continue to work unchanged.
 */
export * from './api/index';

import { authApi } from './api/auth';
import { agentsApi } from './api/agents';
import { healthApi } from './api/health';
import { billingApi } from './api/billing';
import { apiKeysApi } from './api/api-keys';
import { githubApi } from './api/github';
import { telemetryApi } from './api/telemetry';
import { chainsApi } from './api/chains';
import { servicesApi } from './api/services';
import { kbApi } from './api/kb';

export default { authApi, agentsApi, healthApi, billingApi, apiKeysApi, githubApi, telemetryApi, chainsApi, servicesApi, kbApi };
