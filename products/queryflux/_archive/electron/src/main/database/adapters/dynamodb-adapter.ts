/**
 * DynamoDB Adapter
 * AWS NoSQL database with provisioned and on-demand capacity
 */

import { DatabaseAdapter, DatabaseConnection, QueryResult, DatabaseSchema, TableInfo, ColumnInfo } from '../types';

interface DynamoDBConfig extends DatabaseConnection {
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
  endpoint?: string;
  maxRetries?: number;
  retryDelayOptions?: any;
  sslEnabled?: boolean;
  logger?: any;
}

interface TableDescription {
  TableName: string;
  TableStatus: string;
  CreationDateTime: Date;
  ProvisionedThroughput?: {
    ReadCapacityUnits: number;
    WriteCapacityUnits: number;
    NumberOfDecreasesToday: number;
  };
  BillingModeSummary?: {
    BillingMode: 'PAY_PER_REQUEST' | 'PROVISIONED';
    LastUpdateToPayPerRequestDateTime: Date;
  };
  ItemCount: number;
  TableSizeBytes: number;
  TableArn: string;
  KeySchema: Array<{
    AttributeName: string;
    KeyType: 'HASH' | 'RANGE';
  }>;
  AttributeDefinitions: Array<{
    AttributeName: string;
    AttributeType: 'S' | 'N' | 'B';
  }>;
  GlobalSecondaryIndexes?: Array<{
    IndexName: string;
    KeySchema: Array<{
      AttributeName: string;
      KeyType: 'HASH' | 'RANGE';
    }>;
    Projection: {
      ProjectionType: 'ALL' | 'KEYS_ONLY' | 'INCLUDE';
      NonKeyAttributes?: string[];
    };
    ProvisionedThroughput?: {
      ReadCapacityUnits: number;
      WriteCapacityUnits: number;
    };
  }>;
  LocalSecondaryIndexes?: Array<{
    IndexName: string;
    KeySchema: Array<{
      AttributeName: string;
      KeyType: 'HASH' | 'RANGE';
    }>;
    Projection: {
      ProjectionType: 'ALL' | 'KEYS_ONLY' | 'INCLUDE';
      NonKeyAttributes?: string[];
    };
  }>;
}

interface AttributeValue {
  S?: string;
  N?: string;
  B?: Buffer;
  SS?: string[];
  NS?: string[];
  BS?: Buffer[];
  M?: Record<string, AttributeValue>;
  L?: AttributeValue[];
  NULL?: boolean;
  BOOL?: boolean;
}

export class DynamoDBAdapter implements DatabaseAdapter {
  private config: DynamoDBConfig;
  private client: any = null; // DynamoDB client
  private documentClient: any = null; // DynamoDB Document Client

  constructor(config: DynamoDBConfig) {
    this.config = {
      region: 'us-east-1',
      sslEnabled: true,
      maxRetries: 3,
      ...config
    };
  }

  async connect(): Promise<void> {
    try {
      // In a real implementation, use @aws-sdk/client-dynamodb
      // const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
      // const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      //
      // const clientConfig = {
      //   region: this.config.region,
      //   sslEnabled: this.config.sslEnabled,
      //   maxRetries: this.config.maxRetries
      // };
      //
      // // Add credentials if provided
      // if (this.config.accessKeyId && this.config.secretAccessKey) {
      //   clientConfig.credentials = {
      //     accessKeyId: this.config.accessKeyId,
      //     secretAccessKey: this.config.secretAccessKey,
      //     sessionToken: this.config.sessionToken
      //   };
      // }
      //
      // // Add custom endpoint if provided
      // if (this.config.endpoint) {
      //   clientConfig.endpoint = this.config.endpoint;
      // }
      //
      // this.client = new DynamoDBClient(clientConfig);
      // this.documentClient = DynamoDBDocumentClient.from(this.client);
      //
      // // Test connection
      // await this.client.send(new ListTablesCommand({}));

      console.log(`Connected to DynamoDB in region ${this.config.region}`);
    } catch (error) {
      throw new Error(`DynamoDB connection failed: ${error}`);
    }
  }

  async disconnect(): Promise<void> {
    this.client = null;
    this.documentClient = null;
  }

