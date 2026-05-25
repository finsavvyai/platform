import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ESM module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Database Migration Tests
 * Validates that database schema is properly set up
 */

test.describe('Database Schema Validation', () => {

  test('All required tables exist in database', async ({ request }) => {
    // Query the database for table list
    const response = await request.get('/api/v1/admin/database/tables');

    if (response.status() === 404 || response.status() === 503) {
      console.log('⚠️  Database admin endpoint not available yet');
      test.skip();
      return;
    }

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    // Expected tables
    const requiredTables = [
      'dashboard_users',
      'dashboard_organizations',
      'dashboard_sessions',
      'dashboard_api_keys',
      'dashboard_audit_logs'
    ];

    for (const tableName of requiredTables) {
      expect(data.tables).toContain(tableName);
    }
  });

  test('Users table has correct schema', async ({ request }) => {
    const response = await request.get('/api/v1/admin/database/schema/dashboard_users');

    if (response.status() === 404 || response.status() === 503) {
      test.skip();
      return;
    }

    expect(response.ok()).toBeTruthy();
    const schema = await response.json();

    // Check required columns
    const requiredColumns = [
      'id',
      'email',
      'name',
      'password_hash',
      'oauth_provider',
      'oauth_id',
      'role',
      'permissions',
      'organization_id',
      'is_active',
      'email_verified',
      'created_at',
      'updated_at',
      'last_login_at'
    ];

    for (const column of requiredColumns) {
      expect(schema.columns.map((c: any) => c.name)).toContain(column);
    }
  });

  test('Sessions table has correct schema', async ({ request }) => {
    const response = await request.get('/api/v1/admin/database/schema/dashboard_sessions');

    if (response.status() === 404 || response.status() === 503) {
      test.skip();
      return;
    }

    expect(response.ok()).toBeTruthy();
    const schema = await response.json();

    const requiredColumns = [
      'id',
      'user_id',
      'token_hash',
      'ip_address',
      'user_agent',
      'expires_at',
      'created_at',
      'last_activity_at'
    ];

    for (const column of requiredColumns) {
      expect(schema.columns.map((c: any) => c.name)).toContain(column);
    }
  });

  test('API Keys table has correct schema', async ({ request }) => {
    const response = await request.get('/api/v1/admin/database/schema/dashboard_api_keys');

    if (response.status() === 404 || response.status() === 503) {
      test.skip();
      return;
    }

    expect(response.ok()).toBeTruthy();
    const schema = await response.json();

    const requiredColumns = [
      'id',
      'user_id',
      'name',
      'key_hash',
      'key_prefix',
      'scopes',
      'rate_limit',
      'is_active',
      'last_used_at',
      'expires_at',
      'created_at',
      'updated_at'
    ];

    for (const column of requiredColumns) {
      expect(schema.columns.map((c: any) => c.name)).toContain(column);
    }
  });

  test('Organizations table has correct schema', async ({ request }) => {
    const response = await request.get('/api/v1/admin/database/schema/dashboard_organizations');

    if (response.status() === 404 || response.status() === 503) {
      test.skip();
      return;
    }

    expect(response.ok()).toBeTruthy();
    const schema = await response.json();

    const requiredColumns = [
      'id',
      'name',
      'slug',
      'owner_id',
      'billing_email',
      'subscription_plan',
      'subscription_status',
      'subscription_id',
      'is_active',
      'created_at',
      'updated_at'
    ];

    for (const column of requiredColumns) {
      expect(schema.columns.map((c: any) => c.name)).toContain(column);
    }
  });

  test('Audit Logs table has correct schema', async ({ request }) => {
    const response = await request.get('/api/v1/admin/database/schema/dashboard_audit_logs');

    if (response.status() === 404 || response.status() === 503) {
      test.skip();
      return;
    }

    expect(response.ok()).toBeTruthy();
    const schema = await response.json();

    const requiredColumns = [
      'id',
      'user_id',
      'organization_id',
      'action',
      'resource_type',
      'resource_id',
      'details',
      'ip_address',
      'user_agent',
      'status',
      'created_at'
    ];

    for (const column of requiredColumns) {
      expect(schema.columns.map((c: any) => c.name)).toContain(column);
    }
  });
});

