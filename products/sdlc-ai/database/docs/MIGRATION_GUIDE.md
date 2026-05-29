# Database Migration Guide - SDLC.ai

## Overview

This guide provides comprehensive instructions for managing database migrations in the SDLC.ai system. The migration system supports version-controlled schema changes with rollback capabilities, dependency management, and comprehensive validation.

## Migration System Architecture

### Migration Structure

Each migration follows this structure:

```
migrations/
├── 000_schema_migrations_table.sql          # Migration tracking table
├── 001_create_extensions_and_types.sql      # Extensions and custom types
├── 002_create_core_tables.sql               # Core multi-tenant tables
├── 003_create_policy_and_security_tables.sql # Security and policy tables
├── 004_create_views_and_materialized_views.sql # Analytics views
├── 005_implement_row_level_security.sql      # RLS policies
├── 006_create_triggers_and_constraints.sql   # Triggers and constraints
└── migrate.sql                               # Migration orchestration
```

### Migration File Format

Each migration file follows this template:

```sql
-- Migration XXX: [Descriptive Name]
-- Version: 1.0.0
-- Description: [Detailed description of changes]
-- Dependencies: [Previous migration files]
-- Rollback: [Rollback strategy description]
-- Tags: [comma-separated tags]

BEGIN;

-- Migration SQL here

-- Record migration
INSERT INTO schema_migrations (
    version,
    description,
    filename,
    checksum,
    rollback_script,
    dependencies,
    tags,
    metadata
) VALUES (
    'XXX',
    '[Descriptive Name]',
    'XXX_filename.sql',
    md5('XXX_filename.sql'),
    $rollback$
    -- Rollback SQL here
    $rollback$,
    '{dependencies}',
    '{tags}',
    '{"metadata": "values"}'
);

COMMIT;
```

## Migration Management

### Initial Setup

**1. Create Database:**
```sql
CREATE DATABASE sdlc OWNER sdlc_user;
CREATE USER sdlc_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE sdlc TO sdlc_user;
```

**2. Run Initial Migration:**
```bash
# Connect to the database
psql -h localhost -U sdlc_user -d sdlc

# Run the initial migration to create the tracking table
psql -h localhost -U sdlc_user -d sdlc -f migrations/000_schema_migrations_table.sql
```

### Running Migrations

**Method 1: Using Migration Script:**
```bash
# Run all pending migrations
psql -h localhost -U sdlc_user -d sdlc -f migrations/migrate.sql
```

**Method 2: Individual Migration:**
```bash
# Run specific migration in order
psql -h localhost -U sdlc_user -d sdlc -f migrations/001_create_extensions_and_types.sql
psql -h localhost -U sdlc_user -d sdlc -f migrations/002_create_core_tables.sql
# ... continue in order
```

**Method 3: Programmatic Migration:**
```python
import psycopg2
from pathlib import Path

def run_migration(conn, migration_file):
    with open(migration_file, 'r') as f:
        migration_sql = f.read()
    
    with conn.cursor() as cur:
        cur.execute(migration_sql)
        conn.commit()
        print(f"Applied migration: {migration_file}")

def migrate_database():
    conn = psycopg2.connect("postgresql://sdlc_user:password@localhost/sdlc")
    
    migration_files = sorted(Path("migrations").glob("*.sql"))
    
    for migration_file in migration_files:
        # Check if migration already applied
        version = migration_file.stem.split('_')[0]
        
        with conn.cursor() as cur:
            cur.execute("SELECT version FROM schema_migrations WHERE version = %s", (version,))
            if cur.fetchone():
                print(f"Migration {version} already applied, skipping")
                continue
        
        run_migration(conn, migration_file)
    
    conn.close()
```

### Migration Status Checking

**Check Migration Status:**
```sql
-- View migration status
SELECT * FROM migration_status;

-- Check specific migration
SELECT * FROM schema_migrations WHERE version = '003';

-- View pending migrations
SELECT * FROM migration_status WHERE status = 'pending';
```

**Schema Validation:**
```sql
-- Validate database schema
SELECT * FROM schema_validation;

-- Check for missing components
SELECT validation_type, status, message 
FROM schema_validation 
WHERE status = 'FAIL';
```

## Migration Dependencies

### Dependency Management

Each migration specifies dependencies to ensure proper execution order:

```sql
-- Example: Migration 003 depends on 001 and 002
INSERT INTO schema_migrations (
    version,
    description,
    filename,
    checksum,
    rollback_script,
    dependencies,
    tags,
    metadata
) VALUES (
    '003',
    'Create Policy and Security Tables',
    '003_create_policy_and_security_tables.sql',
    md5('003_create_policy_and_security_tables.sql'),
    $rollback$ -- rollback script
    $rollback$,
    '{001,002}',  -- Dependencies
    '{security,policy}',
    '{"required": true}'
);
```

### Dependency Resolution

The migration system automatically resolves dependencies:

