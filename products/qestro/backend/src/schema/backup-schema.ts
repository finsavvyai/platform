/**
 * Backup and Disaster Recovery Database Schema
 * Tables for backup metadata, recovery procedures, and disaster scenarios
 */

import { pgTable, uuid, text, timestamp, integer, boolean, jsonb, decimal } from 'drizzle-orm/pg-core';

// Backups table - Store backup metadata and status
export const backups = pgTable('backups', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: text('type').notNull(), // database, files, configuration, full
  timestamp: timestamp('timestamp').notNull().defaultNow(),
  size: integer('size').notNull(), // bytes
  compressed: boolean('compressed').notNull().default(false),
  encrypted: boolean('encrypted').notNull().default(false),
  checksum: text('checksum').notNull(),
  retentionDate: timestamp('retention_date').notNull(),
  location: text('location').notNull(),
  status: text('status').notNull(), // creating, completed, failed, expired, deleted
  createdBy: uuid('created_by'),
  tags: jsonb('tags').default([]), // array of tags
  metadata: jsonb('metadata').default({}), // additional backup metadata
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Recovery procedures table - Store disaster recovery procedures
export const recoveryProcedures = pgTable('recovery_procedures', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  type: text('type').notNull(), // full, partial, point-in-time
  rtoHours: integer('rto_hours').notNull(), // Recovery Time Objective in hours
  rpoMinutes: integer('rpo_minutes').notNull(), // Recovery Point Objective in minutes
  backupRequirements: jsonb('backup_requirements').notNull(),
  steps: jsonb('steps').notNull(), // array of recovery steps
  validationTests: jsonb('validation_tests').notNull(), // array of validation tests
  notificationChannels: jsonb('notification_channels').default([]), // notification channels
  priority: text('priority').notNull().default('medium'), // critical, high, medium, low
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  lastTestDate: timestamp('last_test_date'),
  lastTestSuccess: boolean('last_test_success'),
  testResults: jsonb('test_results').default([]), // recent test results
});

// Recovery executions table - Track recovery procedure executions
export const recoveryExecutions = pgTable('recovery_executions', {
  id: uuid('id').primaryKey().defaultRandom(),
  procedureId: uuid('procedure_id').notNull(),
  status: text('status').notNull(), // pending, running, completed, failed, cancelled
  startTime: timestamp('start_time').notNull().defaultNow(),
  endTime: timestamp('end_time'),
  duration: integer('duration'), // milliseconds
  triggerReason: text('trigger_reason').notNull(), // manual, automated, test
  triggeredBy: uuid('triggered_by'),
  backupUsed: text('backup_used'),
  steps: jsonb('steps').notNull(), // execution details for each step
  testResults: jsonb('test_results').notNull(), // validation test results
  logs: jsonb('logs').default([]), // execution logs
  rtoMet: boolean('rto_met'),
  rpoMet: boolean('rpo_met'),
  success: boolean('success'),
  error: text('error'),
  metadata: jsonb('metadata').default({}), // additional execution metadata
});

// Disaster scenarios table - Store potential disaster scenarios
export const disasterScenarios = pgTable('disaster_scenarios', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  type: text('type').notNull(), // data_corruption, service_outage, network_failure, security_breach, infrastructure_failure
  severity: text('severity').notNull(), // critical, high, medium, low
  probability: text('probability').notNull(), // high, medium, low
  impact: text('impact'), // description of impact
  detectionMethods: jsonb('detection_methods').default([]), // methods to detect the scenario
  responseProcedures: jsonb('response_procedures').default([]), // recovery procedure IDs
  preventionMeasures: jsonb('prevention_measures').default([]), // prevention measures
  estimatedDowntime: integer('estimated_downtime'), // hours
  estimatedDataLoss: boolean('estimated_data_loss').default(false),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  lastReviewed: timestamp('last_reviewed'),
  reviewStatus: text('review_status').default('pending'), // pending, approved, rejected
});

