import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { organizations } from './organizations.js';

export const customRoles = sqliteTable(
  'custom_roles',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    /** JSON array of Permission strings, e.g. ["instance.view","skill.install"] */
    permissions: text('permissions').notNull(),
    isDefault: integer('is_default').notNull().default(0),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [index('idx_custom_roles_org').on(table.orgId)],
);
