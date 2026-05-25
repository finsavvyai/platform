import { eq } from 'drizzle-orm';
import { getDb, schema } from '../../lib/db';

type DbClient = ReturnType<typeof getDb>;
type PlatformUser = typeof schema.platformUsers.$inferSelect;

export type OrganizationSummary = {
	id: string;
	name: string;
	slug: string;
	subscriptionTier: string;
	subscriptionStatus: string;
	maxUsers?: number | null;
	maxScansPerMonth?: number | null;
};

export function getBearerToken(authHeader: string | undefined): string | null {
	if (!authHeader || !authHeader.startsWith('Bearer ')) {
		return null;
	}
	return authHeader.substring(7);
}

export async function verifyBearerToken(token: string, jwtSecret: string): Promise<{ sub: string }> {
	const { verifyToken } = await import('../../lib/auth');
	return verifyToken(token, jwtSecret) as Promise<{ sub: string }>;
}

export async function findUserByEmail(db: DbClient, email: string): Promise<PlatformUser | null> {
	const users = await db
		.select()
		.from(schema.platformUsers)
		.where(eq(schema.platformUsers.email, email))
		.limit(1);

	return users[0] ?? null;
}

export async function findUserById(db: DbClient, userId: string): Promise<PlatformUser | null> {
	const users = await db
		.select()
		.from(schema.platformUsers)
		.where(eq(schema.platformUsers.id, userId))
		.limit(1);

	return users[0] ?? null;
}

export async function getOrganizationSummary(
	db: DbClient,
	organizationId: string,
	includeLimits = false
): Promise<OrganizationSummary | null> {
	const orgs = await db
		.select()
		.from(schema.organizations)
		.where(eq(schema.organizations.id, organizationId))
		.limit(1);

	if (orgs.length === 0) {
		return null;
	}

	return {
		id: orgs[0].id,
		name: orgs[0].name,
		slug: orgs[0].slug,
		subscriptionTier: orgs[0].subscriptionTier,
		subscriptionStatus: orgs[0].subscriptionStatus,
		...(includeLimits ? {
			maxUsers: orgs[0].maxUsers,
			maxScansPerMonth: orgs[0].maxScansPerMonth,
		} : {})
	};
}
