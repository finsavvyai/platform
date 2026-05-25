/**
 * Dump File Analyzer for Database Initialization
 *
 * This component analyzes database dump files (SQL, JSON, CSV, BSON, etc.)
 * to understand the existing schema, data patterns, relationships, and
 * complexity to inform database recommendations.
 */

import {
  DumpFileAnalysis,
  SchemaAnalysis,
  TableAnalysis,
  ColumnAnalysis,
  RelationshipAnalysis,
  DataPattern,
  IndexAnalysis,
  ConstraintAnalysis,
  TriggerAnalysis,
  StoredProcedureAnalysis,
  DataTypeUsage,
  AIDatabaseInitializationConfig
} from '../types';

export class DumpFileAnalyzer {
  private config: AIDatabaseInitializationConfig;
  private readonly MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
  private readonly SAMPLE_SIZE = 1000; // Sample rows for pattern analysis

  constructor(config: AIDatabaseInitializationConfig) {
    this.config = config;
  }

  /**
   * Main analysis method
   */
  async analyze(file: File): Promise<DumpFileAnalysis> {
    this.validateFile(file);

    const fileContent = await this.readFileContent(file);
    const fileType = this.detectFileType(file.name, fileContent);

    const startTime = Date.now();

    try {
      const schema = await this.analyzeSchema(fileContent, fileType);
      const dataPatterns = await this.analyzeDataPatterns(fileContent, fileType, schema);
      const indexes = await this.analyzeIndexes(fileContent, fileType);
      const constraints = await this.analyzeConstraints(fileContent, fileType);
      const triggers = await this.analyzeTriggers(fileContent, fileType);
      const storedProcedures = await this.analyzeStoredProcedures(fileContent, fileType);
      const complexity = this.calculateComplexity(schema, indexes, triggers, storedProcedures);

      return {
        fileName: file.name,
        fileType,
        size: file.size,
        tableCount: schema.tables.length,
        totalRows: schema.tables.reduce((sum, table) => sum + table.estimatedRows, 0),
        estimatedSchema: schema,
        dataPatterns,
        indexes,
        constraints,
        triggers,
        storedProcedures,
        complexity
      };
    } catch (error) {
      console.error('Dump file analysis failed:', error);
      throw new Error(`Failed to analyze dump file: ${error.message}`);
    } finally {
      console.log(`Analysis completed in ${Date.now() - startTime}ms`);
    }
  }

  /**
   * Validate the uploaded file
   */
  private validateFile(file: File): void {
    if (file.size > this.MAX_FILE_SIZE) {
      throw new Error(`File size ${file.size} bytes exceeds maximum allowed size of ${this.MAX_FILE_SIZE} bytes`);
    }

    const supportedExtensions = ['.sql', '.json', '.csv', '.bson', '.dump'];
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();

    if (!supportedExtensions.includes(extension)) {
      throw new Error(`Unsupported file extension: ${extension}. Supported formats: ${supportedExtensions.join(', ')}`);
    }
  }

