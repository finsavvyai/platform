/**
 * SQLite Database Adapter
 * SQLite-specific implementation for embedded SQL databases
 */

import Database from "better-sqlite3";
import { open, Database as SQLiteDatabase } from "sqlite";
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

export default class SQLiteAdapter extends BaseDatabaseAdapter {
  private db?: SQLiteDatabase;

  constructor(connectionParams: ConnectionParams) {
    super(connectionParams, DatabaseType.SQLITE);
  }

  async connect(): Promise<boolean> {
    try {
      this.emitEvent("connecting");

      // For SQLite, the database name is the file path
      const dbPath =
        this.connectionParams.database || this.connectionParams.host;

      if (!dbPath) {
        throw new Error("SQLite database file path is required");
      }

      // Open database connection
      this.db = await open({
        filename: dbPath,
        driver: Database,
      });

      // Enable foreign keys and WAL mode for better performance
      await this.db.exec("PRAGMA foreign_keys = ON");
      await this.db.exec("PRAGMA journal_mode = WAL");
      await this.db.exec("PRAGMA synchronous = NORMAL");

      this._connected = true;
      this._connectionTime = new Date();
      this.emitEvent("connected", { database: dbPath });

      return true;
    } catch (error) {
      this.emitEvent("error", undefined, error as Error);
      throw new ConnectionError(
        `Failed to connect to SQLite: ${(error as Error).message}`,
        this.dbType,
        error as Error,
      );
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.db) {
        await this.db.close();
        this.db = undefined;
      }

      this._connected = false;
      this.emitEvent("disconnected");
    } catch (error) {
      this.emitEvent("error", undefined, error as Error);
      throw new DatabaseError(
        `Error disconnecting from SQLite: ${(error as Error).message}`,
        this.dbType,
        error as Error,
      );
    }
  }

  async testConnection(): Promise<Record<string, any>> {
    try {
      const startTime = Date.now();
      const result = await this.executeQuery(
        'SELECT sqlite_version() as version, strftime("%Y-%m-%d %H:%M:%S", "now") as current_time',
      );
      const responseTime = Date.now() - startTime;

      return {
        success: true,
        responseTime,
        version: result.data[0]?.version,
        database: this.connectionParams.database,
        connected: true,
        currentTime: result.data[0]?.current_time,
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
      if (!this.db) {
        throw new Error("No database connection");
      }

      const queries = {
        version: "SELECT sqlite_version() as version",
        info: `
          SELECT
            page_count * page_size as size_bytes,
            page_count,
            page_size
          FROM pragma_page_count(), pragma_page_size()
        `,
        tables: `
          SELECT COUNT(*) as collections_count
          FROM sqlite_master
          WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
        `,
      };

      const [versionResult, infoResult, tablesResult] = await Promise.all([
        this.executeQuery(queries.version),
        this.executeQuery(queries.info),
        this.executeQuery(queries.tables),
      ]);

      const info = infoResult.data[0];

      return {
        name: this.connectionParams.database || "unknown",
        dbType: this.dbType,
        host: "local",
        port: 0,
        version: versionResult.data[0]?.version || "unknown",
        sizeBytes: parseInt(info.size_bytes || "0"),
        collectionsCount: parseInt(
          tablesResult.data[0]?.collections_count || "0",
        ),
        metadata: {
          pageCount: parseInt(info.page_count || "0"),
          pageSize: parseInt(info.page_size || "0"),
          engine: "SQLite",
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
      if (!this.db) {
        throw new Error("No database connection");
      }

      const query = `
        SELECT
          name,
          sql as create_sql
        FROM sqlite_master
        WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `;

      const result = await this.executeQuery(query);
      const collections: CollectionInfo[] = [];

      for (const row of result.data) {
        // Get table info
        const infoQuery = `PRAGMA table_info(\`${row.name}\`)`;
        const indexQuery = `PRAGMA index_list(\`${row.name}\`)`;
        const countQuery = `SELECT COUNT(*) as row_count FROM \`${row.name}\``;

        const [infoResult, indexResult, countResult] = await Promise.all([
          this.executeQuery(infoQuery),
          this.executeQuery(indexQuery),
          this.executeQuery(countQuery),
        ]);

        // Get sample data
        const sampleQuery = `SELECT * FROM \`${row.name}\` LIMIT 5`;
        const sampleResult = await this.executeQuery(sampleQuery);

        collections.push({
          name: row.name,
          rowCount: parseInt(countResult.data[0]?.row_count || "0"),
          sizeBytes: 0, // SQLite doesn't easily provide per-table size
          indexes: indexResult.data.map((idx: any) => ({
            name: idx.name,
            type: idx.unique ? "unique" : "btree",
            fields: [], // Would need additional pragma_index_info queries
            unique: idx.unique !== 0,
            metadata: idx,
          })),
          columns: infoResult.data.map((col: any) => ({
            name: col.name,
            type: col.type,
            nullable: col.notnull === 0,
            default: col.dflt_value,
            primaryKey: col.pk > 0,
          })),
          schemaSample: sampleResult.data,
          metadata: {
            createSql: row.create_sql,
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
      if (!this.db) {
        throw new Error("No database connection");
      }

      const queries = {
        info: `PRAGMA table_info(\`${collectionName}\`)`,
        indexes: `PRAGMA index_list(\`${collectionName}\`)`,
        foreignKeys: `PRAGMA foreign_key_list(\`${collectionName}\`)`,
        count: `SELECT COUNT(*) as row_count FROM \`${collectionName}\``,
        sample: `SELECT * FROM \`${collectionName}\` LIMIT 5`,
      };

      const [
        infoResult,
        indexResult,
        foreignKeysResult,
        countResult,
        sampleResult,
      ] = await Promise.all([
        this.executeQuery(queries.info),
        this.executeQuery(queries.indexes),
        this.executeQuery(queries.foreignKeys),
        this.executeQuery(queries.count),
        this.executeQuery(queries.sample),
      ]);

      // Get detailed index information
      const indexes = [];
      for (const index of indexResult.data) {
        const indexInfoQuery = `PRAGMA index_info(\`${index.name}\`)`;
        const indexInfoResult = await this.executeQuery(indexInfoQuery);

        indexes.push({
          name: index.name,
          type: index.unique ? "unique" : "btree",
          fields: indexInfoResult.data.map((info: any) => info.name),
          unique: index.unique !== 0,
          metadata: index,
        });
      }

      return {
        name: collectionName,
        rowCount: parseInt(countResult.data[0]?.row_count || "0"),
        sizeBytes: 0, // Not easily available in SQLite
        indexes,
        columns: infoResult.data.map((col: any) => ({
          name: col.name,
          type: col.type,
          nullable: col.notnull === 0,
          default: col.dflt_value,
          primaryKey: col.pk > 0,
        })),
        schemaSample: sampleResult.data,
        metadata: {
          foreignKeys: foreignKeysResult.data,
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
  ): Promise<QueryResult> {
    if (!this._connected || !this.db) {
      throw new ConnectionError(
        "Not connected to SQLite database",
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

      // Execute query based on type
      const queryType = this.detectQueryType(query);
      let data: any[] = [];
      let affectedRows = 0;

      if (queryType === QueryType.SELECT) {
        const rows = await this.db.all(finalQuery);
        data = rows;
      } else {
        // For INSERT, UPDATE, DELETE operations
        const result = await this.db.run(finalQuery);
        affectedRows = result.changes || 0;

        // For INSERT, get the last insert rowid
        if (queryType === QueryType.INSERT && result.lastID) {
          data = [{ lastID: result.lastID, changes: result.changes }];
        }
      }

      const executionTime = Date.now() - startTime;

      return this.createQueryResult(
        true,
        data,
        executionTime,
        queryType,
        undefined,
        { query },
        data.length,
        affectedRows,
      );
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
    const query = `SELECT * FROM \`${collection}\` ORDER BY RANDOM() LIMIT ${limit}`;
    const result = await this.executeQuery(query);
    return result.data;
  }

  // SQLite-specific methods
  async explainQuery(
    query: string,
    collection?: string,
  ): Promise<Record<string, any>> {
    try {
      const explainQuery = `EXPLAIN QUERY PLAN ${query}`;
      const result = await this.executeQuery(explainQuery);

      return {
        supported: true,
        query,
        explanation: result.data,
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
      if (!this.db) {
        return suggestions;
      }

      // Get table suggestions
      if (
        partialQuery.toUpperCase().includes("FROM") ||
        partialQuery.toUpperCase().includes("JOIN")
      ) {
        const tableQuery = `
          SELECT name
          FROM sqlite_master
          WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
          ORDER BY name
        `;

        const result = await this.executeQuery(tableQuery);

        for (const row of result.data) {
          suggestions.push({
            text: row.name,
            description: `Table in ${this.connectionParams.database}`,
            type: "table",
          });
        }
      }

      // Get column suggestions if table is specified
      if (context?.table) {
        const columnQuery = `PRAGMA table_info(\`${context.table}\`)`;
        const result = await this.executeQuery(columnQuery);

        for (const col of result.data) {
          suggestions.push({
            text: col.name,
            description: `${col.type} column`,
            type: "column",
          });
        }
      }

      // Add SQLite-specific functions and pragmas
      if (partialQuery.toUpperCase().includes("PRAGMA")) {
        suggestions.push(
          {
            text: "PRAGMA table_info(table_name)",
            description: "Get table structure",
            type: "snippet",
          },
          {
            text: "PRAGMA index_list(table_name)",
            description: "List table indexes",
            type: "snippet",
          },
          {
            text: "PRAGMA foreign_key_list(table_name)",
            description: "List foreign keys",
            type: "snippet",
          },
          {
            text: "PRAGMA index_info(index_name)",
            description: "Get index details",
            type: "snippet",
          },
        );
      }
    } catch (error) {
      // Return basic suggestions if we can't get database-specific ones
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

      const query = `CREATE ${unique} INDEX IF NOT EXISTS \`${indexName}\` ON \`${collection}\` (${columns})`;
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
      const query = `DROP INDEX IF EXISTS \`${indexName}\``;
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
      if (!this.db) {
        throw new Error("No database connection");
      }

      const indexListQuery = `PRAGMA index_list(\`${collection}\`)`;
      const indexListResult = await this.executeQuery(indexListQuery);

      const indexes = [];
      for (const index of indexListResult.data) {
        const indexInfoQuery = `PRAGMA index_info(\`${index.name}\`)`;
        const indexInfoResult = await this.executeQuery(indexInfoQuery);

        indexes.push({
          name: index.name,
          type: index.unique ? "unique" : "btree",
          fields: indexInfoResult.data.map((info: any) => info.name),
          unique: index.unique !== 0,
          metadata: index,
        });
      }

      return indexes;
    } catch (error) {
      throw new DatabaseError(
        `Failed to list indexes: ${(error as Error).message}`,
        this.dbType,
        error as Error,
      );
    }
  }

  // SQLite-specific utility methods
  async vacuum(): Promise<boolean> {
    try {
      await this.executeQuery("VACUUM");
      return true;
    } catch (error) {
      throw new DatabaseError(
        `VACUUM failed: ${(error as Error).message}`,
        this.dbType,
        error as Error,
      );
    }
  }

  async analyze(): Promise<boolean> {
    try {
      await this.executeQuery("ANALYZE");
      return true;
    } catch (error) {
      throw new DatabaseError(
        `ANALYZE failed: ${(error as Error).message}`,
        this.dbType,
        error as Error,
      );
    }
  }

  async getTableSchema(collectionName: string): Promise<string> {
    try {
      const query = `
        SELECT sql as create_sql
        FROM sqlite_master
        WHERE type = 'table' AND name = ?
      `;

      const result = await this.executeQuery(query, undefined, undefined, [
        collectionName,
      ]);
      return result.data[0]?.create_sql || "";
    } catch (error) {
      throw new DatabaseError(
        `Failed to get table schema: ${(error as Error).message}`,
        this.dbType,
        error as Error,
      );
    }
  }
}
