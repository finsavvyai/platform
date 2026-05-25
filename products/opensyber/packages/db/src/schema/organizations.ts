import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';

export const organizations = sqliteTable('organizations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  ownerId: text('owner_id')
    .notNull()
    .references(() => users.id),
  plan: text('plan', { enum: ['free', 'personal', 'pro', 'team'] })
    .notNull()
    .default('free'),
  maxInstances: integer('max_instances').notNull().default(1),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const orgMembers = sqliteTable('org_members', {
  id: text('id').primaryKey(),
  orgId: text('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  /** Built-in role name ('owner','admin',...) or custom role UUID */
  role: text('role').notNull().default('viewer'),
  invitedBy: text('invited_by').references(() => users.id),
  invitedAt: text('invited_at').notNull(),
  acceptedAt: text('accepted_at'),
  status: text('status', {
    enum: ['pending', 'active', 'removed'],
  })
    .notNull()
    .default('pending'),
});

export const orgInvitations = sqliteTable('org_invitations', {
  id: text('id').primaryKey(),
  orgId: text('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  role: text('role', {
    enum: ['owner', 'admin', 'security', 'developer', 'viewer'],
  })
    .notNull()
    .default('viewer'),
  invitedBy: text('invited_by')
    .notNull()
    .references(() => users.id),
  token: text('token').notNull().unique(),
  expiresAt: text('expires_at').notNull(),
  acceptedAt: text('accepted_at'),
  status: text('status', {
    enum: ['pending', 'accepted', 'expired', 'cancelled'],
  })
    .notNull()
    .default('pending'),
});
