import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * OpenSyber outbound integrations.
 *
 * Per-org configuration for forwarding tenantiq alert candidates to an
 * OpenSyber webhook receiver. Mirrors migrations/0011_opensyber_integrations.sql
 * and packages/db/src/schema-d1.ts:tfOpensyberIntegrations.
 */
export const tfOpensyberIntegrations = sqliteTable(
	'tf_opensyber_integrations',
	{
		id: text('id').primaryKey(),
		orgId: text('org_id').notNull(),
		opensyberUrl: text('opensyber_url').notNull(),
		secretEncrypted: text('secret_encrypted').notNull(),
		connectionName: text('connection_name').notNull(),
		status: text('status').notNull().default('active'), // 'active' | 'paused'
		createdAt: integer('created_at').notNull(),
	},
	(table) => [
		index('idx_tf_opensyber_org').on(table.orgId),
		index('idx_tf_opensyber_status').on(table.status),
		uniqueIndex('idx_tf_opensyber_org_conn').on(table.orgId, table.connectionName),
	],
);

export type TfOpensyberIntegrationRow = typeof tfOpensyberIntegrations.$inferSelect;