```sql
-- Function to check migration dependencies
CREATE OR REPLACE FUNCTION check_migration_dependencies(migration_version TEXT)
RETURNS TABLE(dependency TEXT, status TEXT, message TEXT) AS $$
DECLARE
    dep_record RECORD;
    result RECORD;
BEGIN
    -- Get dependencies for this migration
    FOR dep_record IN 
        SELECT unnest(dependencies) as dependency
        FROM schema_migrations
        WHERE version = migration_version
    LOOP
        -- Check if dependency is satisfied
        SELECT 
            dep_record.dependency,
            CASE 
                WHEN sm.version IS NOT NULL THEN 'SATISFIED'
                ELSE 'MISSING'
            END as status,
            CASE 
                WHEN sm.version IS NOT NULL THEN 'Dependency already applied'
                ELSE 'Required dependency not found'
            END as message
        INTO result
        FROM schema_migrations sm
        WHERE sm.version = dep_record.dependency;
        
        IF NOT FOUND THEN
            result := ROW(
                dep_record.dependency,
                'MISSING',
                'Required dependency not found'
            );
        END IF;
        
        RETURN NEXT result;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
```

## Rollback Operations

### Single Migration Rollback

**Rollback Specific Migration:**
```sql
-- Check rollback script before executing
SELECT rollback_script FROM schema_migrations WHERE version = '003';

-- Execute rollback
SELECT rollback_migration('003');
```

**Manual Rollback:**
```sql
-- If automatic rollback fails, execute manually
BEGIN;

-- Drop tables created in migration 003
DROP TABLE IF EXISTS compliance_reports;
DROP TABLE IF EXISTS document_access_log;
DROP TABLE IF EXISTS embedding_jobs;
-- ... continue with other tables

-- Remove migration record
DELETE FROM schema_migrations WHERE version = '003';

COMMIT;
```

### Complete Database Reset

**Dangerous Operations - Use with Caution:**

```sql
-- Reset to specific migration
CREATE OR REPLACE FUNCTION reset_to_migration(target_version TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    migration_record RECORD;
BEGIN
    -- Drop all migrations after target version
    FOR migration_record IN 
        SELECT version, rollback_script
        FROM schema_migrations
        WHERE version > target_version
        ORDER BY version DESC
    LOOP
        EXECUTE migration_record.rollback_script;
        DELETE FROM schema_migrations WHERE version = migration_record.version;
    END LOOP;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql;
```

**Complete Database Reset:**
```bash
# Drop and recreate entire database
psql -h localhost -U postgres -c "DROP DATABASE IF EXISTS sdlc;"
psql -h localhost -U postgres -c "CREATE DATABASE sdlc OWNER sdlc_user;"

# Run all migrations from scratch
cd migrations
for file in *.sql; do
    echo "Applying $file..."
    psql -h localhost -U sdlc_user -d sdlc -f "$file"
done
```

## Migration Best Practices

### Development Workflow

**1. Create New Migration:**
```bash
# Create new migration file with next number
touch migrations/007_new_feature.sql

# Follow the migration template format
# Include comprehensive rollback script
# Test dependencies thoroughly
```

**2. Test Migration:**
```sql
-- Create test database
CREATE DATABASE sdlc_test TEMPLATE sdlc;

-- Apply migration to test
psql -h localhost -U sdlc_user -d sdlc_test -f migrations/007_new_feature.sql

-- Validate changes
SELECT * FROM schema_validation;

-- Test rollback
SELECT rollback_migration('007');
```

**3. Production Deployment:**
```bash
# Backup production database
pg_dump -h localhost -U sdlc_user sdlc > backup_before_007.sql

# Apply migration during maintenance window
psql -h localhost -U sdlc_user -d sdlc -f migrations/007_new_feature.sql

# Verify deployment
SELECT * FROM migration_status WHERE version = '007';
SELECT * FROM schema_validation;
```

### Migration File Guidelines

**Naming Conventions:**
- Use 3-digit sequential numbering: `001`, `002`, `003`
- Use descriptive snake_case filenames: `create_user_tables.sql`
- Include descriptive name in file header comment

**Content Guidelines:**
- Always wrap migration in `BEGIN;` and `COMMIT;`
- Include comprehensive rollback script
- Use transactional DDL when possible
- Add validation checks in migration
- Include helpful comments

