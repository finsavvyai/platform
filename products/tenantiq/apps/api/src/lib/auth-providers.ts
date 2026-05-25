/**
 * OAuth / OpenID provider configuration. Extracted from constants.ts to
 * keep that file under the 200-line cap and to keep provider settings
 * collocated.
 */

// ─── LinkedIn OAuth (secondary sign-in) ─────────────────────────────────────

export const LINKEDIN = {
	AUTHORIZE_URL: 'https://www.linkedin.com/oauth/v2/authorization',
	TOKEN_URL: 'https://www.linkedin.com/oauth/v2/accessToken',
	USERINFO_URL: 'https://api.linkedin.com/v2/userinfo',
	SCOPES: ['openid', 'profile', 'email'].join(' '),
} as const;

// ─── Personal (non-admin) Microsoft sign-in — user-only delegated scopes ──
// All are user-consentable. Microsoft blocks `.All` scopes for non-admins
// at the /authorize endpoint, so this set cannot expose anyone else's data.
export const GRAPH_PERSONAL_SCOPES = [
	'openid',
	'profile',
	'email',
	'offline_access',
	'User.Read',
	'Mail.Read',
	'Files.Read',
	'Calendars.Read',
].join(' ');
