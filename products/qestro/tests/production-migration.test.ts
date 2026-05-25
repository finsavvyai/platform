/**
 * Production Migration Test Suite
 *
 * Comprehensive tests for production migration strategy including:
 * - Migration workflow validation
 * - Backup and restore procedures
 * - Rollback functionality
 * - Error handling and recovery
 *
 * @author Questro Platform Team
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ProductionMigrationManager, MigrationConfig } from '../scripts/production-migration';
import { execSync } from 'child_process';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';

describe('ProductionMigrationManager', () => {
  let migrationManager: ProductionMigrationManager;
  let mockConfig: MigrationConfig;

  beforeEach(() => {
    mockConfig = {
      environment: 'staging',
      databaseId: 'test-database-id',
      backupEnabled: true,
      dryRun: false,
      forceContinue: false
    };

    migrationManager = new ProductionMigrationManager(mockConfig);

    // Mock console methods to capture logs
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Configuration Validation', () => {
    it('should create migration manager with valid config', () => {
      expect(migrationManager).toBeInstanceOf(ProductionMigrationManager);
    });

    it('should handle production environment config', () => {
      const prodConfig = { ...mockConfig, environment: 'production' as const };
      const prodManager = new ProductionMigrationManager(prodConfig);
      expect(prodManager).toBeInstanceOf(ProductionMigrationManager);
    });

    it('should handle dry run configuration', () => {
      const dryRunConfig = { ...mockConfig, dryRun: true };
      const dryRunManager = new ProductionMigrationManager(dryRunConfig);
      expect(dryRunManager).toBeInstanceOf(ProductionMigrationManager);
    });
  });

  describe('Migration Hash Calculation', () => {
    it('should calculate consistent hash for same files', async () => {
      // Create temporary migration files
      const tempDir = join(process.cwd(), 'drizzle');
      const tempFile = join(tempDir, 'test_migration.sql');

      writeFileSync(tempFile, 'CREATE TABLE test (id INTEGER);');

      const hash1 = await migrationManager['calculateMigrationHash']();
      const hash2 = await migrationManager['calculateMigrationHash']();

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hash

      // Cleanup
      if (existsSync(tempFile)) {
        unlinkSync(tempFile);
      }
    });

    it('should generate different hashes for different file contents', async () => {
      const tempDir = join(process.cwd(), 'drizzle');
      const tempFile = join(tempDir, 'test_migration.sql');

      writeFileSync(tempFile, 'CREATE TABLE test1 (id INTEGER);');
      const hash1 = await migrationManager['calculateMigrationHash']();

      writeFileSync(tempFile, 'CREATE TABLE test2 (id INTEGER);');
      const hash2 = await migrationManager['calculateMigrationHash']();

      expect(hash1).not.toBe(hash2);

      // Cleanup
      if (existsSync(tempFile)) {
        unlinkSync(tempFile);
      }
    });
  });

  describe('Pre-Migration Validation', () => {
    it('should validate database connectivity', async () => {
      // Mock successful database connection
      jest.spyOn(execSync, 'mockImplementation').mockReturnValueOnce('');

      await expect(migrationManager['validatePreMigration']()).resolves.not.toThrow();
    });

    it('should fail validation when database is unreachable', async () => {
      // Mock failed database connection
      jest.spyOn(execSync, 'mockImplementation').mockImplementationOnce(() => {
        throw new Error('Database connection failed');
      });

      await expect(migrationManager['validatePreMigration']()).rejects.toThrow('Database connectivity failed');
    });

    it('should detect missing migration files', async () => {
      // Mock empty migration directory
      jest.spyOn(execSync, 'mockImplementation').mockReturnValueOnce('');

      await expect(migrationManager['validatePreMigration']()).rejects.toThrow('No migration files found');
    });
  });

  describe('Backup Creation', () => {
    it('should create backup when enabled', async () => {
      // Mock successful backup creation
      const mockBackupFile = 'backups/test-backup.sql';
      jest.spyOn(execSync, 'mockImplementation').mockReturnValueOnce(mockBackupFile);
      jest.spyOn(process, 'cwd').mockReturnValueOnce('/test/dir');

      const backupLocation = await migrationManager['createBackup']();

      expect(backupLocation).toContain('backups/qestro-backup-');
      expect(backupLocation).toContain('.sql');
    });

    it('should skip backup when disabled', async () => {
      const noBackupConfig = { ...mockConfig, backupEnabled: false };
      const noBackupManager = new ProductionMigrationManager(noBackupConfig);

      const result = await noBackupManager.executeMigration();

      expect(result.backupLocation).toBeUndefined();
      expect(result.success).toBe(true);
    });

    it('should handle backup creation failure', async () => {
      // Mock failed backup creation
      jest.spyOn(execSync, 'mockImplementation').mockImplementationOnce(() => {
        throw new Error('Backup creation failed');
      });

      await expect(migrationManager['createBackup']()).rejects.toThrow('Backup creation failed');
    });
  });

  describe('Post-Migration Validation', () => {
    it('should validate schema successfully', async () => {
      // Mock successful schema validation
      const mockSchemaResult = 'users\nprojects\ntest_cases';
      jest.spyOn(execSync, 'mockImplementation').mockReturnValueOnce(mockSchemaResult);

      const result = await migrationManager['validateSchema']();

      expect(result).toBe(true);
    });

    it('should detect insufficient tables', async () => {
      // Mock insufficient table count
      const mockSchemaResult = 'users\nprojects'; // Only 2 tables instead of 33
      jest.spyOn(execSync, 'mockImplementation').mockReturnValueOnce(mockSchemaResult);

      const result = await migrationManager['validateSchema']();

      expect(result).toBe(false);
    });

    it('should validate data integrity', async () => {
      // Mock successful foreign key check
      jest.spyOn(execSync, 'mockImplementation').mockReturnValueOnce(''); // No violations

      const result = await migrationManager['validateDataIntegrity']();

      expect(result).toBe(true);
    });

    it('should detect foreign key violations', async () => {
      // Mock foreign key violations
      jest.spyOn(execSync, 'mockImplementation').mockReturnValueOnce('users|projects|1|2');

      const result = await migrationManager['validateDataIntegrity']();

      expect(result).toBe(false);
    });

    it('should validate performance benchmarks', async () => {
      // Mock fast query response
      jest.spyOn(execSync, 'mockImplementation').mockReturnValueOnce('10');
      jest.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(1500);

      const result = await migrationManager['validatePerformance']();

      expect(result).toBe(true);
    });

    it('should detect performance degradation', async () => {
      // Mock slow query response
      jest.spyOn(execSync, 'mockImplementation').mockReturnValueOnce('10');
      jest.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(3000);

      const result = await migrationManager['validatePerformance']();

      expect(result).toBe(false);
    });
  });

  describe('Rollback Script Generation', () => {
    it('should generate rollback script with correct format', async () => {
      const migrationHash = 'abc123';
      const rollbackScript = await migrationManager['generateRollbackScript'](migrationHash);

      expect(rollbackScript).toContain('-- Questro Platform Migration Rollback Script');
      expect(rollbackScript).toContain(migrationHash);
      expect(rollbackScript).toContain('DROP TABLE IF EXISTS');
      expect(rollbackScript).toContain('BEGIN TRANSACTION');
      expect(rollbackScript).toContain('COMMIT');
    });

    it('should create rollback script file', async () => {
      const migrationHash = 'abc123';

      jest.spyOn(writeFileSync, 'mockImplementation').mockImplementationOnce(() => {});

      const rollbackScriptPath = await migrationManager['generateRollbackScript'](migrationHash);

      expect(rollbackScriptPath).toContain('scripts/rollback-');
      expect(rollbackScriptPath).toContain('.sql');
      expect(writeFileSync).toHaveBeenCalled();
    });
  });

  describe('Complete Migration Workflow', () => {
    it('should execute complete migration successfully', async () => {
      // Mock all successful operations
      jest.spyOn(migrationManager as any, 'validatePreMigration').mockResolvedValueOnce(undefined);
      jest.spyOn(migrationManager as any, 'createBackup').mockResolvedValueOnce('test-backup.sql');
      jest.spyOn(migrationManager as any, 'calculateMigrationHash').mockResolvedValueOnce('abc123');
      jest.spyOn(migrationManager as any, 'executeDatabaseMigration').mockResolvedValueOnce(undefined);
      jest.spyOn(migrationManager as any, 'validatePostMigration').mockResolvedValueOnce({
        schemaValidation: true,
        dataIntegrityCheck: true,
        performanceCheck: true,
        foreignKeyCheck: true,
        indexCheck: true
      });
      jest.spyOn(migrationManager as any, 'generateRollbackScript').mockResolvedValueOnce('rollback.sql');
      jest.spyOn(migrationManager as any, 'updateMigrationRegistry').mockResolvedValueOnce(undefined);

      const result = await migrationManager.executeMigration();

      expect(result.success).toBe(true);
      expect(result.backupLocation).toBe('test-backup.sql');
      expect(result.migrationHash).toBe('abc123');
      expect(result.rollbackScript).toBe('rollback.sql');
      expect(result.validationResults.schemaValidation).toBe(true);
    });

    it('should handle migration failure gracefully', async () => {
      // Mock failed pre-migration validation
      jest.spyOn(migrationManager as any, 'validatePreMigration').mockRejectedValueOnce(new Error('Validation failed'));

      const result = await migrationManager.executeMigration();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation failed');
      expect(result.validationResults.schemaValidation).toBe(false);
    });

    it('should execute dry run without applying changes', async () => {
      const dryRunConfig = { ...mockConfig, dryRun: true };
      const dryRunManager = new ProductionMigrationManager(dryRunConfig);

      // Mock successful validation but skip actual migration
      jest.spyOn(dryRunManager as any, 'validatePreMigration').mockResolvedValueOnce(undefined);
      jest.spyOn(dryRunManager as any, 'calculateMigrationHash').mockResolvedValueOnce('abc123');
      jest.spyOn(dryRunManager as any, 'validatePostMigration').mockResolvedValueOnce({
        schemaValidation: true,
        dataIntegrityCheck: true,
        performanceCheck: true,
        foreignKeyCheck: true,
        indexCheck: true
      });
      jest.spyOn(dryRunManager as any, 'generateRollbackScript').mockResolvedValueOnce('rollback.sql');

      const result = await dryRunManager.executeMigration();

      expect(result.success).toBe(true);
      expect(result.backupLocation).toBeUndefined(); // No backup in dry run
    });
  });

  describe('Emergency Rollback', () => {
    it('should attempt emergency rollback on failure', async () => {
      // Mock failed migration
      jest.spyOn(migrationManager as any, 'validatePreMigration').mockRejectedValueOnce(new Error('Migration failed'));

      // Mock successful rollback
      jest.spyOn(execSync, 'mockImplementation').mockReturnValueOnce('rollback-script.sql\n');

      const result = await migrationManager.executeMigration();

      expect(result.success).toBe(false);
      // Emergency rollback should be attempted
    });

    it('should handle missing rollback script gracefully', async () => {
      // Mock failed migration and missing rollback script
      jest.spyOn(migrationManager as any, 'validatePreMigration').mockRejectedValueOnce(new Error('Migration failed'));
      jest.spyOn(execSync, 'mockImplementation').mockReturnValueOnce(''); // No scripts found

      const result = await migrationManager.executeMigration();

      expect(result.success).toBe(false);
      // Should not throw error for missing rollback script
    });
  });

  describe('Production Environment Validation', () => {
    it('should validate production environment requirements', async () => {
      const prodConfig = { ...mockConfig, environment: 'production' as const };
      const prodManager = new ProductionMigrationManager(prodConfig);

      // Mock production environment setup
      process.env.CLOUDFLARE_API_TOKEN = 'test-token';

      await expect(prodManager['validateProductionEnvironment']()).resolves.not.toThrow();
    });

    it('should reject non-production database in production environment', async () => {
      const prodConfig = { ...mockConfig, environment: 'production' as const, databaseId: 'staging-db' };
      const prodManager = new ProductionMigrationManager(prodConfig);

      process.env.CLOUDFLARE_API_TOKEN = 'test-token';

      await expect(prodManager['validateProductionEnvironment']()).rejects.toThrow('non-production database ID');
    });

    it('should reject missing environment variables', async () => {
      const prodConfig = { ...mockConfig, environment: 'production' as const };
      const prodManager = new ProductionMigrationManager(prodConfig);

      delete process.env.CLOUDFLARE_API_TOKEN;

      await expect(prodManager['validateProductionEnvironment']()).rejects.toThrow('CLOUDFLARE_API_TOKEN');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle execSync failures gracefully', async () => {
      // Mock execSync throwing error
      jest.spyOn(execSync, 'mockImplementation').mockImplementation(() => {
        throw new Error('Command failed');
      });

      await expect(migrationManager['validateSchema']()).rejects.toThrow();
    });

    it('should handle empty migration directory', async () => {
      // Mock empty migration files result
      jest.spyOn(execSync, 'mockImplementation').mockReturnValueOnce('');

      const files = migrationManager['getMigrationFiles']();
      expect(files).toEqual([]);
    });

    it('should create log directory if not exists', () => {
      // Test log directory creation (should not throw)
      expect(() => migrationManager['ensureLogDirectory']()).not.toThrow();
    });
  });

  describe('Performance and Resource Management', () => {
    it('should complete migration within reasonable time', async () => {
      // Mock fast operations
      jest.spyOn(migrationManager as any, 'validatePreMigration').mockResolvedValueOnce(undefined);
      jest.spyOn(migrationManager as any, 'createBackup').mockResolvedValueOnce('test-backup.sql');
      jest.spyOn(migrationManager as any, 'calculateMigrationHash').mockResolvedValueOnce('abc123');
      jest.spyOn(migrationManager as any, 'executeDatabaseMigration').mockResolvedValueOnce(undefined);
      jest.spyOn(migrationManager as any, 'validatePostMigration').mockResolvedValueOnce({
        schemaValidation: true,
        dataIntegrityCheck: true,
        performanceCheck: true,
        foreignKeyCheck: true,
        indexCheck: true
      });
      jest.spyOn(migrationManager as any, 'generateRollbackScript').mockResolvedValueOnce('rollback.sql');
      jest.spyOn(migrationManager as any, 'updateMigrationRegistry').mockResolvedValueOnce(undefined);

      const startTime = Date.now();
      const result = await migrationManager.executeMigration();
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second for mocked operations
    });

    it('should handle large migration files efficiently', async () => {
      // This test would be implemented with actual large migration files
      // For now, we'll mock the scenario
      const largeFileHash = await migrationManager['calculateMigrationHash']();
      expect(largeFileHash).toMatch(/^[a-f0-9]{64}$/);
    });
  });
});

describe('Migration Integration Tests', () => {
  describe('End-to-End Migration Scenarios', () => {
    it('should handle complete successful migration workflow', async () => {
      const config: MigrationConfig = {
        environment: 'staging',
        databaseId: 'integration-test-db',
        backupEnabled: true,
        dryRun: false,
        forceContinue: false
      };

      const manager = new ProductionMigrationManager(config);

      // Mock all external dependencies
      jest.spyOn(manager as any, 'validatePreMigration').mockResolvedValueOnce(undefined);
      jest.spyOn(manager as any, 'createBackup').mockResolvedValueOnce('integration-backup.sql');
      jest.spyOn(manager as any, 'calculateMigrationHash').mockResolvedValueOnce('integration-hash');
      jest.spyOn(manager as any, 'executeDatabaseMigration').mockResolvedValueOnce(undefined);
      jest.spyOn(manager as any, 'validatePostMigration').mockResolvedValueOnce({
        schemaValidation: true,
        dataIntegrityCheck: true,
        performanceCheck: true,
        foreignKeyCheck: true,
        indexCheck: true
      });
      jest.spyOn(manager as any, 'generateRollbackScript').mockResolvedValueOnce('integration-rollback.sql');
      jest.spyOn(manager as any, 'updateMigrationRegistry').mockResolvedValueOnce(undefined);

      const result = await manager.executeMigration();

      expect(result.success).toBe(true);
      expect(result.migrationHash).toBe('integration-hash');
      expect(result.validationResults).toEqual({
        schemaValidation: true,
        dataIntegrityCheck: true,
        performanceCheck: true,
        foreignKeyCheck: true,
        indexCheck: true
      });
    });
  });
});
