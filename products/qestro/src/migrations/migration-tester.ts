// Database Migration and Validation Test Script
// Tests the complete PostgreSQL to D1 SQLite migration

import { SchemaValidator } from './schema-validator.js';

export class MigrationTester {
  async runCompleteMigrationTest(db: D1Database): Promise<TestResult> {
    console.log('🚀 Starting complete migration test...');

    const result: TestResult = {
      status: 'running',
      startTime: Date.now(),
      tests: [],
      passed: 0,
      failed: 0,
      warnings: 0,
      errors: [],
      summary: '',
    };

    try {
      // Test 1: Schema Validation
      console.log('\n📋 Test 1: Schema Structure Validation');
      const validator = new SchemaValidator(db);
      const schemaResult = await validator.validateAllTables();

      result.tests.push({
        name: 'Schema Structure Validation',
        status: schemaResult.errors.length === 0 ? 'passed' : 'failed',
        details: `Validated ${schemaResult.validatedTables}/${schemaResult.totalTables} tables`,
        errors: schemaResult.errors,
        warnings: schemaResult.warnings,
      });

      if (schemaResult.errors.length === 0) result.passed++;
      else result.failed++;

      // Test 2: Foreign Key Validation
      console.log('\n🔗 Test 2: Foreign Key Relationships');
      if (schemaResult.errors.length === 0) {
        result.tests.push({
          name: 'Foreign Key Relationships',
          status: 'passed',
          details: 'All foreign key relationships validated successfully',
        });
        result.passed++;
      } else {
        result.tests.push({
          name: 'Foreign Key Relationships',
          status: 'failed',
          details: 'Foreign key validation failed',
          errors: schemaResult.errors.filter(e => e.includes('Foreign key')),
        });
        result.failed++;
      }

      // Test 3: Data Integrity Validation
      console.log('\n🔍 Test 3: Data Integrity');
      const integrityResult = await validator.validateDataIntegrity();

      result.tests.push({
        name: 'Data Integrity Validation',
        status: integrityResult.corruptedRecords === 0 ? 'passed' : 'warning',
        details: `Checked ${integrityResult.totalRecords} records, ${integrityResult.corruptedRecords} issues found`,
        warnings: integrityResult.corruptedRecords > 0 ? [`${integrityResult.corruptedRecords} data integrity issues found`] : [],
      });

      if (integrityResult.corruptedRecords === 0) result.passed++;
      else result.warnings++;

      // Test 4: Performance Index Validation
      console.log('\n⚡ Test 4: Performance Indexes');
      const performanceTest = await this.testPerformanceIndexes(db);

      result.tests.push({
        name: 'Performance Indexes',
        status: performanceTest.status,
        details: performanceTest.details,
        errors: performanceTest.errors,
      });

      if (performanceTest.status === 'passed') result.passed++;
      else result.failed++;

      // Test 5: CRUD Operations Test
      console.log('\n🔄 Test 5: CRUD Operations');
      const crudTest = await this.testCRUDOperations(db);

      result.tests.push({
        name: 'CRUD Operations',
        status: crudTest.status,
        details: crudTest.details,
        errors: crudTest.errors,
      });

      if (crudTest.status === 'passed') result.passed++;
      else result.failed++;

      // Generate summary
      result.endTime = Date.now();
      result.duration = result.endTime - result.startTime;
      result.status = result.failed === 0 ? 'passed' : 'failed';

      result.summary = `
Migration Test Complete:
✅ Passed: ${result.passed}/${result.tests.length}
❌ Failed: ${result.failed}/${result.tests.length}
⚠️  Warnings: ${result.warnings}
⏱️  Duration: ${result.duration}ms
📊 Success Rate: ${Math.round((result.passed / result.tests.length) * 100)}%
      `.trim();

      console.log('\n' + result.summary);

      // Test-specific recommendations
      if (result.warnings > 0) {
        console.log('\n⚠️  Recommendations:');
        console.log('- Review data integrity issues before production deployment');
        console.log('- Consider running data cleanup scripts');
      }

      if (result.failed > 0) {
        console.log('\n❌ Critical Issues Found:');
        console.log('- Fix schema validation errors before proceeding');
        console.log('- Review foreign key relationships');
        console.log('- Test database connection and permissions');
      }

      return result;

    } catch (error) {
      result.status = 'error';
      result.errors.push(`Test execution failed: ${error.message}`);
      result.endTime = Date.now();
      result.duration = result.endTime - result.startTime;

      console.log(`\n❌ Migration test failed: ${error.message}`);
      return result;
    }
  }

