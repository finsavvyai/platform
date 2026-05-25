// Database adapters
export { PostgreSQLAdapter } from "./postgresql-adapter";
export { MySQLAdapter } from "./mysql-adapter";
export { MongoDBAdapter } from "./mongodb-adapter";
export { RedisAdapter } from "./redis-adapter";
export { SQLiteAdapter } from "./sqlite-adapter";
export { CassandraAdapter } from "./cassandra-adapter";
export { OracleAdapter } from "./oracle-adapter";
export { SqlServerAdapter } from "./sqlserver-adapter";

// Adapter factory
import { DatabaseAdapter, ConnectionConfig } from "../types";
import { PostgreSQLAdapter } from "./postgresql-adapter";
import { MySQLAdapter } from "./mysql-adapter";
import { MongoDBAdapter } from "./mongodb-adapter";
import { RedisAdapter } from "./redis-adapter";
import { SQLiteAdapter } from "./sqlite-adapter";
import { CassandraAdapter } from "./cassandra-adapter";
import { OracleAdapter } from "./oracle-adapter";
import { SqlServerAdapter } from "./sqlserver-adapter";

export class DatabaseAdapterFactory {
  static createAdapter(config: ConnectionConfig): DatabaseAdapter {
    switch (config.type.toLowerCase()) {
      case "postgresql":
      case "postgres":
      case "postgre":
        return new PostgreSQLAdapter();

      case "mysql":
        return new MySQLAdapter();

      case "mongodb":
      case "mongo":
        return new MongoDBAdapter();

      case "redis":
        return new RedisAdapter();

      case "sqlite":
      case "sqlite3":
        return new SQLiteAdapter(config.readonly || false);

      case "cassandra":
        return new CassandraAdapter();

      case "oracle":
      case "oracledb":
        return new OracleAdapter();

      case "sqlserver":
      case "mssql":
      case "sql-server":
        return new SqlServerAdapter();

      case "cockroachdb":
        return new PostgreSQLAdapter(); // Use PostgreSQL adapter

      default:
        throw new Error(`Unsupported database type: ${config.type}`);
    }
  }

  static getSupportedDatabases(): string[] {
    return [
      "postgresql",
      "postgres",
      "postgre",
      "mysql",
      "mongodb",
      "mongo",
      "redis",
      "sqlite",
      "sqlite3",
      "cassandra",
      "oracle",
      "oracledb",
      "sqlserver",
      "mssql",
      "sql-server",
      "cockroachdb",
    ];
  }

