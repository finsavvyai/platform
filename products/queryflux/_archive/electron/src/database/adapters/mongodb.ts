import { MongoClient, Db, Collection } from 'mongodb';
import { BaseAdapter } from './index';

export interface MongoDBConfig {
  uri: string;
  database?: string;
  username?: string;
  password?: string;
  host?: string;
  port?: number;
  replicaSet?: string;
  ssl?: boolean;
  sslKey?: string;
  sslCert?: string;
  sslCA?: string;
  authSource?: string;
  connectTimeoutMS?: number;
  maxPoolSize?: number;
}

export interface MongoDBConnection {
  client: MongoClient;
  db: Db;
  config: MongoDBConfig;
}

export class MongoDBAdapter extends BaseAdapter {
  private config: any = null;

  async connect(config: MongoDBConfig): Promise<MongoDBConnection> {
    // Build URI from components if not provided
    let uri = config.uri;
    if (!uri && config.host) {
      const protocol = config.ssl ? 'mongodb+srv' : 'mongodb';
      const auth = config.username ? `${config.username}:${config.password}@` : '';
      const hostStr = config.host;
      const portStr = config.port ? `:${config.port}` : '';
      const databaseStr = config.database ? `/${config.database}` : '';
      uri = `${protocol}://${auth}${hostStr}${portStr}${databaseStr}`;
    }

    const options = {
      connectTimeoutMS: config.connectTimeoutMS || 10000,
      maxPoolSize: config.maxPoolSize || 10,
      ssl: config.ssl ? {
        rejectUnauthorized: false,
        key: config.sslKey,
        cert: config.sslCert,
        ca: config.sslCA,
      } : false,
      authSource: config.authSource || 'admin',
    };

    const client = new MongoClient(uri, options);
    await client.connect();

    const db = client.db(config.database || 'admin');

    // Test connection
    await db.collection('system.indexes').findOne({});

    this.connection = client;
    this.config = { ...config, uri };

    return {
      client,
      db,
      config: { ...config, uri },
    };
  }

  async disconnect(connection: MongoDBConnection): Promise<void> {
    if (connection.client) {
      await connection.client.close();
      this.connection = null;
    }
  }

  async executeQuery(
    connection: MongoDBConnection,
    query: string,
    params?: any[]
  ): Promise<any> {
    // MongoDB doesn't use SQL, so query is interpreted as MongoDB operation
    try {
      // Parse MongoDB query from natural language or MongoDB syntax
      const mongoQuery = this.parseMongoQuery(query, params);

      const result = await this.executeMongoOperation(connection.db, mongoQuery);

      // Transform result to standard format
      const transformedResult = {
        columns: this.getColumnsFromResult(result),
        rows: Array.isArray(result) ? result : [result],
        rowCount: Array.isArray(result) ? result.length : 1,
        executionTime: 0, // Would need timing measurement
        queryType: mongoQuery.operation,
      };

      return transformedResult;
    } catch (error) {
      console.error('MongoDB query execution failed:', error);
      throw error;
    }
  }

  async getSchema(connection: MongoDBConnection): Promise<any> {
    const db = connection.db;

    try {
      // Get all collections
      const collections = await db.listCollections().toArray();

      const tables = [];

      for (const collection of collections) {
        const collectionObj = db.collection(collection.name);

        // Get indexes
        const indexes = await collectionObj.indexInformation();
        const indexInfo = indexes.map((index: any) => ({
          name: index.name,
          columns: index.key,
          unique: index.unique || false,
          type: 'BTREE',
        }));

        // Get sample documents to infer schema
        const sampleDocs = await collectionObj.find({}).limit(5).toArray();
        const columns = this.inferColumnsFromDocuments(sampleDocs);

        tables.push({
          name: collection.name,
          schema: 'mongo',
          type: 'collection',
          columns,
          indexes: indexInfo,
        });
      }

      // Get views (MongoDB 4.2+)
      let views = [];
      try {
        const pipeline = [{ $listViews: {} }];
        const viewResults = await db.admin().command({ listViews: 1 }).catch(() => ({ views: [] }));
        if (viewResults && viewResults.views) {
          views = viewResults.views.map((view: any) => ({
            name: view.name,
            schema: view.db || 'admin',
            definition: view.viewOn,
            columns: [], // Would need to infer from pipeline
          }));
        }
      } catch (error) {
        console.log('Views not available in this MongoDB version');
      }

      return {
        tables,
        views,
        functions: [],
        procedures: [],
      };
    } catch (error) {
      console.error('Schema retrieval failed:', error);
      throw error;
    }
  }