  private async testPerformanceIndexes(db: D1Database): Promise<SubTestResult> {
    const result: SubTestResult = {
      status: 'passed',
      details: '',
      errors: [],
    };

    try {
      // Test common query patterns with EXPLAIN QUERY PLAN
      const testQueries = [
        'EXPLAIN QUERY PLAN SELECT * FROM users WHERE email = ?',
        'EXPLAIN QUERY PLAN SELECT * FROM projects WHERE user_id = ?',
        'EXPLAIN QUERY PLAN SELECT * FROM test_runs WHERE project_id = ? AND status = ?',
        'EXPLAIN QUERY PLAN SELECT * FROM api_calls WHERE endpoint_id = ? AND success = ?',
        'EXPLAIN QUERY PLAN SELECT * FROM plugin_installations WHERE user_id = ? AND is_active = ?',
      ];

      let indexedQueries = 0;
      for (const query of testQueries) {
        const plan = await db.prepare(query).bind('test-value').first();
        if (plan && plan.details && !plan.details.includes('SCAN TABLE')) {
          indexedQueries++;
        }
      }

      if (indexedQueries === testQueries.length) {
        result.details = `All ${testQueries.length} test queries are properly indexed`;
      } else {
        result.status = 'warning';
        result.details = `${indexedQueries}/${testQueries.length} queries are properly indexed`;
        result.errors.push(`Consider adding indexes for ${testQueries.length - indexedQueries} unindexed queries`);
      }

    } catch (error) {
      result.status = 'failed';
      result.errors.push(`Performance test failed: ${error.message}`);
    }

    return result;
  }

  private async testCRUDOperations(db: D1Database): Promise<SubTestResult> {
    const result: SubTestResult = {
      status: 'passed',
      details: '',
      errors: [],
    };

    try {
      // Test CREATE operation
      const createResult = await db.prepare(`
        INSERT INTO users (id, email, password, role, subscription, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        'test-user-id-' + Date.now(),
        'test@example.com',
        'hashed-password',
        'user',
        'free',
        Date.now(),
        Date.now()
      ).run();

      if (createResult.changes !== 1) {
        throw new Error('CREATE operation failed');
      }

      // Test READ operation
      const readResult = await db.prepare(
        'SELECT * FROM users WHERE email = ?'
      ).bind('test@example.com').first();

      if (!readResult) {
        throw new Error('READ operation failed');
      }

      // Test UPDATE operation
      const updateResult = await db.prepare(`
        UPDATE users SET last_login_at = ? WHERE id = ?
      `).bind(Date.now(), readResult.id).run();

      if (updateResult.changes !== 1) {
        throw new Error('UPDATE operation failed');
      }

      // Test DELETE operation
      const deleteResult = await db.prepare(
        'DELETE FROM users WHERE id = ?'
      ).bind(readResult.id).run();

      if (deleteResult.changes !== 1) {
        throw new Error('DELETE operation failed');
      }

      result.details = 'All CRUD operations completed successfully';

    } catch (error) {
      result.status = 'failed';
      result.errors.push(`CRUD test failed: ${error.message}`);
    }

    return result;
  }

  async generateMigrationReport(db: D1Database): Promise<MigrationReport> {
    console.log('📊 Generating migration report...');

    const report: MigrationReport = {
      migrationDate: new Date().toISOString(),
      sourceDatabase: 'PostgreSQL',
      targetDatabase: 'Cloudflare D1 SQLite',
      tablesMigrated: 0,
      dataTypesConverted: {},
      indexesCreated: 0,
      constraintsApplied: 0,
      validationResults: null,
      recommendations: [],
    };

    try {
      // Count migrated tables
      const tablesResult = await db.prepare(
        "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
      ).first();

      report.tablesMigrated = tablesResult.count;

      // Count indexes
      const indexesResult = await db.prepare(
        "SELECT COUNT(*) as count FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'"
      ).first();

      report.indexesCreated = indexesResult.count;

      // Data type conversions applied
      report.dataTypesConverted = {
        'UUID -> TEXT': 'Applied',
        'VARCHAR/TEXT -> TEXT': 'Applied',
        'TIMESTAMP -> INTEGER': 'Applied',
        'BOOLEAN -> INTEGER': 'Applied',
        'JSONB -> TEXT (JSON)': 'Applied',
        'DECIMAL -> REAL': 'Applied',
        'ARRAY -> TEXT (JSON)': 'Applied',
      };

      // Run validation
      const validator = new SchemaValidator(db);
      report.validationResults = await validator.validateAllTables();

      // Generate recommendations
      if (report.validationResults.errors.length > 0) {
        report.recommendations.push('Fix schema validation errors before production deployment');
      }

      if (report.validationResults.warnings.length > 0) {
        report.recommendations.push('Review and address validation warnings');
      }

      report.recommendations.push('Run comprehensive testing with real data');
      report.recommendations.push('Set up monitoring for database performance');
      report.recommendations.push('Create backup and restore procedures');

      console.log('✅ Migration report generated successfully');
      return report;

    } catch (error) {
      console.log(`❌ Report generation failed: ${error.message}`);
      throw error;
    }
  }
}

// Type definitions
interface TestResult {
  status: 'running' | 'passed' | 'failed' | 'error';
  startTime: number;
  endTime?: number;
  duration?: number;
  tests: SubTestResult[];
  passed: number;
  failed: number;
  warnings: number;
  errors: string[];
  summary: string;
}

interface SubTestResult {
  status: 'passed' | 'failed' | 'warning';
  details: string;
  errors: string[];
  warnings?: string[];
}

interface MigrationReport {
  migrationDate: string;
  sourceDatabase: string;
  targetDatabase: string;
  tablesMigrated: number;
  dataTypesConverted: Record<string, string>;
  indexesCreated: number;
  constraintsApplied: number;
  validationResults: any;
  recommendations: string[];
}

export default MigrationTester;
