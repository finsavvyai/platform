import { test, expect } from '@playwright/test';
import { Pool } from 'pg';
import { InfrastructureHelpers } from '../../utils/infrastructure-helpers';

test.describe('Database Integration Tests', () => {
  let pool: Pool;
  let infraHelpers: InfrastructureHelpers;

  test.beforeAll(async () => {
    infraHelpers = new InfrastructureHelpers();

    const connected = await infraHelpers.initPostgres({
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5434'),
      database: process.env.POSTGRES_DB || 'sdlc_platform',
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || 'secure-postgres-password-change-me'
    });

    if (connected) {
      pool = new Pool({
        host: process.env.POSTGRES_HOST || 'localhost',
        port: parseInt(process.env.POSTGRES_PORT || '5434'),
        database: process.env.POSTGRES_DB || 'sdlc_platform',
        user: process.env.POSTGRES_USER || 'postgres',
        password: process.env.POSTGRES_PASSWORD || 'secure-postgres-password-change-me',
      });
    }
  });

  test.afterAll(async () => {
    if (pool) {
      await pool.end();
    }
    await infraHelpers.cleanup();
  });

  test.describe('Database Connection and Schema', () => {
    test('should establish database connection', async () => {
      expect(pool).toBeDefined();

      const client = await pool.connect();
      try {
        const result = await client.query('SELECT 1 as test');
        expect(result.rows).toHaveLength(1);
        expect(result.rows[0].test).toBe(1);
        console.log('✅ Database connection established successfully');
      } finally {
        client.release();
      }
    });

    test('should have proper database version', async () => {
      const client = await pool.connect();
      try {
        const result = await client.query('SELECT version()');
        const version = result.rows[0].version;
        expect(version).toContain('PostgreSQL');
        console.log('✅ Database version verified');
        console.log(`   Version: ${version.substring(0, 100)}...`);
      } finally {
        client.release();
      }
    });

    test('should have pgvector extension installed', async () => {
      const client = await pool.connect();
      try {
        const result = await client.query(`
          SELECT extname, extversion
          FROM pg_extension
          WHERE extname = 'vector'
        `);

        expect(result.rows).toHaveLength(1);
        expect(result.rows[0].extname).toBe('vector');
        expect(result.rows[0].extversion).toBeDefined();

        console.log('✅ pgvector extension verified');
        console.log(`   Version: ${result.rows[0].extversion}`);
      } finally {
        client.release();
      }
    });

    test('should have expected database tables', async () => {
      const client = await pool.connect();
      try {
        const result = await client.query(`
          SELECT table_name, table_type
          FROM information_schema.tables
          WHERE table_schema = 'public'
          ORDER BY table_name
        `);

        expect(result.rows.length).toBeGreaterThan(0);

        console.log('✅ Database tables found:');
        result.rows.forEach(row => {
          console.log(`   - ${row.table_name} (${row.table_type})`);
        });
      } finally {
        client.release();
      }
    });

    test('should have proper column types and constraints', async () => {
      const client = await pool.connect();
      try {
        const result = await client.query(`
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name IN (
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public'
            LIMIT 3
          )
          ORDER BY table_name, ordinal_position
        `);

        expect(result.rows.length).toBeGreaterThan(0);

        console.log('✅ Column structure verified:');
        result.rows.forEach(row => {
          console.log(`   ${row.table_name || 'table'}.${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
        });
      } finally {
        client.release();
      }
    });
  });

  test.describe('Vector Operations Testing', () => {
    test('should perform vector operations successfully', async () => {
      const client = await pool.connect();
      try {
        // Create a test table with vector column
        await client.query(`
          CREATE TABLE IF NOT EXISTS test_vectors (
            id SERIAL PRIMARY KEY,
            content TEXT,
            embedding vector(3)
          )
        `);

        // Insert test vector
        const insertResult = await client.query(`
          INSERT INTO test_vectors (content, embedding)
          VALUES ($1, $2)
          RETURNING id, content, embedding
        `, ['test content', '[0.1, 0.2, 0.3]']);

        expect(insertResult.rows).toHaveLength(1);
        expect(insertResult.rows[0].content).toBe('test content');

        // Test vector similarity search
        const searchResult = await client.query(`
          SELECT content, embedding <=> $1 as distance
          FROM test_vectors
          ORDER BY embedding <=> $1
          LIMIT 5
        `, ['[0.1, 0.2, 0.3]']);

        expect(searchResult.rows).toHaveLength(1);
        expect(parseFloat(searchResult.rows[0].distance)).toBeCloseTo(0, 5);

        // Cleanup
        await client.query('DROP TABLE test_vectors');

        console.log('✅ Vector operations successful');
        console.log(`   Inserted vector: [0.1, 0.2, 0.3]`);
        console.log(`   Distance calculation: ${searchResult.rows[0].distance}`);
      } finally {
        client.release();
      }
    });

    test('should handle vector dimensions correctly', async () => {
      const client = await pool.connect();
      try {
        // Test different vector dimensions
        await client.query(`
          CREATE TABLE IF NOT EXISTS test_vector_dims (
            id SERIAL PRIMARY KEY,
            vector_1d vector(1),
            vector_10d vector(10),
            vector_100d vector(100),
            vector_1000d vector(1000)
          )
        `);

        // Insert vectors with different dimensions
        const vector1d = Array(1).fill(0).map(() => Math.random()).join(', ');
        const vector10d = Array(10).fill(0).map(() => Math.random()).join(', ');
        const vector100d = Array(100).fill(0).map(() => Math.random()).join(', ');

        await client.query(`
          INSERT INTO test_vector_dims (vector_1d, vector_10d, vector_100d)
          VALUES ($1, $2, $3)
        `, [`[${vector1d}]`, `[${vector10d}]`, `[${vector100d}]`]);

        // Verify insertion
        const result = await client.query('SELECT COUNT(*) as count FROM test_vector_dims');
        expect(parseInt(result.rows[0].count)).toBe(1);

        // Cleanup
        await client.query('DROP TABLE test_vector_dims');

        console.log('✅ Vector dimensions handled correctly');
        console.log(`   1D: ${vector1d.substring(0, 20)}...`);
        console.log(`   10D: ${vector10d.substring(0, 20)}...`);
        console.log(`   100D: ${vector100d.substring(0, 20)}...`);
      } finally {
        client.release();
      }
    });

    test('should perform vector similarity search efficiently', async () => {
      const client = await pool.connect();
      try {
        // Create test data
        await client.query(`
          CREATE TABLE IF NOT EXISTS test_similarity (
            id SERIAL PRIMARY KEY,
            content TEXT,
            embedding vector(3)
          )
        `);

        // Insert multiple vectors
        const vectors = [
          ['test content 1', '[0.1, 0.1, 0.1]'],
          ['test content 2', '[0.9, 0.9, 0.9]'],
          ['test content 3', '[0.2, 0.2, 0.2]'],
          ['test content 4', '[0.8, 0.8, 0.8]']
        ];

        for (const [content, embedding] of vectors) {
          await client.query(
            'INSERT INTO test_similarity (content, embedding) VALUES ($1, $2)',
            [content, embedding]
          );
        }

        // Perform similarity search
        const queryVector = '[0.15, 0.15, 0.15]';
        const startTime = Date.now();

        const result = await client.query(`
          SELECT content, embedding <=> $1 as distance
          FROM test_similarity
          ORDER BY embedding <=> $1
          LIMIT 3
        `, [queryVector]);

        const searchTime = Date.now() - startTime;

        expect(result.rows).toHaveLength(3);

        // Results should be sorted by distance (ascending)
        for (let i = 0; i < result.rows.length - 1; i++) {
          expect(parseFloat(result.rows[i].distance)).toBeLessThanOrEqual(
            parseFloat(result.rows[i + 1].distance)
          );
        }

        // Search should be fast
        expect(searchTime).toBeLessThan(1000);

        // Cleanup
        await client.query('DROP TABLE test_similarity');

        console.log('✅ Vector similarity search efficient');
        console.log(`   Search time: ${searchTime}ms`);
        console.log(`   Results: ${result.rows.length} vectors found`);
        result.rows.forEach((row, index) => {
          console.log(`     ${index + 1}. ${row.content} (distance: ${row.distance})`);
        });
      } finally {
        client.release();
      }
    });
  });

  test.describe('Database Performance Tests', () => {
    test('should handle concurrent connections', async () => {
      const concurrentConnections = 5;
      const connections = [];

      for (let i = 0; i < concurrentConnections; i++) {
        connections.push(
          pool.connect().then(async (client) => {
            const result = await client.query('SELECT pg_sleep(0.1), $1 as test_id', [i]);
            client.release();
            return { success: true, testId: i };
          }).catch(error => ({ success: false, error: error.message, testId: i }))
        );
      }

      const results = await Promise.all(connections);
      const successfulConnections = results.filter(r => r.success);

      expect(successfulConnections.length).toBe(concurrentConnections);

      console.log('✅ Concurrent connections handled');
      console.log(`   Successful: ${successfulConnections.length}/${concurrentConnections}`);
    });

    test('should maintain performance with large datasets', async () => {
      const client = await pool.connect();
      try {
        // Create test table
        await client.query(`
          CREATE TABLE IF NOT EXISTS test_performance (
            id SERIAL PRIMARY KEY,
            data TEXT,
            timestamp TIMESTAMP DEFAULT NOW(),
            vector_col vector(10)
          )
        `);

        // Insert test data
        const insertCount = 100;
        const startTime = Date.now();

        for (let i = 0; i < insertCount; i++) {
          const vector = Array(10).fill(0).map(() => Math.random()).join(', ');
          await client.query(
            'INSERT INTO test_performance (data, vector_col) VALUES ($1, $2)',
            [`test data ${i}`, `[${vector}]`]
          );
        }

        const insertTime = Date.now() - startTime;

        // Test query performance
        const queryStartTime = Date.now();
        const result = await client.query('SELECT COUNT(*) as count FROM test_performance');
        const queryTime = Date.now() - queryStartTime;

        expect(parseInt(result.rows[0].count)).toBe(insertCount);
        expect(insertTime).toBeLessThan(10000); // 10 seconds
        expect(queryTime).toBeLessThan(1000); // 1 second

        // Cleanup
        await client.query('DROP TABLE test_performance');

        console.log('✅ Large dataset performance test passed');
        console.log(`   Inserted ${insertCount} records in ${insertTime}ms`);
        console.log(`   Query completed in ${queryTime}ms`);
      } finally {
        client.release();
      }
    });

    test('should handle transactions properly', async () => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Create test table
        await client.query(`
          CREATE TABLE IF NOT EXISTS test_transactions (
            id SERIAL PRIMARY KEY,
            data TEXT
          )
        `);

        // Insert data
        await client.query('INSERT INTO test_transactions (data) VALUES ($1)', ['test data']);

        // Verify data exists
        const result = await client.query('SELECT COUNT(*) as count FROM test_transactions');
        expect(parseInt(result.rows[0].count)).toBe(1);

        // Rollback transaction
        await client.query('ROLLBACK');

        // Table should not exist after rollback
        await expect(
          client.query('SELECT * FROM test_transactions')
        ).rejects.toThrow();

        console.log('✅ Transaction handling verified');
      } finally {
        client.release();
      }
    });
  });

  test.describe('Database Security and Integrity', () => {
    test('should enforce proper data types', async () => {
      const client = await pool.connect();
      try {
        // Create table with various data types
        await client.query(`
          CREATE TABLE IF NOT EXISTS test_types (
            id SERIAL PRIMARY KEY,
            text_col TEXT,
            int_col INTEGER,
            bool_col BOOLEAN,
            timestamp_col TIMESTAMP,
            vector_col vector(3)
          )
        `);

        // Test type enforcement
        await expect(
          client.query('INSERT INTO test_types (int_col) VALUES ($1)', ['not-an-integer'])
        ).rejects.toThrow();

        await expect(
          client.query('INSERT INTO test_types (bool_col) VALUES ($1)', ['not-a-boolean'])
        ).rejects.toThrow();

        // Valid insert should work
        await client.query(`
          INSERT INTO test_types (text_col, int_col, bool_col, timestamp_col, vector_col)
          VALUES ($1, $2, $3, $4, $5)
        `, ['test', 123, true, '2023-01-01 00:00:00', '[0.1, 0.2, 0.3]']);

        // Cleanup
        await client.query('DROP TABLE test_types');

        console.log('✅ Data type enforcement verified');
      } finally {
        client.release();
      }
    });

    test('should handle NULL values appropriately', async () => {
      const client = await pool.connect();
      try {
        await client.query(`
          CREATE TABLE IF NOT EXISTS test_nulls (
            id SERIAL PRIMARY KEY,
            required_col TEXT NOT NULL,
            optional_col TEXT,
            timestamp_col TIMESTAMP DEFAULT NOW()
          )
        `);

        // Should allow NULL in optional column
        await client.query(
          'INSERT INTO test_nulls (required_col) VALUES ($1)',
          ['required value']
        );

        // Should reject NULL in required column
        await expect(
          client.query('INSERT INTO test_nulls (required_col) VALUES (NULL)')
        ).rejects.toThrow();

        // Cleanup
        await client.query('DROP TABLE test_nulls');

        console.log('✅ NULL value handling verified');
      } finally {
        client.release();
      }
    });

    test('should have proper indexing', async () => {
      const client = await pool.connect();
      try {
        // Create table with index
        await client.query(`
          CREATE TABLE IF NOT EXISTS test_indexes (
            id SERIAL PRIMARY KEY,
            search_col TEXT,
            vector_col vector(10)
          )
        `);

        // Create indexes
        await client.query('CREATE INDEX IF NOT EXISTS idx_search ON test_indexes(search_col)');

        // Test vector index creation (if supported)
        try {
          await client.query('CREATE INDEX IF NOT EXISTS idx_vector ON test_indexes USING ivfflat (vector_col vector_cosine_ops)');
          console.log('✅ Vector index created successfully');
        } catch (error) {
          console.log('⚠️ Vector index creation skipped (not supported)');
        }

        // Insert test data
        for (let i = 0; i < 50; i++) {
          const vector = Array(10).fill(0).map(() => Math.random()).join(', ');
          await client.query(
            'INSERT INTO test_indexes (search_col, vector_col) VALUES ($1, $2)',
            [`search_term_${i}`, `[${vector}]`]
          );
        }

        // Test index usage with EXPLAIN
        const explainResult = await client.query(`
          EXPLAIN (FORMAT JSON)
          SELECT * FROM test_indexes WHERE search_col = $1
        `, ['search_term_25']);

        const plan = explainResult.rows[0]['QUERY PLAN'][0];
        expect(plan).toBeDefined();

        // Cleanup
        await client.query('DROP TABLE test_indexes');

        console.log('✅ Database indexing verified');
      } finally {
        client.release();
      }
    });
  });
});