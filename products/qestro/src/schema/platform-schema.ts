/**
 * Platform Schema - Drizzle tables for Cloud Devices, Security, and API Testing
 * 
 * This schema extends the core Qestro database with tables for:
 * - Cloud Device Hub (providers, devices, reservations)
 * - Security & Compliance (scans, findings, assessments)
 * - API Testing Studio (collections, requests, history, environments)
 */

import {
    sqliteTable,
    text,
    integer,
    real
} from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { coreSchema } from './core-schema.js';

// ================================
// CLOUD DEVICES SCHEMA
// ================================

/**
 * Cloud Providers - BrowserStack, SauceLabs, LambdaTest, Local
 */
export const cloudProviders = sqliteTable('cloud_providers', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id').notNull().references(() => coreSchema.users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    type: text('type').notNull(), // 'browserstack' | 'saucelabs' | 'lambdatest' | 'local'
    connected: integer('connected', { mode: 'boolean' }).default(false),
    deviceCount: integer('device_count').default(0),
    icon: text('icon').default('🔌'),
    configUsername: text('config_username'),
    configAccessKey: text('config_access_key'),
    configApiKey: text('config_api_key'),
    configEndpoint: text('config_endpoint'),
    configRegion: text('config_region'),
    configuredAt: integer('configured_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
});

/**
 * Cloud Devices - Discovered devices from cloud providers
 */
export const cloudDevices = sqliteTable('cloud_devices', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    providerId: text('provider_id').notNull().references(() => cloudProviders.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    platform: text('platform').notNull(), // 'ios' | 'android'
    model: text('model').notNull(),
    osVersion: text('os_version').notNull(),
    status: text('status').default('available'), // 'available' | 'busy' | 'offline' | 'maintenance'
    locationType: text('location_type').default('cloud'), // 'cloud' | 'local'
    locationRegion: text('location_region'),
    supportsScreenshots: integer('supports_screenshots', { mode: 'boolean' }).default(true),
    supportsVideoRecording: integer('supports_video_recording', { mode: 'boolean' }).default(true),
    supportsNetworkSimulation: integer('supports_network_simulation', { mode: 'boolean' }).default(false),
    maxConcurrentTests: integer('max_concurrent_tests').default(1),
    tags: text('tags', { mode: 'json' }).$defaultFn(() => '[]'),
    lastSeen: integer('last_seen', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
}, (table) => ({
    providerIdIdx: sql`CREATE INDEX cloud_devices_provider_id_idx ON ${table} (provider_id)`,
    platformIdx: sql`CREATE INDEX cloud_devices_platform_idx ON ${table} (platform)`,
    statusIdx: sql`CREATE INDEX cloud_devices_status_idx ON ${table} (status)`,
}));

/**
 * Device Reservations - Track device bookings
 */
export const deviceReservations = sqliteTable('device_reservations', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    deviceId: text('device_id').notNull().references(() => cloudDevices.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull().references(() => coreSchema.users.id, { onDelete: 'cascade' }),
    projectId: text('project_id').references(() => coreSchema.projects.id, { onDelete: 'set null' }),
    startTime: integer('start_time', { mode: 'timestamp' }).notNull(),
    endTime: integer('end_time', { mode: 'timestamp' }).notNull(),
    status: text('status').default('scheduled'), // 'scheduled' | 'active' | 'completed' | 'cancelled'
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
}, (table) => ({
    deviceIdIdx: sql`CREATE INDEX device_reservations_device_id_idx ON ${table} (device_id)`,
    userIdIdx: sql`CREATE INDEX device_reservations_user_id_idx ON ${table} (user_id)`,
    statusIdx: sql`CREATE INDEX device_reservations_status_idx ON ${table} (status)`,
}));

// ================================
// SECURITY & COMPLIANCE SCHEMA
// ================================

/**
 * Security Scans - Scan metadata and status
 */
export const securityScans = sqliteTable('security_scans', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id').notNull().references(() => coreSchema.users.id, { onDelete: 'cascade' }),
    projectId: text('project_id').references(() => coreSchema.projects.id, { onDelete: 'set null' }),
    target: text('target').notNull(),
    scanType: text('scan_type').default('full'), // 'full' | 'quick' | 'owasp' | 'custom'
    status: text('status').default('queued'), // 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
    startTime: integer('start_time', { mode: 'timestamp' }),
    endTime: integer('end_time', { mode: 'timestamp' }),
    criticalCount: integer('critical_count').default(0),
    highCount: integer('high_count').default(0),
    mediumCount: integer('medium_count').default(0),
    lowCount: integer('low_count').default(0),
    infoCount: integer('info_count').default(0),
    totalFindings: integer('total_findings').default(0),
    riskScore: real('risk_score').default(0),
    duration: integer('duration').default(0),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
}, (table) => ({
    userIdIdx: sql`CREATE INDEX security_scans_user_id_idx ON ${table} (user_id)`,
    statusIdx: sql`CREATE INDEX security_scans_status_idx ON ${table} (status)`,
    projectIdIdx: sql`CREATE INDEX security_scans_project_id_idx ON ${table} (project_id)`,
}));

/**
 * Security Findings - Vulnerabilities found during scans
 */
