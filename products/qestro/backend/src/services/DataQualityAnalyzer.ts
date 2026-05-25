import { logger } from '../utils/logger.js';
import { connectionPoolManager } from './ConnectionPoolManager.js';
import { dataValidationEngine } from './DataValidationEngine.js';

export interface DataProfileResult {
  tableName: string;
  columnName: string;
  dataType: string;
  totalRows: number;
  nullCount: number;
  uniqueCount: number;
  duplicateCount: number;
  minValue?: any;
  maxValue?: any;
  avgValue?: number;
  stdDeviation?: number;
  commonValues: Array<{ value: any; count: number; percentage: number }>;
  nullPercentage: number;
  uniquenessPercentage: number;
  dataQualityScore: number;
  anomalies: string[];
  recommendations: string[];
}

export interface TableAnalysisResult {
  tableName: string;
  totalRows: number;
  totalColumns: number;
  primaryKey?: string;
  foreignKeys: Array<{ column: string; referencedTable: string; referencedColumn: string }>;
  indexes: Array<{ name: string; columns: string[]; unique: boolean }>;
  constraints: Array<{ name: string; type: string; definition: string }>;
  dataProfiles: DataProfileResult[];
  relationships: Array<{ type: 'one-to-one' | 'one-to-many' | 'many-to-many'; relatedTable: string; confidence: number }>;
  qualityIssues: Array<{ severity: 'low' | 'medium' | 'high' | 'critical'; issue: string; recommendation: string }>;
  overallQualityScore: number;
}

export interface DatabaseAnalysisResult {
  connectionId: string;
  databaseType: string;
  databaseName: string;
  analysisTimestamp: Date;
  analysisVersion: string;
  totalTables: number;
  totalColumns: number;
  totalRows: number;
  dataSize: number; // in bytes
  tables: TableAnalysisResult[];
  crossTableAnalysis: {
    referentialIntegrityIssues: Array<{ fromTable: string; toTable: string; issue: string }>;
    dataConsistencyIssues: Array<{ tables: string[]; issue: string; severity: string }>;
    performanceIssues: Array<{ type: string; description: string; recommendation: string }>;
  };
  overallQualityScore: number;
  recommendations: string[];
  executionTime: number;
}

export interface DataLineageNode {
  id: string;
  type: 'table' | 'column' | 'view' | 'procedure' | 'function';
  name: string;
  schema?: string;
  dataType?: string;
  description?: string;
}

export interface DataLineageEdge {
  from: string;
  to: string;
  type: 'references' | 'derives' | 'uses' | 'updates';
  strength: number; // 0-1, how strong the relationship is
  description?: string;
}

export interface DataLineageGraph {
  nodes: DataLineageNode[];
  edges: DataLineageEdge[];
  impactAnalysis: {
    upstreamTables: string[];
    downstreamTables: string[];
    affectedColumns: string[];
    riskLevel: 'low' | 'medium' | 'high';
  };
}

export class DataQualityAnalyzer {
  private readonly MAX_SAMPLE_SIZE = 10000;
  private readonly MIN_CONFIDENCE_THRESHOLD = 0.7;

