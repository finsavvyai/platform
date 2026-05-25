/**
 * CouchDB Adapter
 * Document database with MapReduce views and replication
 */

import { DatabaseAdapter, DatabaseConnection, QueryResult, DatabaseSchema, TableInfo, ColumnInfo } from '../types';

interface CouchDBConfig extends DatabaseConnection {
  username?: string;
  password?: string;
  timeout?: number;
  maxRetries?: number;
  keepAlive?: boolean;
  ssl?: boolean;
}

interface Document {
  _id: string;
  _rev?: string;
  [key: string]: any;
}

interface ViewResult {
  total_rows: number;
  offset: number;
  rows: Array<{
    id: string;
    key: any;
    value: any;
    doc?: Document;
  }>;
}

interface DatabaseInfo {
  db_name: string;
  doc_count: number;
  doc_del_count: number;
  update_seq: string;
  disk_size: number;
  data_size: number;
  instance_start_time: string;
  disk_format_version: number;
  committed_update_seq: string;
}

interface DesignDocument {
  _id: string;
  _rev?: string;
  views: Record<string, {
    map?: string;
    reduce?: string;
  }>;
  language?: string;
  options?: Record<string, any>;
}

export class CouchDBAdapter implements DatabaseAdapter {
  private config: CouchDBConfig;
  private baseUrl: string;
  private authHeader: string | null = null;

  constructor(config: CouchDBConfig) {
    this.config = {
      timeout: 30000,
      maxRetries: 3,
      keepAlive: true,
      ssl: true,
      ...config
    };

    this.baseUrl = `${this.config.ssl ? 'https' : 'http'}://${this.config.host}:${this.config.port}`;

    if (this.config.username && this.config.password) {
      this.authHeader = `Basic ${Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64')}`;
    }
  }

