/**
 * Type definitions for Worker environment and context
 */

import type { User, AuthContext } from './auth-secure';

// Extend Hono's Context to include our custom variables
declare module 'hono' {
  interface ContextVariableMap {
    user: User | null;
    auth: AuthContext;
    apiKey?: {
      id: string;
      scopes: string[];
      rateLimit: number;
    };
  }
}

// Environment bindings
export interface Env {
  // SDLC service bindings
  SDLC_GATEWAY: Fetcher;
  SDLC_RAG: Fetcher;
  SDLC_VECTOR: Fetcher;

  // Storage bindings
  DASHBOARD_CACHE: KVNamespace;
  DASHBOARD_DB: D1Database;
  DASHBOARD_ASSETS: R2Bucket;
  DASHBOARD_ANALYTICS: AnalyticsEngineDataset;

  // Durable Object binding
  DASHBOARD_REALTIME: DurableObjectNamespace;

  // Secrets
  JWT_SECRET: string;

  // Environment variables
  ENVIRONMENT: string;
  API_VERSION: string;
  ENABLE_ANALYTICS: string;
  ENABLE_CACHING: string;
  CACHE_TTL: string;
  RATE_LIMIT_PER_MINUTE: string;
  CORS_ALLOWED_ORIGINS: string;
}
