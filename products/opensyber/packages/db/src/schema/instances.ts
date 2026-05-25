import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';

// ─── Instances ──────────────────────────────────────────────────────────────────

export const instances = sqliteTable('instances', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  orgId: text('org_id'), // nullable FK to organizations (constraint in migration)
  name: text('name').notNull().default('My Agent'),
  containerId: text('container_id'),
  hostname: text('hostname'),
  region: text('region', {
    enum: ['eu-central', 'us-east', 'us-west', 'ap-southeast'],
  }).notNull(),
  status: text('status', {
    enum: [
      'provisioning',
      'installing',
      'ready',
      'running',
      'stopped',
      'error',
      'suspended',
      'quarantined',
      'destroying',
    ],
  })
    .notNull()
    .default('provisioning'),
  engineVersion: text('engine_version'),
  agentVersion: text('agent_version'),
  gatewayTokenEncrypted: text('gateway_token_encrypted'),
  tailscaleNodeId: text('tailscale_node_id'),
  tailscaleIp: text('tailscale_ip'),
  lastHealthCheck: text('last_health_check'),
  lastBackup: text('last_backup'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── Skills ─────────────────────────────────────────────────────────────────────

export const skills = sqliteTable('skills', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  category: text('category', {
    enum: [
      'productivity',
      'developer',
      'finance',
      'communication',
      'home',
      'security',
      'utilities',
    ],
  }).notNull(),
  authorId: text('author_id').notNull(),
  githubUrl: text('github_url'),
  currentVersion: text('current_version'),
  verificationStatus: text('verification_status', {
    enum: ['pending', 'scanning', 'reviewing', 'approved', 'rejected', 'revoked'],
  })
    .notNull()
    .default('pending'),
  verifiedAt: text('verified_at'),
  installCount: integer('install_count').notNull().default(0),
  ratingAvg: real('rating_avg').notNull().default(0),
  ratingCount: integer('rating_count').notNull().default(0),
  tier: text('tier', { enum: ['free', 'pro', 'premium'] }).notNull().default('free'),
  priceCents: integer('price_cents').notNull().default(0),
  manifest: text('manifest'),
  bundleR2Key: text('bundle_r2_key'),
  sdkVersion: text('sdk_version'),
  publisherId: text('publisher_id').references(() => users.id),
  license: text('license'),
  homepage: text('homepage'),
  repository: text('repository'),
  tags: text('tags'),
  isFeatured: integer('is_featured', { mode: 'boolean' }).notNull().default(false),
  isCertified: integer('is_certified', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── Skill Installations ────────────────────────────────────────────────────────

export const skillInstallations = sqliteTable('skill_installations', {
  id: text('id').primaryKey(),
  instanceId: text('instance_id')
    .notNull()
    .references(() => instances.id),
  skillId: text('skill_id')
    .notNull()
    .references(() => skills.id),
  version: text('version').notNull(),
  installedAt: text('installed_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
});