  async testConnection(): Promise<boolean> {
    try {
      if (!this.client) {
        await this.connect();
      }

      // In a real implementation:
      // const { ListTablesCommand } = require('@aws-sdk/client-dynamodb');
      // await this.client.send(new ListTablesCommand({}));
      return true;
    } catch (error) {
      console.error('DynamoDB connection test failed:', error);
      return false;
    }
  }

  async executeQuery(query: string, params?: any[]): Promise<QueryResult> {
    if (!this.client) {
      throw new Error('Not connected to DynamoDB');
    }

    const start = Date.now();

    try {
      let result: any;
      const queryLower = query.toLowerCase();

      // Parse different types of DynamoDB operations
      if (queryLower.includes('scan')) {
        result = await this.executeScanQuery(query, params);
      } else if (queryLower.includes('query') && queryLower.includes('keycondition')) {
        result = await this.executeDynamoDBQuery(query, params);
      } else if (queryLower.includes('put') || queryLower.includes('insert')) {
        result = await this.executePutQuery(query, params);
      } else if (queryLower.includes('update')) {
        result = await this.executeUpdateQuery(query, params);
      } else if (queryLower.includes('delete')) {
        result = await this.executeDeleteQuery(query, params);
      } else if (queryLower.includes('batch') || queryLower.includes('transact')) {
        result = await this.executeBatchQuery(query, params);
      } else {
        // Default to scan
        result = await this.executeScanQuery(query, params);
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
    if (!this.client) {
      throw new Error('Not connected to DynamoDB');
    }

    try {
      const tables = await this.listTables();
      const tableInfos: TableInfo[] = [];

      for (const tableName of tables) {
        const tableDesc = await this.describeTable(tableName);
        const columns: ColumnInfo[] = [];

        // Add key attributes
        tableDesc.KeySchema?.forEach(key => {
          const attrDef = tableDesc.AttributeDefinitions?.find(
            attr => attr.AttributeName === key.AttributeName
          );
          if (attrDef) {
            columns.push({
              name: `${key.AttributeName} (${key.KeyType})`,
              type: this.getAttributeTypeString(attrDef.AttributeType),
              nullable: false,
              defaultValue: undefined
            });
          }
        });

        // Add other attributes from a sample scan
        try {
          const sampleResult = await this.executeScanQuery(tableName, [], { limit: 1 });
          if (sampleResult.rows.length > 0) {
            const sampleItem = sampleResult.rows[0];
            Object.keys(sampleItem).forEach(attrName => {
              if (!columns.find(col => col.name.includes(attrName))) {
                const attrValue = sampleItem[attrName];
                const type = this.inferAttributeType(attrValue);
                columns.push({
                  name: attrName,
                  type,
                  nullable: true,
                  defaultValue: undefined
                });
              }
            });
          }
        } catch (error) {
          // Ignore scan errors for schema discovery
        }

        tableInfos.push({
          name: tableName,
          schema: 'dynamodb',
          type: 'TABLE',
          rowEstimate: tableDesc.ItemCount,
          size: tableDesc.TableSizeBytes,
          columns
        });
      }

      return {
        name: 'DynamoDB',
        tables: tableInfos,
        functions: this.getDynamoDBFunctions(),
        procedures: this.getDynamoDBProcedures()
      };
    } catch (error) {
      throw new Error(`Schema retrieval failed: ${error}`);
    }
  }

  // DynamoDB specific methods

  async listTables(): Promise<string[]> {
    // In a real implementation:
    // const { ListTablesCommand } = require('@aws-sdk/client-dynamodb');
    // const result = await this.client.send(new ListTablesCommand({}));
    // return result.TableNames || [];

    // Simulate table names
    return ['Users', 'Products', 'Orders', 'Sessions', 'AuditLogs'];
  }

  async describeTable(tableName: string): Promise<TableDescription> {
    // In a real implementation:
    // const { DescribeTableCommand } = require('@aws-sdk/client-dynamodb');
    // const result = await this.client.send(new DescribeTableCommand({ TableName: tableName }));
    // return result.Table;

    // Simulate table description
    return {
      TableName: tableName,
      TableStatus: 'ACTIVE',
      CreationDateTime: new Date('2023-01-01T00:00:00Z'),
      ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5,
        NumberOfDecreasesToday: 0
      },
      ItemCount: Math.floor(Math.random() * 10000),
      TableSizeBytes: Math.floor(Math.random() * 1000000),
      TableArn: `arn:aws:dynamodb:${this.config.region}:123456789012:table/${tableName}`,
      KeySchema: [
        { AttributeName: 'id', KeyType: 'HASH' }
      ],
      AttributeDefinitions: [
        { AttributeName: 'id', AttributeType: 'S' }
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: `${tableName}Index`,
          KeySchema: [
            { AttributeName: 'type', KeyType: 'HASH' }
          ],
          Projection: {
            ProjectionType: 'ALL'
          },
          ProvisionedThroughput: {
            ReadCapacityUnits: 5,
            WriteCapacityUnits: 5
          }
        }
      ]
    };
  }

