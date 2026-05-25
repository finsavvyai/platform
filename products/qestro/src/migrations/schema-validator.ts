// Schema Validation Script for D1 SQLite Conversion
// Validates that all foreign keys, indexes, and constraints work correctly

import { drizzle } from 'drizzle-orm/d1';
import { schema } from '../src/schema/index.js';

export class SchemaValidator {
  constructor(private db: D1Database) {
    this.orm = drizzle(db, { schema });
  }

  async validateAllTables(): Promise<ValidationResult> {
    const results = {
      tables: {},
      foreignKeys: {},
      indexes: {},
      constraints: {},
      errors: [],
      warnings: [],
      totalTables: Object.keys(schema).length,
      validatedTables: 0,
      passedValidations: 0,
    };

    console.log('🔍 Starting D1 SQLite schema validation...');

    // Validate each table exists and has correct structure
    for (const [tableName, tableSchema] of Object.entries(schema)) {
      try {
        await this.validateTable(tableName, tableSchema);
        results.validatedTables++;
        results.passedValidations++;
        console.log(`✅ Table "${tableName}" validated successfully`);
      } catch (error) {
        results.errors.push(`Table "${tableName}": ${error.message}`);
        console.log(`❌ Table "${tableName}" validation failed: ${error.message}`);
      }
    }

    // Validate foreign key relationships
    await this.validateForeignKeys(results);

    // Validate indexes
    await this.validateIndexes(results);

    // Validate unique constraints
    await this.validateConstraints(results);

    return results;
  }

