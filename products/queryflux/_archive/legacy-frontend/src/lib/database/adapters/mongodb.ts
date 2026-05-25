import { MongoClient, Db } from "mongodb";
import {
  DatabaseAdapter,
  DatabaseConfig,
  QueryResult,
  TableInfo,
  ConnectionTestResult,
  ColumnInfo,
  IndexInfo,
} from "../types";

export class MongoDBAdapter implements DatabaseAdapter {
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private config: DatabaseConfig;
  private connectionId: string;
  private connected: boolean = false;

  constructor(config: DatabaseConfig) {
    this.config = config;
    this.connectionId = `mongo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async connect(): Promise<void> {
    try {
      const uri =
        this.config.connectionString ||
        `mongodb://${this.config.username}:${this.config.password}@${this.config.host}:${this.config.port}/${this.config.database}`;

      this.client = new MongoClient(uri);
      await this.client.connect();
      this.db = this.client.db(this.config.database);
      this.connected = true;
    } catch (error) {
      this.connected = false;
      throw new Error(
        `MongoDB connection failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
    }
    this.connected = false;
  }

  async executeQuery(query: string, params?: any[]): Promise<QueryResult> {
    const startTime = Date.now();

    if (!this.client || !this.connected || !this.db) {
      throw new Error("MongoDB not connected");
    }

    try {
      // For MongoDB, we'll handle common aggregation queries and find operations
      // This is a simplified implementation - in production, you'd want more sophisticated query parsing
      let result: any[] = [];

      if (query.trim().toLowerCase().startsWith("find")) {
        // Simple find operation: find({collection: "users", query: {}})
        const match = query.match(/find\s*\(\s*\{[^}]*\}\s*\)/i);
        if (match) {
          // Parse the collection name from the query (simplified)
          const collectionMatch = query.match(
            /collection['":\s]+([^'"\s,}]+)/i,
          );
          if (collectionMatch) {
            const collectionName = collectionMatch[1];
            const collection = this.db.collection(collectionName);
            result = await collection.find({}).toArray();
          }
        }
      } else if (query.trim().toLowerCase().startsWith("aggregate")) {
        // Simple aggregation operation
        const match = query.match(/aggregate\s*\(\s*\[[^\]]*\]\s*\)/i);
        if (match) {
          const collectionMatch = query.match(
            /collection['":\s]+([^'"\s,}]+)/i,
          );
          if (collectionMatch) {
            const collectionName = collectionMatch[1];
            const collection = this.db.collection(collectionName);
            result = await collection.aggregate([]).toArray();
          }
        }
      } else {
        // Default: list all documents in the first collection
        const collections = await this.db.listCollections().toArray();
        if (collections.length > 0) {
          const collection = this.db.collection(collections[0].name);
          result = await collection.find({}).limit(100).toArray();
        }
      }

      const rows = result.map((doc) => Object.values(doc));
      const columns = result.length > 0 ? Object.keys(result[0]) : ["_id"];

      return {
        success: true,
        data: {
          columns,
          rows,
          rowCount: rows.length,
        },
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Query execution failed",
        executionTime: Date.now() - startTime,
      };
    }
  }

  async getSchema(): Promise<{ tables: TableInfo[] }> {
    if (!this.client || !this.connected || !this.db) {
      throw new Error("MongoDB not connected");
    }

    const collections = await this.db.listCollections().toArray();

    const tables: TableInfo[] = collections.map((collection) => ({
      name: collection.name,
      schema: this.db!.databaseName,
      type: "collection",
      columns: [], // MongoDB has dynamic schema
      indexes: [],
    }));

    return { tables };
  }

  async testConnection(): Promise<ConnectionTestResult> {
    const startTime = Date.now();

    try {
      if (!this.client || !this.connected) {
        await this.connect();
      }

      // Ping the database to test connection
      await this.db!.admin().ping();
      const buildInfo = await this.db!.admin().buildInfo();
      const version = buildInfo.version;
      const latency = Date.now() - startTime;

      return {
        success: true,
        version,
        latency,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Connection test failed",
      };
    }
  }

  isConnected(): boolean {
    return this.connected && this.client !== null && this.db !== null;
  }

  getConnectionId(): string {
    return this.connectionId;
  }

  getDatabase(): Db | null {
    return this.db;
  }
}