  async createTable(
    tableName: string,
    keySchema: Array<{ AttributeName: string; KeyType: 'HASH' | 'RANGE' }>,
    attributeDefinitions: Array<{ AttributeName: string; AttributeType: 'S' | 'N' | 'B' }>,
    billingMode: 'PAY_PER_REQUEST' | 'PROVISIONED' = 'PROVISIONED',
    provisionedThroughput?: { ReadCapacityUnits: number; WriteCapacityUnits: number },
    globalSecondaryIndexes?: any[]
  ): Promise<void> {
    const createParams: any = {
      TableName: tableName,
      KeySchema: keySchema,
      AttributeDefinitions: attributeDefinitions,
      BillingMode: billingMode
    };

    if (billingMode === 'PROVISIONED' && provisionedThroughput) {
      createParams.ProvisionedThroughput = provisionedThroughput;
    }

    if (globalSecondaryIndexes) {
      createParams.GlobalSecondaryIndexes = globalSecondaryIndexes;
    }

    // In a real implementation:
    // const { CreateTableCommand } = require('@aws-sdk/client-dynamodb');
    // await this.client.send(new CreateTableCommand(createParams));
  }

  async deleteTable(tableName: string): Promise<void> {
    // In a real implementation:
    // const { DeleteTableCommand } = require('@aws-sdk/client-dynamodb');
    // await this.client.send(new DeleteTableCommand({ TableName: tableName }));
  }

  async updateTable(tableName: string, updates: any): Promise<void> {
    // In a real implementation:
    // const { UpdateTableCommand } = require('@aws-sdk/client-dynamodb');
    // await this.client.send(new UpdateTableCommand({
    //   TableName: tableName,
    //   ...updates
    // }));
  }

  // CRUD operations

  async getItem(tableName: string, key: Record<string, any>): Promise<any> {
    // In a real implementation:
    // const command = new GetCommand({
    //   TableName: tableName,
    //   Key: key
    // });
    // return await this.documentClient.send(command);

    // Simulate get item
    return {
      id: key.id,
      data: 'sample data',
      createdAt: new Date().toISOString()
    };
  }

  async putItem(tableName: string, item: Record<string, any>): Promise<any> {
    // In a real implementation:
    // const command = new PutCommand({
    //   TableName: tableName,
    //   Item: item
    // });
    // return await this.documentClient.send(command);
  }

  async updateItem(
    tableName: string,
    key: Record<string, any>,
    updateExpression: string,
    expressionAttributeValues?: Record<string, any>,
    expressionAttributeNames?: Record<string, string>
  ): Promise<any> {
    // In a real implementation:
    // const command = new UpdateCommand({
    //   TableName: tableName,
    //   Key: key,
    //   UpdateExpression: updateExpression,
    //   ExpressionAttributeValues: expressionAttributeValues,
    //   ExpressionAttributeNames: expressionAttributeNames
    // });
    // return await this.documentClient.send(command);
  }

  async deleteItem(tableName: string, key: Record<string, any>): Promise<any> {
    // In a real implementation:
    // const command = new DeleteCommand({
    //   TableName: tableName,
    //   Key: key
    // });
    // return await this.documentClient.send(command);
  }