**Example Migration:**
```sql
-- Migration 007: Add User Preferences
-- Version: 1.0.0
-- Description: Add user preferences and notification settings
-- Dependencies: 002_create_core_tables.sql
-- Rollback: Drop preferences columns and related indexes
-- Tags: features,user_interface

BEGIN;

-- Add preferences column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences JSONB NOT NULL DEFAULT '{}';

-- Add notification settings
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_settings JSONB NOT NULL DEFAULT '{
    "email_notifications": true,
    "push_notifications": true,
    "security_alerts": true,
    "marketing_emails": false
}';

-- Create index for preferences queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_preferences 
ON users USING GIN(preferences);

-- Create index for notification settings
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_notification_settings 
ON users USING GIN(notification_settings);

-- Add validation check
ALTER TABLE users ADD CONSTRAINT chk_notification_settings 
CHECK (jsonb_typeof(notification_settings) = 'object');

-- Update existing users with default preferences
UPDATE users 
SET preferences = COALESCE(preferences, '{}'),
    notification_settings = COALESCE(notification_settings, '{
        "email_notifications": true,
        "push_notifications": true,
        "security_alerts": true,
        "marketing_emails": false
    }')
WHERE preferences IS NULL OR notification_settings IS NULL;

-- Record migration
INSERT INTO schema_migrations (
    version,
    description,
    filename,
    checksum,
    rollback_script,
    dependencies,
    tags,
    metadata
) VALUES (
    '007',
    'Add User Preferences',
    '007_add_user_preferences.sql',
    md5('007_add_user_preferences.sql'),
    $rollback$
    DROP INDEX IF EXISTS idx_users_notification_settings;
    DROP INDEX IF EXISTS idx_users_preferences;
    ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_notification_settings;
    ALTER TABLE users DROP COLUMN IF EXISTS notification_settings;
    ALTER TABLE users DROP COLUMN IF EXISTS preferences;
    $rollback$,
    '{002}',
    '{features,user_interface}',
    '{"feature": "user_preferences", "impact": "low"}'
);

COMMIT;
```

### Testing Migrations

**Automated Testing:**
```python
import unittest
import psycopg2

class TestMigration(unittest.TestCase):
    def setUp(self):
        self.conn = psycopg2.connect("postgresql://test_user:test@localhost/sdlc_test")
    
    def test_migration_007(self):
        """Test that migration 007 was applied correctly"""
        with self.conn.cursor() as cur:
            # Check that columns exist
            cur.execute("""
                SELECT column_name, data_type, column_default
                FROM information_schema.columns
                WHERE table_name = 'users' 
                AND column_name IN ('preferences', 'notification_settings')
            """)
            
            columns = cur.fetchall()
            self.assertEqual(len(columns), 2)
            
            # Check that indexes exist
            cur.execute("""
                SELECT indexname FROM pg_indexes 
                WHERE tablename = 'users' 
                AND indexname LIKE '%preferences%'
            """)
            
            indexes = cur.fetchall()
            self.assertGreater(len(indexes), 0)
    
    def test_migration_007_rollback(self):
        """Test that migration 007 can be rolled back"""
        with self.conn.cursor() as cur:
            # Apply rollback
            cur.execute("SELECT rollback_migration('007')")
            
            # Verify columns are gone
            cur.execute("""
                SELECT COUNT(*) FROM information_schema.columns
                WHERE table_name = 'users' 
                AND column_name IN ('preferences', 'notification_settings')
            """)
            
            count = cur.fetchone()[0]
            self.assertEqual(count, 0)
```

## Troubleshooting

### Common Issues

**1. Migration Already Applied:**
```sql
-- Check if migration exists
SELECT * FROM schema_migrations WHERE version = '005';

-- Force remove migration record (use carefully)
DELETE FROM schema_migrations WHERE version = '005';
```

**2. Rollback Script Failed:**
```sql
-- Check migration details
SELECT version, description, rollback_script 
FROM schema_migrations 
WHERE version = '004';

-- Manually execute rollback steps
BEGIN;
-- Manual rollback SQL here
DELETE FROM schema_migrations WHERE version = '004';
COMMIT;
```

**3. Dependency Issues:**
```sql
-- Check migration dependencies
SELECT * FROM check_migration_dependencies('006');

-- Manually apply missing dependencies
psql -h localhost -U sdlc_user -d sdlc -f migrations/001_create_extensions_and_types.sql
```

**4. Lock Issues During Migration:**
```sql
-- Check for active locks
SELECT 
    blocked_locks.pid AS blocked_pid,
    blocked_activity.usename AS blocked_user,
    blocking_locks.pid AS blocking_pid,
    blocking_activity.usename AS blocking_user,
    blocked_activity.query AS blocked_statement,
    blocking_activity.query AS current_statement_in_blocking_process
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;

-- Terminate blocking connections if necessary
SELECT pg_terminate_backend(blocking_pid);
```

### Recovery Procedures

**1. Partial Migration Recovery:**
```sql
-- Check current migration state
SELECT * FROM migration_status ORDER BY version;

-- Identify last successful migration
SELECT MAX(version) as last_successful FROM schema_migrations;

-- Re-run from last successful migration
```

**2. Database Corruption Recovery:**
```bash
# Restore from backup
psql -h localhost -U sdlc_user -d sdlc < backup_before_migration.sql

# Re-run migrations from restored state
cd migrations
for file in *.sql; do
    psql -h localhost -U sdlc_user -d sdlc -f "$file"
done
```

This migration guide provides a comprehensive framework for managing database schema changes safely and predictably in the SDLC.ai platform.