test.describe('Database Indexes', () => {

  test('Users table has required indexes', async ({ request }) => {
    const response = await request.get('/api/v1/admin/database/indexes/dashboard_users');

    if (response.status() === 404 || response.status() === 503) {
      test.skip();
      return;
    }

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    const requiredIndexes = [
      'idx_users_email',
      'idx_users_organization',
      'idx_users_oauth',
      'idx_users_active'
    ];

    for (const indexName of requiredIndexes) {
      expect(data.indexes.map((i: any) => i.name)).toContain(indexName);
    }
  });

  test('Sessions table has required indexes', async ({ request }) => {
    const response = await request.get('/api/v1/admin/database/indexes/dashboard_sessions');

    if (response.status() === 404 || response.status() === 503) {
      test.skip();
      return;
    }

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    const requiredIndexes = [
      'idx_sessions_user_id',
      'idx_sessions_token_hash',
      'idx_sessions_expires_at'
    ];

    for (const indexName of requiredIndexes) {
      expect(data.indexes.map((i: any) => i.name)).toContain(indexName);
    }
  });
});

test.describe('Migration Files', () => {

  test('All migration files exist', async () => {
    const migrationsDir = path.join(__dirname, '../../migrations');
    expect(fs.existsSync(migrationsDir)).toBe(true);

    const requiredMigrations = [
      '0001_create_users_table.sql',
      '0002_create_sessions_table.sql',
      '0003_create_api_keys_table.sql',
      '0004_create_organizations_table.sql',
      '0005_create_audit_logs_table.sql',
      'schema.sql'
    ];

    for (const migration of requiredMigrations) {
      const migrationPath = path.join(migrationsDir, migration);
      expect(fs.existsSync(migrationPath)).toBe(true);
    }
  });

  test('Migration script is executable', async () => {
    const scriptPath = path.join(__dirname, '../../scripts/migrate.sh');
    expect(fs.existsSync(scriptPath)).toBe(true);

    // Check if file is executable
    const stats = fs.statSync(scriptPath);
    const isExecutable = (stats.mode & parseInt('111', 8)) !== 0;
    expect(isExecutable).toBe(true);
  });

  test('Schema.sql contains all table definitions', async () => {
    const schemaPath = path.join(__dirname, '../../migrations/schema.sql');
    expect(fs.existsSync(schemaPath)).toBe(true);

    const schemaContent = fs.readFileSync(schemaPath, 'utf-8');

    // Check for all table CREATE statements
    expect(schemaContent).toContain('CREATE TABLE IF NOT EXISTS dashboard_users');
    expect(schemaContent).toContain('CREATE TABLE IF NOT EXISTS dashboard_organizations');
    expect(schemaContent).toContain('CREATE TABLE IF NOT EXISTS dashboard_sessions');
    expect(schemaContent).toContain('CREATE TABLE IF NOT EXISTS dashboard_api_keys');
    expect(schemaContent).toContain('CREATE TABLE IF NOT EXISTS dashboard_audit_logs');
  });
});

test.describe('Database Package.json Scripts', () => {

  test('package.json has migration scripts', async () => {
    const packagePath = path.join(__dirname, '../../package.json');
    expect(fs.existsSync(packagePath)).toBe(true);

    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));

    expect(packageJson.scripts).toHaveProperty('db:migrate');
    expect(packageJson.scripts).toHaveProperty('db:migrate:dev');

    expect(packageJson.scripts['db:migrate']).toContain('migrate.sh');
    expect(packageJson.scripts['db:migrate:dev']).toContain('migrate.sh development');
  });
});
