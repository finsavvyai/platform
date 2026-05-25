import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { organizations } from './organizations.js';
import { agentActivity } from './agent-activity.js';
import { users } from './users.js';

export const agentPolicies = sqliteTable('agent_policies', {
  id: text('id').primaryKey(),
  orgId: text('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  ruleType: text('rule_type', {
    enum: ['file_pattern', 'command_pattern', 'risk_threshold', 'secrets_threshold'],
  }).notNull(),
  ruleConfig: text('rule_config').notNull(), // JSON
  severity: text('severity', {
    enum: ['critical', 'high', 'medium', 'low'],
  }).notNull().default('high'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdBy: text('created_by').references(() => users.id),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

export const agentPolicyViolations = sqliteTable('agent_policy_violations', {
  id: text('id').primaryKey(),
  policyId: text('policy_id')
    .notNull()
    .references(() => agentPolicies.id, { onDelete: 'cascade' }),
  orgId: text('org_id')
    .notNull()
    .references(() => organizations.id),
  activityId: text('activity_id')
    .references(() => agentActivity.id),
  userId: text('user_id').references(() => users.id),
  severity: text('severity', {
    enum: ['critical', 'high', 'medium', 'low'],
  }).notNull(),
  summary: text('summary').notNull(),
  acknowledged: integer('acknowledged', { mode: 'boolean' }).notNull().default(false),
  acknowledgedBy: text('acknowledged_by').references(() => users.id),
  acknowledgedAt: text('acknowledged_at'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});
