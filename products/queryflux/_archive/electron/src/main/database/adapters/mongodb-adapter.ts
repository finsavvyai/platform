/**
 * MongoDB Database Adapter
 * MongoDB-specific implementation for NoSQL databases
 */

import { MongoClient, Db, Collection, ObjectId } from "mongodb";
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

export default class MongoDBAdapter extends BaseDatabaseAdapter {
  private client?: MongoClient;
  private database?: Db;

  constructor(connectionParams: ConnectionParams) {
    super(connectionParams, DatabaseType.MONGODB);
  }

  async connect(): Promise<boolean> {
    try {
      this.emitEvent("connecting");

      // Build connection URI
      const uri = this.buildConnectionURI();

      // Connection options
      const options: any = {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        connectTimeoutMS: 10000,
      };

      if (this.connectionParams.ssl) {
        options.ssl = true;
        options.sslValidate = false;
      }

      // Add additional parameters
      if (this.connectionParams.additionalParams) {
        Object.assign(options, this.connectionParams.additionalParams);
      }

      // Create client and connect
      this.client = new MongoClient(uri, options);
      await this.client.connect();

      // Get database reference
      if (this.connectionParams.database) {
        this.database = this.client.db(this.connectionParams.database);
      }

      this._connected = true;
      this._connectionTime = new Date();
      this.emitEvent("connected", { database: this.connectionParams.database });

      return true;
    } catch (error) {
      this.emitEvent("error", undefined, error as Error);
      throw new ConnectionError(
        `Failed to connect to MongoDB: ${(error as Error).message}`,
        this.dbType,
        error as Error,
      );
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.client) {
        await this.client.close();
        this.client = undefined;
        this.database = undefined;
      }

      this._connected = false;
      this.emitEvent("disconnected");
    } catch (error) {
      this.emitEvent("error", undefined, error as Error);
      throw new DatabaseError(
        `Error disconnecting from MongoDB: ${(error as Error).message}`,
        this.dbType,
        error as Error,
      );
    }
  }

  async testConnection(): Promise<Record<string, any>> {
    try {
      const startTime = Date.now();

      if (!this.database) {
        throw new Error("No database selected");
      }

      await this.database.admin().ping();
      const responseTime = Date.now() - startTime;

      const serverInfo = await this.database.admin().serverStatus();

      return {
        success: true,
        responseTime,
        version: serverInfo.version,
        database: this.connectionParams.database,
        host: serverInfo.host,
        port: serverInfo.port,
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
      if (!this.database) {
        throw new Error("No database selected");
      }

      const [stats, collections] = await Promise.all([
        this.database.stats(),
        this.database.listCollections().toArray(),
      ]);

      return {
        name: this.connectionParams.database || "unknown",
        dbType: this.dbType,
        host: this.connectionParams.host,
        port: this.connectionParams.port,
        version: stats.version,
        sizeBytes: stats.dataSize || 0,
        collectionsCount: collections.length,
        documentsCount: stats.objects || 0,
        metadata: {
          indexes: stats.indexes,
          indexSize: stats.indexSize,
          storageSize: stats.storageSize,
          avgObjSize: stats.avgObjSize,
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
      if (!this.database) {
        throw new Error("No database selected");
      }

      const collections = await this.database.listCollections().toArray();
      const collectionInfos: CollectionInfo[] = [];

      for (const collection of collections) {
        const coll = this.database.collection(collection.name);
        const stats = await coll.estimatedDocumentCount({ maxTimeMS: 1000 });

        // Get index information
        const indexes = await coll.listIndexes().toArray();

        collectionInfos.push({
          name: collection.name,
          documentCount: stats,
          sizeBytes: 0, // Would need aggregation query for accurate size
          indexes: indexes.map((idx) => ({
            name: idx.name,
            type: idx.key ? Object.keys(idx.key).join("_") : "unknown",
            fields: idx.key ? Object.keys(idx.key) : [],
            unique: idx.unique || false,
            metadata: idx,
          })),
          metadata: {
            type: collection.type || "collection",
            options: collection.options || {},
          },
        });
      }

      return collectionInfos;
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
      if (!this.database) {
        throw new Error("No database selected");
      }

      const collection = this.database.collection(collectionName);

      // Get collection stats
      const stats = await this.database.command({
        collStats: collectionName,
        scale: 1,
      });

      // Get sample documents
      const sampleDocs = await collection.find({}).limit(5).toArray();

      // Get indexes
      const indexes = await collection.listIndexes().toArray();

      return {
        name: collectionName,
        documentCount: stats.count || 0,
        sizeBytes: stats.size || 0,
        indexes: indexes.map((idx) => ({
          name: idx.name,
          type: idx.key ? Object.keys(idx.key).join("_") : "unknown",
          fields: idx.key ? Object.keys(idx.key) : [],
          unique: idx.unique || false,
          size: idx.size,
          metadata: idx,
        })),
        schemaSample: this.transformMongoDocuments(sampleDocs),
        metadata: {
          avgObjSize: stats.avgObjSize,
          storageSize: stats.storageSize,
          totalIndexSize: stats.totalIndexSize,
          capped: stats.capped || false,
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
    query: any,
    collection?: string,
    limit?: number,
  ): Promise<QueryResult> {
    if (!this._connected || !this.database) {
      throw new ConnectionError(
        "Not connected to MongoDB database",
        this.dbType,
      );
    }

    if (!collection) {
      throw new QueryError(
        "Collection name is required for MongoDB queries",
        this.dbType,
        query,
      );
    }

    try {
      const startTime = Date.now();
      const coll = this.database.collection(collection);
      let result: any[] = [];
      let totalCount = 0;

      // Handle different query types
      if (typeof query === "object" && query !== null) {
        // Find query
        let cursor = coll.find(query);

        if (limit) {
          cursor = cursor.limit(limit);
        }

        // Get total count
        totalCount = await coll.countDocuments(query);

        result = await cursor.toArray();
      } else if (typeof query === "string") {
        // Aggregation pipeline or special commands
        try {
          const pipeline = JSON.parse(query);
          if (Array.isArray(pipeline)) {
            // Aggregation pipeline
            const cursor = coll.aggregate(pipeline);
            if (limit) {
              cursor.limit(limit);
            }
            result = await cursor.toArray();
            totalCount = result.length;
          }
        } catch {
          throw new QueryError(
            "Invalid query format. Expected JSON object or aggregation pipeline",
            this.dbType,
            query,
          );
        }
      }

      const executionTime = Date.now() - startTime;

      return this.createQueryResult(
        true,
        this.transformMongoDocuments(result),
        executionTime,
        QueryType.FIND,
        undefined,
        { collection },
        totalCount,
      );
    } catch (error) {
      this.emitEvent("error", { query, collection }, error as Error);
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
    if (!this.database) {
      throw new ConnectionError(
        "Not connected to MongoDB database",
        this.dbType,
      );
    }

    const coll = this.database.collection(collection);
    const documents = await coll.find({}).limit(limit).toArray();

    return this.transformMongoDocuments(documents);
  }

  // MongoDB-specific methods
  async explainQuery(
    query: any,
    collection?: string,
  ): Promise<Record<string, any>> {
    try {
      if (!this.database || !collection) {
        throw new Error(
          "Database and collection are required for query explanation",
        );
      }

      const coll = this.database.collection(collection);
      const explanation = await coll.find(query).explain("executionStats");

      return {
        supported: true,
        query,
        collection,
        explanation: {
          executionStats: explanation.executionStats,
          winningPlan: explanation.queryPlanner.winningPlan,
          serverInfo: explanation.serverInfo,
        },
      };
    } catch (error) {
      return {
        supported: false,
        query,
        collection,
        error: this.formatError(error as Error),
      };
    }
  }

  async getQuerySuggestions(
    partialQuery: string,
    context?: Record<string, any>,
  ): Promise<Array<{ text: string; description?: string; type: string }>> {
    const suggestions = await super.getQuerySuggestions(partialQuery, context);

    try {
      if (!this.database) {
        return suggestions;
      }

      // Get collection suggestions
      const collections = await this.database.listCollections().toArray();

      for (const collection of collections) {
        suggestions.push({
          text: collection.name,
          description: `Collection in ${this.connectionParams.database}`,
          type: "collection",
        });
      }

      // Get field suggestions if collection is specified
      if (context?.collection) {
        const sample = await this.getSampleDocuments(context.collection, 10);
        const fields = new Set<string>();

        for (const doc of sample) {
          Object.keys(doc).forEach((key) => fields.add(key));
        }

        for (const field of Array.from(fields)) {
          suggestions.push({
            text: field,
            description: `Field in ${context.collection}`,
            type: "field",
          });
        }
      }

      // Add MongoDB-specific query patterns
      if (partialQuery.trim().startsWith("{")) {
        suggestions.push(
          {
            text: "{$match: {}}",
            description: "Match documents",
            type: "snippet",
          },
          {
            text: "{$group: {_id: null, count: {$sum: 1}}}",
            description: "Group and count",
            type: "snippet",
          },
          {
            text: "{$sort: {_id: 1}}",
            description: "Sort results",
            type: "snippet",
          },
          {
            text: "{$limit: 10}",
            description: "Limit results",
            type: "snippet",
          },
          {
            text: "{$project: {field: 1}}",
            description: "Project fields",
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
      if (!this.database) {
        throw new ConnectionError(
          "Not connected to MongoDB database",
          this.dbType,
        );
      }

      const coll = this.database.collection(collection);
      const indexSpec: any = {};

      for (const field of fields) {
        indexSpec[field] = 1; // Ascending order by default
      }

      const indexOptions: any = {
        name: options?.name,
        unique: options?.unique || false,
        background: options?.background !== false,
      };

      await coll.createIndex(indexSpec, indexOptions);
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
      if (!this.database) {
        throw new ConnectionError(
          "Not connected to MongoDB database",
          this.dbType,
        );
      }

      const coll = this.database.collection(collection);
      await coll.dropIndex(indexName);
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
      if (!this.database) {
        throw new ConnectionError(
          "Not connected to MongoDB database",
          this.dbType,
        );
      }

      const coll = this.database.collection(collection);
      const indexes = await coll.listIndexes().toArray();

      return indexes.map((idx) => ({
        name: idx.name,
        type: idx.key ? Object.keys(idx.key).join("_") : "unknown",
        fields: idx.key ? Object.keys(idx.key) : [],
        unique: idx.unique || false,
        size: idx.size,
        metadata: idx,
      }));
    } catch (error) {
      throw new DatabaseError(
        `Failed to list indexes: ${(error as Error).message}`,
        this.dbType,
        error as Error,
      );
    }
  }

  // Helper methods
  private buildConnectionURI(): string {
    const { host, port, username, password, database, authDatabase } =
      this.connectionParams;

    let uri = "mongodb://";

    if (username && password) {
      const authDb = authDatabase || database || "admin";
      uri += `${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}/${authDb}`;
    } else {
      uri += `${host}:${port}`;
    }

    if (database && !username) {
      uri += `/${database}`;
    }

    return uri;
  }

  private transformMongoDocuments(
    documents: any[],
  ): Array<Record<string, any>> {
    return documents.map((doc) => {
      const transformed: any = {};

      for (const [key, value] of Object.entries(doc)) {
        if (key === "_id") {
          transformed[key] =
            value instanceof ObjectId ? value.toHexString() : value;
        } else if (value instanceof ObjectId) {
          transformed[key] = value.toHexString();
        } else if (value instanceof Date) {
          transformed[key] = value.toISOString();
        } else if (Buffer.isBuffer(value)) {
          transformed[key] = value.toString("base64");
        } else if (Array.isArray(value)) {
          transformed[key] = value.map((item) =>
            item instanceof ObjectId ? item.toHexString() : item,
          );
        } else if (typeof value === "object" && value !== null) {
          transformed[key] = this.transformMongoDocuments([value])[0];
        } else {
          transformed[key] = value;
        }
      }

      return transformed;
    });
  }
}
