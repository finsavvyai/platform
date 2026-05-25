import { integer, sqliteTable, text, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { organizations } from './organizations.js';
import { users } from './users.js';

export const agentDiscoveryRuns = sqliteTable('agent_discovery_runs', {
  id: text('id').primaryKey(),
  orgId: text('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  startedByUserId: text('started_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  status: text('status', { enum: ['queued', 'running', 'completed', 'failed'] })
    .notNull()
    .default('queued'),
  sourceType: text('source_type').notNull().default('manual'),
  sourceRef: text('source_ref'),
  totalFound: integer('total_found').notNull().default(0),
  totalScored: integer('total_scored').notNull().default(0),
  errorCount: integer('error_count').notNull().default(0),
  startedAt: text('started_at').notNull().default(sql`(datetime('now'))`),
  endedAt: text('ended_at'),
}, (table) => ({
  orgStatusIdx: index('idx_agent_discovery_runs_org_status').on(table.orgId, table.status),
}));

export const discoveredAgents = sqliteTable('discovered_agents', {
  id: text('id').primaryKey(),
  orgId: text('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  runId: text('run_id')
    .notNull()
    .references(() => agentDiscoveryRuns.id, { onDelete: 'cascade' }),
  fingerprint: text('fingerprint').notNull(),
  name: text('name').notNull(),
  framework: text('framework').notNull().default('unknown'),
  runtime: text('runtime').notNull().default('unknown'),
  surfaceType: text('surface_type').notNull().default('repo'),
  locationPath: text('location_path'),
  status: text('status', { enum: ['unsecured', 'protected', 'ignored'] })
    .notNull()
    .default('unsecured'),
  lastSeenAt: text('last_seen_at').notNull().default(sql`(datetime('now'))`),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (table) => ({
  orgStatusIdx: index('idx_discovered_agents_org_status').on(table.orgId, table.status),
  orgFingerprintUq: uniqueIndex('uq_discovered_agents_org_fingerprint').on(table.orgId, table.fingerprint),
}));

export const discoveredAgentRiskScores = sqliteTable('discovered_agent_risk_scores', {
  id: text('id').primaryKey(),
  agentId: text('agent_id')
    .notNull()
    .references(() => discoveredAgents.id, { onDelete: 'cascade' }),
  score: integer('score').notNull().default(0),
  severity: text('severity', { enum: ['low', 'medium', 'high', 'critical'] })
    .notNull()
    .default('low'),
  factorsJson: text('factors_json').notNull().default('[]'),
  scoredAt: text('scored_at').notNull().default(sql`(datetime('now'))`),
}, (table) => ({
  agentScoredIdx: index('idx_discovered_agent_risk_scores_agent_scored').on(table.agentId, table.scoredAt),
}));

export const discoveredAgentOwners = sqliteTable('discovered_agent_owners', {
  id: text('id').primaryKey(),
  agentId: text('agent_id')
    .notNull()
    .references(() => discoveredAgents.id, { onDelete: 'cascade' }),
  ownerUserId: text('owner_user_id').references(() => users.id, { onDelete: 'set null' }),
  ownerTeamId: text('owner_team_id'),
  ownerSource: text('owner_source').notNull().default('manual'),
  confidence: integer('confidence').notNull().default(50),
  mappedAt: text('mapped_at').notNull().default(sql`(datetime('now'))`),
}, (table) => ({
  agentUq: uniqueIndex('uq_discovered_agent_owners_agent').on(table.agentId),
}));

export const discoveryProtectionLinks = sqliteTable('discovery_protection_links', {
  id: text('id').primaryKey(),
  agentId: text('agent_id')
    .notNull()
    .references(() => discoveredAgents.id, { onDelete: 'cascade' }),
  instanceId: text('instance_id'),
  protectionMethod: text('protection_method').notNull().default('opensyber-runtime'),
  status: text('status').notNull().default('active'),
  protectedAt: text('protected_at').notNull().default(sql`(datetime('now'))`),
}, (table) => ({
  agentProtectedIdx: index('idx_discovery_protection_links_agent').on(table.agentId, table.protectedAt),
}));

export type AgentDiscoveryRun = typeof agentDiscoveryRuns.$inferSelect;
export type NewAgentDiscoveryRun = typeof agentDiscoveryRuns.$inferInsert;
export type DiscoveredAgent = typeof discoveredAgents.$inferSelect;
export type NewDiscoveredAgent = typeof discoveredAgents.$inferInsert;
