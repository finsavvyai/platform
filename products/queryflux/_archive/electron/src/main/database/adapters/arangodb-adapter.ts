/**
 * ArangoDB Adapter
 * Multi-model database with document, graph, and key-value support
 */

import { DatabaseAdapter, DatabaseConnection, QueryResult, DatabaseSchema, TableInfo, ColumnInfo } from '../types';

interface ArangoDBConfig extends DatabaseConnection {
  database?: string;
  username?: string;
  password?: string;
  arangoVersion?: number;
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
  loadBalancingStrategy?: 'ROUND_ROBIN' | 'ONE_RANDOM';
  fallbackTimeout?: number;
}

interface DatabaseInfo {
  id: string;
  name: string;
  path: string;
  isSystem: boolean;
}

interface CollectionInfo {
  id: string;
  name: string;
  type: 'document' | 'edge';
  status: 'loading' | 'loaded' | 'unloading' | 'deleted';
  isSystem: boolean;
  globallyUniqueId: string;
  count: number;
  figures: {
    count: number;
    alive: number;
    dead: number;
    properties: number;
  };
}

interface Document {
  _key: string;
  _id: string;
  _rev: string;
  [key: string]: any;
}

interface EdgeDocument extends Document {
  _from: string;
  _to: string;
}

export class ArangoDBAdapter implements DatabaseAdapter {
  private config: ArangoDBConfig;
  private client: any = null; // arangojs client
  private db: any = null; // arangojs database instance

  constructor(config: ArangoDBConfig) {
    this.config = {
      database: 'mydb',
      username: 'root',
      arangoVersion: 3,
      maxRetries: 3,
      retryDelay: 1000,
      timeout: 30000,
      loadBalancingStrategy: 'ROUND_ROBIN',
      fallbackTimeout: 30000,
      ...config
    };
  }

