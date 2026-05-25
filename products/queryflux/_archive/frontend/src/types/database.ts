export type DatabaseCategory =
  | 'rdbms'
  | 'nosql'
  | 'cloud'
  | 'aws'
  | 'timeseries'
  | 'cache'
  | 'graph';

export type DatabaseType =
  | 'postgresql'
  | 'mysql'
  | 'mariadb'
  | 'sqlite'
  | 'oracle'
  | 'sqlserver'
  | 'mongodb'
  | 'cassandra'
  | 'couchdb'
  | 'dynamodb'
  | 'redis'
  | 'memcached'
  | 'influxdb'
  | 'timescaledb'
  | 'questdb'
  | 'cockroachdb'
  | 'supabase'
  | 'planetscale'
  | 'neon'
  | 'rds-postgresql'
  | 'rds-mysql'
  | 'aurora'
  | 'redshift'
  | 'documentdb'
  | 'elasticache'
  | 'neo4j'
  | 'arangodb';

export interface DatabaseConfig {
  type: DatabaseType;
  name: string;
  icon: string;
  defaultPort: number;
  requiresHost: boolean;
  requiresDatabase: boolean;
  supportsSSL: boolean;
  supportsURL: boolean;
  color: string;
  category: DatabaseCategory;
  supportsDocker: boolean;
  dockerImage?: string;
}

