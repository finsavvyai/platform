import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { organizations } from './organizations.js';
import { users } from './users.js';

export const agentActivity = sqliteTable('agent_activity', {
  id:               text('id').primaryKey(),
  userId:           text('user_id').notNull().references(() => users.id),
  orgId:            text('org_id').references(() => organizations.id),
  sessionId:        text('session_id').notNull(),
  // Legacy columns (kept for backward compat)
  agent:            text('agent').notNull(),
  type:             text('type', { enum: ['file_read', 'bash_exec'] }).notNull(),
  risk:             text('risk', { enum: ['critical', 'high', 'medium', 'low'] }).notNull(),
  path:             text('path'),
  summary:          text('summary').notNull(),
  secretsCount:     integer('secrets_count').notNull().default(0),
  // New columns from OpenAgent extension (migration 0023)
  agentName:        text('agent_name'),
  eventType:        text('event_type', {
    enum: ['file_access', 'file_write', 'terminal_command', 'secret_detected', 'network_request'],
  }).notNull().default('file_access'),
  riskLevel:        text('risk_level', {
    enum: ['low', 'medium', 'high', 'critical'],
  }).notNull().default('low'),
  filePath:         text('file_path'),
  secretsDetected:  integer('secrets_detected').notNull().default(0),
  metadata:         text('metadata'),
  createdAt:        text('created_at').notNull().default(sql`(datetime('now'))`),
});