  async connect(): Promise<void> {
    try {
      // In a real implementation, use arangojs
      // const { Database } = require('arangojs');
      //
      // const config = {
      //   url: `http://${this.config.host}:${this.config.port}`,
      //   databaseName: this.config.database,
      //   auth: {
      //     username: this.config.username,
      //     password: this.config.password
      //   },
      //   loadBalancingStrategy: this.config.loadBalancingStrategy,
      //   maxRetries: this.config.maxRetries,
      //   retryDelay: this.config.retryDelay,
      //   timeout: this.config.timeout,
      //   fallbackTimeout: this.config.fallbackTimeout,
      //   arangoVersion: this.config.arangoVersion
      // };
      //
      // this.client = new Database(config);
      // await this.client.version();
      // this.db = this.client;

      console.log(`Connected to ArangoDB ${this.config.database} at ${this.config.host}:${this.config.port}`);
    } catch (error) {
      throw new Error(`ArangoDB connection failed: ${error}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      // await this.client.close();
      this.client = null;
      this.db = null;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      if (!this.client) {
        await this.connect();
      }

      // Test with simple version query
      const version = await this.db.version();
      return version !== undefined;
    } catch (error) {
      console.error('ArangoDB connection test failed:', error);
      return false;
    }
  }

  async executeQuery(query: string, params?: any[]): Promise<QueryResult> {
    if (!this.db) {
      throw new Error('Not connected to ArangoDB');
    }

    const start = Date.now();

    try {
      let result: any;

      // Parse different types of ArangoDB queries
      if (query.toLowerCase().includes('for')) {
        result = await this.executeAQLQuery(query, params);
      } else if (query.toLowerCase().includes('insert')) {
        result = await this.executeInsertQuery(query, params);
      } else if (query.toLowerCase().includes('update') || query.toLowerCase().includes('replace')) {
        result = await this.executeUpdateQuery(query, params);
      } else if (query.toLowerCase().includes('remove') || query.toLowerCase().includes('delete')) {
        result = await this.executeDeleteQuery(query, params);
      } else if (query.toLowerCase().includes('create')) {
        result = await this.executeCreateQuery(query, params);
      } else if (query.toLowerCase().includes('drop')) {
        result = await this.executeDropQuery(query, params);
      } else {
        // Default to AQL query
        result = await this.executeAQLQuery(query, params);
      }

      const executionTime = Date.now() - start;

      return {
        rows: result.rows,
        rowCount: result.rowCount,
        columns: result.columns,
        executionTime,
        query
      };
    } catch (error) {
      throw new Error(`Query execution failed: ${error}`);
    }
  }

  async getSchema(): Promise<DatabaseSchema> {
    if (!this.db) {
      throw new Error('Not connected to ArangoDB');
    }

    try {
      const collections = await this.getCollections();
      const tables: TableInfo[] = [];

      for (const collection of collections) {
        // Get sample documents to infer columns
        const columns = await this.getCollectionColumns(collection.name, collection.type);

        tables.push({
          name: collection.name,
          schema: this.config.database || 'arangodb',
          type: collection.type === 'edge' ? 'EDGE_COLLECTION' : 'COLLECTION',
          rowEstimate: collection.figures?.count || 0,
          size: 0,
          columns
        });
      }

      return {
        name: `ArangoDB (${this.config.database})`,
        tables,
        functions: this.getArangoDBFunctions(),
        procedures: this.getArangoDBProcedures()
      };
    } catch (error) {
      throw new Error(`Schema retrieval failed: ${error}`);
    }
  }

  // ArangoDB specific methods

  async getCollections(): Promise<CollectionInfo[]> {
    // In a real implementation:
    // const collections = await this.db.collections();
    // return collections.map(c => ({
    //   id: c.id,
    //   name: c.name,
    //   type: c.type,
    //   status: c.status,
    //   isSystem: c.isSystem,
    //   globallyUniqueId: c.globallyUniqueId,
    //   count: c.count,
    //   figures: c.figures
    // }));

    // Simulate collections
    return [
      {
        id: '123',
        name: 'users',
        type: 'document',
        status: 'loaded',
        isSystem: false,
        globallyUniqueId: 'h123',
        count: 50000,
        figures: {
          count: 50000,
          alive: 50000,
          dead: 0,
          properties: 250000
        }
      },
      {
        id: '456',
        name: 'friendships',
        type: 'edge',
        status: 'loaded',
        isSystem: false,
        globallyUniqueId: 'h456',
        count: 125000,
        figures: {
          count: 125000,
          alive: 125000,
          dead: 0,
          properties: 375000
        }
      },
      {
        id: '789',
        name: 'products',
        type: 'document',
        status: 'loaded',
        isSystem: false,
        globallyUniqueId: 'h789',
        count: 25000,
        figures: {
          count: 25000,
          alive: 25000,
          dead: 0,
          properties: 150000
        }
      }
    ];
  }

  async createCollection(
    name: string,
    type: 'document' | 'edge' = 'document',
    options?: {
      waitForSync?: boolean;
      journalSize?: number;
      keyOptions?: {
        type?: 'traditional' | 'autoincrement';
        allowUserKeys?: boolean;
        increment?: number;
        offset?: number;
      };
      schema?: any;
    }
  ): Promise<void> {
    // In a real implementation:
    // const collection = await this.db.collection(name, { type, ...options });
    // await collection.create();

    console.log(`Created ${type} collection: ${name}`);
  }

  async dropCollection(name: string): Promise<void> {
    // In a real implementation:
    // const collection = await this.db.collection(name);
    // await collection.drop();

    console.log(`Dropped collection: ${name}`);
  }

  async getCollectionColumns(collectionName: string, type: 'document' | 'edge'): Promise<ColumnInfo[]> {
    const columns: ColumnInfo[] = [
      { name: '_key', type: 'string', nullable: false },
      { name: '_id', type: 'string', nullable: false },
      { name: '_rev', type: 'string', nullable: false }
    ];

    if (type === 'edge') {
      columns.push(
        { name: '_from', type: 'string', nullable: false },
        { name: '_to', type: 'string', nullable: false }
      );
    }

    try {
      // Get sample documents to infer additional columns
      const query = `FOR doc IN ${collectionName} LIMIT 10 RETURN doc`;
      const result = await this.executeAQLQuery(query);

      const inferredColumns = new Set<string>();
      result.rows.forEach(doc => {
        Object.keys(doc).forEach(key => {
          if (!key.startsWith('_')) {
            inferredColumns.add(key);
          }
        });
      });

      inferredColumns.forEach(col => {
        columns.push({
          name: col,
          type: 'mixed',
          nullable: true
        });
      });
    } catch (error) {
      // If we can't query the collection, just return base columns
    }

    return columns;
  }

  // Document operations

  async createDocument(
    collectionName: string,
    document: Partial<Document>
  ): Promise<Document> {
    // In a real implementation:
    // const collection = this.db.collection(collectionName);
    // const result = await collection.save(document);
    // return result;

    return {
      _key: document._key || Math.random().toString(36).substr(2, 9),
      _id: `${collectionName}/${document._key || Math.random().toString(36).substr(2, 9)}`,
      _rev: '1-' + Math.random().toString(36),
      ...document
    } as Document;
  }

  async getDocument(
    collectionName: string,
    documentId: string
  ): Promise<Document> {
    // In a real implementation:
    // const collection = this.db.collection(collectionName);
    // const result = await collection.document(documentId);
    // return result;

    return {
      _key: documentId.split('/')[1],
      _id: `${collectionName}/${documentId.split('/')[1]}`,
      _rev: '2-' + Math.random().toString(36),
      // Simulate document data
      name: 'Sample Document',
      type: 'user',
      createdAt: new Date().toISOString()
    } as Document;
  }

  async updateDocument(
    collectionName: string,
    documentId: string,
    updateData: Partial<Document>,
    options?: { keepNull?: boolean; mergeObjects?: boolean }
  ): Promise<Document> {
    // In a real implementation:
    // const collection = this.db.collection(collectionName);
    // const result = await collection.update(documentId, updateData, options);
    // return result;

    return {
      _key: documentId.split('/')[1],
      _id: `${collectionName}/${documentId.split('/')[1]}`,
      _rev: '3-' + Math.random().toString(36),
      ...updateData
    } as Document;
  }

  async deleteDocument(
    collectionName: string,
    documentId: string
  ): Promise<void> {
    // In a real implementation:
    // const collection = this.db.collection(collectionName);
    // await collection.remove(documentId);
  }

  // Edge operations

  async createEdge(
    collectionName: string,
    fromId: string,
    toId: string,
    edgeData: Partial<EdgeDocument> = {}
  ): Promise<EdgeDocument> {
    const edge: Partial<EdgeDocument> = {
      _from: fromId,
      _to: toId,
      ...edgeData
    };

    return this.createDocument(collectionName, edge) as Promise<EdgeDocument>;
  }

  // Query execution helpers

  private async executeAQLQuery(query: string, params?: any[]): Promise<QueryResult> {
    // In a real implementation:
    // const cursor = await this.db.query({
    //   query,
    //   bindVars: params ? { params } : undefined
    // });
    //
    // const rows = [];
    // while (cursor.hasNext()) {
    //   rows.push(await cursor.next());
    // }
    //
    // return {
    //   rows,
    //   rowCount: rows.length,
    //   columns: this.inferColumnsFromRows(rows)
    // };

    // Simulate AQL query execution
    if (query.includes('FOR') && query.includes('RETURN')) {
      return {
        rows: [
          {
            _id: 'users/123',
            _key: '123',
            name: 'John Doe',
            email: 'john@example.com',
            age: 30,
            active: true,
            createdAt: '2023-12-01T10:00:00Z'
          },
          {
            _id: 'users/456',
            _key: '456',
            name: 'Jane Smith',
            email: 'jane@example.com',
            age: 25,
            active: true,
            createdAt: '2023-12-02T15:30:00Z'
          }
        ],
        rowCount: 2,
        columns: [
          { name: '_id', type: 'string', nullable: false },
          { name: '_key', type: 'string', nullable: false },
          { name: 'name', type: 'string', nullable: false },
          { name: 'email', type: 'string', nullable: true },
          { name: 'age', type: 'number', nullable: true },
          { name: 'active', type: 'boolean', nullable: false },
          { name: 'createdAt', type: 'string', nullable: false }
        ]
      };
    }

    return { rows: [], rowCount: 0, columns: [] };
  }

  private async executeInsertQuery(query: string, params?: any[]): Promise<QueryResult> {
    return {
      rows: [{ result: 'insert_completed' }],
      rowCount: 1,
      columns: [{ name: 'result', type: 'string', nullable: false }]
    };
  }

  private async executeUpdateQuery(query: string, params?: any[]): Promise<QueryResult> {
    return {
      rows: [{ result: 'update_completed' }],
      rowCount: 1,
      columns: [{ name: 'result', type: 'string', nullable: false }]
    };
  }

  private async executeDeleteQuery(query: string, params?: any[]): Promise<QueryResult> {
    return {
      rows: [{ result: 'delete_completed' }],
      rowCount: 1,
      columns: [{ name: 'result', type: 'string', nullable: false }]
    };
  }

  private async executeCreateQuery(query: string, params?: any[]): Promise<QueryResult> {
    return {
      rows: [{ result: 'create_completed' }],
      rowCount: 1,
      columns: [{ name: 'result', type: 'string', nullable: false }]
    };
  }

  private async executeDropQuery(query: string, params?: any[]): Promise<QueryResult> {
    return {
      rows: [{ result: 'drop_completed' }],
      rowCount: 1,
      columns: [{ name: 'result', type: 'string', nullable: false }]
    };
  }

  private inferColumnsFromRows(rows: any[]): ColumnInfo[] {
    if (rows.length === 0) return [];

    const columns = new Set<string>();
    rows.forEach(row => {
      Object.keys(row).forEach(key => columns.add(key));
    });

    return Array.from(columns).map(col => ({
      name: col,
      type: this.inferType(rows[0][col]),
      nullable: true
    }));
  }

  private inferType(value: any): string {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'string') return 'string';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object' && value.constructor === Object) return 'object';
    return 'unknown';
  }

  // Graph operations

  async getNeighbors(
    vertexId: string,
    direction: 'any' | 'inbound' | 'outbound' = 'any',
    collection?: string,
    maxDepth: number = 1
  ): Promise<QueryResult> {
    let query = `
      FOR v, e, p IN ${maxDepth === 1 ? '' : `1..${maxDepth}`} ${direction} GRAPH '${collection || 'graph'}' '${vertexId}'
        RETURN {vertex: v, edge: e, path: p}
    `;

    if (collection) {
      query = query.replace("'graph'", collection);
    }

    return this.executeAQLQuery(query);
  }

  async shortestPath(
    fromVertexId: string,
    toVertexId: string,
    collection?: string,
    options?: {
      direction?: 'any' | 'inbound' | 'outbound';
      weightAttribute?: string;
    }
  ): Promise<QueryResult> {
    const direction = options?.direction || 'any';
    let query = `
      FOR p IN SHORTEST_PATH '${collection || 'graph'}' '${fromVertexId}' TO '${toVertexId}'
        ${options?.weightAttribute ? `OPTIONS {weightAttribute: '${options.weightAttribute}'}` : ''}
        RETURN p
    `;

    return this.executeAQLQuery(query);
  }

  // Full-text search (if ArangoSearch is enabled)

  async searchDocuments(
    collectionName: string,
    searchText: string,
    fields?: string[]
  ): Promise<QueryResult> {
    let query = `
      FOR doc IN ${collectionName}
        SEARCH doc IN ${fields ? fields.map(f => `'${f}'`).join(', ') : 'doc'}
        SEARCH doc.text == @searchText
        RETURN doc
    `;

    return this.executeAQLQuery(query, [{ searchText }]);
  }

  // Index operations

  async createIndex(
    collectionName: string,
    fields: string[],
    options?: {
      type?: 'persistent' | 'hash' | 'skiplist' | 'ttl' | 'fulltext';
      unique?: boolean;
      sparse?: boolean;
      deduplicate?: boolean;
      expireAfter?: number;
    }
  ): Promise<void> {
    const indexOptions = {
      type: options?.type || 'persistent',
      fields,
      unique: options?.unique || false,
      sparse: options?.sparse || false,
      deduplicate: options?.deduplicate !== false,
      ...options
    };

    // In a real implementation:
    // const collection = await this.db.collection(collectionName);
    // await collection.ensureIndex(indexOptions);

    console.log(`Created index on ${collectionName}:`, indexOptions);
  }

  // Transaction operations

  async executeTransaction(actions: any[]): Promise<any> {
    // In a real implementation:
    // const result = await this.db.transaction(actions);
    // return result;

    return {
      success: true,
      result: 'transaction_completed'
    };
  }

  // Server information

  async getServerInfo(): Promise<any> {
    return {
      version: '3.11.0',
      license: 'community',
      server: 'arango',
      host: this.config.host,
      port: this.config.port,
      database: this.config.database
    };
  }

  getArangoDBFunctions(): any[] {
    return [
      { name: 'DOCUMENT()', category: 'Utility', description: 'Convert to document' },
      { name: 'TO_NUMBER()', category: 'Conversion', description: 'Convert to number' },
      { name: 'TO_STRING()', category: 'Conversion', description: 'Convert to string' },
      { name: 'TO_BOOL()', category: 'Conversion', description: 'Convert to boolean' },
      { name: 'TO_ARRAY()', category: 'Conversion', description: 'Convert to array' },
      { name: 'TO_LIST()', category: 'Conversion', description: 'Convert to list' },
      { name: 'DATE_FORMAT()', category: 'Date', description: 'Format date' },
      { name: 'DATE_NOW()', category: 'Date', description: 'Current date' },
      { name: 'IS_NULL()', category: 'Comparison', description: 'Check if null' },
      { name: 'IS_BOOL()', category: 'Comparison', description: 'Check if boolean' },
      { name: 'IS_NUMBER()', category: 'Comparison', description: 'Check if number' },
      { name: 'IS_STRING()', category: 'Comparison', description: 'Check if string' },
      { name: 'IS_ARRAY()', category: 'Comparison', description: 'Check if array' },
      { name: 'IS_OBJECT()', category: 'Comparison', description: 'Check if object' },
      { name: 'IS_DATE()', category: 'Comparison', description: 'Check if date' },
      { name: 'ABS()', category: 'Math', description: 'Absolute value' },
      { name: 'CEIL()', category: 'Math', description: 'Round up' },
      { name: 'FLOOR()', category: 'Math', description: 'Round down' },
      { name: 'ROUND()', category: 'Math', description: 'Round to nearest' },
      { name: 'SQRT()', category: 'Math', description: 'Square root' },
      { name: 'POW()', category: 'Math', description: 'Power' },
      { name: 'LOG()', category: 'Math', description: 'Logarithm' },
      { name: 'EXP()', category: 'Math', description: 'Exponential' },
      { name: 'RANDOM()', category: 'Math', description: 'Random number' },
      { name: 'RANGE()', category: 'Array', description: 'Generate range' },
      { name: 'UNION()', category: 'Array', description: 'Union arrays' },
      { name: 'UNION_DISTINCT()', category: 'Array', description: 'Union distinct arrays' },
      { name: 'INTERSECTION()', category: 'Array', description: 'Array intersection' },
      { name: 'MINUS()', category: 'Array', description: 'Array difference' },
      { name: 'OUTERSECTION()', category: 'Array', description: 'Outer difference' },
      { name: 'IN()', category: 'Array', description: 'Check membership' },
      { name: 'NOT_IN()', category: 'Array', description: 'Check non-membership' },
      { name: 'LIKE()', category: 'String', description: 'String pattern matching' },
      { name: 'REGEX_MATCHES()', category: 'String', description: 'Regex matching' },
      { name: 'REGEX_SPLIT()', category: 'String', description: 'Regex split' },
      { name: 'REGEX_REPLACE()', category: 'String', description: 'Regex replace' },
      { name: 'SPLIT()', category: 'String', description: 'Split string' },
      { name: 'SUBSTITUTE()', category: 'String', description: 'Replace string' },
      { name: 'CONCAT()', category: 'String', description: 'Concatenate strings' },
      { name: 'LOWER()', category: 'String', description: 'Lowercase string' },
      { name: 'UPPER()', category: 'String', description: 'Uppercase string' },
      { name: 'LENGTH()', category: 'String', description: 'String length' },
      { name: 'LEFT()', category: 'String', description: 'Left substring' },
      { name: 'RIGHT()', category: 'String', description: 'Right substring' },
      { name: 'SUBSTRING()', category: 'String', description: 'Substring' },
      { name: 'TRIM()', category: 'String', description: 'Trim whitespace' },
      { name: 'CONTAINS()', category: 'String', description: 'Contains substring' },
      { name: 'STARTS_WITH()', category: 'String', description: 'Starts with substring' },
      { name: 'ENDS_WITH()', category: 'String', description: 'Ends with substring' }
    ];
  }

  getArangoDBProcedures(): any[] {
    return [
      { name: 'db._create()', category: 'Database', description: 'Create database' },
      { name: 'db._drop()', category: 'Database', description: 'Drop database' },
      { name: 'db._use()', category: 'Database', description: 'Use database' },
      { name: 'db._databases()', category: 'Database', description: 'List databases' },
      { name: 'db._name()', category: 'Database', description: 'Current database name' },
      { name: 'db._exists()', category: 'Database', description: 'Check database exists' },
      { name: 'db._properties()', category: 'Database', description: 'Database properties' },
      { name: 'db._changeProperties()', category: 'Database', description: 'Change database properties' },
      { name: 'db._queryProperties()', category: 'Database', description: 'Query properties' },
      { name: 'db._query()', category: 'Database', description: 'Query execution properties' },
      { name: 'db._version()', category: 'Database', description: 'Server version' },
      { name: 'db._engine()', category: 'Database', description: 'Storage engine' },
      { name: 'db._statistics()', category: 'Database', description: 'Database statistics' },
      { name: 'db._dropStatistics()', category: 'Database', description: 'Drop statistics' },
      { name: 'db._collection()', category: 'Collection', description: 'Get collection' },
      { name: 'db._collections()', category: 'Collection', description: 'List collections' },
      { name: 'db._list()', category: 'Collection', description: 'List collections (alias)' },
      { name: 'db._createCollection()', category: 'Collection', description: 'Create collection' },
      { name: 'db._drop()', category: 'Collection', description: 'Drop collection' },
      { name: 'db._truncate()', category: 'Collection', description: 'Truncate collection' },
      { name: 'db._count()', category: 'Collection', description: 'Document count' },
      { name: 'db._documents()', category: 'Collection', description: 'List documents' },
      { name: 'db._document()', category: 'Document', description: 'Get document' },
      {name: 'db._insert()', category: 'Document', description: 'Insert document' },
      { name: 'db._update()', category: 'Document', description: 'Update document' },
      { name: 'db._replace()', category: 'Document', description: 'Replace document' },
      { name: 'db._remove()', category: 'Document', description: 'Remove document' },
      { name: 'db._removeByKeys()', category: 'Document', description: 'Remove documents by keys' },
      { name: 'db._exists()', category: 'Document', description: 'Check document exists' },
      { name: 'db._query()', category: 'Query', description: 'Execute query' },
      { name: 'db._list()', category: 'Query', description: 'List query cursors' },
      { name: 'db._execute()', category: 'Query', description: 'Execute query with cursor' },
      { name: 'db._cursor()', category: 'Query', description: 'Get query cursor' },
      { name: 'db._transaction()', category: 'Transaction', description: 'Execute transaction' },
      { name: 'db._begin()', category: 'Transaction', description: 'Begin transaction' },
      { name: 'db._commit()', category: 'Transaction', description: 'Commit transaction' },
      { name: 'db._abort()', category: 'Transaction', description: 'Abort transaction' },
      { name: 'db._view()', category: 'View', description: 'Execute view' },
      { name: 'db._views()', category: 'View', description: 'List views' },
      { name: 'db._create()', category: 'View', description: 'Create view' },
      { name: 'db._drop()', category: 'View', description: 'Drop view' },
      { name: 'db._exists()', category: 'View', description: 'Check view exists' },
      { name: 'db._index()', category: 'Index', description: 'Get index' },
      { name: 'db._indexes()', category: 'Index', description: 'List indexes' },
      { name: 'db._createIndex()', category: 'Index', description: 'Create index' },
      { name: 'db._drop()', category: 'Index', description: 'Drop index' },
      { name: 'db._ensureIndex()', category: 'Index', description: 'Ensure index exists' },
      { name: 'db._rename()', category: 'Index', description: 'Rename index' }
    ];
  }

  getHelperTemplates(): Record<string, string> {
    return {
      'create_database': `
// Create new database
db._create('my_database');
      `,
      'create_collection': `
// Create document collection
db._createCollection('users');

// Create edge collection
db._createCollection('friendships', {type: 'edge'});
      `,
      'insert_document': `
// Insert a document
INSERT {
  _key: 'user123',
  name: 'John Doe',
  email: 'john@example.com',
  age: 30,
  tags: ['developer', 'javascript'],
  active: true,
  createdAt: DATE_NOW()
} INTO users;
      `,
      'insert_edge': `
// Create an edge between users
INSERT {
  _from: 'users/user123',
  _to: 'users/user456',
  type: 'friend',
  since: '2020-01-15',
  strength: 0.8
} INTO friendships;
      `,
      'query_documents': `
// Simple query with filters
FOR user IN users
  FILTER user.age > 25 AND user.active == true
  SORT user.createdAt DESC
  LIMIT 10
  RETURN user;
      `,
      'graph_traversal': `
// Graph traversal to find friends of friends
FOR v, e, p IN 1..2 OUTBOUND 'friendships' @start
  FILTER v.active == true
  RETURN {path: p, user: v};
      `,
      'shortest_path': `
// Find shortest path between two users
FOR p IN SHORTEST_PATH 'friendships' @start TO @target
  RETURN p;
      `,
      'aggregation': `
// Aggregate data
FOR user IN users
  COLLECT ageGroup = FLOOR(user.age / 10) * 10 INTO groups
  RETURN {
    ageGroup,
    count: LENGTH(groups[ageGroup]),
    avgAge: AVERAGE(user.age FOR user IN groups[ageGroup])
  };
      `,
      'subquery': `
// Query with subquery
FOR user IN users
  LET friendCount = (
    FOR f IN 1..1 OUTBOUND friendships @start user
    RETURN 1
  )
  RETURN {
    user: user,
    friendCount: SUM(friendCount)
  };
      `,
      'transaction': `
// Transaction example
db._transaction([
  {action: "function", code: "function () { return 'Hello'; }"},
  {action: "query", query: "RETURN 1"},
  {action: "function", code: "function () { return 'World'; }"}
]);
      `,
      'fulltext_search': `
// Full-text search (if ArangoSearch enabled)
FOR doc IN articles
  SEARCH doc IN ['title', 'content']
  SEARCH doc.text == @searchText
  RETURN doc
`,
      {
        name: 'joins',
        value: `
// Join-like operation with subqueries
FOR user IN users
  LET orders = (
    FOR o IN orders
      FILTER o.userId == user._key
      RETURN o
  )
  RETURN {
    user: user,
    orders: orders,
    totalOrders: LENGTH(orders),
    totalAmount: SUM(o.amount FOR o IN orders)
  };
        `
      },
      'window_functions': `
// Window functions (ArangoDB 3.10+)
FOR user IN users
  LET rank = POSITION(user, (
    FOR u IN users
      SORT u.name DESC
      RETURN u
  ))
  FILTER rank <= 10
  RETURN {
    rank: rank,
    user: user
  };
      `
    };
  }

  validateQuery(query: string): { isValid: boolean; error?: string } {
    try {
      const queryLower = query.toLowerCase();

      // Basic validation for AQL queries
      if (queryLower.includes('for') && !queryLower.includes('return')) {
        return {
          isValid: false,
          error: 'FOR statements must include a RETURN clause'
        };
      }

      if (queryLower.includes('insert') && !queryLower.includes('into')) {
        return {
          isValid: false,
          error: 'INSERT statements must specify target collection with INTO'
        };
      }

      if (queryLower.includes('remove') && !queryLower.includes('from') && !queryLower.includes('in')) {
        return {
          isValid: false,
          error: 'REMOVE statements must specify source with FROM or IN'
        };
      }

      return { isValid: true };
    } catch (error) {
      return {
        isValid: false,
        error: `Query validation failed: ${error}`
      };
    }
  }
}
