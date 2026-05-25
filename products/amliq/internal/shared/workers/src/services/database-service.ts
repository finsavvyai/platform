/**
 * Database Service
 * Unified database operations with migration support for all products
 */

import type { Env } from '../types';

export interface MigrationFile {
  filename: string;
  sql: string;
  version: number;
  product: 'core' | 'billing' | 'compliance' | 'intelligence' | 'risk';
}

export interface DatabaseConfig {
  region: 'US' | 'EU';
  environment: 'development' | 'staging' | 'production';
}

export class DatabaseService {
  private env: Env;
  private migrationCache: Map<string, MigrationFile[]> = new Map();

  constructor(env: Env) {
    this.env = env;
  }

  /**
   * Get database instance by product and region
   */
  getDatabase(product: string, region: 'US' | 'EU'): D1Database {
    const dbMap: Record<string, Record<'US' | 'EU', D1Database>> = {
      core: {
        US: this.env.DB_BILLING_US, // Use billing DB as core for now
        EU: this.env.DB_BILLING_EU
      },
      billing: {
        US: this.env.DB_BILLING_US,
        EU: this.env.DB_BILLING_EU
      },
      compliance: {
        US: this.env.DB_COMPLIANCE_US,
        EU: this.env.DB_COMPLIANCE_EU
      },
      intelligence: {
        US: this.env.DB_INTELLIGENCE_US,
        EU: this.env.DB_INTELLIGENCE_EU
      },
      risk: {
        US: this.env.DB_RISK_US,
        EU: this.env.DB_RISK_EU
      }
    };

    const db = dbMap[product]?.[region];
    if (!db) {
      throw new Error(`Database not found for product: ${product}, region: ${region}`);
    }

    return db;
  }

  /**
   * Load migration files
   */
  async loadMigrations(): Promise<void> {
    const migrationFiles: MigrationFile[] = [
      {
        filename: '001_initial_schema.sql',
        sql: await this.loadMigrationFile('001_initial_schema.sql'),
        version: 1,
        product: 'core'
      },
      {
        filename: '002_billing_schema.sql',
        sql: await this.loadMigrationFile('002_billing_schema.sql'),
        version: 2,
        product: 'billing'
      },
      {
        filename: '003_compliance_schema.sql',
        sql: await this.loadMigrationFile('003_compliance_schema.sql'),
        version: 3,
        product: 'compliance'
      },
      {
        filename: '004_intelligence_schema.sql',
        sql: await this.loadMigrationFile('004_intelligence_schema.sql'),
        version: 4,
        product: 'intelligence'
      },
      {
        filename: '005_risk_schema.sql',
        sql: await this.loadMigrationFile('005_risk_schema.sql'),
        version: 5,
        product: 'risk'
      }
    ];

    // Group migrations by product
    for (const migration of migrationFiles) {
      if (!this.migrationCache.has(migration.product)) {
        this.migrationCache.set(migration.product, []);
      }
      this.migrationCache.get(migration.product)!.push(migration);
    }

    // Sort migrations by version
    for (const product of this.migrationCache.keys()) {
      this.migrationCache.get(product)!.sort((a, b) => a.version - b.version);
    }
  }

