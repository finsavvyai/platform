/**
 * Auth Routes - Shared types and imports
 */

export interface Env {
  DASHBOARD_DB: D1Database;
  DASHBOARD_CACHE: KVNamespace;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
}
