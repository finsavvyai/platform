/** Shared env-derived config — single source of truth for API base URL.
 *  Consumed by api/client.ts, stores/auth.ts, and any component that
 *  needs login/callback URLs. */

export const API_BASE = import.meta.env.PUBLIC_API_URL
	? `${import.meta.env.PUBLIC_API_URL}/api`
	: 'https://api.tenantiq.app/api';

export const LOGIN_URL = `${API_BASE}/auth/login`;
export const LOGIN_PERSONAL_URL = `${API_BASE}/auth/login/personal`;
export const ONBOARD_ORG_URL = `${API_BASE}/auth/onboard-org`;