// Backup schedules table - Automated backup scheduling
export const backupSchedules = pgTable('backup_schedules', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  type: text('type').notNull(), // database, files, configuration, full
  frequency: text('frequency').notNull(), // hourly, daily, weekly, monthly
  cronExpression: text('cron_expression'), // cron expression for custom schedules
  retentionDays: integer('retention_days').notNull(),
  sourcePaths: jsonb('source_paths').default([]), // for file backups
  config: jsonb('config').default({}), // backup configuration
  isActive: boolean('is_active').notNull().default(true),
  lastRun: timestamp('last_run'),
  nextRun: timestamp('next_run'),
  runCount: integer('run_count').default(0),
  successCount: integer('success_count').default(0),
  failureCount: integer('failure_count').default(0),
  createdBy: uuid('created_by').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Backup validation results table - Store backup integrity validation results
export const backupValidations = pgTable('backup_validations', {
  id: uuid('id').primaryKey().defaultRandom(),
  backupId: uuid('backup_id').notNull(),
  validationType: text('validation_type').notNull(), // checksum, restore_test, integrity_check
  status: text('status').notNull(), // pending, running, passed, failed
  startTime: timestamp('start_time').notNull().defaultNow(),
  endTime: timestamp('end_time'),
  duration: integer('duration'), // milliseconds
  result: jsonb('result'), // validation results
  errorMessage: text('error_message'),
  validatedBy: uuid('validated_by'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Recovery notifications table - Track notifications sent during recovery
export const recoveryNotifications = pgTable('recovery_notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  executionId: uuid('execution_id').notNull(),
  channel: text('channel').notNull(), // email, slack, webhook, sms
  recipient: text('recipient').notNull(),
  subject: text('subject'),
  message: text('message').notNull(),
  status: text('status').notNull(), // pending, sent, failed
  sentAt: timestamp('sent_at'),
  error: text('error'),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Backup retention policies table - Define retention policies
export const backupRetentionPolicies = pgTable('backup_retention_policies', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  backupType: text('backup_type').notNull(), // database, files, configuration, full
  retentionDays: integer('retention_days').notNull(),
  maxBackups: integer('max_backups'), // maximum number of backups to keep
  rules: jsonb('rules').default([]), // retention rules
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Disaster recovery drills table - Track disaster recovery drills and tests
export const disasterRecoveryDrills = pgTable('disaster_recovery_drills', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  scenarioId: uuid('scenario_id'),
  procedureIds: jsonb('procedure_ids').notNull(), // procedures tested in drill
  scheduledDate: timestamp('scheduled_date').notNull(),
  actualStartDate: timestamp('actual_start_date'),
  actualEndDate: timestamp('actual_end_date'),
  status: text('status').notNull(), // scheduled, in_progress, completed, cancelled, failed
  duration: integer('duration'), // minutes
  participants: jsonb('participants').default([]), // participants in drill
  objectives: jsonb('objectives').default([]), // drill objectives
  results: jsonb('results'), // drill results and outcomes
  lessonsLearned: jsonb('lessons_learned').default([]),
  successRating: integer('success_rating'), // 1-5 rating
  nextDrillDate: timestamp('next_drill_date'),
  createdBy: uuid('created_by').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Backup storage locations table - Track different storage locations
export const backupStorageLocations = pgTable('backup_storage_locations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  type: text('type').notNull(), // local, s3, gcs, azure, nfs
  config: jsonb('config').notNull(), // storage configuration
  isActive: boolean('is_active').notNull().default(true),
  isPrimary: boolean('is_primary').notNull().default(false),
  lastHealthCheck: timestamp('last_health_check'),
  healthStatus: text('health_status').default('unknown'), // healthy, degraded, unhealthy, unknown
  capacityUsed: integer('capacity_used'), // bytes
  capacityTotal: integer('capacity_total'), // bytes
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Backup archive logs table - Track backup archiving and restoration
export const backupArchiveLogs = pgTable('backup_archive_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  backupId: uuid('backup_id').notNull(),
  action: text('action').notNull(), // archive, restore, delete, move
  sourceLocation: text('source_location'),
  targetLocation: text('target_location'),
  status: text('status').notNull(), // pending, running, completed, failed
  startTime: timestamp('start_time').notNull().defaultNow(),
  endTime: timestamp('end_time'),
  duration: integer('duration'), // milliseconds
  bytesTransferred: integer('bytes_transferred'),
  transferRate: decimal('transfer_rate', { precision: 10, scale: 2 }), // MB/s
  errorMessage: text('error_message'),
  initiatedBy: uuid('initiated_by'),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Recovery metrics table - Track recovery performance metrics
export const recoveryMetrics = pgTable('recovery_metrics', {
  id: uuid('id').primaryKey().defaultRandom(),
  executionId: uuid('execution_id').notNull(),
  metricType: text('metric_type').notNull(), // rto_compliance, rpo_compliance, data_integrity, availability
  value: decimal('value', { precision: 10, scale: 2 }).notNull(),
  unit: text('unit'), // percentage, minutes, seconds, etc.
  target: decimal('target', { precision: 10, scale: 2 }), // target value
  achieved: boolean('achieved').notNull(),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
  metadata: jsonb('metadata').default({}),
});

// Export types
export type Backup = typeof backups.$inferSelect;
export type NewBackup = typeof backups.$inferInsert;

export type RecoveryProcedure = typeof recoveryProcedures.$inferSelect;
export type NewRecoveryProcedure = typeof recoveryProcedures.$inferInsert;

export type RecoveryExecution = typeof recoveryExecutions.$inferSelect;
export type NewRecoveryExecution = typeof recoveryExecutions.$inferInsert;

export type DisasterScenario = typeof disasterScenarios.$inferSelect;
export type NewDisasterScenario = typeof disasterScenarios.$inferInsert;

export type BackupSchedule = typeof backupSchedules.$inferSelect;
export type NewBackupSchedule = typeof backupSchedules.$inferInsert;

export type BackupValidation = typeof backupValidations.$inferSelect;
export type NewBackupValidation = typeof backupValidations.$inferInsert;

export type RecoveryNotification = typeof recoveryNotifications.$inferSelect;
export type NewRecoveryNotification = typeof recoveryNotifications.$inferInsert;

export type BackupRetentionPolicy = typeof backupRetentionPolicies.$inferSelect;
export type NewBackupRetentionPolicy = typeof backupRetentionPolicies.$inferInsert;

export type DisasterRecoveryDrill = typeof disasterRecoveryDrills.$inferSelect;
export type NewDisasterRecoveryDrill = typeof disasterRecoveryDrills.$inferInsert;

export type BackupStorageLocation = typeof backupStorageLocations.$inferSelect;
export type NewBackupStorageLocation = typeof backupStorageLocations.$inferInsert;

export type BackupArchiveLog = typeof backupArchiveLogs.$inferSelect;
export type NewBackupArchiveLog = typeof backupArchiveLogs.$inferInsert;

export type RecoveryMetric = typeof recoveryMetrics.$inferSelect;
export type NewRecoveryMetric = typeof recoveryMetrics.$inferInsert;