  private parseMongoQuery(query: string, params?: any[]): any {
    const trimmedQuery = query.trim().toLowerCase();

    // Handle MongoDB query syntax
    if (trimmedQuery.startsWith('find(') || trimmedQuery.startsWith('db.')) {
      return { operation: 'find', collection: this.extractCollection(trimmedQuery), query: trimmedQuery };
    }

    // Handle natural language to MongoDB conversion
    if (trimmedQuery.includes('find') || trimmedQuery.includes('get') || trimmedQuery.includes('search')) {
      return this.convertToMongoQuery(trimmedQuery, params);
    }

    // Default to find operation
    return { operation: 'find', collection: 'documents', query: trimmedQuery };
  }

  private extractCollection(query: string): string {
    // Extract collection name from query like "db.users.find()" -> "users"
    const match = query.match(/(?:db\.|find\()\()?)(\w+)/);
    return match ? match[1] : 'documents';
  }

  private convertToMongoQuery(query: string, params?: any[]): any {
    // Simple natural language to MongoDB conversion
    const lowerQuery = query.toLowerCase();

    if (lowerQuery.includes('find all')) {
      return { operation: 'find', collection: 'documents', query: {} };
    }

    if (lowerQuery.includes('find where')) {
      // Extract condition after "where"
      const whereMatch = lowerQuery.match(/where\s+(.+?)(?:\s+|$)/);
      if (whereMatch) {
        return { operation: 'find', collection: 'documents', query: this.parseWhereClause(whereMatch[1]) };
      }
    }

    return { operation: 'find', collection: 'documents', query: {} };
  }

  private parseWhereClause(whereClause: string): any {
    // Simple WHERE clause parsing
    const andParts = whereClause.split(/\s+and\s+/i);
    const query: any = {};

    for (const part of andParts) {
      const match = part.match(/(\w+)\s*(=|!=|>|<|>=|<=|contains|startsWith|endsWith)\s*(.+)$/);
      if (match) {
        const [field, operator, value] = match;
        query[field] = this.parseOperatorValue(operator, value);
      }
    }

    return query;
  }

  private parseOperatorValue(operator: string, value: string): any {
    const cleanValue = value.trim().replace(/['"]/g, '');

    switch (operator) {
      case '=': return cleanValue;
      case '!=': return { $ne: cleanValue };
      case '>': return { $gt: isNaN(Number(cleanValue)) ? cleanValue : Number(cleanValue) };
      case '<': return { $lt: isNaN(Number(cleanValue)) ? cleanValue : Number(cleanValue) };
      case '>=': return { $gte: isNaN(Number(cleanValue)) ? cleanValue : Number(cleanValue) };
      case '<=': return { $lte: isNaN(Number(cleanValue)) ? cleanValue : Number(cleanValue) };
      case 'contains': return { $regex: cleanValue, $options: 'i' };
      case 'startswith': return { $regex: `^${cleanValue}`, $options: 'i' };
      case 'endswith': return { $regex: `${cleanValue}$`, $options: 'i' };
      default: return cleanValue;
    }
  }

  private async executeMongoOperation(db: Db, mongoQuery: any): Promise<any> {
    const collection = db.collection(mongoQuery.collection);

    switch (mongoQuery.operation) {
      case 'find':
        return await collection.find(mongoQuery.query).toArray();
      case 'findOne':
        return await collection.findOne(mongoQuery.query);
      case 'insert':
        return await collection.insertOne(mongoQuery.document);
      case 'insertMany':
        return await collection.insertMany(mongoQuery.documents);
      case 'update':
        return await collection.updateOne(mongoQuery.filter, mongoQuery.update);
      case 'updateMany':
        return await collection.updateMany(mongoQuery.filter, mongoQuery.update);
      case 'delete':
        return await collection.deleteOne(mongoQuery.filter);
      case 'deleteMany':
        return await collection.deleteMany(mongoQuery.filter);
      case 'aggregate':
        return await collection.aggregate(mongoQuery.pipeline).toArray();
      default:
        throw new Error(`Unsupported MongoDB operation: ${mongoQuery.operation}`);
    }
  }

  private getColumnsFromResult(result: any): any[] {
    if (!result || (Array.isArray(result) && result.length === 0)) {
      return [];
    }

    const sampleDoc = Array.isArray(result) ? result[0] : result;

    return Object.keys(sampleDoc).map(key => ({
      name: key,
      type: this.inferType(typeof sampleDoc[key]),
      nullable: true, // MongoDB fields are nullable by default
      primaryKey: key === '_id',
    }));
  }

  private inferColumnsFromDocuments(docs: any[]): any[] {
    if (!docs || docs.length === 0) {
      return [];
    }

    const allKeys = new Set<string>();
    docs.forEach(doc => {
      Object.keys(doc).forEach(key => allKeys.add(key));
    });

    return Array.from(allKeys).map(key => ({
      name: key,
      type: this.inferType(docs[0][key]),
      nullable: true,
      primaryKey: key === '_id',
    }));
  }

  private inferType(value: any): string {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'string') return 'string';
    if (value instanceof Date) return 'date';
    if (value instanceof Array) return 'array';
    if (typeof value === 'object' && value.constructor === Object) return 'object';
    return 'unknown';
  }
}
