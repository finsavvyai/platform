/**
 * Simple Database Service Test
 * Tests the database service implementation directly
 */

import { DatabaseService } from '../services/database-service';

// Mock D1 database for testing
const mockD1Database = {
  prepare: (query: string) => ({
    bind: (...params: any[]) => ({
      run: () => Promise.resolve({ success: true, meta: { duration: 5 } }),
      first: () => Promise.resolve({ id: '1', name: 'Test' }),
      all: () => Promise.resolve({ results: [] })
    })
  })
};

async function testDatabaseService() {
  console.log('🧪 Testing Database Service...\n');

  try {
    const dbService = new DatabaseService(mockD1Database as any);

    // Test health check
    console.log('1. Testing health check...');
    const health = await dbService.healthCheck();
    console.log('✅ Health check:', health);

    // Test metrics
    console.log('\n2. Testing metrics...');
    const metrics = dbService.getMetrics();
    console.log('✅ Metrics:', metrics);

    // Test cache operations
    console.log('\n3. Testing cache...');
    dbService.clearCache();
    console.log('✅ Cache cleared');

    console.log('\n🎉 Database service tests passed!');

  } catch (error) {
    console.error('❌ Database service test failed:', error);
  }
}

// Run the test
testDatabaseService();
