import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';
import { organizations } from './organizations.js';

export const agentRiskSnapshots = sqliteTable('agent_risk_snapshots', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
  orgId: text('org_id').references(() => organizations.id, { onDelete: 'cascade' }),
  agentScore: integer('agent_score').notNull().default(100),
  cspmScore: integer('cspm_score').notNull().default(100),
  combinedScore: integer('combined_score').notNull().default(100),
  grade: text('grade').notNull().default('A'),
  agentEventCount: integer('agent_event_count').notNull().default(0),
  cspmFindingCount: integer('cspm_finding_count').notNull().default(0),
  snapshotDate: text('snapshot_date').notNull(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});
