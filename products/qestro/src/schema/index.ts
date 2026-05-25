// Main D1 Database Schema Index
// Complete SQLite schema for Cloudflare D1 database

import { coreSchema } from './core-schema.js';
import { testExecutionSchema } from './test-execution-schema.js';
import { apiManagementSchema } from './api-management-schema.js';
import { pluginSystemSchema } from './plugin-system-schema.js';
import { voiceSystemSchema } from './voice-system-schema.js';
import { advancedAnalyticsSchema } from './advanced-analytics-schema.js';
import { paymentSystemSchema } from './payment-system-schema.js';
import { platformSchema } from './platform-schema.js';

// Import backup schema
const backupSchema = {
  // Backup schema tables will be converted here if needed
  // For now, we're focusing on the main application schemas
};

// Complete D1 Database Schema
export const schema = {
  // Core system tables
  ...coreSchema,

  // Test execution engine tables
  ...testExecutionSchema,

  // API management and testing tables
  ...apiManagementSchema,

  // Plugin ecosystem tables
  ...pluginSystemSchema,

  // Voice system tables
  ...voiceSystemSchema,

  // Advanced analytics and security tables
  ...advancedAnalyticsSchema,

  // Payment system tables
  ...paymentSystemSchema,

  // Platform modules: Cloud Devices, Security, API Testing
  ...platformSchema,

  // Backup and disaster recovery tables (if needed)
  ...backupSchema,
};

// Export schema groups for organized imports
export const coreSchemaExport = coreSchema;
export const testExecutionSchemaExport = testExecutionSchema;
export const apiManagementSchemaExport = apiManagementSchema;
export const pluginSystemSchemaExport = pluginSystemSchema;
export const voiceSystemSchemaExport = voiceSystemSchema;
export const advancedAnalyticsSchemaExport = advancedAnalyticsSchema;
export const paymentSystemSchemaExport = paymentSystemSchema;
export const platformSchemaExport = platformSchema;

// Schema statistics and metadata
export const schemaMetadata = {
  totalTables: Object.keys(schema).length,
  schemaGroups: {
    core: Object.keys(coreSchema).length,
    testExecution: Object.keys(testExecutionSchema).length,
    apiManagement: Object.keys(apiManagementSchema).length,
    pluginSystem: Object.keys(pluginSystemSchema).length,
    voiceSystem: Object.keys(voiceSystemSchema).length,
    advancedAnalytics: Object.keys(advancedAnalyticsSchema).length,
    paymentSystem: Object.keys(paymentSystemSchema).length,
    platform: Object.keys(platformSchema).length,
  },
  version: '1.0.0-d1',
  createdAt: new Date().toISOString(),
  dataTypes: {
    primaryKey: 'text',
    foreignKey: 'text',
    timestamp: 'integer',
    boolean: 'integer',
    json: 'text (json mode)',
    decimal: 'real',
    array: 'text (json mode)',
  },
  conversions: {
    uuid: 'text',
    varchar: 'text',
    text: 'text',
    timestamp: 'integer (timestamp mode)',
    boolean: 'integer (boolean mode)',
    jsonb: 'text (json mode)',
    decimal: 'real',
    serial: 'integer',
  },
};

export default schema;