export const securityFindings = sqliteTable('security_findings', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    scanId: text('scan_id').notNull().references(() => securityScans.id, { onDelete: 'cascade' }),
    severity: text('severity').notNull(), // 'critical' | 'high' | 'medium' | 'low' | 'info'
    category: text('category').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    location: text('location'),
    remediation: text('remediation'),
    cweId: text('cwe_id'),
    cvssScore: real('cvss_score'),
    evidence: text('evidence'),
    falsePositive: integer('false_positive', { mode: 'boolean' }).default(false),
    status: text('status').default('open'), // 'open' | 'resolved' | 'ignored' | 'in-progress'
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
}, (table) => ({
    scanIdIdx: sql`CREATE INDEX security_findings_scan_id_idx ON ${table} (scan_id)`,
    severityIdx: sql`CREATE INDEX security_findings_severity_idx ON ${table} (severity)`,
    statusIdx: sql`CREATE INDEX security_findings_status_idx ON ${table} (status)`,
}));

/**
 * Compliance Assessments - Framework assessment history
 */
export const complianceAssessments = sqliteTable('compliance_assessments', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id').notNull().references(() => coreSchema.users.id, { onDelete: 'cascade' }),
    frameworkId: text('framework_id').notNull(), // 'soc2' | 'gdpr' | 'hipaa' | 'pci'
    frameworkName: text('framework_name').notNull(),
    frameworkVersion: text('framework_version'),
    overallScore: real('overall_score').default(0),
    controlsData: text('controls_data', { mode: 'json' }).$defaultFn(() => '[]'),
    assessedAt: integer('assessed_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
}, (table) => ({
    userIdIdx: sql`CREATE INDEX compliance_assessments_user_id_idx ON ${table} (user_id)`,
    frameworkIdIdx: sql`CREATE INDEX compliance_assessments_framework_id_idx ON ${table} (framework_id)`,
}));

// ================================
// API TESTING SCHEMA
// ================================

/**
 * API Collections - Postman-like collections
 */
export const apiCollections = sqliteTable('api_collections', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id').notNull().references(() => coreSchema.users.id, { onDelete: 'cascade' }),
    projectId: text('project_id').references(() => coreSchema.projects.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    description: text('description'),
    variables: text('variables', { mode: 'json' }).$defaultFn(() => '{}'),
    authType: text('auth_type').default('none'), // 'none' | 'bearer' | 'basic' | 'apiKey' | 'oauth2'
    authConfig: text('auth_config', { mode: 'json' }).$defaultFn(() => '{}'),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
}, (table) => ({
    userIdIdx: sql`CREATE INDEX api_collections_user_id_idx ON ${table} (user_id)`,
    projectIdIdx: sql`CREATE INDEX api_collections_project_id_idx ON ${table} (project_id)`,
}));

/**
 * API Requests - Individual requests within collections
 */
export const apiRequests = sqliteTable('api_requests', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    collectionId: text('collection_id').notNull().references(() => apiCollections.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    method: text('method').notNull(), // 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD'
    url: text('url').notNull(),
    headers: text('headers', { mode: 'json' }).$defaultFn(() => '{}'),
    body: text('body'),
    bodyType: text('body_type').default('json'), // 'json' | 'form-data' | 'x-www-form-urlencoded' | 'raw' | 'binary'
    authType: text('auth_type'),
    authConfig: text('auth_config', { mode: 'json' }),
    preRequestScript: text('pre_request_script'),
    testScript: text('test_script'),
    description: text('description'),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
}, (table) => ({
    collectionIdIdx: sql`CREATE INDEX api_requests_collection_id_idx ON ${table} (collection_id)`,
    methodIdx: sql`CREATE INDEX api_requests_method_idx ON ${table} (method)`,
}));

/**
 * API Request History - Execution history
 */
export const apiRequestHistory = sqliteTable('api_request_history', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    requestId: text('request_id').references(() => apiRequests.id, { onDelete: 'set null' }),
    collectionId: text('collection_id').references(() => apiCollections.id, { onDelete: 'set null' }),
    userId: text('user_id').notNull().references(() => coreSchema.users.id, { onDelete: 'cascade' }),
    method: text('method').notNull(),
    url: text('url').notNull(),
    status: integer('status').notNull(),
    responseTime: integer('response_time').notNull(), // in ms
    responseSize: integer('response_size').default(0), // in bytes
    responseBody: text('response_body'),
    responseHeaders: text('response_headers', { mode: 'json' }),
    executedAt: integer('executed_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
}, (table) => ({
    userIdIdx: sql`CREATE INDEX api_request_history_user_id_idx ON ${table} (user_id)`,
    collectionIdIdx: sql`CREATE INDEX api_request_history_collection_id_idx ON ${table} (collection_id)`,
    executedAtIdx: sql`CREATE INDEX api_request_history_executed_at_idx ON ${table} (executed_at)`,
}));

/**
 * API Environments - Environment variable sets
 */
export const apiEnvironments = sqliteTable('api_environments', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id').notNull().references(() => coreSchema.users.id, { onDelete: 'cascade' }),
    projectId: text('project_id').references(() => coreSchema.projects.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    variables: text('variables', { mode: 'json' }).$defaultFn(() => '{}'),
    isActive: integer('is_active', { mode: 'boolean' }).default(false),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => Date.now()),
}, (table) => ({
    userIdIdx: sql`CREATE INDEX api_environments_user_id_idx ON ${table} (user_id)`,
    projectIdIdx: sql`CREATE INDEX api_environments_project_id_idx ON ${table} (project_id)`,
    isActiveIdx: sql`CREATE INDEX api_environments_is_active_idx ON ${table} (is_active)`,
}));

// ================================
// EXPORTS
// ================================

export const platformSchema = {
    // Cloud Devices
    cloudProviders,
    cloudDevices,
    deviceReservations,
    // Security & Compliance
    securityScans,
    securityFindings,
    complianceAssessments,
    // API Testing
    apiCollections,
    apiRequests,
    apiRequestHistory,
    apiEnvironments,
};

export default platformSchema;