  /**
   * Read file content
   */
  private async readFileContent(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = (e) => reject(new Error('Failed to read file content'));
      reader.readAsText(file);
    });
  }

  /**
   * Detect file type based on extension and content
   */
  private detectFileType(fileName: string, content: string): DumpFileAnalysis['fileType'] {
    const extension = '.' + fileName.split('.').pop()?.toLowerCase();

    if (extension === '.sql') return 'sql';
    if (extension === '.json') return 'json';
    if (extension === '.csv') return 'csv';
    if (extension === '.bson') return 'bson';
    if (extension === '.dump') return 'custom';

    // Content-based detection
    if (content.trim().startsWith('CREATE TABLE') || content.includes('INSERT INTO')) {
      return 'sql';
    }
    if (content.trim().startsWith('[') || content.trim().startsWith('{')) {
      return 'json';
    }
    if (content.includes(',') && content.split('\n').length > 1) {
      return 'csv';
    }

    return 'custom';
  }

  /**
   * Analyze database schema
   */
  private async analyzeSchema(content: string, fileType: DumpFileAnalysis['fileType']): Promise<SchemaAnalysis> {
    switch (fileType) {
      case 'sql':
        return await this.analyzeSQLSchema(content);
      case 'json':
        return await this.analyzeJSONSchema(content);
      case 'csv':
        return await this.analyzeCSVSchema(content);
      case 'bson':
        return await this.analyzeBSONSchema(content);
      default:
        return await this.analyzeCustomSchema(content);
    }
  }

  /**
   * Analyze SQL schema
   */
  private async analyzeSQLSchema(content: string): Promise<SchemaAnalysis> {
    const tables: TableAnalysis[] = [];
    const relationships: RelationshipAnalysis[] = [];
    const dataTypes: DataTypeUsage[] = [];

    // Extract CREATE TABLE statements
    const createTableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?(\w+)`?\s*\(([\s\S]*?)\)(?:\s*;)?/gi;
    let match;

    while ((match = createTableRegex.exec(content)) !== null) {
      const tableName = match[1];
      const tableDef = match[2];

      const tableAnalysis = await this.analyzeTableDefinition(tableName, tableDef);
      tables.push(tableAnalysis);

      // Extract data types
      tableAnalysis.columns.forEach(col => {
        const existingType = dataTypes.find(dt => dt.dataType === col.dataType);
        if (existingType) {
          existingType.count++;
        } else {
          dataTypes.push({
            dataType: col.dataType,
            count: 1,
            percentage: 0, // Will be calculated later
            recommendedOptimization: this.getOptimizationForDataType(col.dataType)
          });
        }
      });
    }

    // Calculate percentages for data types
    const totalColumns = tables.reduce((sum, table) => sum + table.columns.length, 0);
    dataTypes.forEach(dt => {
      dt.percentage = Math.round((dt.count / totalColumns) * 100);
    });

    // Extract relationships from foreign keys
    tables.forEach(table => {
      table.foreignKeys.forEach(fk => {
        const relatedTable = tables.find(t => t.name === fk.referencedTable);
        if (relatedTable) {
          relationships.push({
            type: 'many_to_one',
            sourceTable: table.name,
            targetTable: fk.referencedTable,
            joinColumns: [fk.column],
            cardinality: {
              minSource: 0,
              maxSource: -1, // Many
              minTarget: 0,
              maxTarget: 1   // One
            }
          });
        }
      });
    });

    // Determine normalization level
    const normalizationLevel = this.determineNormalizationLevel(tables, relationships);

    return {
      databaseName: this.extractDatabaseName(content),
      version: this.extractDatabaseVersion(content),
      tables,
      relationships,
      dataTypes,
      normalizationLevel
    };
  }

  /**
   * Analyze individual table definition
   */
  private async analyzeTableDefinition(tableName: string, tableDef: string): Promise<TableAnalysis> {
    const columns: ColumnAnalysis[] = [];
    const primaryKeys: string[] = [];
    const foreignKeys: any[] = [];
    const indexes: string[] = [];

    // Extract column definitions
    const lines = tableDef.split(',').map(line => line.trim());

    for (const line of lines) {
      // Skip constraint definitions that don't define columns
      if (line.toUpperCase().includes('PRIMARY KEY') ||
          line.toUpperCase().includes('FOREIGN KEY') ||
          line.toUpperCase().includes('INDEX') ||
          line.toUpperCase().includes('CONSTRAINT')) {
        continue;
      }

      const columnMatch = line.match(/^`?(\w+)`?\s+(\w+)(?:\(([^)]+)\))?\s*(.*)$/i);
      if (columnMatch) {
        const [, name, dataType, params, constraints] = columnMatch;

        columns.push({
          name,
          type: dataType + (params ? `(${params})` : ''),
          nullable: !constraints.toUpperCase().includes('NOT NULL'),
          unique: constraints.toUpperCase().includes('UNIQUE'),
          defaultValue: this.extractDefaultValue(constraints),
          maxLength: this.extractMaxLength(params),
          precision: this.extractPrecision(params),
          scale: this.extractScale(params),
          estimatedCardinality: this.estimateCardinality(dataType),
          growthPattern: this.estimateGrowthPattern(constraints)
        });
      }
    }

    // Extract primary keys
    const pkMatch = tableDef.match(/PRIMARY\s+KEY\s*\(([^)]+)\)/i);
    if (pkMatch) {
      primaryKeys.push(...pkMatch[1].split(',').map(col => col.trim().replace(/[`'"]/g, '')));
    }

    // Extract foreign keys
    const fkMatches = tableDef.matchAll(/FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+`?(\w+)`?\s*\(`?(\w+)`?\)/gi);
    for (const fkMatch of fkMatches) {
      foreignKeys.push({
        column: fkMatch[1].trim().replace(/[`'"]/g, ''),
        referencedTable: fkMatch[2],
        referencedColumn: fkMatch[3],
        onUpdateAction: 'restrict',
        onDeleteAction: 'restrict'
      });
    }

    // Estimate row count and size
    const estimatedRows = this.estimateRowCount(content, tableName);
    const estimatedSize = this.estimateTableSize(columns, estimatedRows);

    return {
      name: tableName,
      estimatedRows,
      columns,
      primaryKeys,
      foreignKeys,
      indexes,
      estimatedSize,
      growthRate: this.estimateGrowthRate(tableName, columns)
    };
  }

  /**
   * Analyze data patterns
   */
  private async analyzeDataPatterns(
    content: string,
    fileType: DumpFileAnalysis['fileType'],
    schema: SchemaAnalysis
  ): Promise<DataPattern[]> {
    const patterns: DataPattern[] = [];

    // Analyze for temporal patterns
    const temporalColumns = schema.tables.flatMap(table =>
      table.columns.filter(col =>
        col.type.toLowerCase().includes('timestamp') ||
        col.type.toLowerCase().includes('datetime') ||
        col.type.toLowerCase().includes('date') ||
        col.name.toLowerCase().includes('created') ||
        col.name.toLowerCase().includes('updated')
      ).map(col => `${table.name}.${col.name}`)
    );

    if (temporalColumns.length > 0) {
      patterns.push({
        type: 'temporal',
        description: `Time-series data detected in ${temporalColumns.length} columns`,
        confidence: 0.8,
        relatedTables: [...new Set(temporalColumns.map(col => col.split('.')[0]))],
        optimizationSuggestions: [
          'Consider time-series database (InfluxDB, TimescaleDB)',
          'Add time-based indexes',
          'Implement data retention policies'
        ]
      });
    }

    // Analyze for hierarchical patterns
    const hierarchicalColumns = schema.tables.flatMap(table =>
      table.columns.filter(col =>
        col.name.toLowerCase().includes('parent') ||
        col.name.toLowerCase().includes('tree') ||
        col.name.toLowerCase().includes('level') ||
        col.name.toLowerCase().includes('path')
      ).map(col => `${table.name}.${col.name}`)
    );

    if (hierarchicalColumns.length > 0) {
      patterns.push({
        type: 'hierarchical',
        description: `Hierarchical data structure detected`,
        confidence: 0.7,
        relatedTables: [...new Set(hierarchicalColumns.map(col => col.split('.')[0]))],
        optimizationSuggestions: [
          'Consider recursive CTEs or closure tables',
          'Use graph database for complex hierarchies',
          'Implement materialized path patterns'
        ]
      });
    }

    // Analyze for network/graph patterns
    if (schema.relationships.length > schema.tables.length * 0.5) {
      patterns.push({
        type: 'network',
        description: `Highly connected data with ${schema.relationships.length} relationships`,
        confidence: 0.8,
        relatedTables: schema.tables.map(t => t.name),
        optimizationSuggestions: [
          'Consider graph database (Neo4j, ArangoDB)',
          'Optimize join queries',
          'Implement relationship indexes'
        ]
      });
    }

    // Analyze for document patterns
    const textColumns = schema.tables.flatMap(table =>
      table.columns.filter(col =>
        col.type.toLowerCase().includes('text') ||
        col.type.toLowerCase().includes('json') ||
        col.type.toLowerCase().includes('xml')
      ).map(col => `${table.name}.${col.name}`)
    );

    if (textColumns.length > schema.tables.length * 0.3) {
      patterns.push({
        type: 'document',
        description: `Document-oriented data detected in ${textColumns.length} text/JSON columns`,
        confidence: 0.6,
        relatedTables: [...new Set(textColumns.map(col => col.split('.')[0]))],
        optimizationSuggestions: [
          'Consider document database (MongoDB, CouchDB)',
          'Implement full-text search',
          'Use JSON-specific indexing'
        ]
      });
    }

    // Analyze for geospatial patterns
    const geoColumns = schema.tables.flatMap(table =>
      table.columns.filter(col =>
        col.name.toLowerCase().includes('lat') ||
        col.name.toLowerCase().includes('lon') ||
        col.name.toLowerCase().includes('geo') ||
        col.type.toLowerCase().includes('point') ||
        col.type.toLowerCase().includes('geometry')
      ).map(col => `${table.name}.${col.name}`)
    );

    if (geoColumns.length > 0) {
      patterns.push({
        type: 'geospatial',
        description: `Geospatial data detected in ${geoColumns.length} columns`,
        confidence: 0.9,
        relatedTables: [...new Set(geoColumns.map(col => col.split('.')[0]))],
        optimizationSuggestions: [
          'Use PostGIS for PostgreSQL',
          'Implement spatial indexes',
          'Consider specialized geospatial databases'
        ]
      });
    }

    // Analyze for key-value patterns
    const simpleTables = schema.tables.filter(table =>
      table.columns.length <= 5 &&
      table.columns.some(col => col.name.toLowerCase().includes('key')) &&
      table.columns.some(col => col.name.toLowerCase().includes('value'))
    );

    if (simpleTables.length > 0) {
      patterns.push({
        type: 'key_value',
        description: `Key-value pattern detected in ${simpleTables.length} tables`,
        confidence: 0.7,
        relatedTables: simpleTables.map(t => t.name),
        optimizationSuggestions: [
          'Consider Redis or other key-value stores',
          'Implement caching strategies',
          'Optimize for lookups'
        ]
      });
    }

    return patterns;
  }

  /**
   * Analyze indexes
   */
  private async analyzeIndexes(
    content: string,
    fileType: DumpFileAnalysis['fileType']
  ): Promise<IndexAnalysis[]> {
    const indexes: IndexAnalysis[] = [];

    if (fileType === 'sql') {
      // Extract CREATE INDEX statements
      const indexRegex = /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?`?(\w+)`?\s+ON\s+`?(\w+)`?\s*\(([^)]+)\)/gi;
      let match;

      while ((match = indexRegex.exec(content)) !== null) {
        const [, indexName, tableName, columns] = match;

        indexes.push({
          name: indexName,
          table: tableName,
          columns: columns.split(',').map(col => col.trim().replace(/[`'"]/g, '')),
          type: 'btree',
          unique: content.toLowerCase().includes('unique index'),
          estimatedSelectivity: this.estimateSelectivity(columns),
          usageFrequency: this.inferUsageFrequency(indexName),
          recommendation: 'keep'
        });
      }
    }

    return indexes;
  }

  /**
   * Analyze constraints
   */
  private async analyzeConstraints(
    content: string,
    fileType: DumpFileAnalysis['fileType']
  ): Promise<ConstraintAnalysis[]> {
    const constraints: ConstraintAnalysis[] = [];

    if (fileType === 'sql') {
      // Extract PRIMARY KEY constraints
      const pkMatches = content.matchAll(/PRIMARY\s+KEY\s*\(([^)]+)\)/gi);
      for (const match of pkMatches) {
        constraints.push({
          type: 'primary_key',
          table: this.extractTableFromContext(content, match.index),
          columns: match[1].split(',').map(col => col.trim()),
          definition: match[0],
          enforced: true,
          performanceImpact: 'medium'
        });
      }

      // Extract FOREIGN KEY constraints
      const fkMatches = content.matchAll(/FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+`?(\w+)`?\s*\(`?(\w+)`?\)/gi);
      for (const match of fkMatches) {
        constraints.push({
          type: 'foreign_key',
          table: this.extractTableFromContext(content, match.index),
          columns: [match[1].trim()],
          definition: match[0],
          enforced: true,
          performanceImpact: 'high'
        });
      }

      // Extract UNIQUE constraints
      const uniqueMatches = content.matchAll(/UNIQUE\s*\(([^)]+)\)/gi);
      for (const match of uniqueMatches) {
        constraints.push({
          type: 'unique',
          table: this.extractTableFromContext(content, match.index),
          columns: match[1].split(',').map(col => col.trim()),
          definition: match[0],
          enforced: true,
          performanceImpact: 'medium'
        });
      }

      // Extract CHECK constraints
      const checkMatches = content.matchAll(/CHECK\s*\(([^)]+)\)/gi);
      for (const match of checkMatches) {
        constraints.push({
          type: 'check',
          table: this.extractTableFromContext(content, match.index),
          columns: this.extractColumnsFromCheckConstraint(match[1]),
          definition: match[0],
          enforced: true,
          performanceImpact: 'low'
        });
      }
    }

    return constraints;
  }

  /**
   * Analyze triggers
   */
  private async analyzeTriggers(
    content: string,
    fileType: DumpFileAnalysis['fileType']
  ): Promise<TriggerAnalysis[]> {
    const triggers: TriggerAnalysis[] = [];

    if (fileType === 'sql') {
      const triggerRegex = /CREATE\s+(?:OR\s+REPLACE\s+)?TRIGGER\s+`?(\w+)`?\s*(BEFORE|AFTER|INSTEAD\s+OF)\s+(INSERT|UPDATE|DELETE)\s+ON\s+`?(\w+)`?/gi;
      let match;

      while ((match = triggerRegex.exec(content)) !== null) {
        const [, triggerName, timing, event, table] = match;

        triggers.push({
          name: triggerName,
          table: table,
          event: event.toLowerCase() as any,
          timing: timing.toLowerCase().replace(' ', '_') as any,
          complexity: this.estimateTriggerComplexity(content, match.index),
          performanceImpact: this.estimateTriggerPerformanceImpact(content, match.index)
        });
      }
    }

    return triggers;
  }

  /**
   * Analyze stored procedures
   */
  private async analyzeStoredProcedures(
    content: string,
    fileType: DumpFileAnalysis['fileType']
  ): Promise<StoredProcedureAnalysis[]> {
    const procedures: StoredProcedureAnalysis[] = [];

    if (fileType === 'sql') {
      const procRegex = /CREATE\s+(?:OR\s+REPLACE\s+)?(?:PROCEDURE|FUNCTION)\s+`?(\w+)`?\s*\(([^)]*)\)/gi;
      let match;

      while ((match = procRegex.exec(content)) !== null) {
        const [, procName, params] = match;

        procedures.push({
          name: procName,
          parameters: this.parseParameters(params),
          complexity: this.estimateProcedureComplexity(content, match.index),
          estimatedExecutionTime: this.estimateExecutionTime(content, match.index),
          usageFrequency: this.inferProcedureUsageFrequency(procName)
        });
      }
    }

    return procedures;
  }

  // Helper methods for schema analysis
  private async analyzeJSONSchema(content: string): Promise<SchemaAnalysis> {
    try {
      const data = JSON.parse(content);
      // Implement JSON schema analysis
      return this.createDefaultSchema();
    } catch (error) {
      throw new Error('Invalid JSON format');
    }
  }

  private async analyzeCSVSchema(content: string): Promise<SchemaAnalysis> {
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length === 0) {
      throw new Error('Empty CSV file');
    }

    const headers = lines[0].split(',').map(h => h.trim().replace(/['"]/g, ''));
    const sampleRows = lines.slice(1, Math.min(6, lines.length));

    const table: TableAnalysis = {
      name: 'csv_data',
      estimatedRows: lines.length - 1,
      columns: headers.map(header => ({
        name: header,
        type: this.inferDataTypeFromCSV(header, sampleRows),
        nullable: true,
        unique: false,
        estimatedCardinality: this.estimateCardinality('string'),
        growthPattern: 'static'
      })),
      primaryKeys: [],
      foreignKeys: [],
      indexes: [],
      estimatedSize: content.length,
      growthRate: 'low'
    };

    return {
      databaseName: 'csv_import',
      version: '1.0',
      tables: [table],
      relationships: [],
      dataTypes: this.extractDataTypesFromTable(table),
      normalizationLevel: 'unnormalized'
    };
  }

  private async analyzeBSONSchema(content: string): Promise<SchemaAnalysis> {
    // BSON analysis would require specialized parsing
    return this.createDefaultSchema();
  }

  private async analyzeCustomSchema(content: string): Promise<SchemaAnalysis> {
    return this.createDefaultSchema();
  }

  private createDefaultSchema(): SchemaAnalysis {
    return {
      databaseName: 'unknown',
      version: '1.0',
      tables: [],
      relationships: [],
      dataTypes: [],
      normalizationLevel: 'unnormalized'
    };
  }

  // Utility helper methods
  private extractDatabaseName(content: string): string {
    const match = content.match(/CREATE\s+DATABASE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?(\w+)`?/i);
    return match ? match[1] : 'unknown';
  }

  private extractDatabaseVersion(content: string): string {
    const versionMatch = content.match(/--\s*Version:\s*(.+)/i);
    return versionMatch ? versionMatch[1].trim() : '1.0';
  }

  private extractDefaultValue(constraints: string): any {
    const match = constraints.match(/DEFAULT\s+(['"`]?)(.*?)\1/i);
    return match ? match[2] : undefined;
  }

  private extractMaxLength(params?: string): number | undefined {
    if (!params) return undefined;
    const match = params.match(/(\d+)/);
    return match ? parseInt(match[1]) : undefined;
  }

  private extractPrecision(params?: string): number | undefined {
    if (!params) return undefined;
    const match = params.match(/(\d+),?\d*/);
    return match ? parseInt(match[1]) : undefined;
  }

  private extractScale(params?: string): number | undefined {
    if (!params) return undefined;
    const match = params.match(/\d+,(\d+)/);
    return match ? parseInt(match[1]) : undefined;
  }

  private estimateCardinality(dataType: string): number {
    const lower = dataType.toLowerCase();
    if (lower.includes('int') || lower.includes('serial')) return 1000;
    if (lower.includes('varchar') || lower.includes('text')) return 500;
    if (lower.includes('timestamp') || lower.includes('datetime')) return 100;
    if (lower.includes('boolean')) return 2;
    return 100;
  }

  private estimateGrowthPattern(constraints: string): ColumnAnalysis['growthPattern'] {
    const lower = constraints.toLowerCase();
    if (lower.includes('auto_increment') || lower.includes('timestamp')) return 'linear';
    if (lower.includes('static') || lower.includes('fixed')) return 'static';
    return 'linear';
  }

  private estimateRowCount(content: string, tableName: string): number {
    // Look for INSERT statements to estimate row count
    const insertRegex = new RegExp(`INSERT\\s+INTO\\s+\\`?${tableName}\\`?`, 'gi');
    const matches = content.match(insertRegex);
    return matches ? matches.length : 1000; // Default estimate
  }

  private estimateTableSize(columns: ColumnAnalysis[], estimatedRows: number): number {
    const avgRowSize = columns.reduce((sum, col) => {
      let colSize = 50; // Default column size
      if (col.maxLength) colSize = col.maxLength;
      else if (col.type.includes('int')) colSize = 8;
      else if (col.type.includes('text')) colSize = 500;
      return sum + colSize;
    }, 0);

    return estimatedRows * avgRowSize;
  }

  private estimateGrowthRate(tableName: string, columns: ColumnAnalysis[]): 'low' | 'medium' | 'high' {
    const name = tableName.toLowerCase();
    if (name.includes('log') || name.includes('event') || name.includes('activity')) return 'high';
    if (name.includes('config') || name.includes('static') || name.includes('reference')) return 'low';
    return 'medium';
  }

  private determineNormalizationLevel(
    tables: TableAnalysis[],
    relationships: RelationshipAnalysis[]
  ): SchemaAnalysis['normalizationLevel'] {
    if (tables.length === 0) return 'unnormalized';

    const avgColumnsPerTable = tables.reduce((sum, table) => sum + table.columns.length, 0) / tables.length;
    const relationshipRatio = relationships.length / tables.length;

    if (avgColumnsPerTable > 20 && relationshipRatio < 0.2) return 'unnormalized';
    if (avgColumnsPerTable > 10 && relationshipRatio < 0.5) return '1nf';
    if (relationshipRatio >= 0.5 && tables.some(t => t.foreignKeys.length > 0)) return '2nf';
    if (relationshipRatio >= 1.0 && tables.every(t => t.primaryKeys.length > 0)) return '3nf';

    return '3nf';
  }

  private getOptimizationForDataType(dataType: string): string | undefined {
    const lower = dataType.toLowerCase();
    if (lower.includes('varchar')) return 'Consider appropriate length limits';
    if (lower.includes('text')) return 'Consider full-text indexing';
    if (lower.includes('timestamp')) return 'Consider time-series partitioning';
    return undefined;
  }

  private extractDataTypesFromTable(table: TableAnalysis): DataTypeUsage[] {
    const typeMap = new Map<string, number>();

    table.columns.forEach(col => {
      const count = typeMap.get(col.type) || 0;
      typeMap.set(col.type, count + 1);
    });

    return Array.from(typeMap.entries()).map(([dataType, count]) => ({
      dataType,
      count,
      percentage: Math.round((count / table.columns.length) * 100),
      recommendedOptimization: this.getOptimizationForDataType(dataType)
    }));
  }

  private inferDataTypeFromCSV(header: string, sampleRows: string[]): string {
    const values = sampleRows.map(row => row.split(',')[sampleRows[0].split(',').indexOf(header)]);

    // Check for numeric values
    if (values.every(val => val && !isNaN(Number(val)))) {
      return values.some(val => val.includes('.')) ? 'decimal' : 'integer';
    }

    // Check for dates
    if (values.every(val => val && !isNaN(Date.parse(val)))) {
      return 'timestamp';
    }

    // Check for booleans
    if (values.every(val => val && ['true', 'false', '1', '0', 'yes', 'no'].includes(val.toLowerCase()))) {
      return 'boolean';
    }

    return 'varchar(255)';
  }

  private extractTableFromContext(content: string, position: number): string {
    const before = content.substring(0, position);
    const tableMatch = before.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?(\w+)`?\s*\(/gi);
    return tableMatch ? tableMatch[1] : 'unknown';
  }

  private extractColumnsFromCheckConstraint(constraint: string): string[] {
    const columnMatches = constraint.match(/\b(\w+)\b/g);
    return columnMatches || [];
  }

  private parseParameters(params: string): any[] {
    if (!params.trim()) return [];

    const paramList = params.split(',');
    return paramList.map(param => {
      const parts = param.trim().split(/\s+/);
      return {
        name: parts[0]?.replace('@', ''),
        dataType: parts[1] || 'unknown',
        direction: 'in' as const,
        required: !param.toLowerCase().includes('default')
      };
    });
  }

  private estimateSelectivity(columns: string[]): number {
    // More columns typically mean lower selectivity
    return Math.max(0.1, 1.0 - (columns.length * 0.1));
  }

  private inferUsageFrequency(indexName: string): 'high' | 'medium' | 'low' {
    const name = indexName.toLowerCase();
    if (name.includes('primary') || name.includes('unique') || name.includes('fk')) return 'high';
    if (name.includes('temp') || name.includes('tmp')) return 'low';
    return 'medium';
  }

  private inferProcedureUsageFrequency(procName: string): 'high' | 'medium' | 'low' {
    const name = procName.toLowerCase();
    if (name.includes('get') || name.includes('select') || name.includes('find')) return 'high';
    if (name.includes('admin') || name.includes('maintenance')) return 'low';
    return 'medium';
  }

  private estimateTriggerComplexity(content: string, position: number): 'simple' | 'moderate' | 'complex' {
    const triggerContent = this.extractTriggerContent(content, position);
    const lineCount = triggerContent.split('\n').length;

    if (lineCount <= 5) return 'simple';
    if (lineCount <= 15) return 'moderate';
    return 'complex';
  }

  private estimateTriggerPerformanceImpact(content: string, position: number): 'low' | 'medium' | 'high' {
    const triggerContent = this.extractTriggerContent(content, position);
    if (triggerContent.includes('UPDATE') || triggerContent.includes('INSERT') || triggerContent.includes('DELETE')) {
      return 'high';
    }
    if (triggerContent.includes('SELECT')) {
      return 'medium';
    }
    return 'low';
  }

  private extractTriggerContent(content: string, position: number): string {
    const before = content.substring(position);
    const endMatch = before.match(/END;/i);
    return endMatch ? before.substring(0, endMatch.index + endMatch[0].length) : before.substring(0, 500);
  }

  private estimateProcedureComplexity(content: string, position: number): 'simple' | 'moderate' | 'complex' {
    const procContent = this.extractProcedureContent(content, position);
    const lineCount = procContent.split('\n').length;
    const keywordCount = (procContent.match(/\b(IF|WHILE|FOR|CASE)\b/gi) || []).length;

    if (lineCount <= 10 && keywordCount <= 2) return 'simple';
    if (lineCount <= 50 && keywordCount <= 5) return 'moderate';
    return 'complex';
  }

  private extractProcedureContent(content: string, position: number): string {
    const before = content.substring(position);
    const endMatch = before.match(/END;/i);
    return endMatch ? before.substring(0, endMatch.index + endMatch[0].length) : before.substring(0, 1000);
  }

  private estimateExecutionTime(content: string, position: number): number {
    const complexity = this.estimateProcedureComplexity(content, position);
    switch (complexity) {
      case 'simple': return 10; // 10ms
      case 'moderate': return 100; // 100ms
      case 'complex': return 1000; // 1s
      default: return 100;
    }
  }

  private calculateComplexity(
    schema: SchemaAnalysis,
    indexes: IndexAnalysis[],
    triggers: TriggerAnalysis[],
    procedures: StoredProcedureAnalysis[]
  ): DumpFileAnalysis['complexity'] {
    let complexityScore = 0;

    // Table complexity
    complexityScore += schema.tables.length * 2;
    complexityScore += schema.tables.reduce((sum, table) => sum + table.columns.length, 0);

    // Relationship complexity
    complexityScore += schema.relationships.length * 3;

    // Index complexity
    complexityScore += indexes.length * 1.5;

    // Trigger complexity
    complexityScore += triggers.length * 2;
    triggers.forEach(trigger => {
      if (trigger.complexity === 'complex') complexityScore += 3;
      else if (trigger.complexity === 'moderate') complexityScore += 2;
      else complexityScore += 1;
    });

    // Procedure complexity
    complexityScore += procedures.length * 2;
    procedures.forEach(proc => {
      if (proc.complexity === 'complex') complexityScore += 5;
      else if (proc.complexity === 'moderate') complexityScore += 3;
      else complexityScore += 1;
    });

    if (complexityScore <= 20) return 'simple';
    if (complexityScore <= 50) return 'moderate';
    if (complexityScore <= 100) return 'complex';
    return 'very_complex';
  }
}