  /**
   * Load migration file content
   */
  private async loadMigrationFile(filename: string): Promise<string> {
    // In a real implementation, this would load from R2 storage or filesystem
    // For now, we'll simulate the file content

    const migrationContent: Record<string, string> = {
      '001_initial_schema.sql': `-- Initial Schema for FinSavvy AI Suite
CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT,
  region TEXT NOT NULL CHECK (region IN ('US', 'EU')),
  subscription_tier TEXT NOT NULL DEFAULT 'starter' CHECK (subscription_tier IN ('free', 'starter', 'professional', 'enterprise')),
  settings TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  organization_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'finance', 'compliance', 'auditor', 'viewer')),
  permissions TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Additional tables from the migration file...
`,
      '002_billing_schema.sql': `CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  tax_id TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Additional billing tables...
`,
      '003_compliance_schema.sql': `CREATE TABLE IF NOT EXISTS kyc_requests (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('individual', 'business')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'approved', 'rejected', 'requires_more_info')),
  risk_level TEXT NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  documents TEXT NOT NULL DEFAULT '[]',
  screenings TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Additional compliance tables...
`,
      '004_intelligence_schema.sql': `CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT,
  subcategory TEXT,
  date TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
  counterparty TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '[]',
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Additional intelligence tables...
`,
      '005_risk_schema.sql': `CREATE TABLE IF NOT EXISTS risk_events (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  transaction_id TEXT,
  user_id TEXT,
  type TEXT NOT NULL CHECK (type IN ('transaction', 'user_behavior', 'pattern_anomaly', 'external_threat')),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  risk_score REAL NOT NULL DEFAULT 0,
  features TEXT NOT NULL DEFAULT '{}',
  decision TEXT NOT NULL DEFAULT '{}',
  raw_event TEXT NOT NULL,
  processed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Additional risk tables...
`
    };

    return migrationContent[filename] || '';
  }

  /**
   * Get applied migrations from database
   */
  async getAppliedMigrations(db: D1Database): Promise<number[]> {
    try {
      const result = await db.prepare(`
        SELECT version FROM schema_migrations ORDER BY version
      `).all();

      return (result.results || []).map(row => row.version);
    } catch (error) {
      // Schema migrations table doesn't exist yet
      return [];
    }
  }

  /**
   * Create schema migrations table if it doesn't exist
   */
  async createMigrationsTable(db: D1Database): Promise<void> {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        filename TEXT NOT NULL,
        applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
  }

  /**
   * Apply a single migration
   */
  async applyMigration(db: D1Database, migration: MigrationFile): Promise<void> {
    try {
      // Execute migration in a transaction
      await db.batch([
        db.prepare(migration.sql),
        db.prepare(`
          INSERT INTO schema_migrations (version, filename, applied_at)
          VALUES (?, ?, CURRENT_TIMESTAMP)
        `).bind(migration.version, migration.filename)
      ]).run();

      console.log(`Applied migration: ${migration.filename} (version ${migration.version})`);
    } catch (error) {
      console.error(`Failed to apply migration ${migration.filename}:`, error);
      throw error;
    }
  }

  /**
   * Run migrations for a specific product and region
   */
  async runMigrations(product: string, region: 'US' | 'EU'): Promise<void> {
    try {
      await this.loadMigrations();
      const db = this.getDatabase(product, region);

      // Create migrations table if it doesn't exist
      await this.createMigrationsTable(db);

      // Get applied migrations
      const appliedVersions = await this.getAppliedMigrations(db);

      // Get pending migrations for this product
      const productMigrations = this.migrationCache.get(product) || [];
      const pendingMigrations = productMigrations.filter(
        migration => !appliedVersions.includes(migration.version)
      );

      // Apply pending migrations
      for (const migration of pendingMigrations) {
        await this.applyMigration(db, migration);
      }

      console.log(`Migrations completed for ${product} (${region})`);
    } catch (error) {
      console.error(`Migration failed for ${product} (${region}):`, error);
      throw error;
    }
  }

  /**
   * Run all migrations for all products and regions
   */
  async runAllMigrations(): Promise<void> {
    const products = ['core', 'billing', 'compliance', 'intelligence', 'risk'];
    const regions = ['US', 'EU'] as const;

    const migrationPromises: Promise<void>[] = [];

    for (const product of products) {
      for (const region of regions) {
        migrationPromises.push(this.runMigrations(product, region));
      }
    }

    try {
      await Promise.all(migrationPromises);
      console.log('All database migrations completed successfully');
    } catch (error) {
      console.error('Migration process failed:', error);
      throw error;
    }
  }

  /**
   * Check database health
   */
  async checkHealth(product: string, region: 'US' | 'EU'): Promise<{
    accessible: boolean;
    tables: string[];
    error?: string;
  }> {
    try {
      const db = this.getDatabase(product, region);

      // Test basic connectivity
      await db.prepare('SELECT 1').first();

      // Get table list
      const tables = await db.prepare(`
        SELECT name FROM sqlite_master WHERE type='table'
      `).all();

      const tableNames = (tables.results || []).map(row => row.name);

      return {
        accessible: true,
        tables: tableNames
      };
    } catch (error) {
      return {
        accessible: false,
        tables: [],
        error: error.message
      };
    }
  }