export const DATABASE_CONFIGS: Record<DatabaseType, DatabaseConfig> = {
  postgresql: {
    type: 'postgresql',
    name: 'PostgreSQL',
    icon: 'database',
    defaultPort: 5432,
    requiresHost: true,
    requiresDatabase: true,
    supportsSSL: true,
    supportsURL: true,
    color: '#336791',
    category: 'rdbms',
    supportsDocker: true,
    dockerImage: 'postgres:16-alpine',
  },
  mysql: {
    type: 'mysql',
    name: 'MySQL',
    icon: 'database',
    defaultPort: 3306,
    requiresHost: true,
    requiresDatabase: true,
    supportsSSL: true,
    supportsURL: true,
    color: '#4479A1',
    category: 'rdbms',
    supportsDocker: true,
    dockerImage: 'mysql:8',
  },
  mariadb: {
    type: 'mariadb',
    name: 'MariaDB',
    icon: 'database',
    defaultPort: 3306,
    requiresHost: true,
    requiresDatabase: true,
    supportsSSL: true,
    supportsURL: true,
    color: '#003545',
    category: 'rdbms',
    supportsDocker: true,
    dockerImage: 'mariadb:11',
  },
  sqlite: {
    type: 'sqlite',
    name: 'SQLite',
    icon: 'hard-drive',
    defaultPort: 0,
    requiresHost: false,
    requiresDatabase: true,
    supportsSSL: false,
    supportsURL: false,
    color: '#003B57',
    category: 'rdbms',
    supportsDocker: false,
  },
  oracle: {
    type: 'oracle',
    name: 'Oracle',
    icon: 'database',
    defaultPort: 1521,
    requiresHost: true,
    requiresDatabase: true,
    supportsSSL: true,
    supportsURL: true,
    color: '#F80000',
    category: 'rdbms',
    supportsDocker: true,
    dockerImage: 'container-registry.oracle.com/database/express:21.3.0-xe',
  },
  sqlserver: {
    type: 'sqlserver',
    name: 'SQL Server',
    icon: 'server',
    defaultPort: 1433,
    requiresHost: true,
    requiresDatabase: true,
    supportsSSL: true,
    supportsURL: true,
    color: '#CC2927',
    category: 'rdbms',
    supportsDocker: true,
    dockerImage: 'mcr.microsoft.com/mssql/server:2022-latest',
  },
  mongodb: {
    type: 'mongodb',
    name: 'MongoDB',
    icon: 'leaf',
    defaultPort: 27017,
    requiresHost: true,
    requiresDatabase: true,
    supportsSSL: true,
    supportsURL: true,
    color: '#47A248',
    category: 'nosql',
    supportsDocker: true,
    dockerImage: 'mongo:7',
  },
  cassandra: {
    type: 'cassandra',
    name: 'Cassandra',
    icon: 'layers',
    defaultPort: 9042,
    requiresHost: true,
    requiresDatabase: true,
    supportsSSL: true,
    supportsURL: false,
    color: '#1287B1',
    category: 'nosql',
    supportsDocker: true,
    dockerImage: 'cassandra:5',
  },
  couchdb: {
    type: 'couchdb',
    name: 'CouchDB',
    icon: 'database',
    defaultPort: 5984,
    requiresHost: true,
    requiresDatabase: true,
    supportsSSL: true,
    supportsURL: true,
    color: '#E42528',
    category: 'nosql',
    supportsDocker: true,
    dockerImage: 'couchdb:3',
  },
  dynamodb: {
    type: 'dynamodb',
    name: 'DynamoDB',
    icon: 'database',
    defaultPort: 8000,
    requiresHost: true,
    requiresDatabase: false,
    supportsSSL: true,
    supportsURL: false,
    color: '#527FFF',
    category: 'aws',
    supportsDocker: true,
    dockerImage: 'amazon/dynamodb-local:latest',
  },
  redis: {
    type: 'redis',
    name: 'Redis',
    icon: 'box',
    defaultPort: 6379,
    requiresHost: true,
    requiresDatabase: false,
    supportsSSL: true,
    supportsURL: true,
    color: '#DC382D',
    category: 'cache',
    supportsDocker: true,
    dockerImage: 'redis:7-alpine',
  },
  memcached: {
    type: 'memcached',
    name: 'Memcached',
    icon: 'box',
    defaultPort: 11211,
    requiresHost: true,
    requiresDatabase: false,
    supportsSSL: false,
    supportsURL: false,
    color: '#4B8BBE',
    category: 'cache',
    supportsDocker: true,
    dockerImage: 'memcached:alpine',
  },
  influxdb: {
    type: 'influxdb',
    name: 'InfluxDB',
    icon: 'activity',
    defaultPort: 8086,
    requiresHost: true,
    requiresDatabase: true,
    supportsSSL: true,
    supportsURL: true,
    color: '#22ADF6',
    category: 'timeseries',
    supportsDocker: true,
    dockerImage: 'influxdb:2.7-alpine',
  },
  timescaledb: {
    type: 'timescaledb',
    name: 'TimescaleDB',
    icon: 'clock',
    defaultPort: 5432,
    requiresHost: true,
    requiresDatabase: true,
    supportsSSL: true,
    supportsURL: true,
    color: '#FDB515',
    category: 'timeseries',
    supportsDocker: true,
    dockerImage: 'timescale/timescaledb:latest-pg16',
  },
  questdb: {
    type: 'questdb',
    name: 'QuestDB',
    icon: 'activity',
    defaultPort: 9000,
    requiresHost: true,
    requiresDatabase: true,
    supportsSSL: false,
    supportsURL: false,
    color: '#FF6B00',
    category: 'timeseries',
    supportsDocker: true,
    dockerImage: 'questdb/questdb:latest',
  },
  cockroachdb: {
    type: 'cockroachdb',
    name: 'CockroachDB',
    icon: 'bug',
    defaultPort: 26257,
    requiresHost: true,
    requiresDatabase: true,
    supportsSSL: true,
    supportsURL: true,
    color: '#6933FF',
    category: 'rdbms',
    supportsDocker: true,
    dockerImage: 'cockroachdb/cockroach:latest',
  },
  supabase: {
    type: 'supabase',
    name: 'Supabase',
    icon: 'zap',
    defaultPort: 5432,
    requiresHost: false,
    requiresDatabase: false,
    supportsSSL: true,
    supportsURL: true,
    color: '#3ECF8E',
    category: 'cloud',
    supportsDocker: false,
  },
  planetscale: {
    type: 'planetscale',
    name: 'PlanetScale',
    icon: 'cloud',
    defaultPort: 3306,
    requiresHost: true,
    requiresDatabase: true,
    supportsSSL: true,
    supportsURL: true,
    color: '#000000',
    category: 'cloud',
    supportsDocker: false,
  },
  neon: {
    type: 'neon',
    name: 'Neon',
    icon: 'zap',
    defaultPort: 5432,
    requiresHost: true,
    requiresDatabase: true,
    supportsSSL: true,
    supportsURL: true,
    color: '#00E699',
    category: 'cloud',
    supportsDocker: false,
  },
  'rds-postgresql': {
    type: 'rds-postgresql',
    name: 'RDS PostgreSQL',
    icon: 'cloud',
    defaultPort: 5432,
    requiresHost: true,
    requiresDatabase: true,
    supportsSSL: true,
    supportsURL: true,
    color: '#FF9900',
    category: 'aws',
    supportsDocker: false,
  },
  'rds-mysql': {
    type: 'rds-mysql',
    name: 'RDS MySQL',
    icon: 'cloud',
    defaultPort: 3306,
    requiresHost: true,
    requiresDatabase: true,
    supportsSSL: true,
    supportsURL: true,
    color: '#FF9900',
    category: 'aws',
    supportsDocker: false,
  },
  aurora: {
    type: 'aurora',
    name: 'Aurora',
    icon: 'cloud',
    defaultPort: 3306,
    requiresHost: true,
    requiresDatabase: true,
    supportsSSL: true,
    supportsURL: true,
    color: '#FF9900',
    category: 'aws',
    supportsDocker: false,
  },
  redshift: {
    type: 'redshift',
    name: 'Redshift',
    icon: 'database',
    defaultPort: 5439,
    requiresHost: true,
    requiresDatabase: true,
    supportsSSL: true,
    supportsURL: true,
    color: '#8C4FFF',
    category: 'aws',
    supportsDocker: false,
  },
  documentdb: {
    type: 'documentdb',
    name: 'DocumentDB',
    icon: 'leaf',
    defaultPort: 27017,
    requiresHost: true,
    requiresDatabase: true,
    supportsSSL: true,
    supportsURL: true,
    color: '#FF9900',
    category: 'aws',
    supportsDocker: false,
  },
  elasticache: {
    type: 'elasticache',
    name: 'ElastiCache',
    icon: 'box',
    defaultPort: 6379,
    requiresHost: true,
    requiresDatabase: false,
    supportsSSL: true,
    supportsURL: false,
    color: '#FF9900',
    category: 'aws',
    supportsDocker: false,
  },
  neo4j: {
    type: 'neo4j',
    name: 'Neo4j',
    icon: 'network',
    defaultPort: 7687,
    requiresHost: true,
    requiresDatabase: true,
    supportsSSL: true,
    supportsURL: true,
    color: '#008CC1',
    category: 'graph',
    supportsDocker: true,
    dockerImage: 'neo4j:5',
  },
  arangodb: {
    type: 'arangodb',
    name: 'ArangoDB',
    icon: 'network',
    defaultPort: 8529,
    requiresHost: true,
    requiresDatabase: true,
    supportsSSL: true,
    supportsURL: false,
    color: '#DDE072',
    category: 'graph',
    supportsDocker: true,
    dockerImage: 'arangodb:latest',
  },
};

export const DATABASE_CATEGORIES = {
  rdbms: {
    name: 'Relational Databases',
    icon: 'database',
    color: '#3b82f6',
  },
  nosql: {
    name: 'NoSQL Databases',
    icon: 'layers',
    color: '#8b5cf6',
  },
  cloud: {
    name: 'Cloud Platforms',
    icon: 'cloud',
    color: '#06b6d4',
  },
  aws: {
    name: 'AWS Services',
    icon: 'cloud',
    color: '#f59e0b',
  },
  timeseries: {
    name: 'Time Series',
    icon: 'activity',
    color: '#10b981',
  },
  cache: {
    name: 'Cache & In-Memory',
    icon: 'zap',
    color: '#ef4444',
  },
  graph: {
    name: 'Graph Databases',
    icon: 'network',
    color: '#ec4899',
  },
};