  static validateConfig(config: ConnectionConfig): boolean {
    const requiredFields = [
      "id",
      "name",
      "type",
      "host",
      "port",
      "database",
      "username",
    ];

    for (const field of requiredFields) {
      if (!config[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Database-specific validation
    switch (config.type.toLowerCase()) {
      case "postgresql":
      case "postgres":
      case "postgre":
        return this.validatePostgreSQLConfig(config);

      case "mysql":
        return this.validateMySQLConfig(config);

      case "mongodb":
      case "mongo":
        return this.validateMongoDBConfig(config);

      case "redis":
        return this.validateRedisConfig(config);

      case "sqlite":
      case "sqlite3":
        return this.validateSQLiteConfig(config);

      case "cassandra":
        return this.validateCassandraConfig(config);

      case "oracle":
      case "oracledb":
        return this.validateOracleConfig(config);

      case "sqlserver":
      case "mssql":
      case "sql-server":
        return this.validateSqlServerConfig(config);

      default:
        throw new Error(`Unsupported database type: ${config.type}`);
    }
  }

  private static validatePostgreSQLConfig(config: ConnectionConfig): boolean {
    if (config.port && (config.port < 1 || config.port > 65535)) {
      throw new Error("PostgreSQL port must be between 1 and 65535");
    }

    if (
      config.maxConnections &&
      (config.maxConnections < 1 || config.maxConnections > 1000)
    ) {
      throw new Error("PostgreSQL max connections must be between 1 and 1000");
    }

    return true;
  }

  private static validateMySQLConfig(config: ConnectionConfig): boolean {
    if (config.port && (config.port < 1 || config.port > 65535)) {
      throw new Error("MySQL port must be between 1 and 65535");
    }

    if (
      config.maxConnections &&
      (config.maxConnections < 1 || config.maxConnections > 1000)
    ) {
      throw new Error("MySQL max connections must be between 1 and 1000");
    }

    return true;
  }

  private static validateMongoDBConfig(config: ConnectionConfig): boolean {
    if (config.port && (config.port < 1 || config.port > 65535)) {
      throw new Error("MongoDB port must be between 1 and 65535");
    }

    if (
      config.readPreference &&
      ![
        "primary",
        "primaryPreferred",
        "secondary",
        "secondaryPreferred",
        "nearest",
      ].includes(config.readPreference)
    ) {
      throw new Error("Invalid read preference");
    }

    return true;
  }

  private static validateRedisConfig(config: ConnectionConfig): boolean {
    if (config.port && (config.port < 1 || config.port > 65535)) {
      throw new Error("Redis port must be between 1 and 65535");
    }

    if (config.db && (config.db < 0 || config.db > 15)) {
      throw new Error("Redis database index must be between 0 and 15");
    }

    if (config.family && ![4, 6].includes(config.family)) {
      throw new Error("Redis IP family must be 4 or 6");
    }

    return true;
  }

  private static validateSQLiteConfig(config: ConnectionConfig): boolean {
    // SQLite doesn't use host/port but uses file path
    if (!config.file && !config.database) {
      throw new Error("SQLite requires a file path or database name");
    }
    return true;
  }

  private static validateCassandraConfig(config: ConnectionConfig): boolean {
    if (config.port && (config.port < 1 || config.port > 65535)) {
      throw new Error("Cassandra port must be between 1 and 65535");
    }
    if (!config.dataCenter) {
      throw new Error("Cassandra requires a data center name");
    }
    return true;
  }

  private static validateOracleConfig(config: ConnectionConfig): boolean {
    if (config.port && (config.port < 1 || config.port > 65535)) {
      throw new Error("Oracle port must be between 1 and 65535");
    }
    if (!config.serviceName && !config.sid) {
      throw new Error("Oracle requires either service name or SID");
    }
    return true;
  }

  private static validateSqlServerConfig(config: ConnectionConfig): boolean {
    if (config.port && (config.port < 1 || config.port > 65535)) {
      throw new Error("SQL Server port must be between 1 and 65535");
    }
    if (!config.database) {
      throw new Error("SQL Server requires a database name");
    }
    return true;
  }

  static getSampleConfig(databaseType: string): ConnectionConfig {
    const timestamp = Date.now();

    switch (databaseType.toLowerCase()) {
      case "postgresql":
      case "postgres":
      case "postgre":
        return {
          id: `pg-${timestamp}`,
          name: "PostgreSQL Connection",
          type: "postgresql",
          host: "localhost",
          port: 5432,
          database: "postgres",
          username: "postgres",
          password: "password",
          ssl: false,
          maxConnections: 10,
          minConnections: 2,
          timeout: 30000,
          idleTimeout: 30000,
        };

      case "mysql":
        return {
          id: `mysql-${timestamp}`,
          name: "MySQL Connection",
          type: "mysql",
          host: "localhost",
          port: 3306,
          database: "mysql",
          username: "root",
          password: "password",
          ssl: false,
          maxConnections: 10,
          minConnections: 2,
          timeout: 30000,
          idleTimeout: 30000,
          charset: "utf8mb4",
        };

      case "mongodb":
      case "mongo":
        return {
          id: `mongo-${timestamp}`,
          name: "MongoDB Connection",
          type: "mongodb",
          host: "localhost",
          port: 27017,
          database: "test",
          username: "mongouser",
          password: "password",
          authDatabase: "admin",
          maxConnections: 10,
          minConnections: 2,
          timeout: 30000,
          idleTimeout: 30000,
        };

      case "redis":
        return {
          id: `redis-${timestamp}`,
          name: "Redis Connection",
          type: "redis",
          host: "localhost",
          port: 6379,
          database: "test",
          password: undefined,
          maxConnections: 10,
          minConnections: 2,
          timeout: 30000,
        };

      case "sqlite":
      case "sqlite3":
        return {
          id: `sqlite-${timestamp}`,
          name: "SQLite Connection",
          type: "sqlite",
          host: "localhost",
          port: 0,
          database: `queryflux-${timestamp}.db`,
          username: "",
          password: "",
          readonly: false,
        };

      case "cassandra":
        return {
          id: `cassandra-${timestamp}`,
          name: "Cassandra Connection",
          type: "cassandra",
          host: "localhost",
          port: 9042,
          database: "cassandra",
          username: "cassandra",
          password: "cassandra",
          dataCenter: "datacenter1",
          keyspace: "queryflux",
        };

      case "oracle":
      case "oracledb":
        return {
          id: `oracle-${timestamp}`,
          name: "Oracle Connection",
          type: "oracle",
          host: "localhost",
          port: 1521,
          database: "oracle",
          username: "system",
          password: "oracle",
          serviceName: "ORCL",
          sid: "ORCL",
        };

      case "sqlserver":
      case "mssql":
      case "sql-server":
        return {
          id: `sqlserver-${timestamp}`,
          name: "SQL Server Connection",
          type: "sqlserver",
          host: "localhost",
          port: 1433,
          database: "master",
          username: "sa",
          password: "password",
          encrypt: false,
          trustServerCertificate: false,
        };

      default:
        throw new Error(`Unsupported database type: ${databaseType}`);
    }
  }

  static getConnectionDefaults(databaseType: string): any {
    switch (databaseType.toLowerCase()) {
      case "postgresql":
      case "postgres":
      case "postgre":
        return {
          ssl: false,
          maxConnections: 10,
          minConnections: 2,
          timeout: 30000,
          idleTimeout: 30000,
        };

      case "mysql":
        return {
          ssl: false,
          maxConnections: 10,
          minConnections: 2,
          timeout: 30000,
          idleTimeout: 30000,
          charset: "utf8mb4",
          timezone: "+00:00",
        };

      case "mongodb":
      case "mongo":
        return {
          authDatabase: "admin",
          readPreference: "primary",
          retryWrites: true,
          retryReads: true,
          maxConnections: 10,
          minConnections: 2,
          timeout: 30000,
          idleTimeout: 30000,
        };

      case "redis":
        return {
          db: 0,
          family: 4,
          keepAlive: true,
          connectTimeout: 30000,
          commandTimeout: 5000,
          lazyConnect: false,
          maxRetriesPerRequest: 3,
        };

      case "sqlite":
      case "sqlite3":
        return {
          readonly: false,
          verbose: false,
          timeout: 30000,
        };

      case "cassandra":
        return {
          dataCenter: "datacenter1",
          keyspace: "queryflux",
          timeout: 30000,
        };

      case "oracle":
      case "oracledb":
        return {
          serviceName: "ORCL",
          sid: "ORCL",
          timeout: 30000,
        };

      case "sqlserver":
      case "mssql":
      case "sql-server":
        return {
          encrypt: false,
          trustServerCertificate: false,
          timeout: 30000,
        };

      default:
        return {};
    }
  }

  static getRequiredFields(databaseType: string): string[] {
    const baseFields = ["id", "name", "type"];

    switch (databaseType.toLowerCase()) {
      case "postgresql":
      case "postgres":
      case "postgre":
      case "mysql":
        return [
          ...baseFields,
          "host",
          "port",
          "database",
          "username",
          "password",
        ];

      case "mongodb":
      case "mongo":
        return [
          ...baseFields,
          "host",
          "port",
          "database",
          "username",
          "password",
        ];

      case "redis":
        return [...baseFields, "host", "port", "database"];

      case "sqlite":
      case "sqlite3":
        return [...baseFields, "file"];

      case "cassandra":
        return [
          ...baseFields,
          "host",
          "port",
          "database",
          "username",
          "password",
          "dataCenter",
        ];

      case "oracle":
      case "oracledb":
        return [
          ...baseFields,
          "host",
          "port",
          "database",
          "username",
          "password",
        ];

      case "sqlserver":
      case "mssql":
      case "sql-server":
        return [
          ...baseFields,
          "host",
          "port",
          "database",
          "username",
          "password",
        ];

      default:
        return baseFields;
    }
  }

  static getOptionalFields(databaseType: string): string[] {
    switch (databaseType.toLowerCase()) {
      case "postgresql":
      case "postgres":
      case "postgre":
        return [
          "ssl",
          "sslOptions",
          "timeout",
          "idleTimeout",
          "maxConnections",
          "minConnections",
          "options",
        ];

      case "mysql":
        return [
          "ssl",
          "sslOptions",
          "timeout",
          "idleTimeout",
          "maxConnections",
          "minConnections",
          "charset",
          "timezone",
          "options",
        ];

      case "mongodb":
      case "mongo":
        return [
          "ssl",
          "sslOptions",
          "authDatabase",
          "replicaSet",
          "readPreference",
          "writeConcern",
          "readConcern",
          "retryWrites",
          "retryReads",
          "timeout",
          "idleTimeout",
          "maxConnections",
          "minConnections",
          "options",
        ];

      case "redis":
        return [
          "password",
          "family",
          "keepAlive",
          "connectTimeout",
          "commandTimeout",
          "lazyConnect",
          "maxRetriesPerRequest",
          "options",
        ];

      case "sqlite":
      case "sqlite3":
        return ["readonly", "verbose", "timeout", "options"];

      case "cassandra":
        return ["keyspace", "timeout", "options"];

      case "oracle":
      case "oracledb":
        return ["serviceName", "sid", "timeout", "options"];

      case "sqlserver":
      case "mssql":
      case "sql-server":
        return ["encrypt", "trustServerCertificate", "timeout", "options"];

      default:
        return [];
    }
  }

  static getCapabilities(databaseType: string): any {
    switch (databaseType.toLowerCase()) {
      case "postgresql":
      case "postgres":
      case "postgre":
        return {
          supportsTransactions: true,
          supportsForeignKeys: true,
          supportsViews: true,
          supportsProcedures: true,
          supportsTriggers: true,
          supportsFullTextSearch: true,
          supportsJson: true,
          supportsArrays: true,
          supportsConnectionPooling: true,
        };

      case "mysql":
        return {
          supportsTransactions: true,
          supportsForeignKeys: true,
          supportsViews: true,
          supportsProcedures: true,
          supportsTriggers: true,
          supportsFullTextSearch: true,
          supportsJson: true,
          supportsArrays: false,
          supportsConnectionPooling: true,
        };

      case "mongodb":
        return {
          supportsTransactions: false,
          supportsForeignKeys: false,
          supportsViews: false,
          supportsProcedures: false,
          supportsTriggers: false,
          supportsFullTextSearch: true,
          supportsJson: true,
          supportsArrays: true,
          supportsConnectionPooling: true,
          supportsAggregation: true,
        };

      case "redis":
        return {
          supportsTransactions: false,
          supportsForeignKeys: false,
          supportsViews: false,
          supportsProcedures: false,
          supportsTriggers: false,
          supportsFullTextSearch: false,
          supportsJson: false,
          supportsArrays: false,
          supportsConnectionPooling: true,
          supportsPubSub: true,
          supportsLuaScripts: true,
        };

      case "sqlite":
      case "sqlite3":
        return {
          supportsTransactions: true,
          supportsForeignKeys: true,
          supportsViews: true,
          supportsProcedures: false,
          supportsTriggers: true,
          supportsFullTextSearch: true,
          supportsJson: true,
          supportsArrays: false,
          supportsConnectionPooling: false,
        };

      case "cassandra":
        return {
          supportsTransactions: false,
          supportsForeignKeys: false,
          supportsViews: false,
          supportsProcedures: false,
          supportsTriggers: false,
          supportsFullTextSearch: true,
          supportsJson: false,
          supportsArrays: true,
          supportsConnectionPooling: false,
          supportsBatchOperations: true,
          supportsWideColumns: true,
        };

      case "oracle":
      case "oracledb":
        return {
          supportsTransactions: true,
          supportsForeignKeys: true,
          supportsViews: true,
          supportsProcedures: true,
          supportsTriggers: true,
          supportsFullTextSearch: true,
          supportsJson: true,
          supportsArrays: true,
          supportsConnectionPooling: true,
        };

      case "sqlserver":
      case "mssql":
      case "sql-server":
        return {
          supportsTransactions: true,
          supportsForeignKeys: true,
          supportsViews: true,
          supportsProcedures: true,
          supportsTriggers: true,
          supportsFullTextSearch: true,
          supportsJson: true,
          supportsArrays: false,
          supportsConnectionPooling: true,
        };

      default:
        return {
          supportsTransactions: false,
          supportsForeignKeys: false,
          supportsViews: false,
          supportsProcedures: false,
          supportsTriggers: false,
          supportsFullTextSearch: false,
          supportsJson: false,
          supportsArrays: false,
          supportsConnectionPooling: false,
        };
    }
  }

  static testConnection = DatabaseAdapterFactory.validateConfig;
}