  async analyzeDatabase(connectionId: string, options?: {
    includeProfiling?: boolean;
    includeLineage?: boolean;
    sampleSize?: number;
    tables?: string[];
  }): Promise<DatabaseAnalysisResult> {
    const startTime = performance.now();

    logger.info(`Starting comprehensive database analysis for connection: ${connectionId}`);

    try {
      const connection = await connectionPoolManager.getConnection(connectionId);
      const config = connectionPoolManager.configs?.get(connectionId);

      if (!config) {
        throw new Error(`Configuration not found for connection ${connectionId}`);
      }

      // Get database metadata
      const databaseMetadata = await this.getDatabaseMetadata(connection, config.type);

      // Analyze tables
      const tablesToAnalyze = options?.tables || await this.getAllTableNames(connection, config.type);
      const tableAnalyses: TableAnalysisResult[] = [];

      for (const tableName of tablesToAnalyze) {
        try {
          const tableAnalysis = await this.analyzeTable(
            connection,
            tableName,
            config.type,
            options?.sampleSize || this.MAX_SAMPLE_SIZE,
            options?.includeProfiling !== false
          );
          tableAnalyses.push(tableAnalysis);
        } catch (error) {
          logger.error(`Failed to analyze table ${tableName}:`, error);
        }
      }

      // Perform cross-table analysis
      const crossTableAnalysis = await this.performCrossTableAnalysis(connection, config.type, tableAnalyses);

      // Calculate overall quality score
      const overallQualityScore = this.calculateOverallQualityScore(tableAnalyses);

      // Generate recommendations
      const recommendations = this.generateDatabaseRecommendations(tableAnalyses, crossTableAnalysis);

      const executionTime = performance.now() - startTime;

      const result: DatabaseAnalysisResult = {
        connectionId,
        databaseType: config.type,
        databaseName: config.database,
        analysisTimestamp: new Date(),
        analysisVersion: '1.0.0',
        totalTables: tableAnalyses.length,
        totalColumns: tableAnalyses.reduce((sum, t) => sum + t.totalColumns, 0),
        totalRows: tableAnalyses.reduce((sum, t) => sum + t.totalRows, 0),
        dataSize: databaseMetadata.dataSize || 0,
        tables: tableAnalyses,
        crossTableAnalysis,
        overallQualityScore,
        recommendations,
        executionTime
      };

      logger.info(`Database analysis completed for ${connectionId} in ${executionTime.toFixed(2)}ms`);
      return result;

    } catch (error) {
      logger.error(`Database analysis failed for ${connectionId}:`, error);
      throw error;
    } finally {
      await connectionPoolManager.releaseConnection(connectionId, null);
    }
  }

  async analyzeTable(
    connection: any,
    tableName: string,
    dbType: string,
    sampleSize: number = this.MAX_SAMPLE_SIZE,
    includeProfiling: boolean = true
  ): Promise<TableAnalysisResult> {
    logger.debug(`Analyzing table: ${tableName}`);

    try {
      // Get table metadata
      const tableMetadata = await this.getTableMetadata(connection, tableName, dbType);

      // Get column information
      const columns = await this.getColumnInformation(connection, tableName, dbType);

      // Get row count
      const totalRows = await this.getRowCount(connection, tableName, dbType);

      // Analyze each column if profiling is enabled
      const dataProfiles: DataProfileResult[] = [];
      if (includeProfiling) {
        for (const column of columns) {
          try {
            const profile = await this.analyzeColumn(
              connection,
              tableName,
              column.name,
              column.dataType,
              dbType,
              Math.min(sampleSize, totalRows)
            );
            dataProfiles.push(profile);
          } catch (error) {
            logger.warn(`Failed to profile column ${column.name} in ${tableName}:`, error);
          }
        }
      }

      // Analyze relationships
      const relationships = await this.analyzeTableRelationships(connection, tableName, dbType);

      // Identify quality issues
      const qualityIssues = this.identifyTableQualityIssues(tableMetadata, dataProfiles);

      // Calculate overall table quality score
      const overallQualityScore = this.calculateTableQualityScore(dataProfiles, qualityIssues);

      return {
        tableName,
        totalRows,
        totalColumns: columns.length,
        primaryKey: tableMetadata.primaryKey,
        foreignKeys: tableMetadata.foreignKeys,
        indexes: tableMetadata.indexes,
        constraints: tableMetadata.constraints,
        dataProfiles,
        relationships,
        qualityIssues,
        overallQualityScore
      };

    } catch (error) {
      logger.error(`Failed to analyze table ${tableName}:`, error);
      throw error;
    }
  }