  private async validateTable(tableName: string, tableSchema: any): Promise<void> {
    // Check if table exists
    const tableExists = await this.db.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name=?`
    ).bind(tableName).first();

    if (!tableExists) {
      throw new Error(`Table "${tableName}" does not exist in D1 database`);
    }

    // Check table structure
    const columns = await this.db.prepare(
      `PRAGMA table_info(${tableName})`
    ).all();

    if (!columns.results || columns.results.length === 0) {
      throw new Error(`No columns found for table "${tableName}"`);
    }

    // Validate primary key exists
    const hasPrimaryKey = columns.results.some(col => col.pk > 0);
    if (!hasPrimaryKey) {
      throw new Error(`Table "${tableName}" has no primary key defined`);
    }

    // Validate data types are SQLite compatible
    const invalidTypes = columns.results.filter(col => {
      const type = col.type.toUpperCase();
      return !['TEXT', 'INTEGER', 'REAL', 'BLOB', 'NUMERIC'].includes(type);
    });

    if (invalidTypes.length > 0) {
      throw new Error(`Invalid data types found in table "${tableName}": ${invalidTypes.map(c => c.name).join(', ')}`);
    }
  }

  private async validateForeignKeys(results: any): Promise<void> {
    console.log('🔗 Validating foreign key relationships...');

    const foreignKeyChecks = [
      // Core relationships
      { table: 'projects', fk: 'user_id', references: 'users.id' },
      { table: 'recording_sessions', fk: 'project_id', references: 'projects.id' },
      { table: 'recording_sessions', fk: 'user_id', references: 'users.id' },
      { table: 'test_suites', fk: 'project_id', references: 'projects.id' },
      { table: 'test_cases', fk: 'project_id', references: 'projects.id' },
      { table: 'test_runs', fk: 'project_id', references: 'projects.id' },

      // API management relationships
      { table: 'api_endpoints', fk: 'user_id', references: 'users.id' },
      { table: 'api_calls', fk: 'endpoint_id', references: 'api_endpoints.id' },
      { table: 'api_calls', fk: 'user_id', references: 'users.id' },

      // Plugin system relationships
      { table: 'plugins', fk: 'author_id', references: 'users.id' },
      { table: 'plugin_installations', fk: 'user_id', references: 'users.id' },
      { table: 'plugin_installations', fk: 'plugin_id', references: 'plugins.id' },

      // Payment system relationships
      { table: 'payment_customers', fk: 'user_id', references: 'users.id' },
      { table: 'subscriptions', fk: 'user_id', references: 'users.id' },

      // Voice system relationships
      { table: 'voice_recordings', fk: 'user_id', references: 'users.id' },
      { table: 'voice_recordings', fk: 'project_id', references: 'projects.id' },
    ];

    for (const fk of foreignKeyChecks) {
      try {
        // Check if referenced records exist for foreign keys
        const orphanedRecords = await this.db.prepare(`
          SELECT COUNT(*) as count FROM ${fk.table}
          WHERE ${fk.fk} IS NOT NULL
          AND ${fk.fk} NOT IN (SELECT id FROM ${fk.references.split('.')[0]})
        `).first();

        if (orphanedRecords.count > 0) {
          results.warnings.push(`Found ${orphanedRecords.count} orphaned records in ${fk.table}.${fk.fk}`);
        } else {
          results.passedValidations++;
          console.log(`✅ Foreign key ${fk.table}.${fk.fk} -> ${fk.references} validated`);
        }
      } catch (error) {
        results.errors.push(`Foreign key validation failed for ${fk.table}.${fk.fk}: ${error.message}`);
      }
    }
  }

  private async validateIndexes(results: any): Promise<void> {
    console.log('📊 Validating indexes...');

    const expectedIndexes = [
      'users_email_idx',
      'users_role_idx',
      'projects_user_id_idx',
      'projects_type_idx',
      'recording_sessions_project_id_idx',
      'recording_sessions_user_id_idx',
      'recording_sessions_status_idx',
      'test_suites_project_id_idx',
      'test_cases_project_id_idx',
      'test_runs_project_id_idx',
      'test_runs_status_idx',
      'api_endpoints_user_id_idx',
      'api_calls_endpoint_id_idx',
      'api_calls_user_id_idx',
      'plugins_author_id_idx',
      'plugins_type_idx',
      'plugin_installations_user_id_idx',
      'plugin_installations_plugin_id_idx',
      'payment_customers_user_id_idx',
      'subscriptions_user_id_idx',
      'voice_recordings_user_id_idx',
      'voice_recordings_processing_status_idx',
      'security_audit_logs_user_id_idx',
      'security_audit_logs_timestamp_idx',
    ];

    for (const indexName of expectedIndexes) {
      try {
        const indexExists = await this.db.prepare(
          `SELECT name FROM sqlite_master WHERE type='index' AND name=?`
        ).bind(indexName).first();

        if (indexExists) {
          results.passedValidations++;
          console.log(`✅ Index "${indexName}" exists`);
        } else {
          results.warnings.push(`Expected index "${indexName}" not found`);
        }
      } catch (error) {
        results.errors.push(`Index validation failed for "${indexName}": ${error.message}`);
      }
    }
  }

  private async validateConstraints(results: any): Promise<void> {
    console.log('🔒 Validating unique constraints...');

    const uniqueConstraints = [
      { table: 'users', column: 'email' },
      { table: 'plugins', column: 'slug' },
      { table: 'payment_customers', column: 'lemon_squeezy_customer_id' },
      { table: 'subscriptions', column: 'lemon_squeezy_subscription_id' },
      { table: 'plugin_installations', columns: ['user_id', 'plugin_id'] },
      { table: 'advanced_analytics', columns: ['user_id', 'date', 'granularity'] },
    ];

    for (const constraint of uniqueConstraints) {
      try {
        let query;
        if (constraint.columns) {
          query = `SELECT COUNT(*) - COUNT(DISTINCT ${constraint.columns.join(', ')}) as duplicates FROM ${constraint.table}`;
        } else {
          query = `SELECT COUNT(*) - COUNT(DISTINCT ${constraint.column}) as duplicates FROM ${constraint.table}`;
        }

        const result = await this.db.prepare(query).first();

        if (result.duplicates > 0) {
          results.errors.push(`Unique constraint violation in ${constraint.table}: found ${result.duplicates} duplicates`);
        } else {
          results.passedValidations++;
          console.log(`✅ Unique constraint validated for ${constraint.table}`);
        }
      } catch (error) {
        results.errors.push(`Constraint validation failed for ${constraint.table}: ${error.message}`);
      }
    }
  }

  async validateDataIntegrity(): Promise<DataIntegrityResult> {
    console.log('🔍 Validating data integrity...');

    const result = {
      totalRecords: 0,
      corruptedRecords: 0,
      jsonValidationErrors: 0,
      timestampValidationErrors: 0,
      details: {},
    };

    // Validate JSON fields
    const jsonFields = [
      { table: 'users', field: 'role' },
      { table: 'projects', field: 'settings' },
      { table: 'recording_sessions', field: 'metadata' },
      { table: 'test_suites', field: 'test_cases' },
      { table: 'test_cases', field: 'test_data' },
      { table: 'api_endpoints', field: 'authentication' },
      { table: 'plugins', field: 'configuration' },
      { table: 'voice_recordings', field: 'detected_commands' },
    ];

    for (const { table, field } of jsonFields) {
      try {
        const records = await this.db.prepare(
          `SELECT id, ${field} FROM ${table} WHERE ${field} IS NOT NULL LIMIT 100`
        ).all();

        for (const record of records.results || []) {
          result.totalRecords++;

          try {
            JSON.parse(record[field]);
          } catch {
            result.jsonValidationErrors++;
            result.corruptedRecords++;
            if (!result.details[table]) result.details[table] = [];
            result.details[table].push({
              id: record.id,
              field,
              error: 'Invalid JSON format'
            });
          }
        }
      } catch (error) {
        console.log(`⚠️  Could not validate JSON in ${table}.${field}: ${error.message}`);
      }
    }

    // Validate timestamp fields (should be positive integers)
    const timestampFields = [
      { table: 'users', field: 'created_at' },
      { table: 'projects', field: 'created_at' },
      { table: 'recording_sessions', field: 'created_at' },
      { table: 'test_cases', field: 'created_at' },
    ];

    for (const { table, field } of timestampFields) {
      try {
        const invalidTimestamps = await this.db.prepare(
          `SELECT COUNT(*) as count FROM ${table} WHERE ${field} IS NOT NULL AND (${field} < 0 OR ${field} > 9999999999999)`
        ).first();

        if (invalidTimestamps.count > 0) {
          result.timestampValidationErrors += invalidTimestamps.count;
          result.corruptedRecords += invalidTimestamps.count;
          result.details[table] = result.details[table] || [];
          result.details[table].push({
            field,
            error: `Found ${invalidTimestamps.count} invalid timestamps`
          });
        }
      } catch (error) {
        console.log(`⚠️  Could not validate timestamps in ${table}.${field}: ${error.message}`);
      }
    }

    console.log(`✅ Data integrity validation complete: ${result.totalRecords} records checked, ${result.corruptedRecords} issues found`);
    return result;
  }
}

// Type definitions
interface ValidationResult {
  tables: any;
  foreignKeys: any;
  indexes: any;
  constraints: any;
  errors: string[];
  warnings: string[];
  totalTables: number;
  validatedTables: number;
  passedValidations: number;
}

interface DataIntegrityResult {
  totalRecords: number;
  corruptedRecords: number;
  jsonValidationErrors: number;
  timestampValidationErrors: number;
  details: Record<string, any[]>;
}

export default SchemaValidator;