  /**
   * Get database statistics
   */
  async getStats(product: string, region: 'US' | 'EU'): Promise<{
    tables: number;
    totalRows: number;
    lastMigration?: number;
  }> {
    try {
      const db = this.getDatabase(product, region);

      // Count tables
      const tableCount = await db.prepare(`
        SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'
      `).first();

      // Count total rows (approximate)
      const rowCounts = await db.prepare(`
        SELECT SUM(COUNT(*)) as total FROM (
          SELECT COUNT(*) FROM organizations
          UNION ALL
          SELECT COUNT(*) FROM users
          UNION ALL
          SELECT COUNT(*) FROM sessions
        )
      `).first();

      // Get last migration version
      const lastMigration = await db.prepare(`
        SELECT MAX(version) as version FROM schema_migrations
      `).first();

      return {
        tables: tableCount?.count || 0,
        totalRows: rowCounts?.total || 0,
        lastMigration: lastMigration?.version
      };
    } catch (error) {
      console.error(`Failed to get stats for ${product} (${region}):`, error);
      return {
        tables: 0,
        totalRows: 0
      };
    }
  }

  /**
   * Backup database schema
   */
  async backupSchema(product: string, region: 'US' | 'EU'): Promise<{
    schema: string;
    timestamp: string;
  }> {
    try {
      const db = this.getDatabase(product, region);

      // Get schema dump
      const schema = await db.prepare(`
        SELECT sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `).all();

      const createStatements = schema.results?.map(row => row.sql).join('\n\n');

      return {
        schema: createStatements,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error(`Failed to backup schema for ${product} (${region}):`, error);
      throw error;
    }
  }

  /**
   * Validate data integrity
   */
  async validateIntegrity(product: string, region: 'US' | 'EU'): Promise<{
    isValid: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];

    try {
      const db = this.getDatabase( product, region );

      // Check foreign key constraints
      const fkChecks = [
        'SELECT COUNT(*) as orphaned_users FROM users WHERE organization_id NOT IN (SELECT id FROM organizations)',
        'SELECT COUNT(*) as orphaned_sessions FROM sessions WHERE user_id NOT IN (SELECT id FROM users)',
        'SELECT COUNT(*) as orphaned_invoices FROM invoices WHERE customer_id NOT IN (SELECT id FROM customers)',
        'SELECT COUNT(*) as orphaned_payments FROM payments WHERE invoice_id NOT IN (SELECT id FROM invoices) WHERE invoice_id IS NOT NULL'
      ];

      for (const check of fkChecks) {
        const result = await db.prepare(check).first();
        const tableName = check.split('FROM')[1].trim().split(' ')[0];
        const countName = Object.keys(result || {})[0];

        if (result && result[countName] > 0) {
          issues.push(`${tableName}: ${result[countName]} orphaned records found`);
        }
      }

      // Check for missing indexes on commonly queried fields
      const indexChecks = [
        'SELECT COUNT(*) as missing_index FROM pragma_index_list(\'users\') WHERE name LIKE \'idx_users_%\' AND sql NOT LIKE \'autoindex%\'',
        'SELECT COUNT(*) as missing_index FROM pragma_index_list(\'invoices\') WHERE name LIKE \'idx_invoices_%\' AND sql NOT LIKE \'autoindex%\''
      ];

      for (const check of indexChecks) {
        const result = await db.prepare(check).first();
        const countName = Object.keys(result || {})[0];

        if (result && result[countName] > 5) {
          issues.push(`Performance: ${result[countName]} manual indexes found (consider reviewing)`);
        }
      }

      return {
        isValid: issues.length === 0,
        issues
      };
    } catch (error) {
      console.error(`Integrity validation failed for ${product} (${region}):`, error);
      return {
        isValid: false,
        issues: [error.message]
      };
    }
  }
}