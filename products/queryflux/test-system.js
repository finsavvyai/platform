#!/usr/bin/env node

/**
 * QueryFlux Manual System Test
 *
 * This script tests the complete QueryFlux system to ensure everything works
 * before deployment to Cloudflare.
 */

import { databaseConnectionManager } from './src/lib/database/connection-manager.js';

async function runSystemTest() {
  console.log('🚀 QueryFlux Complete System Test');
  console.log('=====================================\n');

  let testResults = {
    passed: 0,
    failed: 0,
    total: 0
  };

  async function runTest(testName: string, testFn: () => Promise<boolean>) {
    testResults.total++;
    try {
      console.log(`🧪 ${testName}...`);
      const result = await testFn();
      if (result) {
        console.log(`✅ ${testName} - PASSED\n`);
        testResults.passed++;
      } else {
        console.log(`❌ ${testName} - FAILED\n`);
        testResults.failed++;
      }
    } catch (error) {
      console.log(`❌ ${testName} - ERROR: ${error}\n`);
      testResults.failed++;
    }
  }

  // Test 1: Database Adapter Factory
  await runTest('Database Adapter Factory', async () => {
    const supportedTypes = databaseConnectionManager.getSupportedDatabaseTypes();
    console.log(`   Supported types: ${supportedTypes.join(', ')}`);
    return supportedTypes.length > 0;
  });

  // Test 2: SQLite Connection (In-memory)
  await runTest('SQLite In-Memory Connection', async () => {
    const result = await databaseConnectionManager.connect({
      type: 'sqlite',
      database: ':memory:'
    });

    if (!result.success) {
      console.log(`   Connection failed: ${result.error}`);
      return false;
    }

    console.log(`   Connection ID: ${result.connectionId}`);

    // Test query execution
    const queryResult = await databaseConnectionManager.executeQuery(
      result.connectionId!,
      'SELECT "QueryFlux Test" as message, datetime("now") as timestamp'
    );

    if (!queryResult.success) {
      console.log(`   Query failed: ${queryResult.error}`);
      await databaseConnectionManager.disconnect(result.connectionId!);
      return false;
    }

    console.log(`   Query result: ${JSON.stringify(queryResult.data)}`);

    // Test schema retrieval
    const schemaResult = await databaseConnectionManager.getSchema(result.connectionId!);
    console.log(`   Schema tables: ${schemaResult.tables.length}`);

    // Clean up
    await databaseConnectionManager.disconnect(result.connectionId!);
    return true;
  });

  // Test 3: Database Operations
  await runTest('Complete Database Operations', async () => {
    const result = await databaseConnectionManager.connect({
      type: 'sqlite',
      database: ':memory:'
    });

    if (!result.success) return false;

    const connectionId = result.connectionId!;

    try {
      // Create table
      const createResult = await databaseConnectionManager.executeQuery(
        connectionId,
        `CREATE TABLE users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT UNIQUE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`
      );
      if (!createResult.success) {
        console.log(`   Create table failed: ${createResult.error}`);
        return false;
      }

      // Insert data
      const insertResult = await databaseConnectionManager.executeQuery(
        connectionId,
        'INSERT INTO users (name, email) VALUES (?, ?)',
        ['QueryFlux User', 'test@queryflux.com']
      );
      if (!insertResult.success) {
        console.log(`   Insert failed: ${insertResult.error}`);
        return false;
      }

      // Select data
      const selectResult = await databaseConnectionManager.executeQuery(
        connectionId,
        'SELECT * FROM users WHERE email = ?',
        ['test@queryflux.com']
      );
      if (!selectResult.success || selectResult.rowCount !== 1) {
        console.log(`   Select failed: ${selectResult.error}`);
        return false;
      }

      console.log(`   User data: ${JSON.stringify(selectResult.data)}`);

      // Get schema
      const schema = await databaseConnectionManager.getSchema(connectionId);
      const usersTable = schema.tables.find(t => t.name === 'users');
      if (!usersTable) {
        console.log('   Schema retrieval failed: users table not found');
        return false;
      }

      console.log(`   Schema: ${usersTable.columns.length} columns found`);

      return true;
    } finally {
      await databaseConnectionManager.disconnect(connectionId);
    }
  });

  // Test 4: Multiple Database Types Information
  await runTest('Database Types Information', async () => {
    const types = databaseConnectionManager.getSupportedDatabaseTypes();

    for (const type of types) {
      const info = databaseConnectionManager.getDatabaseInfo(type);
      if (info) {
        console.log(`   ${info.icon} ${info.name}: ${info.description} (Port: ${info.defaultPort})`);
      }
    }

    return types.length >= 5; // Should have at least 5 database types
  });

  // Test 5: Connection Manager Statistics
  await runTest('Connection Manager Statistics', async () => {
    const stats = {
      supportedTypes: databaseConnectionManager.getSupportedDatabaseTypes(),
      connectionsCount: databaseConnectionManager.getAllConnections().length,
      activeConnections: databaseConnectionManager.getAllConnections().filter(c => c.connected).length
    };

    console.log(`   Supported types: ${stats.supportedTypes.length}`);
    console.log(`   Total connections: ${stats.connectionsCount}`);
    console.log(`   Active connections: ${stats.activeConnections}`);

    return stats.supportedTypes.length > 0;
  });

  // Final Results
  console.log('=====================================');
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('=====================================');
  console.log(`Total Tests: ${testResults.total}`);
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);

  if (testResults.failed === 0) {
    console.log('\n🎉 ALL TESTS PASSED! QueryFlux is ready for Cloudflare deployment!');
    console.log('\n📋 Next Steps:');
    console.log('1. Deploy frontend to Cloudflare Pages');
    console.log('2. Deploy backend to Cloudflare Workers');
    console.log('3. Configure environment variables');
    console.log('4. Test database connectivity in production');
  } else {
    console.log('\n⚠️  Some tests failed. Please fix the issues before deploying.');
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Check database driver installations');
    console.log('2. Verify Node.js version compatibility');
    console.log('3. Check for missing dependencies');
    console.log('4. Review error messages above');
  }

  console.log('\n🚀 QueryFlux System Test Complete!');
  return testResults.failed === 0;
}

// Run the test
runSystemTest().catch(console.error);
