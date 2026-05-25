/** Shared env-derived config: single source of truth for API base URL.
 *  Consumed by api/client.ts, stores/auth.ts, and any component that
 *  needs login/callback URLs.
 *
 *  Reads PUBLIC_API_URL via import.meta.env. Vite's default envPrefix
 *  is VITE_, so vite.config.ts widens it to include PUBLIC_ for
 *  SvelteKit interop. apps/web/.env points PUBLIC_API_URL at
 *  http://localhost:8787 for local dev; prod Pages with no override
 *  falls through to the hard-coded api.tenantiq.app. */
const ENV_API_URL = import.meta.env.PUBLIC_API_URL as string | undefined;

export const API_BASE = ENV_API_URL
	? `${ENV_API_URL}/api`
	: 'https://api.tenantiq.app/api';

export const LOGIN_URL = `${API_BASE}/auth/login`;
export const LOGIN_PERSONAL_URL = `${API_BASE}/auth/login/personal`;
export const ONBOARD_ORG_URL = `${API_BASE}/auth/onboard-org`;
