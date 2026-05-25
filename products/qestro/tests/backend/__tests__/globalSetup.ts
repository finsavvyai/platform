/**
 * Jest Global Setup
 * Runs once before all test suites
 * Sets up environment variables before any code is imported
 */

export default async function globalSetup() {
  // Set test environment variables BEFORE any imports
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-secret-key';
  process.env.DATABASE_URL = 'postgresql://shaharsolomon@localhost:5432/questro_test';
  process.env.TEST_DATABASE_URL = process.env.DATABASE_URL;
  process.env.DB_HOST = 'localhost';
  process.env.DB_PORT = '5432';
  process.env.DB_NAME = 'questro_test';
  process.env.DB_USER = 'shaharsolomon';
  process.env.DB_PASSWORD = '';
  process.env.REDIS_URL = 'redis://localhost:6379/1';
  process.env.OPENAI_API_KEY = 'test-openai-key';
  process.env.STRIPE_SECRET_KEY = 'test-stripe-key';
  process.env.LEMON_SQUEEZY_API_KEY = 'test-lemonsqueezy-key';
  process.env.USE_SUPABASE = 'false';

  console.log('✅ Test environment variables configured');
  console.log(`📊 Database: ${process.env.DB_NAME} (User: ${process.env.DB_USER})`);

  // Run schema migrations for test DB (add columns if missing - sync with backend/src/schema)
  try {
    const postgres = (await import('postgres')).default;
    const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
    const migrations = [
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_method VARCHAR(20) DEFAULT 'email'",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS theme VARCHAR(20) DEFAULT 'dark'",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_project_id UUID",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(100)",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(100)",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_email_verified BOOLEAN DEFAULT false",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription VARCHAR(20) DEFAULT 'free'",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS password VARCHAR(255)",
    ];
    for (const m of migrations) {
      await sql.unsafe(m).catch(() => {});
    }
    await sql.end();
  } catch {
    // Ignore - table may not exist or migration already applied
  }
}
