/**
 * Drizzle schema definitions for OpenSyber database.
 * Defines users, tokens, subscriptions, and sessions tables.
 */

import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  role: text('role', { enum: ['user', 'admin'] }).notNull().default('user'),
  created_at: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updated_at: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const tokens = sqliteTable('tokens', {
  id: text('id').primaryKey(),
  user_id: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expires_at: integer('expires_at', { mode: 'timestamp' }).notNull(),
  created_at: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const subscriptions = sqliteTable('subscriptions', {
  id: text('id').primaryKey(),
  user_id: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' })
    .unique(),
  plan: text('plan', { enum: ['free', 'pro', 'enterprise'] }).notNull().default('free'),
  status: text('status', { enum: ['active', 'expired', 'cancelled'] }).notNull().default('active'),
  started_at: integer('started_at', { mode: 'timestamp' }).notNull(),
  expires_at: integer('expires_at', { mode: 'timestamp' }).notNull(),
  created_at: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updated_at: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  user_id: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  ip: text('ip').notNull(),
  user_agent: text('user_agent').notNull(),
  created_at: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  expires_at: integer('expires_at', { mode: 'timestamp' }).notNull(),
});
