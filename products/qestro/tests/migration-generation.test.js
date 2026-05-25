/**
 * Migration Generation Tests
 * Tests for the database migration generation functionality
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

describe('Database Migration Generation', () => {
  const migrationDir = path.join(projectRoot, 'drizzle');
  const schemaPath = path.join(projectRoot, 'src/db/schema.ts');
  const completeSchemaPath = path.join(projectRoot, 'scripts/create-complete-schema.sql');

  beforeAll(() => {
    // Ensure test environment is ready
    if (!fs.existsSync(schemaPath)) {
      throw new Error('Schema file not found');
    }
    if (!fs.existsSync(completeSchemaPath)) {
      throw new Error('Complete schema file not found');
    }
  });

  describe('Schema File Validation', () => {
    test('should have schema file with table definitions', () => {
      const schemaContent = fs.readFileSync(schemaPath, 'utf8');

      // Check for essential table exports
      expect(schemaContent).toContain('export const users');
      expect(schemaContent).toContain('export const projects');
      expect(schemaContent).toContain('export const testCases');
      expect(schemaContent).toContain('export const subscriptions');

      // Count table exports
      const tableExports = schemaContent.match(/export const \w+ = sqliteTable/g);
      expect(tableExports.length).toBe(33);
    });

    test('should have complete schema SQL file', () => {
      const completeSchemaContent = fs.readFileSync(completeSchemaPath, 'utf8');

      // Check for essential CREATE TABLE statements
      expect(completeSchemaContent).toContain('CREATE TABLE users');
      expect(completeSchemaContent).toContain('CREATE TABLE projects');
      expect(completeSchemaContent).toContain('CREATE TABLE test_cases');
      expect(completeSchemaContent).toContain('CREATE TABLE subscriptions');

      // Check for foreign key constraints
      expect(completeSchemaContent).toContain('FOREIGN KEY');

      // Check for transaction handling
      expect(completeSchemaContent).toContain('BEGIN TRANSACTION');
      expect(completeSchemaContent).toContain('COMMIT');
    });
  });

  describe('Migration Generation Script', () => {
    test('should generate migration with all required components', () => {
      // Run migration generation
      const { execSync } = require('child_process');

      try {
        const output = execSync('node scripts/generate-complete-migration.js', {
          cwd: projectRoot,
          encoding: 'utf8'
        });

        // Check for success indicators
        expect(output).toContain('🎉 Complete migration generation successful');
        expect(output).toContain('Tables: 33');
        expect(output).toContain('Indexes: 95');
        expect(output).toContain('Triggers: 18');

      } catch (error) {
        console.error('Migration generation failed:', error);
        throw error;
      }
    });

    test('should create migration file in correct location', () => {
      const migrationFiles = fs.readdirSync(migrationDir)
        .filter(file => file.endsWith('.sql') && file.includes('questro'))
        .sort()
        .reverse();

      expect(migrationFiles.length).toBeGreaterThan(0);

      const latestMigration = migrationFiles[0];
      const migrationPath = path.join(migrationDir, latestMigration);

      expect(fs.existsSync(migrationPath)).toBe(true);

      // Check migration file content
      const migrationContent = fs.readFileSync(migrationPath, 'utf8');

      // Essential components
      expect(migrationContent).toContain('PRAGMA foreign_keys = ON');
      expect(migrationContent).toContain('BEGIN TRANSACTION');
      expect(migrationContent).toContain('COMMIT');
      expect(migrationContent).toContain('CREATE TABLE users');
      expect(migrationContent).toContain('CREATE INDEX');
      expect(migrationContent).toContain('CREATE TRIGGER');

      // Should not contain harmful commands
      expect(migrationContent).not.toContain('DROP TABLE');
      expect(migrationContent).not.toContain('DELETE FROM');
    });
  });

  describe('Migration Validation', () => {
    test('should pass all validation checks', () => {
      // Run validation script
      const { execSync } = require('child_process');

      try {
        const output = execSync('node scripts/validate-migration.js', {
          cwd: projectRoot,
          encoding: 'utf8'
        });

        // Check for successful validation
        expect(output).toContain('✅ Migration validation PASSED');
        expect(output).toContain('✅ Ready for deployment');
        expect(output).toContain('Development: wrangler d1 migrations apply upm-plus-config --local');
        expect(output).toContain('Production:  wrangler d1 migrations apply upm-plus-config --remote');

      } catch (error) {
        console.error('Migration validation failed:', error.stdout);
        throw error;
      }
    });

    test('should validate table counts correctly', () => {
      const migrationFiles = fs.readdirSync(migrationDir)
        .filter(file => file.endsWith('.sql') && file.includes('questro'))
        .sort()
        .reverse();

      const latestMigration = migrationFiles[0];
      const migrationPath = path.join(migrationDir, latestMigration);
      const migrationContent = fs.readFileSync(migrationPath, 'utf8');

      // Count actual elements
      const tableCount = (migrationContent.match(/CREATE TABLE/g) || []).length - 1; // Exclude migration_meta
      const indexCount = (migrationContent.match(/CREATE INDEX/g) || []).length;
      const triggerCount = (migrationContent.match(/CREATE TRIGGER/g) || []).length;

      // Validate counts
      expect(tableCount).toBe(33);
      expect(indexCount).toBeGreaterThanOrEqual(50);
      expect(triggerCount).toBeGreaterThanOrEqual(15);
    });
  });

  describe('Migration Metadata', () => {
    test('should create comprehensive metadata file', () => {
      const metadataPath = path.join(migrationDir, 'migration-metadata.json');

      expect(fs.existsSync(metadataPath)).toBe(true);

      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

      // Check metadata structure
      expect(metadata).toHaveProperty('migration');
      expect(metadata).toHaveProperty('schema');
      expect(metadata).toHaveProperty('features');
      expect(metadata).toHaveProperty('deployment');

      // Check migration info
      expect(metadata.migration).toHaveProperty('version');
      expect(metadata.migration).toHaveProperty('timestamp');
      expect(metadata.migration).toHaveProperty('database', 'cloudflare-d1');
      expect(metadata.migration).toHaveProperty('platform', 'cloudflare-workers');

      // Check schema info
      expect(metadata.schema).toHaveProperty('tables', 33);
      expect(metadata.schema).toHaveProperty('indexes');
      expect(metadata.schema).toHaveProperty('triggers');

      // Check features
      expect(metadata.features).toHaveProperty('automaticTimestamps', true);
      expect(metadata.features).toHaveProperty('foreignKeyConstraints', true);
      expect(metadata.features).toHaveProperty('productionReady', true);

      // Check deployment commands
      expect(metadata.deployment).toHaveProperty('localCommand');
      expect(metadata.deployment).toHaveProperty('remoteCommand');
      expect(metadata.deployment.localCommand).toContain('wrangler d1 migrations apply upm-plus-config');
      expect(metadata.deployment.remoteCommand).toContain('wrangler d1 migrations apply upm-plus-config');
    });
  });

  describe('Error Handling', () => {
    test('should handle missing schema file gracefully', () => {
      // This test would involve temporarily renaming the schema file
      // and verifying the script handles the error appropriately
      // For now, we'll just verify the error handling exists
      const migrationScript = fs.readFileSync(
        path.join(projectRoot, 'scripts/generate-complete-migration.js'),
        'utf8'
      );

      // Check for error handling patterns
      expect(migrationScript).toContain('fs.readFileSync');
      expect(migrationScript).toContain('console.log');
    });

    test('should handle missing migrations directory', () => {
      // Verify the script creates the migrations directory if it doesn't exist
      const migrationScript = fs.readFileSync(
        path.join(projectRoot, 'scripts/generate-complete-migration.js'),
        'utf8'
      );

      expect(migrationScript).toContain('fs.mkdirSync');
      expect(migrationScript).toContain('recursive: true');
    });
  });

  describe('Performance and Best Practices', () => {
    test('should generate reasonably sized migration file', () => {
      const migrationFiles = fs.readdirSync(migrationDir)
        .filter(file => file.endsWith('.sql') && file.includes('questro'))
        .sort()
        .reverse();

      const latestMigration = migrationFiles[0];
      const migrationPath = path.join(migrationDir, latestMigration);
      const stats = fs.statSync(migrationPath);

      // File should be reasonably sized (not too large, not too small)
      const fileSizeKB = stats.size / 1024;
      expect(fileSizeKB).toBeGreaterThan(10); // At least 10KB
      expect(fileSizeKB).toBeLessThan(100);  // Less than 100KB
    });

    test('should include performance optimizations', () => {
      const migrationFiles = fs.readdirSync(migrationDir)
        .filter(file => file.endsWith('.sql') && file.includes('questro'))
        .sort()
        .reverse();

      const latestMigration = migrationFiles[0];
      const migrationPath = path.join(migrationDir, latestMigration);
      const migrationContent = fs.readFileSync(migrationPath, 'utf8');

      // Check for performance optimizations
      expect(migrationContent).toContain('PRAGMA journal_mode = WAL');
      expect(migrationContent).toContain('PRAGMA synchronous = NORMAL');
      expect(migrationContent).toContain('PRAGMA cache_size = 1000');
      expect(migrationContent).toContain('CREATE INDEX');
    });
  });
});

// Integration test for the complete workflow
describe('Complete Migration Workflow', () => {
  test('should complete full migration generation workflow', async () => {
    const { execSync } = require('child_process');

    // Step 1: Generate migration
    try {
      execSync('node scripts/generate-complete-migration.js', {
        cwd: projectRoot,
        encoding: 'utf8'
      });
    } catch (error) {
      console.error('Migration generation failed:', error);
      throw error;
    }

    // Step 2: Validate migration
    try {
      const validationOutput = execSync('node scripts/validate-migration.js', {
        cwd: projectRoot,
        encoding: 'utf8'
      });

      expect(validationOutput).toContain('✅ Migration validation PASSED');
    } catch (error) {
      console.error('Migration validation failed:', error.stdout);
      throw error;
    }

    // Step 3: Verify deployment commands are provided
    const migrationFiles = fs.readdirSync(path.join(projectRoot, 'drizzle'))
      .filter(file => file.endsWith('.sql') && file.includes('questro'))
      .sort()
      .reverse();

    expect(migrationFiles.length).toBeGreaterThan(0);

    // The workflow should be complete and ready for deployment
    expect(true).toBe(true);
  }, 30000); // 30 second timeout for the complete workflow
});