  async analyzeColumn(
    connection: any,
    tableName: string,
    columnName: string,
    dataType: string,
    dbType: string,
    sampleSize: number
  ): Promise<DataProfileResult> {
    try {
      const queries = this.buildColumnAnalysisQueries(tableName, columnName, dataType, dbType, sampleSize);

      // Execute analysis queries
      const results = await Promise.all(
        queries.map(query => this.executeQuery(connection, query, dbType))
      );

      const [basicStats, nullStats, uniqueStats, valueDistribution] = results;

      const totalRows = basicStats[0]?.total_rows || 0;
      const nullCount = nullStats[0]?.null_count || 0;
      const uniqueCount = uniqueStats[0]?.unique_count || 0;
      const duplicateCount = totalRows - uniqueCount;

      const nullPercentage = totalRows > 0 ? (nullCount / totalRows) * 100 : 0;
      const uniquenessPercentage = totalRows > 0 ? (uniqueCount / totalRows) * 100 : 0;

      // Extract common values
      const commonValues = valueDistribution.slice(0, 10).map((row: any) => ({
        value: row.value,
        count: parseInt(row.count),
        percentage: totalRows > 0 ? (parseInt(row.count) / totalRows) * 100 : 0
      }));

      // Identify anomalies
      const anomalies = this.identifyColumnAnomalies({
        columnName,
        dataType,
        totalRows,
        nullCount,
        uniqueCount,
        nullPercentage,
        uniquenessPercentage,
        commonValues
      });

      // Generate recommendations
      const recommendations = this.generateColumnRecommendations({
        columnName,
        dataType,
        nullPercentage,
        uniquenessPercentage,
        anomalies
      });

      // Calculate data quality score
      const dataQualityScore = this.calculateColumnQualityScore({
        nullPercentage,
        uniquenessPercentage,
        dataType,
        anomalies
      });

      return {
        tableName,
        columnName,
        dataType,
        totalRows,
        nullCount,
        uniqueCount,
        duplicateCount,
        minValue: basicStats[0]?.min_value,
        maxValue: basicStats[0]?.max_value,
        avgValue: basicStats[0]?.avg_value,
        stdDeviation: basicStats[0]?.std_deviation,
        commonValues,
        nullPercentage,
        uniquenessPercentage,
        dataQualityScore,
        anomalies,
        recommendations
      };

    } catch (error) {
      logger.error(`Failed to analyze column ${columnName} in ${tableName}:`, error);
      throw error;
    }
  }

  async generateDataLineage(
    connectionId: string,
    tableName: string,
    depth: number = 3
  ): Promise<DataLineageGraph> {
    logger.info(`Generating data lineage for table ${tableName} with depth ${depth}`);

    try {
      const connection = await connectionPoolManager.getConnection(connectionId);
      const config = connectionPoolManager.configs?.get(connectionId);

      if (!config) {
        throw new Error(`Configuration not found for connection ${connectionId}`);
      }

      const nodes: DataLineageNode[] = [];
      const edges: DataLineageEdge[] = [];
      const visited = new Set<string>();
      const queue: Array<{ table: string; currentDepth: number }> = [{ table: tableName, currentDepth: 0 }];

      while (queue.length > 0 && queue[0].currentDepth < depth) {
        const { table, currentDepth } = queue.shift()!;

        if (visited.has(table)) continue;
        visited.add(table);

        // Add table node
        const tableNode: DataLineageNode = {
          id: table,
          type: 'table',
          name: table,
          schema: config.database
        };
        nodes.push(tableNode);

        // Get table columns
        const columns = await this.getColumnInformation(connection, table, config.type);

        // Add column nodes
        for (const column of columns) {
          const columnNode: DataLineageNode = {
            id: `${table}.${column.name}`,
            type: 'column',
            name: column.name,
            schema: table,
            dataType: column.dataType
          };
          nodes.push(columnNode);
        }

        // Find relationships (foreign keys)
        const foreignKeys = await this.getForeignKeyRelationships(connection, table, config.type);

        for (const fk of foreignKeys) {
          // Add edge for foreign key relationship
          const edge: DataLineageEdge = {
            from: `${table}.${fk.column}`,
            to: `${fk.referencedTable}.${fk.referencedColumn}`,
            type: 'references',
            strength: 1.0,
            description: `Foreign key reference`
          };
          edges.push(edge);

          // Add referenced table to queue
          if (currentDepth + 1 < depth) {
            queue.push({ table: fk.referencedTable, currentDepth: currentDepth + 1 });
          }
        }

        // Find tables that reference this table
        const referencingTables = await this.getReferencingTables(connection, table, config.type);

        for (const ref of referencingTables) {
          const edge: DataLineageEdge = {
            from: `${ref.table}.${ref.column}`,
            to: `${table}.${ref.referencedColumn}`,
            type: 'references',
            strength: 1.0,
            description: `Foreign key reference`
          };
          edges.push(edge);

          if (currentDepth + 1 < depth) {
            queue.push({ table: ref.table, currentDepth: currentDepth + 1 });
          }
        }
      }

      // Perform impact analysis
      const impactAnalysis = this.performImpactAnalysis(tableName, nodes, edges);

      return {
        nodes,
        edges,
        impactAnalysis
      };

    } catch (error) {
      logger.error(`Failed to generate data lineage for ${tableName}:`, error);
      throw error;
    } finally {
      await connectionPoolManager.releaseConnection(connectionId, null);
    }
  }

