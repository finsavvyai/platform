import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { instances } from './instances.js';
import { organizations } from './organizations.js';

// ─── Uptime Records ─────────────────────────────────────────────────────────

export const uptimeRecords = sqliteTable('uptime_records', {
  id: text('id').primaryKey(),
  instanceId: text('instance_id')
    .notNull()
    .references(() => instances.id),
  checkedAt: text('checked_at').notNull(),
  status: text('status', {
    enum: ['up', 'down', 'degraded'],
  }).notNull(),
  responseTimeMs: integer('response_time_ms'),
  checkType: text('check_type', {
    enum: ['health', 'ping', 'agent'],
  }).notNull(),
});

// ─── SLA Configs ────────────────────────────────────────────────────────────

export const slaConfigs = sqliteTable('sla_configs', {
  id: text('id').primaryKey(),
  orgId: text('org_id')
    .notNull()
    .unique()
    .references(() => organizations.id),
  targetUptime: real('target_uptime').notNull().default(99.9),
  checkIntervalMinutes: integer('check_interval_minutes').notNull().default(5),
  alertOnBreach: integer('alert_on_breach', { mode: 'boolean' }).default(true),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── Data Residency Configs ─────────────────────────────────────────────────

export const dataResidencyConfigs = sqliteTable('data_residency_configs', {
  id: text('id').primaryKey(),
  orgId: text('org_id')
    .notNull()
    .unique()
    .references(() => organizations.id),
  region: text('region', {
    enum: ['eu', 'us', 'ap'],
  }).notNull(),
  storageRegion: text('storage_region').notNull(),
  computeRegion: text('compute_region').notNull(),
  enforceStrict: integer('enforce_strict', { mode: 'boolean' }).default(false),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});
