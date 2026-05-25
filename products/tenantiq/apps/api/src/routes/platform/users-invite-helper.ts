import { nanoid } from 'nanoid';
import type { Env } from '../../index';
import { getDb, schema } from '../../lib/db';

/**
 * Create a pending invitation row for a newly-provisioned user. Returns the
 * raw token so the caller can email it — the token is intentionally not
 * stored in any log channel (it grants account access).
 */
export async function createInvitation(
	env: Env,
	input: {
		email: string;
		role: string;
		organizationId: string;
		invitedBy: string;
		invitedAt: string;
	},
): Promise<string> {
	const db = getDb(env);
	const invitationToken = nanoid(32);
	const expiresAt = new Date();
	expiresAt.setDate(expiresAt.getDate() + 7);

	await db.insert(schema.invitations).values({
		id: nanoid(),
		organizationId: input.organizationId,
		email: input.email,
		role: input.role,
		token: invitationToken,
		status: 'pending',
		invitedBy: input.invitedBy,
		invitedAt: input.invitedAt,
		expiresAt: expiresAt.toISOString(),
	});

	// Log only a short fingerprint; never the raw token.
	console.log(
		`Invitation created for ${input.email} (token fingerprint): ${invitationToken.slice(0, 4)}…`,
	);

	return invitationToken;
}