  private async getDatabaseMetadata(connection: any, dbType: string): Promise<{ dataSize?: number }> {
    // Implementation depends on database type
    return { dataSize: 0 };
  }

  private async getAllTableNames(connection: any, dbType: string): Promise<string[]> {
    let query: string;

    switch (dbType) {
      case 'postgresql':
        query = "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'";
        break;
      case 'mysql':
        query = "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE()";
        break;
      case 'mongodb':
        // For MongoDB, get collection names
        return await connection.listCollections().toArray().then((collections: any[]) =>
          collections.map(c => c.name)
        );
      default:
        throw new Error(`Unsupported database type: ${dbType}`);
    }

    const result = await this.executeQuery(connection, query, dbType);
    return result.map((row: any) => row.table_name);
  }

  private async getTableMetadata(connection: any, tableName: string, dbType: string): Promise<any> {
    // Get primary key, foreign keys, indexes, constraints
    const metadata = {
      primaryKey: undefined,
      foreignKeys: [],
      indexes: [],
      constraints: []
    };

    // Implementation would vary by database type
    return metadata;
  }

  private async getColumnInformation(connection: any, tableName: string, dbType: string): Promise<Array<{ name: string; dataType: string }>> {
    let query: string;

    switch (dbType) {
      case 'postgresql':
        query = `
          SELECT column_name as name, data_type as dataType
          FROM information_schema.columns
          WHERE table_name = '${tableName}'
          ORDER BY ordinal_position
        `;
        break;
      case 'mysql':
        query = `
          SELECT column_name as name, data_type as dataType
          FROM information_schema.columns
          WHERE table_name = '${tableName}' AND table_schema = DATABASE()
          ORDER BY ordinal_position
        `;
        break;
      case 'mongodb':
        // For MongoDB, we'd need to sample documents to infer schema
        return [{ name: '_id', dataType: 'ObjectId' }];
      default:
        throw new Error(`Unsupported database type: ${dbType}`);
    }

    return await this.executeQuery(connection, query, dbType);
  }

  private async getRowCount(connection: any, tableName: string, dbType: string): Promise<number> {
    let query: string;

    switch (dbType) {
      case 'postgresql':
      case 'mysql':
        query = `SELECT COUNT(*) as count FROM ${tableName}`;
        break;
      case 'mongodb':
        return await connection.collection(tableName).countDocuments();
      default:
        throw new Error(`Unsupported database type: ${dbType}`);
    }

    const result = await this.executeQuery(connection, query, dbType);
    return parseInt(result[0]?.count || 0);
  }

