/**
 * Global Setup - Runs once before all tests
 */

export default async function globalSetup() {
    // Set test environment variables
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
    process.env.REDIS_URL = 'redis://localhost:6379/1';

    console.log('\n🧪 Starting test suite...\n');

    // Wait for any async initialization
    await new Promise((resolve) => setTimeout(resolve, 100));
}
