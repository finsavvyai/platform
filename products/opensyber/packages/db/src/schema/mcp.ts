import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ─── MCP Server Registry ────────────────────────────────────────────────────────

export const mcpServers = sqliteTable('mcp_servers', {
  id: text('id').primaryKey(),
  orgId: text('org_id'),
  name: text('name').notNull(),
  url: text('url').notNull(),
  transport: text('transport', { enum: ['stdio', 'sse', 'streamable-http'] }).notNull().default('stdio'),
  authType: text('auth_type', { enum: ['none', 'bearer', 'api_key', 'oauth'] }),
  authConfig: text('auth_config'), // encrypted JSON
  toolCount: integer('tool_count').notNull().default(0),
  lastHealthAt: text('last_health_at'),
  healthStatus: text('health_status', {
    enum: ['healthy', 'degraded', 'unhealthy', 'unknown'],
  }).notNull().default('unknown'),
  riskScore: integer('risk_score').notNull().default(0),
  isVerified: integer('is_verified', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

// ─── MCP Server Security Findings ───────────────────────────────────────────────

export const mcpServerFindings = sqliteTable('mcp_server_findings', {
  id: text('id').primaryKey(),
  serverId: text('server_id')
    .notNull()
    .references(() => mcpServers.id, { onDelete: 'cascade' }),
  findingType: text('finding_type', {
    enum: ['excessive_permissions', 'data_exfil', 'prompt_injection', 'tool_shadowing', 'rug_pull', 'auth_bypass'],
  }).notNull(),
  severity: text('severity', {
    enum: ['info', 'low', 'medium', 'high', 'critical'],
  }).notNull().default('medium'),
  title: text('title').notNull(),
  description: text('description'),
  evidence: text('evidence'),
  status: text('status', {
    enum: ['open', 'confirmed', 'mitigated', 'false_positive'],
  }).notNull().default('open'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  resolvedAt: text('resolved_at'),
});
