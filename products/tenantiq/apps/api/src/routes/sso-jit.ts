/**
 * SSO-04: Just-In-Time (JIT) provisioning for first-time SSO users.
 *
 * Uses INSERT OR IGNORE + re-fetch pattern to safely handle concurrent
 * assertions — see RESEARCH.md Pitfall 1 / Pattern 4.
 *
 * The caller (sso-callback.ts) passes c.env.DB as `db`.
 * This module is pure business logic: no Hono Context, no logging,
 * no rate-limiting — those belong at the route layer.
 */

/**
 * Upsert a platform_users row for the given SSO login and return the canonical user ID.
 *
 * @param db        - Cloudflare D1 database binding
 * @param orgId     - organization_id the user belongs to
 * @param email     - user's email address (globally unique in platform_users)
 * @param name      - display name; falls back to email when null
 * @param role      - RBAC role for new users; defaults to 'member'
 * @returns         - canonical platform_users.id (existing or newly created)
 */
export async function jitProvision(
	db: D1Database,
	orgId: string,
	email: string,
	name: string | null,
	role = 'member',
): Promise<string> {
	// Step 1: check if user already exists for this org+email
	const existing = await db
		.prepare('SELECT id FROM platform_users WHERE email = ? AND organization_id = ?')
		.bind(email, orgId)
		.first<{ id: string }>();

	if (existing) return existing.id;

	// Step 2: INSERT OR IGNORE — concurrent callers for the same email silently no-op
	const id = crypto.randomUUID();
	await db
		.prepare(
			`INSERT OR IGNORE INTO platform_users
        (id, organization_id, email, display_name, role, auth_provider, scope_level, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		)
		.bind(id, orgId, email, name ?? email, role, 'sso', 'org', Date.now())
		.run();

	// Step 3: re-fetch — returns canonical ID regardless of which concurrent caller won the insert
	const row = await db
		.prepare('SELECT id FROM platform_users WHERE email = ? AND organization_id = ?')
		.bind(email, orgId)
		.first<{ id: string }>();

	return row!.id;
}
