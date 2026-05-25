import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';

export const agentRegistry = sqliteTable('agent_registry', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  instanceId: text('instance_id'),
  name: text('name').notNull(),
  source: text('source', {
    enum: ['ide', 'copilot', 'openai-sdk', 'langsmith', 'mcp'],
  }).notNull(),
  owner: text('owner'),
  permissions: text('permissions').notNull().default('[]'),
  riskScore: integer('risk_score').notNull().default(0),
  status: text('status', {
    enum: ['active', 'inactive', 'suspended'],
  })
    .notNull()
    .default('active'),
  lastActiveAt: text('last_active_at'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

export type AgentRegistry = typeof agentRegistry.$inferSelect;
export type NewAgentRegistry = typeof agentRegistry.$inferInsert;
