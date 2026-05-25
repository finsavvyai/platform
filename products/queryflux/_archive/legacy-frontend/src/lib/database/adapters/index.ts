import { DatabaseAdapter, DatabaseConfig } from '../types';
import { PostgreSQLAdapter } from './postgresql';
import { MySQLAdapter } from './mysql';
import { MongoDBAdapter } from './mongodb';
import { RedisAdapter } from './redis';
import { SQLiteAdapter } from './sqlite';

export class DatabaseAdapterFactory {
  static create(config: DatabaseConfig): DatabaseAdapter {
    switch (config.type) {
      case 'postgresql':
        return new PostgreSQLAdapter(config);
      case 'mysql':
        return new MySQLAdapter(config);
      case 'mongodb':
        return new MongoDBAdapter(config);
      case 'redis':
        return new RedisAdapter(config);
      case 'sqlite':
        return new SQLiteAdapter(config);
      case 'sqlserver':
        // TODO: Implement SQL Server adapter
        throw new Error('SQL Server adapter not yet implemented for web version');
      case 'oracle':
        // TODO: Implement Oracle adapter
        throw new Error('Oracle adapter not yet implemented for web version');
      case 'cassandra':
        // TODO: Implement Cassandra adapter
        throw new Error('Cassandra adapter not yet implemented for web version');
      default:
        throw new Error(`Unsupported database type: ${config.type}`);
    }
  }

  static getSupportedTypes(): string[] {
    return ['postgresql', 'mysql', 'mongodb', 'redis', 'sqlite'];
  }

  static getDatabaseInfo(type: string) {
    const databaseInfo = {
      postgresql: {
        name: 'PostgreSQL',
        description: 'Advanced open source relational database',
        icon: '🐘',
        defaultPort: 5432,
        docsUrl: 'https://www.postgresql.org/docs/'
      },
      mysql: {
        name: 'MySQL',
        description: 'World\'s most popular open source database',
        icon: '🐬',
        defaultPort: 3306,
        docsUrl: 'https://dev.mysql.com/doc/'
      },
      mongodb: {
        name: 'MongoDB',
        description: 'Leading NoSQL document database',
        icon: '🍃',
        defaultPort: 27017,
        docsUrl: 'https://docs.mongodb.com/'
      },
      redis: {
        name: 'Redis',
        description: 'In-memory data structure store',
        icon: '🔴',
        defaultPort: 6379,
        docsUrl: 'https://redis.io/documentation'
      },
      sqlite: {
        name: 'SQLite',
        description: 'Self-contained, serverless database engine',
        icon: '💾',
        defaultPort: 0,
        docsUrl: 'https://sqlite.org/docs.html'
      }
    };

    return databaseInfo[type as keyof typeof databaseInfo] || null;
  }
}
