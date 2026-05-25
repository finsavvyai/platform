import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { dataSources, users } from '../schema/index.js';

export async function seedDataSources(
  db: PostgresJsDatabase<any>,
  seedUsers: any[]
) {
  console.log('🗃️ Seeding data sources...');

  const sampleDataSources = [
    {
      userId: seedUsers[0].id,
      name: 'Primary PostgreSQL Database',
      type: 'postgresql',
      config: {
        host: 'localhost',
        port: 5432,
        database: 'questro_main',
        username: 'questro_user',
        password: '{{POSTGRES_PASSWORD}}',
        ssl: false,
        connectionTimeout: 30000,
        maxConnections: 10
      },
      status: 'active',
      tags: ['primary', 'production', 'postgresql'],
      metadata: {
        version: '15.0',
        description: 'Main application database',
        owner: 'Database Team',
        environment: 'production'
      }
    },
    {
      userId: seedUsers[0].id,
      name: 'Analytics Data Warehouse',
      type: 'postgresql',
      config: {
        host: 'analytics-db.questro.com',
        port: 5432,
        database: 'questro_analytics',
        username: 'analytics_user',
        password: '{{ANALYTICS_DB_PASSWORD}}',
        ssl: true,
        connectionTimeout: 45000,
        maxConnections: 5,
        readOnly: true
      },
      status: 'active',
      tags: ['analytics', 'warehouse', 'readonly'],
      metadata: {
        version: '15.0',
        description: 'Analytics and reporting database',
        owner: 'Analytics Team',
        environment: 'production',
        dataRetention: '2 years'
      }
    },
    {
      userId: seedUsers[0].id,
      name: 'Redis Cache',
      type: 'redis',
      config: {
        host: 'redis.questro.com',
        port: 6379,
        password: '{{REDIS_PASSWORD}}',
        database: 0,
        connectionTimeout: 10000,
        maxConnections: 20,
        keyPrefix: 'questro:'
      },
      status: 'active',
      tags: ['cache', 'redis', 'session'],
      metadata: {
        version: '7.0',
        description: 'Application cache and session store',
        owner: 'Backend Team',
        environment: 'production',
        maxMemory: '2GB'
      }
    },
    {
      userId: seedUsers[0].id,
      name: 'MongoDB Document Store',
      type: 'mongodb',
      config: {
        connectionString: 'mongodb://mongo-user:{{MONGO_PASSWORD}}@mongo.questro.com:27017/questro_docs',
        database: 'questro_docs',
        authSource: 'admin',
        ssl: true,
        replicaSet: 'questro-replica',
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 30000
      },
      status: 'active',
      tags: ['documents', 'mongodb', 'nosql'],
      metadata: {
        version: '6.0',
        description: 'Document storage for test artifacts',
        owner: 'Backend Team',
        environment: 'production',
        collections: ['test_artifacts', 'recordings', 'reports']
      }
    },
    {
      userId: seedUsers[1]?.id || seedUsers[0].id,
      name: 'External API - JSONPlaceholder',
      type: 'api',
      config: {
        baseUrl: 'https://jsonplaceholder.typicode.com',
        authentication: {
          type: 'none'
        },
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Questro-Testing/1.0'
        },
        timeout: 30000,
        retryConfig: {
          maxRetries: 3,
          retryDelay: 1000
        }
      },
      status: 'active',
      tags: ['api', 'external', 'testing'],
      metadata: {
        description: 'External API for testing purposes',
        owner: 'QA Team',
        environment: 'external',
        rateLimit: '1000 requests/hour'
      }
    },
    {
      userId: seedUsers[0].id,
      name: 'GraphQL API - GitHub',
      type: 'graphql',
      config: {
        endpoint: 'https://api.github.com/graphql',
        authentication: {
          type: 'bearer',
          token: '{{GITHUB_TOKEN}}'
        },
        headers: {
          'User-Agent': 'Questro-Testing/1.0'
        },
        timeout: 45000,
        introspection: true
      },
      status: 'active',
      tags: ['graphql', 'github', 'external'],
      metadata: {
        description: 'GitHub GraphQL API for integration testing',
        owner: 'Integration Team',
        environment: 'external',
        version: 'v4'
      }
    },
    {
      userId: seedUsers[0].id,
      name: 'Test Database - MySQL',
      type: 'mysql',
      config: {
        host: 'test-mysql.questro.com',
        port: 3306,
        database: 'questro_test',
        username: 'test_user',
        password: '{{MYSQL_TEST_PASSWORD}}',
        ssl: false,
        connectionTimeout: 30000,
        acquireTimeout: 60000,
        maxConnections: 5
      },
      status: 'inactive',
      tags: ['mysql', 'testing', 'temporary'],
      metadata: {
        version: '8.0',
        description: 'MySQL database for testing purposes',
        owner: 'QA Team',
        environment: 'testing',
        autoCleanup: true
      }
    },
    {
      userId: seedUsers[1]?.id || seedUsers[0].id,
      name: 'REST API - Internal Services',
      type: 'rest',
      config: {
        baseUrl: 'https://internal-api.questro.com',
        authentication: {
          type: 'api_key',
          apiKey: '{{INTERNAL_API_KEY}}',
          header: 'X-API-Key'
        },
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 30000,
        retryConfig: {
          maxRetries: 2,
          retryDelay: 2000,
          retryOnStatus: [500, 502, 503, 504]
        }
      },
      status: 'active',
      tags: ['rest', 'internal', 'microservices'],
      metadata: {
        description: 'Internal microservices API',
        owner: 'Backend Team',
        environment: 'production',
        services: ['user-service', 'project-service', 'notification-service']
      }
    }
  ];

  try {
    const insertedDataSources = await db.insert(dataSources).values(sampleDataSources).returning();
    console.log(`✅ Seeded ${insertedDataSources.length} data sources`);
    return insertedDataSources;
  } catch (error) {
    console.error('❌ Error seeding data sources:', error);
    throw error;
  }
}