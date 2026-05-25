import { getDb, schema } from '../../lib/db';
import { eq } from 'drizzle-orm';
import type { ProvisionTenantParams } from './types';

/**
 * Validate provisioning parameters before creating tenant
 */
export async function validateProvisioningParams(
	db: ReturnType<typeof getDb>,
	params: ProvisionTenantParams
): Promise<void> {
	// Validate slug is unique
	const existingOrg = await db
		.select()
		.from(schema.organizations)
		.where(eq(schema.organizations.slug, params.slug))
		.limit(1);

	if (existingOrg.length > 0) {
		throw new Error(`Organization with slug "${params.slug}" already exists`);
	}

	// Validate email is unique
	const existingUser = await db
		.select()
		.from(schema.platformUsers)
		.where(eq(schema.platformUsers.email, params.adminEmail))
		.limit(1);

	if (existingUser.length > 0) {
		throw new Error(`User with email "${params.adminEmail}" already exists`);
	}
}