  // Query operations

  async query(
    tableName: string,
    keyConditionExpression: string,
    filterExpression?: string,
    expressionAttributeValues?: Record<string, any>,
    expressionAttributeNames?: Record<string, string>,
    indexName?: string,
    limit?: number,
    exclusiveStartKey?: any
  ): Promise<QueryResult> {
    const queryParams: any = {
      TableName: tableName,
      KeyConditionExpression: keyConditionExpression
    };

    if (filterExpression) {
      queryParams.FilterExpression = filterExpression;
    }

    if (expressionAttributeValues) {
      queryParams.ExpressionAttributeValues = expressionAttributeValues;
    }

    if (expressionAttributeNames) {
      queryParams.ExpressionAttributeNames = expressionAttributeNames;
    }

    if (indexName) {
      queryParams.IndexName = indexName;
    }

    if (limit) {
      queryParams.Limit = limit;
    }

    if (exclusiveStartKey) {
      queryParams.ExclusiveStartKey = exclusiveStartKey;
    }

    // In a real implementation:
    // const { QueryCommand } = require('@aws-sdk/client-dynamodb');
    // const result = await this.client.send(new QueryCommand(queryParams));
    // return this.formatQueryResult(result);

    // Simulate query result
    return {
      rows: [
        {
          id: 'item1',
          type: 'user',
          createdAt: '2023-12-01T10:00:00Z',
          data: 'sample data 1'
        },
        {
          id: 'item2',
          type: 'user',
          createdAt: '2023-12-01T11:00:00Z',
          data: 'sample data 2'
        }
      ],
      rowCount: 2,
      columns: [
        { name: 'id', type: 'string', nullable: false },
        { name: 'type', type: 'string', nullable: false },
        { name: 'createdAt', type: 'string', nullable: false },
        { name: 'data', type: 'string', nullable: true }
      ]
    };
  }

  async scan(
    tableName: string,
    filterExpression?: string,
    expressionAttributeValues?: Record<string, any>,
    expressionAttributeNames?: Record<string, string>,
    limit?: number,
    exclusiveStartKey?: any
  ): Promise<QueryResult> {
    const scanParams: any = {
      TableName: tableName
    };

    if (filterExpression) {
      scanParams.FilterExpression = filterExpression;
    }

    if (expressionAttributeValues) {
      scanParams.ExpressionAttributeValues = expressionAttributeValues;
    }

    if (expressionAttributeNames) {
      scanParams.ExpressionAttributeNames = expressionAttributeNames;
    }

    if (limit) {
      scanParams.Limit = limit;
    }

    if (exclusiveStartKey) {
      scanParams.ExclusiveStartKey = exclusiveStartKey;
    }

    // In a real implementation:
    // const { ScanCommand } = require('@aws-sdk/client-dynamodb');
    // const result = await this.client.send(new ScanCommand(scanParams));
    // return this.formatQueryResult(result);

    // Simulate scan result
    return {
      rows: [
        {
          id: 'scan1',
          category: 'electronics',
          price: 299.99,
          inStock: true,
          attributes: {
            color: 'black',
            brand: 'SampleBrand'
          }
        },
        {
          id: 'scan2',
          category: 'books',
          price: 19.99,
          inStock: true,
          attributes: {
            author: 'Sample Author',
            pages: 300
          }
        }
      ],
      rowCount: 2,
      columns: [
        { name: 'id', type: 'string', nullable: false },
        { name: 'category', type: 'string', nullable: false },
        { name: 'price', type: 'number', nullable: false },
        { name: 'inStock', type: 'boolean', nullable: false },
        { name: 'attributes', type: 'object', nullable: true }
      ]
    };
  }

  // Batch operations

  async batchGet(tableName: string, keys: Record<string, any>[]): Promise<any> {
    const params = {
      RequestItems: {
        [tableName]: {
          Keys: keys
        }
      }
    };

    // In a real implementation:
    // const { BatchGetCommand } = require('@aws-sdk/client-dynamodb');
    // return await this.client.send(new BatchGetCommand(params));
  }

