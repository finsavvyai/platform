import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ─── Memory/RAG Poisoning Tracker ───────────────────────────────────────────────

export const memoryEntries = sqliteTable('memory_entries', {
  id: text('id').primaryKey(),
  orgId: text('org_id'),
  instanceId: text('instance_id'),
  entryType: text('entry_type', {
    enum: ['rag_document', 'memory_write', 'context_injection', 'tool_output'],
  }).notNull(),
  contentHash: text('content_hash').notNull(),
  contentPreview: text('content_preview'),
  source: text('source'),
  riskScore: integer('risk_score').notNull().default(0),
  isPoisoned: integer('is_poisoned', { mode: 'boolean' }).notNull().default(false),
  scanResult: text('scan_result'), // JSON
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  scannedAt: text('scanned_at'),
});

// ─── Newsletter Subscribers ─────────────────────────────────────────────────────

export const newsletterSubscribers = sqliteTable('newsletter_subscribers', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  source: text('source').notNull().default('website'),
  status: text('status', { enum: ['active', 'unsubscribed', 'bounced'] }).notNull().default('active'),
  subscribedAt: text('subscribed_at').notNull().default(sql`(datetime('now'))`),
  unsubscribedAt: text('unsubscribed_at'),
});

// ─── Certification Enrollments ──────────────────────────────────────────────────

export const certEnrollments = sqliteTable('cert_enrollments', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  certType: text('cert_type', { enum: ['CAASD', 'COSA'] }).notNull(),
  status: text('status', {
    enum: ['enrolled', 'in_progress', 'exam_ready', 'passed', 'failed', 'expired'],
  }).notNull().default('enrolled'),
  progressPct: integer('progress_pct').notNull().default(0),
  modulesCompleted: text('modules_completed'), // JSON
  examScore: integer('exam_score'),
  enrolledAt: text('enrolled_at').notNull().default(sql`(datetime('now'))`),
  completedAt: text('completed_at'),
  expiresAt: text('expires_at'),
  certificateUrl: text('certificate_url'),
});
