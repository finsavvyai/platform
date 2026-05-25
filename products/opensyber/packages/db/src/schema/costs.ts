import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ─── Agent Cost Events ──────────────────────────────────────────────────────────

export const agentCostEvents = sqliteTable('agent_cost_events', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull(),
  instanceId: text('instance_id'),
  provider: text('provider').notNull(),
  model: text('model').notNull(),
  inputTokens: integer('input_tokens').notNull().default(0),
  outputTokens: integer('output_tokens').notNull().default(0),
  costMicros: integer('cost_micros').notNull().default(0),
  skillId: text('skill_id'),
  requestId: text('request_id'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

// ─── Agent Cost Budgets ─────────────────────────────────────────────────────────

export const agentCostBudgets = sqliteTable('agent_cost_budgets', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull(),
  budgetType: text('budget_type', { enum: ['daily', 'weekly', 'monthly'] }).notNull(),
  limitMicros: integer('limit_micros').notNull(),
  currentMicros: integer('current_micros').notNull().default(0),
  killSwitch: integer('kill_switch', { mode: 'boolean' }).notNull().default(false),
  alertThresholdPct: integer('alert_threshold_pct').notNull().default(80),
  periodStart: text('period_start').notNull(),
  periodEnd: text('period_end').notNull(),
  status: text('status', { enum: ['active', 'exceeded', 'paused'] }).notNull().default('active'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});