  async batchWrite(tableName: string, requests: any[]): Promise<any> {
    const params = {
      RequestItems: {
        [tableName]: requests
      }
    };

    // In a real implementation:
    // const { BatchWriteCommand } = require('@aws-sdk/client-dynamodb');
    // return await this.client.send(new BatchWriteCommand(params));
  }

  // Transaction operations

  async transactGet(requests: any[]): Promise<any> {
    const params = {
      TransactItems: requests
    };

    // In a real implementation:
    // const { TransactGetCommand } = require('@aws-sdk/client-dynamodb');
    // return await this.client.send(new TransactGetCommand(params));
  }

  async transactWrite(requests: any[]): Promise<any> {
    const params = {
      TransactItems: requests
    };

    // In a real implementation:
    // const { TransactWriteCommand } = require('@aws-sdk/client-dynamodb');
    // return await this.client.send(new TransactWriteCommand(params));
  }

  // Query execution helpers

  private async executeScanQuery(query: string, params?: any[], options?: any): Promise<QueryResult> {
    // Simulate scan with query string parsing
    const tableName = this.extractTableNameFromQuery(query);
    return this.scan(tableName, undefined, undefined, undefined, options?.limit);
  }

  private async executeDynamoDBQuery(query: string, params?: any[]): Promise<QueryResult> {
    // Simulate query with query string parsing
    const tableName = this.extractTableNameFromQuery(query);
    return this.query(tableName, 'id = :id', undefined, { ':id': 'sample' });
  }

  private async executePutQuery(query: string, params?: any[]): Promise<QueryResult> {
    return {
      rows: [{ result: 'item_put' }],
      rowCount: 1,
      columns: [{ name: 'result', type: 'string', nullable: false }]
    };
  }

  private async executeUpdateQuery(query: string, params?: any[]): Promise<QueryResult> {
    return {
      rows: [{ result: 'item_updated' }],
      rowCount: 1,
      columns: [{ name: 'result', type: 'string', nullable: false }]
    };
  }

  private async executeDeleteQuery(query: string, params?: any[]): Promise<QueryResult> {
    return {
      rows: [{ result: 'item_deleted' }],
      rowCount: 1,
      columns: [{ name: 'result', type: 'string', nullable: false }]
    };
  }

  private async executeBatchQuery(query: string, params?: any[]): Promise<QueryResult> {
    return {
      rows: [{ result: 'batch_operation_completed' }],
      rowCount: 1,
      columns: [{ name: 'result', type: 'string', nullable: false }]
    };
  }

