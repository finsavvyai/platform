import type { Context } from 'hono';
import type { AppEnv } from '../index';

/** Build the user payload shape returned by /auth/me + embedded in the JWT.
 *  Extracted from auth-callback-helpers to keep the parent file under the
 *  200-line portfolio cap after the org-merge logic was added. */
export async function buildUserPayload(
	c: Context<AppEnv>,
	user: Record<string, unknown>,
	orgId: string,
	tenantIds: string[],
	email: string,
	name: string,
) {
	const org = orgId
		? await c.env.DB.prepare('SELECT created_at, billing_plan FROM organizations WHERE id = ?')
				.bind(orgId)
				.first()
		: null;
	const userCreatedAt = Number(
		(user as { created_at?: number })?.created_at ?? Math.floor(Date.now() / 1000),
	);
	const billingPlan = String((org as { billing_plan?: string })?.billing_plan ?? 'trial');
	const trialEndsAt =
		billingPlan === 'trial' || billingPlan === 'free'
			? new Date(userCreatedAt * 1000 + 14 * 86400000).toISOString()
			: null;
	return {
		id: user.id,
		email,
		name,
		role: user.role,
		status: user.status ?? 'active',
		organizationId: orgId,
		tenantIds,
		plan: billingPlan,
		trialEndsAt,
		scopeLevel: (user as { scope_level?: string }).scope_level ?? 'admin',
	};
}
