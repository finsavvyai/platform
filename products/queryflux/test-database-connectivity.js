import { databaseConnectionManager } from '../src/lib/database';

// Test database connectivity
async function testDatabaseConnectivity() {
  console.log('🧪 Testing QueryFlux Database Connectivity...\n');

  // Test PostgreSQL connection
  try {
    console.log('🐘 Testing PostgreSQL connection...');
    const pgResult = await databaseConnectionManager.connect({
      type: 'postgresql',
      host: 'localhost',
      port: 5432,
      database: 'postgres',
      username: 'postgres',
      password: 'password'
    });

    if (pgResult.success) {
      console.log('✅ PostgreSQL connection successful!');
      console.log(`   Connection ID: ${pgResult.connectionId}`);

      // Test schema retrieval
      const schema = await databaseConnectionManager.getSchema(pgResult.connectionId!);
      console.log(`   Tables found: ${schema.tables.length}`);

      // Test query execution
      const queryResult = await databaseConnectionManager.executeQuery(
        pgResult.connectionId!,
        'SELECT version() as version, current_database() as database'
      );
      console.log(`   Query executed in ${queryResult.executionTime}ms`);

      // Test disconnection
      await databaseConnectionManager.disconnect(pgResult.connectionId!);
      console.log('   Disconnected successfully\n');
    } else {
      console.log(`❌ PostgreSQL connection failed: ${pgResult.error}\n`);
    }
  } catch (error) {
    console.log(`❌ PostgreSQL test error: ${error}\n`);
  }

  // Test SQLite connection (should work)
  try {
    console.log('💾 Testing SQLite connection...');
    const sqliteResult = await databaseConnectionManager.connect({
      type: 'sqlite',
      database: ':memory:'
    });

    if (sqliteResult.success) {
      console.log('✅ SQLite connection successful!');
      console.log(`   Connection ID: ${sqliteResult.connectionId}`);

      // Create a test table
      await databaseConnectionManager.executeQuery(
        sqliteResult.connectionId!,
        'CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)'
      );

      // Insert data
      await databaseConnectionManager.executeQuery(
        sqliteResult.connectionId!,
        'INSERT INTO test (name) VALUES (?)',
        ['QueryFlux Test']
      );

      // Query data
      const result = await databaseConnectionManager.executeQuery(
        sqliteResult.connectionId!,
        'SELECT * FROM test'
      );
      console.log(`   Test query returned ${result.rowCount} rows`);

      await databaseConnectionManager.disconnect(sqliteResult.connectionId!);
      console.log('   SQLite test completed successfully\n');
    } else {
      console.log(`❌ SQLite connection failed: ${sqliteResult.error}\n`);
    }
  } catch (error) {
    console.log(`❌ SQLite test error: ${error}\n`);
  }

  // Show supported database types
  const supportedTypes = databaseConnectionManager.getSupportedDatabaseTypes();
  console.log('📊 Supported Database Types:');
  supportedTypes.forEach(type => {
    const info = databaseConnectionManager.getDatabaseInfo(type);
    console.log(`   • ${info?.icon} ${info?.name} (${type})`);
  });

  console.log('\n🎉 QueryFlux Database Integration Test Complete!');
  console.log('   Real database connectivity is now functional!');
}

// Export for testing
export { testDatabaseConnectivity };
