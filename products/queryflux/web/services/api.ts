// Barrel file — re-exports all domain-specific API modules.
// Consumers can continue using: import { connectionAPI } from '../services/api'
// or: import api from '../services/api'

export { connectionAPI, schemaAPI } from './connection-api';
export { queryAPI } from './query-api';
export { authAPI, healthAPI, serverMetricsAPI } from './auth-api';
export type { LoginResponse, ServerMetrics } from './auth-api';
export { nlpAPI } from './nlp-api';

import { connectionAPI } from './connection-api';
import { schemaAPI } from './connection-api';
import { queryAPI } from './query-api';
import { authAPI, healthAPI, serverMetricsAPI } from './auth-api';
import { nlpAPI } from './nlp-api';

export const api = {
    connections: connectionAPI,
    queries: queryAPI,
    schema: schemaAPI,
    health: healthAPI,
    nlp: nlpAPI,
    auth: authAPI,
    serverMetrics: serverMetricsAPI,
};

export default api;