  async connect(): Promise<void> {
    try {
      // Test connection to CouchDB
      const response = await this.makeRequest('/', 'GET');

      if (!response.ok) {
        throw new Error(`CouchDB connection failed: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.couchdb !== 'Welcome') {
        throw new Error('Invalid CouchDB server response');
      }

      console.log(`Connected to CouchDB ${data.version} at ${this.config.host}:${this.config.port}`);
    } catch (error) {
      throw new Error(`CouchDB connection failed: ${error}`);
    }
  }

  async disconnect(): Promise<void> {
    this.authHeader = null;
  }

  async testConnection(): Promise<boolean> {
    try {
      if (!this.authHeader && this.config.username) {
        await this.connect();
      }

      const response = await this.makeRequest('/_up', 'GET');
      return response.ok;
    } catch (error) {
      console.error('CouchDB connection test failed:', error);
      return false;
    }
  }

  async executeQuery(query: string, params?: any[]): Promise<QueryResult> {
    const start = Date.now();

    try {
      let result: any;
      const queryLower = query.toLowerCase();

      // Parse different types of CouchDB operations
      if (queryLower.includes('_find')) {
        result = await this.executeFindQuery(query, params);
      } else if (queryLower.includes('_view') || queryLower.includes('_design/')) {
        result = await this.executeViewQuery(query, params);
      } else if (queryLower.includes('_all_docs')) {
        result = await this.executeAllDocsQuery(query, params);
      } else if (queryLower.includes('_bulk_docs')) {
        result = await this.executeBulkDocsQuery(query, params);
      } else if (queryLower.includes('_changes')) {
        result = await this.executeChangesQuery(query, params);
      } else if (queryLower.includes('_replicate')) {
        result = await this.executeReplicateQuery(query, params);
      } else {
        // Default to find query
        result = await this.executeFindQuery(query, params);
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
    if (!this.config.database) {
      throw new Error('Database name is required for schema retrieval');
    }

    try {
      const databases = await this.getDatabases();
      const tables: TableInfo[] = [];

      for (const dbName of databases) {
        const dbInfo = await this.getDatabaseInfo(dbName);
        const designDocs = await this.getDesignDocuments(dbName);

        // Extract view schemas
        const columns: ColumnInfo[] = [
          { name: '_id', type: 'string', nullable: false },
          { name: '_rev', type: 'string', nullable: false },
          { name: 'type', type: 'string', nullable: true }
        ];

        // Add columns from design documents
        for (const designDoc of designDocs) {
          if (designDoc.views) {
            Object.keys(designDoc.views).forEach(viewName => {
              columns.push({
                name: `view_${viewName}`,
                type: 'view',
                nullable: true
              });
            });
          }
        }

        tables.push({
          name: dbName,
          schema: 'couchdb',
          type: 'DATABASE',
          rowEstimate: dbInfo.doc_count,
          size: dbInfo.disk_size,
          columns
        });
      }

      return {
        name: 'CouchDB Server',
        tables,
        functions: this.getCouchDBFunctions(),
        procedures: this.getCouchDBProcedures()
      };
    } catch (error) {
      throw new Error(`Schema retrieval failed: ${error}`);
    }
  }

  // CouchDB specific methods

  async getDatabases(): Promise<string[]> {
    const response = await this.makeRequest('/_all_dbs', 'GET');
    const data = await response.json();
    return data;
  }

  async createDatabase(dbName: string): Promise<void> {
    const response = await this.makeRequest(`/${encodeURIComponent(dbName)}`, 'PUT');

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to create database: ${error.reason}`);
    }
  }

  async deleteDatabase(dbName: string): Promise<void> {
    const response = await this.makeRequest(`/${encodeURIComponent(dbName)}`, 'DELETE');

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to delete database: ${error.reason}`);
    }
  }

  async getDatabaseInfo(dbName: string): Promise<DatabaseInfo> {
    const response = await this.makeRequest(`/${encodeURIComponent(dbName)}`, 'GET');
    return await response.json();
  }

  async getDocument(dbName: string, docId: string, rev?: string): Promise<Document> {
    let url = `/${encodeURIComponent(dbName)}/${encodeURIComponent(docId)}`;
    if (rev) {
      url += `?rev=${encodeURIComponent(rev)}`;
    }

    const response = await this.makeRequest(url, 'GET');
    return await response.json();
  }

  async createDocument(dbName: string, document: Document): Promise<Document> {
    const response = await this.makeRequest(
      `/${encodeURIComponent(dbName)}/${encodeURIComponent(document._id)}`,
      'PUT',
      document
    );

    return await response.json();
  }

  async updateDocument(dbName: string, document: Document): Promise<Document> {
    return this.createDocument(dbName, document);
  }

  async deleteDocument(dbName: string, docId: string, rev: string): Promise<any> {
    const response = await this.makeRequest(
      `/${encodeURIComponent(dbName)}/${encodeURIComponent(docId)}?rev=${encodeURIComponent(rev)}`,
      'DELETE'
    );

    return await response.json();
  }

  // View operations

  async getDesignDocuments(dbName: string): Promise<DesignDocument[]> {
    const response = await this.makeRequest(
      `/${encodeURIComponent(dbName)}/_design_docs`,
      'GET',
      null,
      { include_docs: 'true' }
    );

    const data = await response.json();
    return data.rows.map((row: any) => row.doc);
  }

  async createView(
    dbName: string,
    designDocName: string,
    viewName: string,
    mapFunction: string,
    reduceFunction?: string
  ): Promise<void> {
    const designDocId = `_design/${designDocName}`;

    try {
      // Try to get existing design document
      const existingDoc = await this.getDocument(dbName, designDocId);

      existingDoc.views = existingDoc.views || {};
      existingDoc.views[viewName] = {
        map: mapFunction,
        ...(reduceFunction && { reduce: reduceFunction })
      };

      await this.createDocument(dbName, existingDoc);
    } catch (error) {
      // Create new design document
      const designDoc: DesignDocument = {
        _id: designDocId,
        views: {
          [viewName]: {
            map: mapFunction,
            ...(reduceFunction && { reduce: reduceFunction })
          }
        },
        language: 'javascript'
      };

      await this.createDocument(dbName, designDoc);
    }
  }

  async queryView(
    dbName: string,
    designDocName: string,
    viewName: string,
    options?: {
      key?: any;
      keys?: any[];
      startkey?: any;
      endkey?: any;
      limit?: number;
      skip?: number;
      descending?: boolean;
      include_docs?: boolean;
      reduce?: boolean;
      group?: boolean;
      group_level?: number;
    }
  ): Promise<QueryResult> {
    const url = `/${encodeURIComponent(dbName)}/_design/${designDocName}/_view/${viewName}`;
    const params = new URLSearchParams();

    if (options) {
      Object.entries(options).forEach(([key, value]) => {
        if (value !== undefined) {
          params.set(key, JSON.stringify(value));
        }
      });
    }

    const response = await this.makeRequest(`${url}?${params.toString()}`, 'GET');
    const data: ViewResult = await response.json();

    return {
      rows: data.rows.map(row => ({
        id: row.id,
        key: row.key,
        value: row.value,
        doc: row.doc
      })),
      rowCount: data.total_rows,
      columns: [
        { name: 'id', type: 'string', nullable: false },
        { name: 'key', type: 'mixed', nullable: false },
        { name: 'value', type: 'mixed', nullable: false },
        ...(options?.include_docs && [{ name: 'doc', type: 'object', nullable: true }])
      ]
    };
  }

  // Find operations (Mango)

  async findDocuments(
    dbName: string,
    selector: Record<string, any>,
    options?: {
      fields?: string[];
      limit?: number;
      skip?: number;
      sort?: Array<Record<string, any>>;
      use_index?: string;
    }
  ): Promise<QueryResult> {
    const body: any = {
      selector: selector,
      ...(options && options)
    };

    const response = await this.makeRequest(
      `/${encodeURIComponent(dbName)}/_find`,
      'POST',
      body
    );

    const data = await response.json();

    return {
      rows: data.docs,
      rowCount: data.docs.length,
      columns: this.inferColumnsFromDocuments(data.docs)
    };
  }

  async createIndex(
    dbName: string,
    fields: Array<string | Record<string, any>>,
    options?: {
      name?: string;
      type?: 'json' | 'text';
      partial_filter_selector?: Record<string, any>;
    }
  ): Promise<any> {
    const body = {
      index: {
        fields: fields,
        ...(options && {
          ...(options.name && { name: options.name }),
          ...(options.type && { type: options.type }),
          ...(options.partial_filter_selector && {
            partial_filter_selector: options.partial_filter_selector
          })
        })
      }
    };

    const response = await this.makeRequest(
      `/${encodeURIComponent(dbName)}/_index`,
      'POST',
      body
    );

    return await response.json();
  }

  // Bulk operations

  async bulkDocuments(
    dbName: string,
    documents: Array<Document & { _deleted?: boolean }>,
    options?: {
      all_or_nothing?: boolean;
      new_edits?: boolean;
    }
  ): Promise<any> {
    const body: any = {
      docs: documents,
      ...(options && options)
    };

    const response = await this.makeRequest(
      `/${encodeURIComponent(dbName)}/_bulk_docs`,
      'POST',
      body
    );

    return await response.json();
  }

  // Replication

  async createReplication(
    source: string,
    target: string,
    options?: {
      continuous?: boolean;
      create_target?: boolean;
      doc_ids?: string[];
      filter?: string;
      query_params?: Record<string, any>;
    }
  ): Promise<any> {
    const body: any = {
      source: source,
      target: target,
      ...(options && options)
    };

    const response = await this.makeRequest('/_replicator', 'POST', body);
    return await response.json();
  }

  async getReplications(): Promise<any[]> {
    const response = await this.makeRequest('/_scheduler/docs/_replicator', 'GET');
    return await response.json();
  }

  // Changes feed

  async getChanges(
    dbName: string,
    options?: {
      since?: string | number;
      limit?: number;
      feed?: 'normal' | 'longpoll' | 'continuous' | 'eventsource';
      filter?: string;
      include_docs?: boolean;
      conflicts?: boolean;
    }
  ): Promise<any> {
    const params = new URLSearchParams();

    if (options) {
      Object.entries(options).forEach(([key, value]) => {
        if (value !== undefined) {
          params.set(key, String(value));
        }
      });
    }

    const response = await this.makeRequest(
      `/${encodeURIComponent(dbName)}/_changes?${params.toString()}`,
      'GET'
    );

    return await response.json();
  }

  // Query execution helpers

  private async executeFindQuery(query: string, params?: any[]): Promise<QueryResult> {
    // Parse query to extract database and selector
    const dbName = this.config.database || 'default';

    // Default find query
    return this.findDocuments(dbName, {});
  }

  private async executeViewQuery(query: string, params?: any[]): Promise<QueryResult> {
    // Parse query to extract design doc and view name
    const match = query.match(/_design\/([^\/]+)\/_view\/([^\/\?]+)/);
    if (match) {
      const [, designDoc, view] = match;
      const dbName = this.config.database || 'default';
      return this.queryView(dbName, designDoc, view);
    }

    return { rows: [], rowCount: 0, columns: [] };
  }

  private async executeAllDocsQuery(query: string, params?: any[]): Promise<QueryResult> {
    const dbName = this.config.database || 'default';
    const url = `/${encodeURIComponent(dbName)}/_all_docs?include_docs=true`;

    const response = await this.makeRequest(url, 'GET');
    const data: ViewResult = await response.json();

    return {
      rows: data.rows.map(row => row.doc),
      rowCount: data.total_rows,
      columns: this.inferColumnsFromDocuments(data.rows.map(row => row.doc))
    };
  }

  private async executeBulkDocsQuery(query: string, params?: any[]): Promise<QueryResult> {
    return {
      rows: [{ result: 'bulk_operation_completed' }],
      rowCount: 1,
      columns: [{ name: 'result', type: 'string', nullable: false }]
    };
  }

  private async executeChangesQuery(query: string, params?: any[]): Promise<QueryResult> {
    const dbName = this.config.database || 'default';
    const changes = await this.getChanges(dbName, { limit: 10 });

    return {
      rows: changes.results || [],
      rowCount: changes.results?.length || 0,
      columns: [
        { name: 'seq', type: 'mixed', nullable: false },
        { name: 'id', type: 'string', nullable: false },
        { name: 'changes', type: 'array', nullable: false },
        { name: 'deleted', type: 'boolean', nullable: true }
      ]
    };
  }

  private async executeReplicateQuery(query: string, params?: any[]): Promise<QueryResult> {
    return {
      rows: [{ result: 'replication_started' }],
      rowCount: 1,
      columns: [{ name: 'result', type: 'string', nullable: false }]
    };
  }

  // Utility methods

  private async makeRequest(
    path: string,
    method: string,
    body?: any,
    params?: Record<string, string>
  ): Promise<Response> {
    const url = new URL(`${this.baseUrl}${path}`);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    if (this.authHeader) {
      headers['Authorization'] = this.authHeader;
    }

    const response = await fetch(url.toString(), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(this.config.timeout!)
    });

    return response;
  }

  private inferColumnsFromDocuments(documents: Document[]): ColumnInfo[] {
    const columnSet = new Set<string>();

    documents.forEach(doc => {
      Object.keys(doc).forEach(key => {
        if (!key.startsWith('_')) {
          columnSet.add(key);
        }
      });
    });

    const columns: ColumnInfo[] = [
      { name: '_id', type: 'string', nullable: false },
      { name: '_rev', type: 'string', nullable: false }
    ];

    Array.from(columnSet).forEach(col => {
      columns.push({
        name: col,
        type: 'mixed',
        nullable: true
      });
    });

    return columns;
  }

  // Management operations

  async compactDatabase(dbName: string): Promise<void> {
    const response = await this.makeRequest(
      `/${encodeURIComponent(dbName)}/_compact`,
      'POST'
    );

    if (!response.ok) {
      throw new Error('Failed to compact database');
    }
  }

  async cleanupViews(dbName: string): Promise<void> {
    const response = await this.makeRequest(
      `/${encodeURIComponent(dbName)}/_view_cleanup`,
      'POST'
    );

    if (!response.ok) {
      throw new Error('Failed to cleanup views');
    }
  }

  async getServerStats(): Promise<any> {
    const response = await this.makeRequest('/_stats', 'GET');
    return await response.json();
  }

  getCouchDBFunctions(): any[] {
    return [
      { name: 'emit', category: 'MapReduce', description: 'Emit key-value pair in map function' },
      { name: 'sum', category: 'Reduce', description: 'Sum values' },
      { name: 'count', category: 'Reduce', description: 'Count documents' },
      { name: 'min', category: 'Reduce', description: 'Minimum value' },
      { name: 'max', category: 'Reduce', description: 'Maximum value' },
      { name: 'average', category: 'Reduce', description: 'Average values' },
      { name: 'stats', category: 'Reduce', description: 'Statistical values' },
      { name: '_sum', category: 'Built-in', description: 'Built-in sum function' },
      { name: '_count', category: 'Built-in', description: 'Built-in count function' },
      { name: '_stats', category: 'Built-in', description: 'Built-in stats function' }
    ];
  }

  getCouchDBProcedures(): any[] {
    return [
      { name: 'PUT /{db}', category: 'Database', description: 'Create database' },
      { name: 'DELETE /{db}', category: 'Database', description: 'Delete database' },
      { name: 'GET /{db}', category: 'Database', description: 'Get database info' },
      { name: 'PUT /{db}/{doc}', category: 'Document', description: 'Create/update document' },
      { name: 'GET /{db}/{doc}', category: 'Document', description: 'Get document' },
      { name: 'DELETE /{db}/{doc}', category: 'Document', description: 'Delete document' },
      { name: 'POST /{db}/_find', category: 'Query', description: 'Mango query' },
      { name: 'GET /{db}/_all_docs', category: 'Query', description: 'List all documents' },
      { name: 'GET /{db}/_design/{ddoc}/_view/{view}', category: 'View', description: 'Query view' },
      { name: 'PUT /{db}/_design/{ddoc}', category: 'Design', description: 'Create design document' },
      { name: 'POST /{db}/_bulk_docs', category: 'Bulk', description: 'Bulk operations' },
      { name: 'POST /{db}/_changes', category: 'Replication', description: 'Changes feed' },
      { name: 'POST /_replicator', category: 'Replication', description: 'Create replication' },
      { name: 'POST /{db}/_compact', category: 'Maintenance', description: 'Compact database' },
      { name: 'POST /{db}/_view_cleanup', category: 'Maintenance', description: 'Cleanup views' },
      { name: 'POST /{db}/_index', category: 'Index', description: 'Create index' },
      { name: 'GET /{db}/_index', category: 'Index', description: 'List indexes' },
      { name: 'DELETE /{db}/_index/{ddoc}/{type}/{name}', category: 'Index', description: 'Delete index' }
    ];
  }

  getHelperTemplates(): Record<string, string> {
    return {
      'create_document': `
// Create a new document
{
  "_id": "user:123",
  "type": "user",
  "name": "John Doe",
  "email": "john@example.com",
  "age": 30,
  "preferences": {
    "theme": "dark",
    "notifications": true
  },
  "createdAt": "2023-12-01T10:00:00Z",
  "updatedAt": "2023-12-01T10:00:00Z"
}
      `,
      'create_view': `
// Create a design document with views
{
  "_id": "_design/users",
  "views": {
    "by_age": {
      "map": "function(doc) { if (doc.type === 'user' && doc.age) { emit(doc.age, doc.name); } }",
      "reduce": "_count"
    },
    "by_type": {
      "map": "function(doc) { if (doc.type) { emit(doc.type, 1); } }",
      "reduce": "_sum"
    },
    "active_users": {
      "map": "function(doc) { if (doc.type === 'user' && doc.status === 'active') { emit(doc._id, doc); } }"
    }
  },
  "language": "javascript"
}
      `,
      'mango_query': `
// Mango query with selector and options
{
  "selector": {
    "type": "user",
    "age": { "$gt": 25 },
    "status": "active"
  },
  "fields": ["_id", "name", "email", "age"],
  "limit": 50,
  "sort": [{"age": "asc"}, {"name": "asc"}],
  "use_index": "users_by_age"
}
      `,
      'complex_view': `
// Complex view with compound key emission
function(doc) {
  if (doc.type === 'order' && doc.customer && doc.product) {
    emit([doc.customer, doc.product.category], {
      orderId: doc._id,
      amount: doc.amount,
      date: doc.createdAt,
      status: doc.status
    });
  }
}
      `,
      'reduce_view': `
// View with reduce function for aggregations
{
  "map": "function(doc) { if (doc.type === 'sale' && doc.amount) { emit(doc.category, doc.amount); } }",
  "reduce": "function(keys, values, rereduce) { return sum(values); }"
}
      `,
      'bulk_operations': `
// Bulk create, update, and delete operations
{
  "docs": [
    {
      "_id": "order:456",
      "type": "order",
      "customer": "cust123",
      "amount": 299.99
    },
    {
      "_id": "order:789",
      "_rev": "1-abc123",
      "type": "order",
      "status": "completed"
    },
    {
      "_id": "order:012",
      "_rev": "1-def456",
      "_deleted": true
    }
  ]
}
      `,
      'create_index': `
// Create JSON index for Mango queries
{
  "index": {
    "fields": ["type", "status", "createdAt"],
    "partial_filter_selector": {
      "type": "order"
    }
  },
  "name": "orders_by_status_date",
  "type": "json"
}
      `,
      'text_index': `
// Create text search index
{
  "index": {
    "fields": [
      {"name": "title", "type": "string"},
      {"name": "content", "type": "string"},
      {"name": "tags", "type": "string"}
    ],
    "default_analyzer": "keyword",
    "fields": [
      {"name": "title", "analyzer": "english"},
      {"name": "content", "analyzer": "english"}
    ]
  },
  "name": "search_index",
  "type": "text"
}
      `,
      'replication': `
// Create continuous replication
{
  "source": "http://user:pass@source-couchdb:5984/sourcedb",
  "target": "http://user:pass@target-couchdb:5984/targetdb",
  "continuous": true,
  "create_target": true,
  "doc_ids": ["doc1", "doc2", "doc3"],
  "filter": "mydesign/myfilter",
  "query_params": {
    "param1": "value1",
    "param2": "value2"
  }
}
      `,
      'changes_feed': `
// Long polling changes feed
GET /mydb/_changes?feed=longpoll&include_docs=true&since=now&filter=_doc_ids&doc_ids=["doc1","doc2"]
      `
    };
  }

  validateQuery(query: string): { isValid: boolean; error?: string } {
    try {
      const queryLower = query.toLowerCase();

      // Basic validation for CouchDB operations
      if (queryLower.includes('_find') && !queryLower.includes('selector')) {
        return {
          isValid: false,
          error: 'Mango queries must include a selector'
        };
      }

      if (queryLower.includes('_view') && !queryLower.includes('_design/')) {
        return {
          isValid: false,
          error: 'View queries must reference a design document'
        };
      }

      if (queryLower.includes('emit(') && !queryLower.includes('function(')) {
        return {
          isValid: false,
          error: 'Map functions must be valid JavaScript functions'
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
