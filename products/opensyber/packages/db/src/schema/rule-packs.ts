import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { instances } from './instances.js';

export const policyRulePacks = sqliteTable('policy_rule_packs', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  category: text('category', {
    enum: ['ai_security', 'cloud_posture', 'dev_environment', 'compliance'],
  }).notNull(),
  rules: text('rules').notNull(),
  severity: text('severity', {
    enum: ['critical', 'high', 'medium', 'low'],
  })
    .notNull()
    .default('medium'),
  isBuiltIn: integer('is_built_in', { mode: 'boolean' }).default(true),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const installedRulePacks = sqliteTable('installed_rule_packs', {
  id: text('id').primaryKey(),
  instanceId: text('instance_id')
    .notNull()
    .references(() => instances.id),
  packId: text('pack_id')
    .notNull()
    .references(() => policyRulePacks.id),
  installedAt: text('installed_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
});