  private buildColumnAnalysisQueries(
    tableName: string,
    columnName: string,
    dataType: string,
    dbType: string,
    sampleSize: number
  ): string[] {
    const queries: string[] = [];

    switch (dbType) {
      case 'postgresql':
      case 'mysql':
        // Basic statistics
        if (this.isNumericType(dataType)) {
          queries.push(`
            SELECT
              COUNT(*) as total_rows,
              MIN(${columnName}) as min_value,
              MAX(${columnName}) as max_value,
              AVG(${columnName}) as avg_value,
              STDDEV(${columnName}) as std_deviation
            FROM ${tableName}
          `);
        } else {
          queries.push(`
            SELECT
              COUNT(*) as total_rows,
              MIN(${columnName}) as min_value,
              MAX(${columnName}) as max_value
            FROM ${tableName}
          `);
        }

        // Null count
        queries.push(`
          SELECT COUNT(*) as null_count
          FROM ${tableName}
          WHERE ${columnName} IS NULL
        `);

        // Unique count
        queries.push(`
          SELECT COUNT(DISTINCT ${columnName}) as unique_count
          FROM ${tableName}
        `);

        // Value distribution
        queries.push(`
          SELECT ${columnName} as value, COUNT(*) as count
          FROM ${tableName}
          WHERE ${columnName} IS NOT NULL
          GROUP BY ${columnName}
          ORDER BY count DESC
          LIMIT 20
        `);
        break;

      default:
        throw new Error(`Unsupported database type: ${dbType}`);
    }

    return queries;
  }

  private async executeQuery(connection: any, query: string, dbType: string): Promise<any[]> {
    switch (dbType) {
      case 'postgresql':
        const pgResult = await connection.query(query);
        return pgResult.rows;
      case 'mysql':
        const [mysqlRows] = await connection.execute(query);
        return mysqlRows as any[];
      default:
        throw new Error(`Unsupported database type: ${dbType}`);
    }
  }

  private isNumericType(dataType: string): boolean {
    const numericTypes = ['integer', 'int', 'bigint', 'decimal', 'numeric', 'float', 'double', 'real'];
    return numericTypes.some(type => dataType.toLowerCase().includes(type));
  }

  private identifyColumnAnomalies(data: any): string[] {
    const anomalies: string[] = [];

    // High null percentage
    if (data.nullPercentage > 50) {
      anomalies.push(`High null percentage (${data.nullPercentage.toFixed(2)}%)`);
    }

    // Low uniqueness for potential ID columns
    if (data.columnName.toLowerCase().includes('id') && data.uniquenessPercentage < 95) {
      anomalies.push(`ID column with low uniqueness (${data.uniquenessPercentage.toFixed(2)}%)`);
    }

    // Single value dominance
    if (data.commonValues.length > 0 && data.commonValues[0].percentage > 90) {
      anomalies.push(`Single value dominance: ${data.commonValues[0].value} (${data.commonValues[0].percentage.toFixed(2)}%)`);
    }

    return anomalies;
  }

  private generateColumnRecommendations(data: any): string[] {
    const recommendations: string[] = [];

    if (data.nullPercentage > 20) {
      recommendations.push(`Consider adding NOT NULL constraint or default value for ${data.columnName}`);
    }

    if (data.uniquenessPercentage > 95 && !data.columnName.toLowerCase().includes('id')) {
      recommendations.push(`Consider adding unique constraint to ${data.columnName}`);
    }

    if (data.anomalies.length > 0) {
      recommendations.push(`Review data quality issues in ${data.columnName}`);
    }

    return recommendations;
  }

