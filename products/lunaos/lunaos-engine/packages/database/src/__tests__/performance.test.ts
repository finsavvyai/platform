import { DatabaseConnectionManager } from '../connection';
import { redisService } from '../services/redis.service';
import { qdrantService } from '../services/qdrant.service';
import { elasticsearchService } from '../services/elasticsearch.service';

// Mock logger to avoid noise during tests
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('Database Performance Benchmarks', () => {
  let manager: DatabaseConnectionManager;
  const mockConfig = {
    postgres: {
      url: 'postgresql://test:test@localhost:5432/testdb',
      maxConnections: 20,
      connectionTimeout: 10000,
      idleTimeout: 30000,
    },
    redis: {
      url: 'redis://localhost:6379',
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      lazyConnect: true,
      keepAlive: 30000,
    },
    qdrant: {
      url: 'http://localhost:6333',
      apiKey: 'test-key',
      timeout: 30000,
      maxRetries: 3,
    },
    elasticsearch: {
      node: 'http://localhost:9200',
      auth: {
        username: 'elastic',
        password: 'changeme',
      },
      maxRetries: 3,
      requestTimeout: 30000,
      pingTimeout: 3000,
    },
  };

  beforeAll(() => {
    manager = DatabaseConnectionManager.getInstance();
  });

  describe('PostgreSQL Performance', () => {
    it('should benchmark basic query performance', async () => {
      const mockPrismaClient = {
        $connect: jest.fn().mockResolvedValue(undefined),
        $queryRaw: jest.fn().mockResolvedValue([{ id: 1, name: 'test' }]),
        $on: jest.fn(),
        $disconnect: jest.fn().mockResolvedValue(undefined),
      };

      // Mock Prisma constructor
      const originalPrisma = require('@prisma/client').PrismaClient;
      require('@prisma/client').PrismaClient = jest.fn().mockImplementation(() => mockPrismaClient);

      try {
        await manager.initialize(mockConfig);
        const prisma = manager.getPrismaClient();

        const iterations = 100;
        const results: number[] = [];

        for (let i = 0; i < iterations; i++) {
          const startTime = performance.now();
          await prisma.$queryRaw`SELECT 1 as test`;
          const endTime = performance.now();
          results.push(endTime - startTime);
        }

        const avgTime = results.reduce((sum, time) => sum + time, 0) / results.length;
        const minTime = Math.min(...results);
        const maxTime = Math.max(...results);
        const p95 = results.sort((a, b) => a - b)[Math.floor(results.length * 0.95)];

        console.log(`PostgreSQL Query Performance (${iterations} iterations):`);
        console.log(`  Average: ${avgTime.toFixed(2)}ms`);
        console.log(`  Min: ${minTime.toFixed(2)}ms`);
        console.log(`  Max: ${maxTime.toFixed(2)}ms`);
        console.log(`  95th percentile: ${p95.toFixed(2)}ms`);

        // Performance assertions
        expect(avgTime).toBeLessThan(100); // Average should be under 100ms
        expect(p95).toBeLessThan(200); // 95th percentile should be under 200ms
      } finally {
        require('@prisma/client').PrismaClient = originalPrisma;
      }
    });

    it('should benchmark connection pooling performance', async () => {
      const mockPrismaClient = {
        $connect: jest.fn().mockResolvedValue(undefined),
        $queryRaw: jest.fn().mockResolvedValue([{ id: 1 }]),
        $on: jest.fn(),
        $disconnect: jest.fn().mockResolvedValue(undefined),
      };

      const originalPrisma = require('@prisma/client').PrismaClient;
      require('@prisma/client').PrismaClient = jest.fn().mockImplementation(() => mockPrismaClient);

      try {
        await manager.initialize(mockConfig);
        const prisma = manager.getPrismaClient();

        const concurrentQueries = 20;
        const queriesPerConnection = 10;

        const startTime = performance.now();

        const promises = Array.from({ length: concurrentQueries }, async () => {
          const connectionPromises = Array.from({ length: queriesPerConnection }, async () => {
            return prisma.$queryRaw`SELECT pg_sleep(0.01) as test`;
          });
          return Promise.all(connectionPromises);
        });

        await Promise.all(promises);
        const endTime = performance.now();

        const totalTime = endTime - startTime;
        const totalQueries = concurrentQueries * queriesPerConnection;
        const queriesPerSecond = (totalQueries / totalTime) * 1000;

        console.log(`PostgreSQL Connection Pool Performance:`);
        console.log(`  Total queries: ${totalQueries}`);
        console.log(`  Total time: ${totalTime.toFixed(2)}ms`);
        console.log(`  Queries per second: ${queriesPerSecond.toFixed(2)}`);

        expect(queriesPerSecond).toBeGreaterThan(100); // Should handle at least 100 queries/second
      } finally {
        require('@prisma/client').PrismaClient = originalPrisma;
      }
    });
  });

  describe('Redis Performance', () => {
    let mockRedisClient: any;

    beforeEach(() => {
      mockRedisClient = {
        connect: jest.fn().mockResolvedValue(undefined),
        on: jest.fn(),
        quit: jest.fn().mockResolvedValue(undefined),
        isOpen: true,
        get: jest.fn().mockResolvedValue(null),
        setEx: jest.fn().mockResolvedValue('OK'),
        mGet: jest.fn().mockResolvedValue([]),
        del: jest.fn().mockResolvedValue(1),
        ping: jest.fn().mockResolvedValue('PONG'),
      };

      const originalRedis = require('redis').createClient;
      require('redis').createClient = jest.fn().mockReturnValue(mockRedisClient);
    });

    it('should benchmark basic cache operations', async () => {
      // Mock the connection manager to return our mock Redis client
      manager['redisClient'] = mockRedisClient;
      manager['isInitialized'] = true;

      await redisService.initialize();

      const iterations = 1000;
      const testData = { id: 1, name: 'test', data: 'x'.repeat(100) };

      // Benchmark SET operations
      const setTimes: number[] = [];
      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        await redisService.set(`test-key-${i}`, testData, { ttl: 3600 });
        const endTime = performance.now();
        setTimes.push(endTime - startTime);
      }

      // Benchmark GET operations
      mockRedisClient.get.mockResolvedValue(JSON.stringify(testData));
      const getTimes: number[] = [];
      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        await redisService.get(`test-key-${i}`);
        const endTime = performance.now();
        getTimes.push(endTime - startTime);
      }

      const avgSetTime = setTimes.reduce((sum, time) => sum + time, 0) / setTimes.length;
      const avgGetTime = getTimes.reduce((sum, time) => sum + time, 0) / getTimes.length;

      console.log(`Redis Cache Performance (${iterations} operations):`);
      console.log(`  Average SET time: ${avgSetTime.toFixed(2)}ms`);
      console.log(`  Average GET time: ${avgGetTime.toFixed(2)}ms`);

      expect(avgSetTime).toBeLessThan(5); // SET should be under 5ms
      expect(avgGetTime).toBeLessThan(2); // GET should be under 2ms
    });

    it('should benchmark multi-operations', async () => {
      manager['redisClient'] = mockRedisClient;
      manager['isInitialized'] = true;

      await redisService.initialize();

      const batchSize = 100;
      const batches = 10;
      const testData = Array.from({ length: batchSize }, (_, i) => ({
        [`key-${i}`]: { id: i, data: `test-data-${i}` },
      }));

      // Mock mget to return data
      const mockValues = Array(batchSize).fill(JSON.stringify({ id: 1, data: 'test' }));
      mockRedisClient.mGet.mockResolvedValue(mockValues);

      // Benchmark MGET operations
      const mgetTimes: number[] = [];
      for (let i = 0; i < batches; i++) {
        const keys = Object.keys(testData[0]);
        const startTime = performance.now();
        await redisService.mget(keys);
        const endTime = performance.now();
        mgetTimes.push(endTime - startTime);
      }

      const avgMgetTime = mgetTimes.reduce((sum, time) => sum + time, 0) / mgetTimes.length;

      console.log(`Redis Multi-GET Performance (${batches} batches of ${batchSize} keys):`);
      console.log(`  Average MGET time: ${avgMgetTime.toFixed(2)}ms`);
      console.log(`  Keys per second: ${((batchSize * batches) / (avgMgetTime * batches)) * 1000}`);

      expect(avgMgetTime).toBeLessThan(10); // MGET should be under 10ms
    });
  });

  describe('Qdrant Performance', () => {
    let mockQdrantClient: any;

    beforeEach(() => {
      mockQdrantClient = {
        health: jest.fn().mockResolvedValue({ status: 'ok' }),
        search: jest.fn().mockResolvedValue([
          { id: '1', score: 0.9, payload: { text: 'test' } },
          { id: '2', score: 0.8, payload: { text: 'test2' } },
        ]),
        upsert: jest.fn().mockResolvedValue({ status: 'ok' }),
        count: jest.fn().mockResolvedValue({ result: { count: 1000 } }),
      };

      const originalQdrant = require('@qdrant/js-client-rest').QdrantClient;
      require('@qdrant/js-client-rest').QdrantClient = jest.fn().mockImplementation(() => mockQdrantClient);
    });

    it('should benchmark vector search performance', async () => {
      manager['qdrantClient'] = mockQdrantClient;
      manager['isInitialized'] = true;

      await qdrantService.initialize();

      const iterations = 100;
      const testVector = Array.from({ length: 1536 }, () => Math.random());

      const searchTimes: number[] = [];
      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        await qdrantService.search('test-collection', {
          vector: testVector,
          limit: 10,
          includePayload: true,
        });
        const endTime = performance.now();
        searchTimes.push(endTime - startTime);
      }

      const avgSearchTime = searchTimes.reduce((sum, time) => sum + time, 0) / searchTimes.length;
      const minTime = Math.min(...searchTimes);
      const maxTime = Math.max(...searchTimes);
      const p95 = searchTimes.sort((a, b) => a - b)[Math.floor(searchTimes.length * 0.95)];

      console.log(`Qdrant Vector Search Performance (${iterations} searches):`);
      console.log(`  Average: ${avgSearchTime.toFixed(2)}ms`);
      console.log(`  Min: ${minTime.toFixed(2)}ms`);
      console.log(`  Max: ${maxTime.toFixed(2)}ms`);
      console.log(`  95th percentile: ${p95.toFixed(2)}ms`);

      expect(avgSearchTime).toBeLessThan(100); // Average search should be under 100ms
      expect(p95).toBeLessThan(200); // 95th percentile should be under 200ms
    });

    it('should benchmark vector upsert performance', async () => {
      manager['qdrantClient'] = mockQdrantClient;
      manager['isInitialized'] = true;

      await qdrantService.initialize();

      const batchSize = 100;
      const iterations = 10;
      const testPoints = Array.from({ length: batchSize }, (_, i) => ({
        id: `point-${i}`,
        vector: Array.from({ length: 1536 }, () => Math.random()),
        payload: { text: `test text ${i}`, index: i },
      }));

      const upsertTimes: number[] = [];
      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        await qdrantService.upsertPoints('test-collection', testPoints);
        const endTime = performance.now();
        upsertTimes.push(endTime - startTime);
      }

      const avgUpsertTime = upsertTimes.reduce((sum, time) => sum + time, 0) / upsertTimes.length;
      const vectorsPerSecond = (batchSize / avgUpsertTime) * 1000;

      console.log(`Qdrant Vector Upsert Performance (${iterations} batches of ${batchSize} vectors):`);
      console.log(`  Average upsert time: ${avgUpsertTime.toFixed(2)}ms`);
      console.log(`  Vectors per second: ${vectorsPerSecond.toFixed(2)}`);

      expect(avgUpsertTime).toBeLessThan(200); // Average upsert should be under 200ms
      expect(vectorsPerSecond).toBeGreaterThan(500); // Should handle at least 500 vectors/second
    });
  });

  describe('Elasticsearch Performance', () => {
    let mockElasticsearchClient: any;

    beforeEach(() => {
      mockElasticsearchClient = {
        ping: jest.fn().mockResolvedValue({ body: { status: 'ok' } }),
        search: jest.fn().mockResolvedValue({
          body: {
            hits: {
              total: { value: 100, relation: 'eq' },
              hits: Array.from({ length: 10 }, (_, i) => ({
                _id: `doc-${i}`,
                _score: 0.9 - i * 0.1,
                _source: { title: `Document ${i}`, content: `Test content ${i}` },
              })),
            },
          },
        }),
        index: jest.fn().mockResolvedValue({ body: { _id: '1', result: 'created' } }),
        indices: {
          create: jest.fn().mockResolvedValue({ body: { acknowledged: true } }),
        },
        cluster: {
          health: jest.fn().mockResolvedValue({ body: { status: 'green' } }),
        },
      };

      const originalElasticsearch = require('@elastic/elasticsearch').Client;
      require('@elastic/elasticsearch').Client = jest.fn().mockImplementation(() => mockElasticsearchClient);
    });

    it('should benchmark search performance', async () => {
      manager['elasticsearchClient'] = mockElasticsearchClient;
      manager['isInitialized'] = true;

      await elasticsearchService.initialize();

      const iterations = 100;
      const searchQuery = {
        query: {
          match: {
            content: 'test search query',
          },
        },
        size: 10,
      };

      const searchTimes: number[] = [];
      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        await elasticsearchService.search('test-index', searchQuery);
        const endTime = performance.now();
        searchTimes.push(endTime - startTime);
      }

      const avgSearchTime = searchTimes.reduce((sum, time) => sum + time, 0) / searchTimes.length;
      const minTime = Math.min(...searchTimes);
      const maxTime = Math.max(...searchTimes);
      const p95 = searchTimes.sort((a, b) => a - b)[Math.floor(searchTimes.length * 0.95)];

      console.log(`Elasticsearch Search Performance (${iterations} searches):`);
      console.log(`  Average: ${avgSearchTime.toFixed(2)}ms`);
      console.log(`  Min: ${minTime.toFixed(2)}ms`);
      console.log(`  Max: ${maxTime.toFixed(2)}ms`);
      console.log(`  95th percentile: ${p95.toFixed(2)}ms`);

      expect(avgSearchTime).toBeLessThan(50); // Average search should be under 50ms
      expect(p95).toBeLessThan(100); // 95th percentile should be under 100ms
    });

    it('should benchmark indexing performance', async () => {
      manager['elasticsearchClient'] = mockElasticsearchClient;
      manager['isInitialized'] = true;

      await elasticsearchService.initialize();

      const batchSize = 100;
      const iterations = 10;
      const testDocuments = Array.from({ length: batchSize }, (_, i) => ({
        id: `doc-${i}`,
        title: `Test Document ${i}`,
        content: `This is test content for document ${i}. It contains some text that would be indexed and searchable. `.repeat(10),
        timestamp: new Date().toISOString(),
      }));

      const indexTimes: number[] = [];
      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();

        for (const doc of testDocuments) {
          await elasticsearchService.indexDocument('test-index', doc.id, doc);
        }

        const endTime = performance.now();
        indexTimes.push(endTime - startTime);
      }

      const avgIndexTime = indexTimes.reduce((sum, time) => sum + time, 0) / indexTimes.length;
      const docsPerSecond = (batchSize / avgIndexTime) * 1000;

      console.log(`Elasticsearch Indexing Performance (${iterations} batches of ${batchSize} documents):`);
      console.log(`  Average indexing time: ${avgIndexTime.toFixed(2)}ms`);
      console.log(`  Documents per second: ${docsPerSecond.toFixed(2)}`);

      expect(avgIndexTime).toBeLessThan(1000); // Average batch indexing should be under 1 second
      expect(docsPerSecond).toBeGreaterThan(100); // Should handle at least 100 docs/second
    });
  });

  describe('Cross-Service Performance', () => {
    it('should benchmark concurrent operations across all services', async () => {
      // Mock all services
      manager['prismaClient'] = {
        $queryRaw: jest.fn().mockResolvedValue([{ id: 1 }]),
      } as any;
      manager['redisClient'] = {
        get: jest.fn().mockResolvedValue(JSON.stringify({ data: 'test' })),
        setEx: jest.fn().mockResolvedValue('OK'),
      } as any;
      manager['qdrantClient'] = {
        search: jest.fn().mockResolvedValue([{ id: '1', score: 0.9 }]),
      } as any;
      manager['elasticsearchClient'] = {
        search: jest.fn().mockResolvedValue({
          body: {
            hits: { total: { value: 10 }, hits: [] },
          },
        }),
      } as any;
      manager['isInitialized'] = true;

      const iterations = 50;
      const startTime = performance.now();

      const promises = Array.from({ length: iterations }, async () => {
        const operations = await Promise.all([
          // PostgreSQL query
          manager.getPrismaClient().$queryRaw`SELECT 1`,
          // Redis operations
          redisService.get('test-key'),
          redisService.set('test-key-2', { data: 'test' }, { ttl: 3600 }),
          // Qdrant search
          qdrantService.search('test-collection', {
            vector: Array.from({ length: 100 }, () => Math.random()),
            limit: 5,
          }),
          // Elasticsearch search
          elasticsearchService.search('test-index', {
            query: { match_all: {} },
            size: 5,
          }),
        ]);
        return operations;
      });

      await Promise.all(promises);
      const endTime = performance.now();

      const totalTime = endTime - startTime;
      const avgTimePerIteration = totalTime / iterations;
      const operationsPerSecond = (iterations * 5) / (totalTime / 1000); // 5 operations per iteration

      console.log(`Cross-Service Concurrent Performance (${iterations} concurrent iterations):`);
      console.log(`  Total time: ${totalTime.toFixed(2)}ms`);
      console.log(`  Average time per iteration: ${avgTimePerIteration.toFixed(2)}ms`);
      console.log(`  Operations per second: ${operationsPerSecond.toFixed(2)}`);

      expect(avgTimePerIteration).toBeLessThan(200); // Each iteration should be under 200ms
      expect(operationsPerSecond).toBeGreaterThan(25); // Should handle at least 25 operations/second
    });
  });
});