  private extractTableNameFromQuery(query: string): string {
    // Simple extraction - in real implementation would be more sophisticated
    const match = query.match(/table["\']?(\w+)["\']?/i);
    return match ? match[1] : 'default_table';
  }

  private getAttributeTypeString(type: 'S' | 'N' | 'B'): string {
    switch (type) {
      case 'S': return 'string';
      case 'N': return 'number';
      case 'B': return 'binary';
      default: return 'unknown';
    }
  }

  private inferAttributeType(value: any): string {
    if (typeof value === 'string') return 'string';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object' && value !== null) return 'object';
    return 'unknown';
  }

  // Management operations

  async getTableMetrics(tableName: string): Promise<any> {
    // In a real implementation, use CloudWatch metrics
    return {
      tableName,
      readCapacity: 5,
      writeCapacity: 5,
      consumedReadCapacity: 2.3,
      consumedWriteCapacity: 1.7,
      throttledRequests: 0,
      systemErrors: 0,
      latency: {
        read: 5.2,
        write: 8.1
      }
    };
  }

  async enableTTL(tableName: string, attributeName: string): Promise<void> {
    const params = {
      TableName: tableName,
      TimeToLiveSpecification: {
        Enabled: true,
        AttributeName: attributeName
      }
    };

    // In a real implementation:
    // const { UpdateTimeToLiveCommand } = require('@aws-sdk/client-dynamodb');
    // await this.client.send(new UpdateTimeToLiveCommand(params));
  }

  async createBackup(tableName: string, backupName: string): Promise<string> {
    // In a real implementation:
    // const { CreateBackupCommand } = require('@aws-sdk/client-dynamodb');
    // const result = await this.client.send(new CreateBackupCommand({
    //   TableName: tableName,
    //   BackupName: backupName
    // }));
    // return result.BackupDetails.BackupArn;

    return `arn:aws:dynamodb:${this.config.region}:123456789012:table/${tableName}/backup/${backupName}`;
  }

  getDynamoDBFunctions(): any[] {
    return [
      { name: 'attribute_exists', category: 'Condition', description: 'Check if attribute exists' },
      { name: 'attribute_not_exists', category: 'Condition', description: 'Check if attribute does not exist' },
      { name: 'attribute_type', category: 'Condition', description: 'Check attribute type' },
      { name: 'begins_with', category: 'Condition', description: 'Check if attribute begins with value' },
      { name: 'contains', category: 'Condition', description: 'Check if attribute contains value' },
      { name: 'size', category: 'Function', description: 'Get size of attribute' },
      { name: 'if_not_exists', category: 'Function', description: 'Use value if attribute does not exist' },
      { name: 'list_append', category: 'Function', description: 'Append lists' }
    ];
  }

  getDynamoDBProcedures(): any[] {
    return [
      { name: 'CreateTable', category: 'DDL', description: 'Create new table' },
      { name: 'DeleteTable', category: 'DDL', description: 'Delete table' },
      { name: 'UpdateTable', category: 'DDL', description: 'Update table configuration' },
      { name: 'DescribeTable', category: 'DML', description: 'Get table information' },
      { name: 'ListTables', category: 'DML', description: 'List all tables' },
      { name: 'PutItem', category: 'DML', description: 'Insert or replace item' },
      { name: 'GetItem', category: 'DML', description: 'Retrieve item by key' },
      { name: 'UpdateItem', category: 'DML', description: 'Update existing item' },
      { name: 'DeleteItem', category: 'DML', description: 'Delete item by key' },
      { name: 'Query', category: 'DML', description: 'Query items by key conditions' },
      { name: 'Scan', category: 'DML', description: 'Scan all items in table' },
      { name: 'BatchGetItem', category: 'Batch', description: 'Retrieve multiple items' },
      { name: 'BatchWriteItem', category: 'Batch', description: 'Write multiple items' },
      { name: 'TransactGetItems', category: 'Transaction', description: 'Transactional get' },
      { name: 'TransactWriteItems', category: 'Transaction', description: 'Transactional write' },
      { name: 'CreateBackup', category: 'Backup', description: 'Create table backup' },
      { name: 'DeleteBackup', category: 'Backup', description: 'Delete table backup' },
      { name: 'RestoreTableFromBackup', category: 'Backup', description: 'Restore from backup' },
      { name: 'DescribeBackup', category: 'Backup', description: 'Get backup information' },
      { name: 'ListBackups', category: 'Backup', description: 'List all backups' },
      { name: 'UpdateTimeToLive', category: 'TTL', description: 'Configure TTL' },
      { name: 'DescribeTimeToLive', category: 'TTL', description: 'Get TTL configuration' }
    ];
  }

  getHelperTemplates(): Record<string, string> {
    return {
      'create_table': `
// Create a table with composite key and GSI
{
  "TableName": "Orders",
  "KeySchema": [
    { "AttributeName": "customerId", "KeyType": "HASH" },
    { "AttributeName": "orderId", "KeyType": "RANGE" }
  ],
  "AttributeDefinitions": [
    { "AttributeName": "customerId", "AttributeType": "S" },
    { "AttributeName": "orderId", "AttributeType": "S" },
    { "AttributeName": "status", "AttributeType": "S" },
    { "AttributeName": "orderDate", "AttributeType": "S" }
  ],
  "GlobalSecondaryIndexes": [
    {
      "IndexName": "OrdersByStatus",
      "KeySchema": [
        { "AttributeName": "status", "KeyType": "HASH" }
      ],
      "Projection": { "ProjectionType": "ALL" },
      "ProvisionedThroughput": {
        "ReadCapacityUnits": 5,
        "WriteCapacityUnits": 5
      }
    }
  ],
  "BillingMode": "PROVISIONED",
  "ProvisionedThroughput": {
    "ReadCapacityUnits": 10,
    "WriteCapacityUnits": 5
  }
}
      `,
      'put_item': `
// Insert or replace an item
{
  "TableName": "Users",
  "Item": {
    "userId": "user123",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "createdAt": "2023-12-01T10:00:00Z",
    "profile": {
      "age": 30,
      "preferences": ["sports", "technology"],
      "premium": true
    }
  }
}
      `,
      'query_items': `
// Query items with key conditions and filters
{
  "TableName": "Orders",
  "IndexName": "OrdersByStatus",
  "KeyConditionExpression": "#status = :status",
  "FilterExpression": "#orderDate >= :startDate",
  "ExpressionAttributeNames": {
    "#status": "status",
    "#orderDate": "orderDate"
  },
  "ExpressionAttributeValues": {
    ":status": "completed",
    ":startDate": "2023-12-01T00:00:00Z"
  },
  "Limit": 50,
  "ScanIndexForward": false
}
      `,
      'update_item': `
// Update item with conditional expression
{
  "TableName": "Users",
  "Key": { "userId": "user123" },
  "UpdateExpression": "SET #email = :email, #lastLogin = :login, #visits = if_not_exists(#visits, :zero) + :inc",
  "ConditionExpression": "attribute_exists(userId)",
  "ExpressionAttributeNames": {
    "#email": "email",
    "#lastLogin": "lastLogin",
    "#visits": "visits"
  },
  "ExpressionAttributeValues": {
    ":email": "newemail@example.com",
    ":login": "2023-12-01T10:00:00Z",
    ":zero": 0,
    ":inc": 1
  },
  "ReturnValues": "ALL_NEW"
}
      `,
      'scan_with_filter': `
// Scan table with complex filter
{
  "TableName": "Products",
  "FilterExpression": "#category IN (:categories) AND #price BETWEEN :min AND :max",
  "ExpressionAttributeNames": {
    "#category": "category",
    "#price": "price"
  },
  "ExpressionAttributeValues": {
    ":categories": ["electronics", "computers"],
    ":min": 100,
    ":max": 1000
  },
  "ProjectionExpression": "id, name, price, #category, attributes.brand",
  "Limit": 100
}
      `,
      'batch_operations': `
// Batch write multiple operations
{
  "RequestItems": {
    "Orders": [
      {
        "PutRequest": {
          "Item": {
            "customerId": "cust123",
            "orderId": "order456",
            "status": "pending",
            "total": 299.99
          }
        }
      },
      {
        "DeleteRequest": {
          "Key": {
            "customerId": "cust789",
            "orderId": "order012"
          }
        }
      }
    ]
  }
}
      `,
      'transaction': `
// Transactional write with conditions
{
  "TransactItems": [
    {
      "Update": {
        "TableName": "Accounts",
        "Key": { "accountId": "acc123" },
        "UpdateExpression": "SET #balance = #balance - :amount",
        "ConditionExpression": "#balance >= :amount",
        "ExpressionAttributeNames": { "#balance": "balance" },
        "ExpressionAttributeValues": { ":amount": 100 }
      }
    },
    {
      "Update": {
        "TableName": "Accounts",
        "Key": { "accountId": "acc456" },
        "UpdateExpression": "SET #balance = #balance + :amount",
        "ExpressionAttributeNames": { "#balance": "balance" },
        "ExpressionAttributeValues": { ":amount": 100 }
      }
    }
  ]
}
      `,
      'enable_ttl': `
// Enable TTL on table
{
  "TableName": "Sessions",
  "TimeToLiveSpecification": {
    "Enabled": true,
    "AttributeName": "expiresAt"
  }
}
      `
    };
  }

  validateQuery(query: string): { isValid: boolean; error?: string } {
    try {
      const queryLower = query.toLowerCase();

      // Basic validation for DynamoDB operations
      if (queryLower.includes('updateexpression') && !queryLower.includes('set')) {
        return {
          isValid: false,
          error: 'UpdateExpression must include a SET clause'
        };
      }

      if (queryLower.includes('keyconditionexpression') && !queryLower.includes('expressionattributevalues')) {
        return {
          isValid: false,
          error: 'KeyConditionExpression requires ExpressionAttributeValues'
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
