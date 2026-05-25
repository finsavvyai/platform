# Database Migration System

Comprehensive database migration system for SDLC.ai production deployment with automated backup, execution, verification, and rollback capabilities.

## Overview

The Database Migration System provides a safe and reliable way to apply schema changes to production databases. It includes:

- **Schema Version Tracking**: Tracks which migrations have been applied
- **Pending Migration Detection**: Identifies migrations that need to be executed
- **Pre-Migration Backups**: Automatically creates backups before applying changes
- **Migration Execution**: Executes SQL migrations with verification
- **Automatic Rollback**: Reverts to backup if migration fails
- **Backup Management**: Stores and manages database backups with metadata

## Components

### 1. MigrationManager

Handles schema version tracking and pending migration detection.

**Key Methods:**
- `getCurrentVersion(databaseName)` - Get current schema version
- `getPendingMigrations(databaseName)` - Detect pending migrations
- `getMigrationFiles()` - Get all migration files
- `verifyMigrationExecuted(databaseName, version)` - Verify migration was recorded

### 2. BackupHandler

Manages database backups before migrations.

**Key Methods:**
- `createBackup(databaseName, reason)` - Create database backup
- `verifyBackup(backupInfo)` - Verify backup integrity
- `storeBackupMetadata(backupInfo)` - Store backup metadata
- `listBackups()` - List all available backups
- `cleanupOldBackups(keepCount)` - Clean up old backups

### 3. MigrationExecutor

Executes SQL migrations and updates schema version.

**Key Methods:**
- `executeMigration(databaseName, migration)` - Execute single migration
- `executeMigrations(databaseName, migrations)` - Execute multiple migrations
- `verifyMigrationSuccess(databaseName, migration)` - Verify migration succeeded
- `updateSchemaVersion(databaseName, migration, checksum, executionTime)` - Update schema version
- `validateMigration(migration)` - Validate migration file before execution

### 4. RollbackHandler

Handles database restoration from backups.

**Key Methods:**
- `rollback(databaseName, backupId)` - Rollback to backup
- `restoreFromBackup(databaseName, backupInfo)` - Restore database
- `verifyRollback(databaseName, backupInfo)` - Verify rollback success
- `handleRollbackError(error, databaseName, backupId)` - Handle rollback errors
- `getMostRecentBackup(databaseName)` - Get most recent backup

### 5. DatabaseMigrationSystem

Orchestrates the complete migration process.

**Key Methods:**
- `migrate(databaseName)` - Execute complete migration process
- `rollback(databaseName, backupId)` - Rollback database
- `getStatus(databaseName)` - Get migration status

## Usage

### Basic Migration

```javascript
const { DatabaseMigrationSystem } = require('./lib/migrations');
const { Logger } = require('./lib/logger');

const logger = new Logger('production');
const config = {
  environment: 'production',
  databases: [
    { name: 'primary' },
    { name: 'events' }
  ]
};

const migrationSystem = new DatabaseMigrationSystem(logger, config);

// Execute migration
const result = await migrationSystem.migrate('sdlc-production-primary');

if (result.success) {
  console.log(`Migration successful: ${result.migrationsExecuted} migrations applied`);
} else {
  console.error(`Migration failed: ${result.error}`);
}
```

### Manual Rollback

```javascript
// Rollback to most recent backup
const rollbackResult = await migrationSystem.rollback('sdlc-production-primary');

// Rollback to specific backup
const rollbackResult = await migrationSystem.rollback(
  'sdlc-production-primary',
  'abc123def456'
);
```

### Check Migration Status

```javascript
const status = await migrationSystem.getStatus('sdlc-production-primary');

console.log(`Current version: ${status.currentVersion}`);
console.log(`Pending migrations: ${status.pendingMigrations}`);
console.log(`Available backups: ${status.availableBackups}`);
console.log(`Up to date: ${status.upToDate}`);
```

## Migration File Format

Migration files should be placed in `database/migrations/` and follow this naming convention:

```
XXX_description.sql
```

Where:
- `XXX` is a 3-digit version number (e.g., 001, 002, 003)
- `description` is a brief description of the migration

Example: `003_add_user_roles.sql`

### Migration File Structure

```sql
-- Migration: Add user roles table
-- Version: 003
-- Description: Creates user_roles table and relationships

CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    role_name VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
```

## Migration Process Flow

1. **Pre-Migration Validation**
   - Get current schema version
   - Detect pending migrations
   - Validate migration files

2. **Backup Creation**
   - Export current database state
   - Calculate checksum
   - Store backup metadata
   - Verify backup integrity

3. **Migration Execution**
   - Execute migrations sequentially
   - Verify each migration success
   - Update schema version
   - Track execution time

4. **Post-Migration Verification**
   - Verify all migrations recorded
   - Check database accessibility
   - Validate schema version