  private calculateColumnQualityScore(data: any): number {
    let score = 100;

    // Reduce score for high null percentage
    score -= Math.min(data.nullPercentage, 50);

    // Reduce score for anomalies
    score -= data.anomalies.length * 5;

    // Adjust for data type appropriateness
    if (data.dataType === 'text' && data.uniquenessPercentage < 10) {
      score -= 10;
    }

    return Math.max(0, Math.min(100, score));
  }

  private async performCrossTableAnalysis(connection: any, dbType: string, tables: TableAnalysisResult[]): Promise<any> {
    return {
      referentialIntegrityIssues: [],
      dataConsistencyIssues: [],
      performanceIssues: []
    };
  }

  private calculateOverallQualityScore(tables: TableAnalysisResult[]): number {
    if (tables.length === 0) return 0;
    return tables.reduce((sum, table) => sum + table.overallQualityScore, 0) / tables.length;
  }

  private generateDatabaseRecommendations(tables: TableAnalysisResult[], crossTableAnalysis: any): string[] {
    const recommendations: string[] = [];

    const lowQualityTables = tables.filter(t => t.overallQualityScore < 70);
    if (lowQualityTables.length > 0) {
      recommendations.push(`${lowQualityTables.length} tables have quality scores below 70%`);
    }

    const tablesWithoutPK = tables.filter(t => !t.primaryKey);
    if (tablesWithoutPK.length > 0) {
      recommendations.push(`${tablesWithoutPK.length} tables are missing primary keys`);
    }

    return recommendations;
  }

  private calculateTableQualityScore(profiles: DataProfileResult[], issues: any[]): number {
    if (profiles.length === 0) return 0;

    const avgColumnScore = profiles.reduce((sum, profile) => sum + profile.dataQualityScore, 0) / profiles.length;
    const issuesPenalty = issues.length * 5;

    return Math.max(0, Math.min(100, avgColumnScore - issuesPenalty));
  }

  private identifyTableQualityIssues(metadata: any, profiles: DataProfileResult[]): any[] {
    const issues: any[] = [];

    if (!metadata.primaryKey) {
      issues.push({
        severity: 'high',
        issue: 'Missing primary key',
        recommendation: 'Add a primary key to improve data integrity and performance'
      });
    }

    const highNullColumns = profiles.filter(p => p.nullPercentage > 50);
    if (highNullColumns.length > 0) {
      issues.push({
        severity: 'medium',
        issue: `${highNullColumns.length} columns have high null percentages`,
        recommendation: 'Review nullable columns and consider default values'
      });
    }

    return issues;
  }

  private async analyzeTableRelationships(connection: any, tableName: string, dbType: string): Promise<any[]> {
    // Placeholder for relationship analysis
    return [];
  }

  private async getForeignKeyRelationships(connection: any, tableName: string, dbType: string): Promise<any[]> {
    // Implementation would vary by database type
    return [];
  }

  private async getReferencingTables(connection: any, tableName: string, dbType: string): Promise<any[]> {
    // Implementation would vary by database type
    return [];
  }

  private performImpactAnalysis(tableName: string, nodes: DataLineageNode[], edges: DataLineageEdge[]): any {
    const upstreamTables = new Set<string>();
    const downstreamTables = new Set<string>();
    const affectedColumns = new Set<string>();

    // Analyze impact based on lineage graph
    for (const edge of edges) {
      if (edge.to.startsWith(tableName)) {
        upstreamTables.add(edge.from.split('.')[0]);
      }
      if (edge.from.startsWith(tableName)) {
        downstreamTables.add(edge.to.split('.')[0]);
        affectedColumns.add(edge.to);
      }
    }

    const riskLevel = downstreamTables.size > 5 ? 'high' :
                     downstreamTables.size > 2 ? 'medium' : 'low';

    return {
      upstreamTables: Array.from(upstreamTables),
      downstreamTables: Array.from(downstreamTables),
      affectedColumns: Array.from(affectedColumns),
      riskLevel
    };
  }
}

export const dataQualityAnalyzer = new DataQualityAnalyzer();
export default DataQualityAnalyzer;