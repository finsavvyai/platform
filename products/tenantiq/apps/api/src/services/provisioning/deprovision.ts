import { nanoid } from 'nanoid';
import type { Env } from '../../index';
import { getDb, schema } from '../../lib/db';
import { eq } from 'drizzle-orm';

/**
 * Deprovision a tenant
 *
 * Soft-deletes the organization and all related data
 */
export async function deprovisionTenant(
	env: Env,
	organizationId: string,
	deprovisionedBy: string
): Promise<void> {
	const db = getDb(env);
	const now = new Date().toISOString();

	try {
		// Soft delete organization
		await db
			.update(schema.organizations)
			.set({
				status: 'deleted',
				deletedAt: now,
				updatedAt: now,
			})
			.where(eq(schema.organizations.id, organizationId));

		// Soft delete all users
		await db
			.update(schema.platformUsers)
			.set({
				status: 'deleted',
				deletedAt: now,
				updatedAt: now,
			})
			.where(eq(schema.platformUsers.organizationId, organizationId));

		// Cancel subscriptions
		await db
			.update(schema.subscriptions)
			.set({
				status: 'cancelled',
				cancelledAt: now,
				updatedAt: now,
			})
			.where(eq(schema.subscriptions.organizationId, organizationId));

		// Create audit log
		await db.insert(schema.auditLogs).values({
			id: nanoid(),
			tenantId: organizationId,
			eventType: 'tenant_deprovisioned',
			actorId: deprovisionedBy,
			actorType: 'platform_admin',
			resourceId: organizationId,
			resourceType: 'organization',
			action: 'delete',
			result: 'success',
			timestamp: now,
			complianceCategory: 'administrative',
		});

		console.log(`Tenant ${organizationId} deprovisioned successfully`);
	} catch (error) {
		console.error('Failed to deprovision tenant:', error);
		throw new Error(`Tenant deprovisioning failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
}
