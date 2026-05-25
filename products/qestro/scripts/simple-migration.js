/**
 * Simple Production Migration Strategy for Questro Platform
 *
 * This script provides safe deployment procedures for Questro database migrations.
 */

import fs from 'fs';
import { execSync } from 'child_process';

class ProductionMigration {
  constructor() {
    this.backupDir = './backups';
    this.reportsDir = './migration-reports';
    this.ensureDirectories();
  }

  ensureDirectories() {
    [this.backupDir, this.reportsDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  createBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupId = `backup-${timestamp}`;
    const backupPath = `${this.backupDir}/${backupId}.sql`;

    console.log(`📦 Creating backup: ${backupId}`);

    try {
      execSync(`wrangler d1 export upm-plus-config --remote > ${backupPath}`, { stdio: 'pipe' });
      const stats = fs.statSync(backupPath);

      console.log(`✅ Backup created: ${backupId} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
      return { id: backupId, path: backupPath, size: stats.size };
    } catch (error) {
      throw new Error(`Backup failed: ${error.message}`);
    }
  }

  validateMigration() {
    const migrationFile = './drizzle/0001_initial_schema.sql';
    const content = fs.readFileSync(migrationFile, 'utf8');

    console.log('🔍 Validating migration file...');

    // Check for dangerous operations
    const dangerousPatterns = [
      /DROP TABLE/gi,
      /DELETE FROM.*users/gi,
      /TRUNCATE/gi
    ];

    const errors = [];
    dangerousPatterns.forEach(pattern => {
      if (pattern.test(content)) {
        errors.push('Dangerous operation detected');
      }
    });

    if (errors.length > 0) {
      throw new Error('Migration validation failed');
    }

    console.log('✅ Migration validation passed');
  }

  async applyMigration() {
    console.log('🚀 Applying production migration...');

    try {
      // Validate migration
      this.validateMigration();

      // Create backup
      const backup = this.createBackup();

      // Apply migration
      console.log('📋 Applying changes...');
      execSync('wrangler d1 migrations apply upm-plus-config --remote');

      console.log('✅ Migration applied successfully!');
      console.log(`   Backup: ${backup.id}`);

      return { success: true, backup };

    } catch (error) {
      console.error('❌ Migration failed:', error.message);
      throw error;
    }
  }
}

// Main execution
if (process.argv[2] === 'production') {
  const migration = new ProductionMigration();

  migration.applyMigration()
    .then(() => {
      console.log('🎉 Production migration completed!');
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
} else {
  console.log('Use: npm run migrate:production');
}

export default ProductionMigration;