5. **Rollback (if needed)**
   - Drop all tables
   - Restore from backup
   - Verify restoration
   - Log rollback details

## Backup Management

### Backup Storage

Backups are stored in `deployments/production/backups/` with:
- SQL backup file: `{database}-{timestamp}-{backupId}.sql`
- Metadata file: `{backupId}.json`

### Backup Metadata

```json
{
  "backupId": "abc123def456",
  "databaseName": "sdlc-production-primary",
  "filename": "sdlc-production-primary-2025-11-19-abc123def456.sql",
  "size": 1048576,
  "checksum": "sha256-hash",
  "reason": "pre-migration",
  "createdAt": "2025-11-19T10:30:00.000Z",
  "executionTime": 1234,
  "verified": true,
  "environment": "production",
  "version": "002"
}
```

### Backup Retention

- Default retention: 30 backups per database
- Automatic cleanup of old backups
- Manual cleanup available via `cleanupOldBackups(keepCount)`

## Error Handling

### Migration Errors

If a migration fails:
1. Error is logged with details
2. Automatic rollback is initiated
3. Database is restored from pre-migration backup
4. Rollback is verified
5. Error report is generated

### Rollback Errors

If rollback fails:
1. Error is classified (backup not found, corrupted, permission, etc.)
2. Recovery action is recommended
3. Manual intervention may be required
4. Error details are logged for troubleshooting

### Error Types

- `BACKUP_NOT_FOUND` - Backup file missing
- `BACKUP_CORRUPTED` - Backup checksum mismatch
- `PERMISSION_ERROR` - File or database access denied
- `DISK_SPACE_ERROR` - Insufficient disk space
- `SQL_ERROR` - SQL syntax or execution error
- `CONNECTION_ERROR` - Database connection failed
- `UNKNOWN_ERROR` - Unclassified error

## Best Practices

### Before Migration

1. **Test migrations in development/staging first**
2. **Review migration SQL for syntax errors**
3. **Ensure sufficient disk space for backups**
4. **Verify database connectivity**
5. **Schedule migrations during low-traffic periods**

### During Migration

1. **Monitor migration progress**
2. **Watch for error messages**
3. **Keep deployment logs**
4. **Don't interrupt the process**

### After Migration

1. **Verify migration success**
2. **Test application functionality**
3. **Monitor database performance**
4. **Keep backups for recovery**
5. **Document any issues**

## Troubleshooting

### Migration Fails to Execute

**Symptoms:** Migration execution fails with SQL error

**Solutions:**
- Review migration SQL syntax
- Check for missing dependencies
- Verify table/column names
- Test migration in development first

### Backup Creation Fails

**Symptoms:** Cannot create pre-migration backup

**Solutions:**
- Check disk space availability
- Verify file permissions
- Ensure database is accessible
- Check Wrangler authentication

### Rollback Fails

**Symptoms:** Cannot restore from backup

**Solutions:**
- Verify backup file exists
- Check backup integrity (checksum)
- Ensure sufficient permissions
- Try earlier backup if available

### Schema Version Mismatch

**Symptoms:** Current version doesn't match expected

**Solutions:**
- Check schema_migrations table
- Verify migration execution history
- Manually update version if needed
- Restore from known good backup

## Integration with Deployment Orchestrator

The migration system integrates with the deployment orchestrator:

```javascript
// In deploy-orchestrator.js
const { DatabaseMigrationSystem } = require('./lib/migrations');

async function executeDatabaseMigrations() {
  const migrationSystem = new DatabaseMigrationSystem(logger, config);
  
  for (const db of config.databases) {
    const dbName = `sdlc-${config.environment}-${db.name}`;
    const result = await migrationSystem.migrate(dbName);
    
    if (!result.success) {
      throw new Error(`Migration failed for ${dbName}: ${result.error}`);
    }
  }
}
```

## Requirements Mapping

This implementation satisfies the following requirements:

- **Requirement 5.1**: Schema version tracking and pending migration detection
- **Requirement 5.2**: Sequential migration execution with version verification
- **Requirement 5.3**: Pre-migration backup creation with verification
- **Requirement 5.4**: Backup restoration on migration failure
- **Requirement 5.5**: Migration success verification and schema version update

## Testing

### Unit Tests

Test individual components:
- Migration manager version tracking
- Backup handler creation and verification
- Migration executor SQL execution
- Rollback handler restoration logic

### Integration Tests

Test complete workflows:
- Full migration process with backup
- Migration failure and rollback
- Multiple migrations in sequence
- Backup creation and restoration

### Manual Testing

1. Create test database
2. Apply migrations
3. Verify schema version
4. Test rollback
5. Verify restoration

## Future Enhancements

- **Parallel migrations** for independent changes
- **Migration dependencies** tracking
- **Dry-run mode** for testing
- **Migration scheduling** for automated execution
- **Notification system** for migration events
- **Migration analytics** and reporting
