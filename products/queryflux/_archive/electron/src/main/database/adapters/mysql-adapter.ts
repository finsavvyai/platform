/**
 * MySQL Database Adapter
 * MySQL-specific implementation for SQL databases
 */

import { createPool, Pool, PoolConnection } from "mysql2/promise";
import BaseDatabaseAdapter from "../base-adapter";
import {
  DatabaseType,
  ConnectionParams,
  DatabaseInfo,
  CollectionInfo,
  QueryResult,
  QueryType,
  DatabaseError,
  ConnectionError,
  QueryError,
} from "../types";

export default class MySQLAdapter extends BaseDatabaseAdapter {
  private pool?: Pool;

  constructor(connectionParams: ConnectionParams) {
    super(connectionParams, DatabaseType.MYSQL);
  }

  async connect(): Promise<boolean> {
    try {
      this.emitEvent("connecting");

      // Build connection configuration
      const config: any = {
        host: this.connectionParams.host,
        port: this.connectionParams.port,
        user: this.connectionParams.username,
        password: this.connectionParams.password,
        database: this.connectionParams.database,
        ssl: this.connectionParams.ssl ? { rejectUnauthorized: false } : false,
        connectionLimit: 20,
        acquireTimeout: 2000,
        timeout: 2000,
        reconnect: true,
        multipleStatements: false, // Prevent SQL injection
      };

      // Add additional parameters
      if (this.connectionParams.additionalParams) {
        Object.assign(config, this.connectionParams.additionalParams);
      }

      // Create connection pool
      this.pool = createPool(config);

      // Test connection
      const connection = await this.pool.getConnection();
      await connection.execute("SELECT 1");
      connection.release();

      this._connected = true;
      this._connectionTime = new Date();
      this.emitEvent("connected", { database: this.connectionParams.database });

      return true;
    } catch (error) {
      this.emitEvent("error", undefined, error as Error);
      throw new ConnectionError(
        `Failed to connect to MySQL: ${(error as Error).message}`,
        this.dbType,
        error as Error,
      );
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.pool) {
        await this.pool.end();
        this.pool = undefined;
      }

      this._connected = false;
      this.emitEvent("disconnected");
    } catch (error) {
      this.emitEvent("error", undefined, error as Error);
      throw new DatabaseError(
        `Error disconnecting from MySQL: ${(error as Error).message}`,
        this.dbType,
        error as Error,
      );
    }
  }

  async testConnection(): Promise<Record<string, any>> {
    try {
      const startTime = Date.now();
      const result = await this.executeQuery(
        "SELECT VERSION() as version, DATABASE() as current_database, USER() as current_user",
      );
      const responseTime = Date.now() - startTime;

      return {
        success: true,
        responseTime,
        version: result.data[0]?.version,
        database: result.data[0]?.current_database,
        user: result.data[0]?.current_user,
        connected: true,
      };
    } catch (error) {
      return {
        success: false,
        connected: false,
        error: this.formatError(error as Error),
      };
    }
  }

  async getDatabaseInfo(): Promise<DatabaseInfo> {
    try {
      const queries = {
        version: "SELECT VERSION() as version",
        size: `
          SELECT
            SUM(data_length + index_length) as size_bytes
          FROM information_schema.tables
          WHERE table_schema = DATABASE()
        `,
        stats: `
          SELECT
            COUNT(*) as collections_count,
            SUM(table_rows) as estimated_rows
          FROM information_schema.tables
          WHERE table_schema = DATABASE()
            AND table_type = 'BASE TABLE'
        `,
      };

      const [versionResult, sizeResult, statsResult] = await Promise.all([
        this.executeQuery(queries.version),
        this.executeQuery(queries.size),
        this.executeQuery(queries.stats),
      ]);

      return {
        name: this.connectionParams.database || "unknown",
        dbType: this.dbType,
        host: this.connectionParams.host,
        port: this.connectionParams.port,
        version: versionResult.data[0]?.version?.split("-")[0] || "unknown",
        sizeBytes: parseInt(sizeResult.data[0]?.size_bytes || "0"),
        collectionsCount: parseInt(
          statsResult.data[0]?.collections_count || "0",
        ),
        documentsCount: parseInt(statsResult.data[0]?.estimated_rows || "0"),
        metadata: {
          engine: "InnoDB", // Default engine, could be enhanced
        },
      };
    } catch (error) {
      throw new DatabaseError(
        `Failed to get database info: ${(error as Error).message}`,
        this.dbType,
        error as Error,
      );
    }
  }

  async listCollections(): Promise<CollectionInfo[]> {
    try {
      const query = `
        SELECT
          TABLE_NAME as tablename,
          TABLE_ROWS as row_count,
          DATA_LENGTH as data_size,
          INDEX_LENGTH as index_size,
          (DATA_LENGTH + INDEX_LENGTH) as size_bytes
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_TYPE = 'BASE TABLE'
        ORDER BY TABLE_NAME
      `;

      const result = await this.executeQuery(query);
      const collections: CollectionInfo[] = [];

      for (const row of result.data) {
        const indexQuery = `
          SELECT
            INDEX_NAME as name,
            COLUMN_NAME as column_name,
            NON_UNIQUE as non_unique
          FROM information_schema.STATISTICS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
          ORDER BY INDEX_NAME, SEQ_IN_INDEX
        `;

        const columnQuery = `
          SELECT
            COLUMN_NAME,
            DATA_TYPE,
            IS_NULLABLE,
            COLUMN_DEFAULT,
            CHARACTER_MAXIMUM_LENGTH
          FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
          ORDER BY ORDINAL_POSITION
        `;

        const [indexResult, columnResult] = await Promise.all([
          this.executeQuery(indexQuery, undefined, undefined, [row.tablename]),
          this.executeQuery(columnQuery, undefined, undefined, [row.tablename]),
        ]);

        // Group indexes by name
        const indexes = this.groupMySQLIndexes(indexResult.data);

        collections.push({
          name: row.tablename,
          rowCount: parseInt(row.row_count || "0"),
          sizeBytes: parseInt(row.size_bytes || "0"),
          indexes,
          columns: columnResult.data,
          metadata: {
            dataSize: parseInt(row.data_size || "0"),
            indexSize: parseInt(row.index_size || "0"),
          },
        });
      }

      return collections;
    } catch (error) {
      throw new DatabaseError(
        `Failed to list collections: ${(error as Error).message}`,
        this.dbType,
        error as Error,
      );
    }
  }

  async getCollectionInfo(collectionName: string): Promise<CollectionInfo> {
    try {
      const queries = {
        info: `
          SELECT
            TABLE_ROWS as row_count,
            DATA_LENGTH as data_size,
            INDEX_LENGTH as index_size,
            (DATA_LENGTH + INDEX_LENGTH) as size_bytes,
            TABLE_COLLATION,
            ENGINE,
            TABLE_COMMENT
          FROM information_schema.TABLES
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
        `,
        indexes: `
          SELECT
            INDEX_NAME as name,
            COLUMN_NAME as column_name,
            NON_UNIQUE as non_unique
          FROM information_schema.STATISTICS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
          ORDER BY INDEX_NAME, SEQ_IN_INDEX
        `,
        columns: `
          SELECT
            COLUMN_NAME,
            DATA_TYPE,
            CHARACTER_MAXIMUM_LENGTH,
            IS_NULLABLE,
            COLUMN_DEFAULT,
            EXTRA
          FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
          ORDER BY ORDINAL_POSITION
        `,
        sample: `
          SELECT * FROM \`${collectionName}\` LIMIT 5
        `,
      };

      const [infoResult, indexResult, columnResult, sampleResult] =
        await Promise.all([
          this.executeQuery(queries.info, undefined, undefined, [
            collectionName,
          ]),
          this.executeQuery(queries.indexes, undefined, undefined, [
            collectionName,
          ]),
          this.executeQuery(queries.columns, undefined, undefined, [
            collectionName,
          ]),
          this.executeQuery(queries.sample),
        ]);

      const info = infoResult.data[0];

      return {
        name: collectionName,
        rowCount: parseInt(info.row_count || "0"),
        sizeBytes: parseInt(info.size_bytes || "0"),
        indexes: this.groupMySQLIndexes(indexResult.data),
        columns: columnResult.data,
        schemaSample: sampleResult.data,
        metadata: {
          dataSize: parseInt(info.data_size || "0"),
          indexSize: parseInt(info.index_size || "0"),
          collation: info.TABLE_COLLATION,
          engine: info.ENGINE,
          comment: info.TABLE_COMMENT,
        },
      };
    } catch (error) {
      throw new DatabaseError(
        `Failed to get collection info: ${(error as Error).message}`,
        this.dbType,
        error as Error,
      );
    }
  }

  async executeQuery(
    query: string,
    collection?: string,
    limit?: number,
    params?: any[],
  ): Promise<QueryResult> {
    if (!this._connected || !this.pool) {
      throw new ConnectionError("Not connected to MySQL database", this.dbType);
    }

    try {
      const startTime = Date.now();

      // Add LIMIT clause if specified and not already present
      let finalQuery = query;
      if (limit && !query.toUpperCase().includes("LIMIT")) {
        finalQuery += ` LIMIT ${limit}`;
      }

      const connection = await this.pool.getConnection();

      try {
        const [rows, fields] = await connection.execute(finalQuery, params);
        const executionTime = Date.now() - startTime;

        // Transform RowDataPacket to objects
        const data = Array.isArray(rows)
          ? rows.map((row: any) => {
              const obj: any = {};
              for (const [key, value] of Object.entries(row)) {
                // Handle MySQL specific types
                if (value instanceof Date) {
                  obj[key] = value.toISOString();
                } else if (Buffer.isBuffer(value)) {
                  obj[key] = value.toString("base64");
                } else {
                  obj[key] = value;
                }
              }
              return obj;
            })
          : [];

        const queryType = this.detectQueryType(query);

        // For INSERT/UPDATE/DELETE queries, get affected rows
        let affectedRows = 0;
        if (
          queryType === QueryType.INSERT ||
          queryType === QueryType.UPDATE ||
          queryType === QueryType.DELETE
        ) {
          const result = rows as any; // MySQL returns result object for DML queries
          affectedRows = result.affectedRows || 0;
        }

        return this.createQueryResult(
          true,
          data,
          executionTime,
          queryType,
          undefined,
          { rowCount: Array.isArray(rows) ? rows.length : 0 },
          data.length,
          affectedRows,
          fields?.map((field: any) => ({
            name: field.name,
            type: field.type?.name,
            length: field.length,
          })),
        );
      } finally {
        connection.release();
      }
    } catch (error) {
      this.emitEvent("error", { query }, error as Error);
      throw new QueryError(
        `Query execution failed: ${(error as Error).message}`,
        this.dbType,
        query,
        error as Error,
      );
    }
  }

  async getSampleDocuments(
    collection: string,
    limit: number = 10,
  ): Promise<Array<Record<string, any>>> {
    const query = `SELECT * FROM \`${collection}\` ORDER BY RAND() LIMIT ${limit}`;
    const result = await this.executeQuery(query);
    return result.data;
  }

  // MySQL-specific methods
  async explainQuery(
    query: string,
    collection?: string,
  ): Promise<Record<string, any>> {
    try {
      const explainQuery = `EXPLAIN FORMAT=JSON ${query}`;
      const result = await this.executeQuery(explainQuery);

      return {
        supported: true,
        query,
        explanation: result.data[0]?.["EXPLAIN"],
        collection,
      };
    } catch (error) {
      return {
        supported: false,
        query,
        error: this.formatError(error as Error),
        collection,
      };
    }
  }

  async getQuerySuggestions(
    partialQuery: string,
    context?: Record<string, any>,
  ): Promise<Array<{ text: string; description?: string; type: string }>> {
    const suggestions = await super.getQuerySuggestions(partialQuery, context);

    try {
      // Get table suggestions
      if (
        partialQuery.toUpperCase().includes("FROM") ||
        partialQuery.toUpperCase().includes("JOIN")
      ) {
        const tableQuery = `
          SELECT TABLE_NAME
          FROM information_schema.TABLES
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_TYPE = 'BASE TABLE'
          ORDER BY TABLE_NAME
        `;

        const result = await this.executeQuery(tableQuery);

        for (const row of result.data) {
          suggestions.push({
            text: row.TABLE_NAME,
            description: `Table in ${this.connectionParams.database}`,
            type: "table",
          });
        }
      }

      // Get column suggestions
      if (context?.table) {
        const columnQuery = `
          SELECT COLUMN_NAME, DATA_TYPE
          FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
          ORDER BY ORDINAL_POSITION
        `;

        const result = await this.executeQuery(
          columnQuery,
          undefined,
          undefined,
          [context.table],
        );

        for (const row of result.data) {
          suggestions.push({
            text: row.COLUMN_NAME,
            description: `${row.DATA_TYPE} column`,
            type: "column",
          });
        }
      }
    } catch (error) {
      // If we can't get suggestions, just return the basic ones
    }

    return suggestions.filter((s) =>
      s.text.toLowerCase().includes(partialQuery.toLowerCase()),
    );
  }

  async createIndex(
    collection: string,
    fields: string[],
    options?: Record<string, any>,
  ): Promise<boolean> {
    try {
      const indexName =
        options?.name || `idx_${collection}_${fields.join("_")}`;
      const unique = options?.unique ? "UNIQUE" : "";
      const columns = fields.map((field) => `\`${field}\``).join(", ");

      const query = `CREATE ${unique} INDEX \`${indexName}\` ON \`${collection}\` (${columns})`;
      await this.executeQuery(query);

      return true;
    } catch (error) {
      throw new DatabaseError(
        `Failed to create index: ${(error as Error).message}`,
        this.dbType,
        error as Error,
      );
    }
  }

  async dropIndex(collection: string, indexName: string): Promise<boolean> {
    try {
      const query = `DROP INDEX \`${indexName}\` ON \`${collection}\``;
      await this.executeQuery(query);
      return true;
    } catch (error) {
      throw new DatabaseError(
        `Failed to drop index: ${(error as Error).message}`,
        this.dbType,
        error as Error,
      );
    }
  }

  async listIndexes(collection: string): Promise<any[]> {
    try {
      const query = `
        SELECT
          INDEX_NAME as name,
          COLUMN_NAME as column_name,
          NON_UNIQUE as non_unique
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
        ORDER BY INDEX_NAME, SEQ_IN_INDEX
      `;

      const result = await this.executeQuery(query, undefined, undefined, [
        collection,
      ]);
      return this.groupMySQLIndexes(result.data);
    } catch (error) {
      throw new DatabaseError(
        `Failed to list indexes: ${(error as Error).message}`,
        this.dbType,
        error as Error,
      );
    }
  }

  // Helper methods
  private groupMySQLIndexes(indexRows: any[]): any[] {
    const grouped: Record<string, any> = {};

    for (const row of indexRows) {
      const indexName = row.name;

      if (!grouped[indexName]) {
        grouped[indexName] = {
          name: indexName,
          type: "btree", // Default MySQL index type
          fields: [],
          unique: row.non_unique === 0,
        };
      }

      grouped[indexName].fields.push(row.column_name);
    }

    return Object.values(grouped);
  }
}
