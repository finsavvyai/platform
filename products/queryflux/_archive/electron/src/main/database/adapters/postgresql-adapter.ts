/**
 * PostgreSQL Database Adapter
 * PostgreSQL-specific implementation for SQL databases
 */

import { Pool, PoolClient, types } from "pg";
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

// Configure PostgreSQL type parsers for better data handling
types.setTypeParser(20, (val: string) => parseInt(val, 10)); // int8
types.setTypeParser(1700, (val: string) => parseFloat(val)); // numeric

export default class PostgreSQLAdapter extends BaseDatabaseAdapter {
  private pool?: Pool;
  private client?: PoolClient;

  constructor(connectionParams: ConnectionParams) {
    super(connectionParams, DatabaseType.POSTGRESQL);
  }

  async connect(): Promise<boolean> {
    try {
      this.emitEvent("connecting");

      // Build connection configuration
      const config: any = {
        host: this.connectionParams.host,
        port: this.connectionParams.port,
        database: this.connectionParams.database,
        user: this.connectionParams.username,
        password: this.connectionParams.password,
        ssl: this.connectionParams.ssl ? { rejectUnauthorized: false } : false,
        max: 20, // Maximum number of connections in pool
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      };

      // Add additional parameters
      if (this.connectionParams.additionalParams) {
        Object.assign(config, this.connectionParams.additionalParams);
      }

      // Create connection pool
      this.pool = new Pool(config);

      // Test connection
      const client = await this.pool.connect();
      await client.query("SELECT NOW()");
      client.release();

      this._connected = true;
      this._connectionTime = new Date();
      this.emitEvent("connected", { database: this.connectionParams.database });

      return true;
    } catch (error) {
      this.emitEvent("error", undefined, error as Error);
      throw new ConnectionError(
        `Failed to connect to PostgreSQL: ${(error as Error).message}`,
        this.dbType,
        error as Error,
      );
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.client) {
        this.client.release();
        this.client = undefined;
      }

      if (this.pool) {
        await this.pool.end();
        this.pool = undefined;
      }

      this._connected = false;
      this.emitEvent("disconnected");
    } catch (error) {
      this.emitEvent("error", undefined, error as Error);
      throw new DatabaseError(
        `Error disconnecting from PostgreSQL: ${(error as Error).message}`,
        this.dbType,
        error as Error,
      );
    }
  }

  async testConnection(): Promise<Record<string, any>> {
    try {
      const startTime = Date.now();
      const result = await this.executeQuery(
        "SELECT version(), current_database(), current_user",
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
        version: "SELECT version() as version",
        size: `
          SELECT pg_database_size(current_database()) as size_bytes
        `,
        stats: `
          SELECT
            count(*) as collections_count,
            sum(n_tup_ins) as total_inserts,
            sum(n_tup_upd) as total_updates,
            sum(n_tup_del) as total_deletes
          FROM pg_stat_user_tables
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
        version: versionResult.data[0]?.version?.split(" ")[1] || "unknown",
        sizeBytes: parseInt(sizeResult.data[0]?.size_bytes || "0"),
        collectionsCount: parseInt(
          statsResult.data[0]?.collections_count || "0",
        ),
        metadata: {
          inserts: parseInt(statsResult.data[0]?.total_inserts || "0"),
          updates: parseInt(statsResult.data[0]?.total_updates || "0"),
          deletes: parseInt(statsResult.data[0]?.total_deletes || "0"),
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
          schemaname,
          tablename,
          n_tup_ins as row_count,
          pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
        FROM pg_stat_user_tables
        ORDER BY tablename
      `;

      const result = await this.executeQuery(query);
      const collections: CollectionInfo[] = [];

      for (const row of result.data) {
        const indexQuery = `
          SELECT
            indexname as name,
            indexdef as definition
          FROM pg_indexes
          WHERE schemaname = $1 AND tablename = $2
        `;

        const indexResult = await this.executeQuery(
          indexQuery,
          undefined,
          undefined,
          [row.schemaname, row.tablename],
        );

        const columnQuery = `
          SELECT
            column_name,
            data_type,
            is_nullable,
            column_default
          FROM information_schema.columns
          WHERE table_schema = $1 AND table_name = $2
          ORDER BY ordinal_position
        `;

        const columnResult = await this.executeQuery(
          columnQuery,
          undefined,
          undefined,
          [row.schemaname, row.tablename],
        );

        collections.push({
          name: `${row.schemaname}.${row.tablename}`,
          rowCount: parseInt(row.row_count || "0"),
          sizeBytes: parseInt(row.size_bytes || "0"),
          indexes: indexResult.data.map((idx: any) => ({
            name: idx.name,
            definition: idx.definition,
          })),
          columns: columnResult.data,
          metadata: {
            schema: row.schemaname,
            table: row.tablename,
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
      const [schema, table] = collectionName.split(".");

      const queries = {
        info: `
          SELECT
            n_tup_ins as row_count,
            n_tup_upd as row_updates,
            n_tup_del as row_deletes,
            pg_total_relation_size($1) as size_bytes
          FROM pg_stat_user_tables
          WHERE schemaname = $2 AND tablename = $3
        `,
        indexes: `
          SELECT
            indexname as name,
            indexdef as definition
          FROM pg_indexes
          WHERE schemaname = $1 AND tablename = $2
        `,
        columns: `
          SELECT
            column_name,
            data_type,
            character_maximum_length,
            is_nullable,
            column_default
          FROM information_schema.columns
          WHERE table_schema = $1 AND table_name = $2
          ORDER BY ordinal_position
        `,
        sample: `
          SELECT *
          FROM ${schema}.${table}
          LIMIT 5
        `,
      };

      const [infoResult, indexResult, columnResult, sampleResult] =
        await Promise.all([
          this.executeQuery(queries.info, undefined, undefined, [
            collectionName,
            schema,
            table,
          ]),
          this.executeQuery(queries.indexes, undefined, undefined, [
            schema,
            table,
          ]),
          this.executeQuery(queries.columns, undefined, undefined, [
            schema,
            table,
          ]),
          this.executeQuery(queries.sample),
        ]);

      return {
        name: collectionName,
        rowCount: parseInt(infoResult.data[0]?.row_count || "0"),
        sizeBytes: parseInt(infoResult.data[0]?.size_bytes || "0"),
        indexes: indexResult.data.map((idx: any) => ({
          name: idx.name,
          definition: idx.definition,
        })),
        columns: columnResult.data,
        schemaSample: sampleResult.data,
        metadata: {
          schema,
          table,
          updates: parseInt(infoResult.data[0]?.row_updates || "0"),
          deletes: parseInt(infoResult.data[0]?.row_deletes || "0"),
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
      throw new ConnectionError(
        "Not connected to PostgreSQL database",
        this.dbType,
      );
    }

    try {
      const startTime = Date.now();

      // Add LIMIT clause if specified and not already present
      let finalQuery = query;
      if (limit && !query.toUpperCase().includes("LIMIT")) {
        finalQuery += ` LIMIT ${limit}`;
      }

      const client = await this.pool.connect();

      try {
        const result = await client.query(finalQuery, params);
        const executionTime = Date.now() - startTime;

        // Transform rows to objects
        const data = result.rows.map((row) => {
          const obj: any = {};
          for (const [key, value] of Object.entries(row)) {
            // Convert PostgreSQL types to JavaScript types
            if (value instanceof Date) {
              obj[key] = value.toISOString();
            } else if (Buffer.isBuffer(value)) {
              obj[key] = value.toString("base64");
            } else {
              obj[key] = value;
            }
          }
          return obj;
        });

        const queryType = this.detectQueryType(query);

        return this.createQueryResult(
          true,
          data,
          executionTime,
          queryType,
          undefined,
          { rowCount: result.rowCount },
          result.rowCount,
          result.rowCount,
          result.fields?.map((field) => ({
            name: field.name,
            type: field.dataTypeID,
          })),
        );
      } finally {
        client.release();
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
    const query = `SELECT * FROM ${collection} ORDER BY RANDOM() LIMIT ${limit}`;
    const result = await this.executeQuery(query);
    return result.data;
  }

  // PostgreSQL-specific methods
  async explainQuery(
    query: string,
    collection?: string,
  ): Promise<Record<string, any>> {
    try {
      const explainQuery = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`;
      const result = await this.executeQuery(explainQuery);

      return {
        supported: true,
        query,
        explanation: result.data[0]?.["QUERY PLAN"],
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
          SELECT table_schema, table_name
          FROM information_schema.tables
          WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
          ORDER BY table_name
        `;

        const result = await this.executeQuery(tableQuery);

        for (const row of result.data) {
          suggestions.push({
            text: `${row.table_schema}.${row.table_name}`,
            description: `Table in ${row.table_schema} schema`,
            type: "table",
          });
        }
      }

      // Get column suggestions
      if (context?.table) {
        const [schema, table] = context.table.split(".");
        const columnQuery = `
          SELECT column_name, data_type
          FROM information_schema.columns
          WHERE table_schema = $1 AND table_name = $2
          ORDER BY ordinal_position
        `;

        const result = await this.executeQuery(
          columnQuery,
          undefined,
          undefined,
          [schema, table],
        );

        for (const row of result.data) {
          suggestions.push({
            text: row.column_name,
            description: `${row.data_type} column`,
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
        options?.name ||
        `idx_${collection.replace(".", "_")}_${fields.join("_")}`;
      const unique = options?.unique ? "UNIQUE" : "";
      const columns = fields.join(", ");

      const query = `CREATE ${unique} INDEX ${indexName} ON ${collection} (${columns})`;
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
      const query = `DROP INDEX ${indexName}`;
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
      const [schema, table] = collection.split(".");
      const query = `
        SELECT
          indexname as name,
          indexdef as definition
        FROM pg_indexes
        WHERE schemaname = $1 AND tablename = $2
      `;

      const result = await this.executeQuery(query, undefined, undefined, [
        schema,
        table,
      ]);
      return result.data;
    } catch (error) {
      throw new DatabaseError(
        `Failed to list indexes: ${(error as Error).message}`,
        this.dbType,
        error as Error,
      );
    }
  }
}
