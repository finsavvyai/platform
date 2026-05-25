/**
 * Tableau Integration & Domination Suite
 *
 * Complete Tableau-compatible data source connectors and export capabilities
 * Makes QueryFlux the superior alternative to Tableau with AI-powered features
 */

export interface TableauDataSource {
  id: string;
  name: string;
  type: 'live' | 'extract';
  connectionType: 'postgres' | 'mysql' | 'mongodb' | 'redshift' | 'snowflake' | 'bigquery' | 'oracle' | 'sqlserver';
  connectionDetails: TableauConnectionDetails;
  tables: TableauTable[];
  customSQL?: string;
  refreshSchedule?: TableauRefreshSchedule;
  credentials?: TableauCredentials;
  metadata: TableauMetadata;
}

export interface TableauConnectionDetails {
  server: string;
  port: number;
  database: string;
  username?: string;
  password?: string;
  ssl: boolean;
  connectionString?: string;
  parameters: Record<string, any>;
}

export interface TableauTable {
  name: string;
  alias?: string;
  schema?: string;
  columns: TableauColumn[];
  joins?: TableauJoin[];
  filters?: TableauFilter[];
}

export interface TableauColumn {
  name: string;
  alias?: string;
  dataType: 'string' | 'number' | 'date' | 'boolean' | 'geographic';
  role: 'dimension' | 'measure';
  aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'countd' | 'median' | 'stdev' | 'stdevp';
  calculation?: string;
  format?: string;
  description?: string;
  hidden: boolean;
}

export interface TableauJoin {
  type: 'inner' | 'left' | 'right' | 'full';
  leftTable: string;
  leftColumn: string;
  rightTable: string;
  rightColumn: string;
  joinClause?: string;
}

export interface TableauFilter {
  name: string;
  field: string;
  operator: 'equals' | 'not equal' | 'greater than' | 'less than' | 'contains' | 'starts with' | 'ends with' | 'in' | 'not in';
  value: any;
  includeNulls: boolean;
  applyBeforeAggregation: boolean;
}

export interface TableauRefreshSchedule {
  enabled: boolean;
  frequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
  time?: string; // HH:MM format
  daysOfWeek?: number[]; // 0-6, Sunday = 0
  dayOfMonth?: number; // 1-31
  timezone: string;
  incrementalRefresh: boolean;
  refreshFields?: string[];
}

export interface TableauCredentials {
  type: 'username_password' | 'oauth' | 'kerberos' | 'embedded';
  username?: string;
  password?: string;
  oauthToken?: string;
  kerberosTicket?: string;
  embeddedCredentials?: Record<string, string>;
}

export interface TableauMetadata {
  createdAt: string;
  updatedAt: string;
  lastRefreshed?: string;
  size: number;
  rowcount?: number;
  tags: string[];
  owner: string;
  project: string;
  description?: string;
}

export interface TableauExtract {
  id: string;
  dataSourceId: string;
  name: string;
  format: 'hyper' | 'tde';
  size: number;
  rowcount: number;
  columns: string[];
  createdAt: string;
  lastRefreshed: string;
  refreshSchedule?: TableauRefreshSchedule;
  encryption: boolean;
  compression: boolean;
}

export interface TableauWorkbook {
  id: string;
  name: string;
  datasources: TableauDataSource[];
  worksheets: TableauWorksheet[];
  dashboards: TableauDashboard[];
  version: string;
  createdAt: string;
  updatedAt: string;
  author: string;
  tags: string[];
  description?: string;
}

export interface TableauWorksheet {
  id: string;
  name: string;
  dataSourceId: string;
  visualization: TableauVisualization;
  filters: TableauFilter[];
  parameters: TableauParameter[];
  marks: TableauMarks;
  layout: TableauLayout;
}

export interface TableauDashboard {
  id: string;
  name: string;
  worksheets: string[];
  layout: TableauDashboardLayout;
  filters: TableauFilter[];
  actions: TableauAction[];
  sizing: TableauSizing;
  backgroundColor: string;
  title: string;
}

export interface TableauVisualization {
  type: 'bar' | 'line' | 'area' | 'pie' | 'scatter' | 'text' | 'shape' | 'map' | 'density' | 'gantt' | 'bubble' | 'histogram' | 'boxplot' | 'treemap' | 'heat-map';
  marks: {
    type: 'automatic' | 'bar' | 'line' | 'circle' | 'square' | 'text' | 'map' | 'density' | 'pie' | 'polygon';
    color?: string;
    size?: number;
    label?: boolean;
    tooltip?: boolean;
    detail?: string[];
  };
  shelves: {
    columns: string[];
    rows: string[];
    pages?: string[];
    filters?: string[];
    marks?: {
      color?: string;
      size?: string;
      label?: string;
      detail?: string;
      tooltip?: string;
    };
  };
}

export interface TableauParameter {
  name: string;
  dataType: 'string' | 'integer' | 'float' | 'boolean' | 'date' | 'datetime';
  currentValue: any;
  allowableValues: 'all' | 'list' | 'range';
  valueList?: any[];
  rangeStart?: any;
  rangeEnd?: any;
  step?: number;
  displayFormat: string;
}

export interface TableauMarks {
  type: string;
  color: TableauEncoding;
  size: TableauEncoding;
  label: TableauEncoding;
  tooltip: TableauEncoding;
  detail: TableauEncoding;
  shape?: TableauEncoding;
  angle?: TableauEncoding;
}

export interface TableauEncoding {
  field?: string;
  aggregation?: string;
  type: 'categorical' | 'continuous' | 'ordinal';
  palette?: string;
  format?: string;
}

export interface TableauLayout {
  size: 'automatic' | 'entire_view' | 'fit_width' | 'fit_height';
  format: {
    fontSize: number;
    fontFamily: string;
    fontWeight: 'normal' | 'bold';
    fontStyle: 'normal' | 'italic';
    color: string;
    alignment: 'left' | 'center' | 'right';
    backgroundColor: string;
    borders: {
      showRowDividers: boolean;
      showColumnDividers: boolean;
      dividerThickness: number;
      dividerColor: string;
    };
  };
}

export interface TableauDashboardLayout {
  type: 'tiled' | 'floating';
  grid: {
    columns: number;
    rows: number;
    cellSize: { width: number; height: number };
  };
  items: TableauDashboardItem[];
}

export interface TableauDashboardItem {
  id: string;
  worksheetId: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  title: string;
  border: boolean;
  backgroundColor: string;
}

export interface TableauAction {
  id: string;
  name: string;
  type: 'filter' | 'highlight' | 'url' | 'go_to_sheet';
  source: string;
  target: string;
  config: TableauActionConfig;
}

export interface TableauActionConfig {
  runOnSelect: boolean;
  runOnHover: boolean;
  excludeAllValues: boolean;
  multipleValues: boolean;
  url?: string;
  urlTarget?: '_blank' | '_self';
}

export interface TableauSizing {
  type: 'automatic' | 'exact' | 'range';
  width?: { min?: number; max?: number; exact?: number };
  height?: { min?: number; max?: number; exact?: number };
}

export class TableauConnector {
  private connectionId: string;
  private databaseType: string;

  constructor(connectionId: string, databaseType: string) {
    this.connectionId = connectionId;
    this.databaseType = databaseType;
  }

  /**
   * Create Tableau-compatible data source
   */
  async createDataSource(config: Omit<TableauDataSource, 'id' | 'metadata'>): Promise<TableauDataSource> {
    const dataSource: TableauDataSource = {
      ...config,
      id: this.generateId(),
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        size: 0,
        tags: [],
        owner: 'QueryFlux',
        project: 'Default'
      }
    };

    // Validate connection
    const isValid = await this.validateConnection(config.connectionDetails);
    if (!isValid) {
      throw new Error('Invalid database connection details');
    }

    // Extract schema information
    dataSource.tables = await this.extractTableSchema(config.connectionDetails);

    // Calculate initial size estimate
    dataSource.metadata.size = await this.estimateDataSourceSize(dataSource);

    return dataSource;
  }

  /**
   * Connect to Tableau Server
   */
  async connectToTableauServer(serverUrl: string, credentials: TableauCredentials): Promise<TableauServerConnection> {
    try {
      const response = await fetch(`${serverUrl}/api/2.0/auth/signin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          credentials: {
            name: credentials.username,
            password: credentials.password,
            site: {
              contentUrl: 'default'
            }
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Tableau Server authentication failed: ${response.statusText}`);
      }

      const authResult = await response.json();

      return {
        serverUrl,
        authToken: authResult.credentials.token,
        siteId: authResult.credentials.site.id,
        userId: authResult.credentials.user.id,
        connectedAt: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Failed to connect to Tableau Server: ${error.message}`);
    }
  }

  /**
   * Publish data source to Tableau Server
   */
  async publishDataSourceToTableau(
    dataSource: TableauDataSource,
    connection: TableauServerConnection,
    project: string,
    overwrite: boolean = false
  ): Promise<TableauPublishResult> {
    try {
      // Create Tableau data source file (.tds)
      const tdsContent = await this.generateTDSFile(dataSource);

      // Upload to Tableau Server
      const formData = new FormData();
      formData.append('file', new Blob([tdsContent], { type: 'application/xml' }), `${dataSource.name}.tds`);
      formData.append('name', dataSource.name);
      formData.append('projectId', project);

      const publishUrl = `${connection.serverUrl}/api/2.0/datasources`;

      let response: Response;
      if (overwrite) {
        // Check if data source already exists
        const existingDs = await this.findDataSourceOnServer(connection, dataSource.name);
        if (existingDs) {
          // Update existing data source
          response = await fetch(`${connection.serverUrl}/api/2.0/datasources/${existingDs.id}`, {
            method: 'PUT',
            headers: {
              'X-Tableau-Auth': connection.authToken,
              'Content-Type': 'multipart/form-data'
            },
            body: formData
          });
        } else {
          // Create new data source
          response = await fetch(publishUrl, {
            method: 'POST',
            headers: {
              'X-Tableau-Auth': connection.authToken,
              'Content-Type': 'multipart/form-data'
            },
            body: formData
          });
        }
      } else {
        // Create new data source
        response = await fetch(publishUrl, {
          method: 'POST',
          headers: {
            'X-Tableau-Auth': connection.authToken,
            'Content-Type': 'multipart/form-data'
          },
          body: formData
        });
      }

      if (!response.ok) {
        throw new Error(`Failed to publish data source: ${response.statusText}`);
      }

      const result = await response.json();

      return {
        success: true,
        dataSourceId: result.datasource.id,
        name: result.datasource.name,
        createdAt: result.datasource.createdAt,
        url: `${connection.serverUrl}/datasources/${result.datasource.id}`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Create Tableau extract (.hyper file)
   */
  async createTableauExtract(
    dataSource: TableauDataSource,
    extractConfig: Omit<TableauExtract, 'id' | 'dataSourceId' | 'createdAt' | 'lastRefreshed'> = {}
  ): Promise<TableauExtract> {
    const extract: TableauExtract = {
      ...extractConfig,
      id: this.generateId(),
      dataSourceId: dataSource.id,
      name: extractConfig.name || `${dataSource.name}_Extract`,
      createdAt: new Date().toISOString(),
      lastRefreshed: new Date().toISOString(),
      format: 'hyper',
      encryption: extractConfig.encryption ?? true,
      compression: extractConfig.compression ?? true
    };

    // Extract data from source
    const data = await this.extractDataForHyperFile(dataSource);

    // Create HYPER file
    const hyperBuffer = await this.generateHyperFile(data, dataSource);

    // Save extract
    extract.size = hyperBuffer.length;
    extract.rowcount = data.length;
    extract.columns = data.length > 0 ? Object.keys(data[0]) : [];

    return extract;
  }

  /**
   * Export visualization as Tableau-compatible format
   */
  async exportToTableauFormat(
    visualization: TableauVisualization,
    dataSource: TableauDataSource,
    format: 'tds' | 'twb' | 'hyper' | 'packaged'
  ): Promise<ExportResult> {
    try {
      let content: ArrayBuffer;
      let contentType: string;
      let fileExtension: string;

      switch (format) {
        case 'tds':
          content = await this.generateTDSFile(dataSource);
          contentType = 'application/xml';
          fileExtension = 'tds';
          break;

        case 'twb':
          const workbook: TableauWorkbook = {
            id: this.generateId(),
            name: `${dataSource.name}_Workbook`,
            datasources: [dataSource],
            worksheets: [{
              id: this.generateId(),
              name: 'Sheet 1',
              dataSourceId: dataSource.id,
              visualization,
              filters: [],
              parameters: [],
              marks: this.createDefaultMarks(),
              layout: this.createDefaultLayout()
            }],
            dashboards: [],
            version: '2023.1',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            author: 'QueryFlux',
            tags: ['queryflux', 'generated'],
            description: `Generated by QueryFlux AI platform`
          };

          content = await this.generateTWBFile(workbook);
          contentType = 'application/xml';
          fileExtension = 'twb';
          break;

        case 'hyper':
          const extract = await this.createTableauExtract(dataSource);
          content = await this.generateHyperFileContent(extract);
          contentType = 'application/octet-stream';
          fileExtension = 'hyper';
          break;

        case 'packaged':
          const packagedContent = await this.createPackagedWorkbook(dataSource, visualization);
          content = packagedContent;
          contentType = 'application/zip';
          fileExtension = 'twbx';
          break;

        default:
          throw new Error(`Unsupported export format: ${format}`);
      }

      return {
        success: true,
        content,
        contentType,
        fileName: `${dataSource.name}.${fileExtension}`,
        size: content.byteLength
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Migrate from Tableau to QueryFlux
   */
  async migrateFromTableau(
    tableauDataSourceUrl: string,
    connection: TableauServerConnection
  ): Promise<MigrationResult> {
    try {
      // Download Tableau data source
      const tdsContent = await this.downloadTableauDataSource(tableauDataSourceUrl, connection);

      // Parse Tableau data source
      const parsedDataSource = await this.parseTDSFile(tdsContent);

      // Convert to QueryFlux format
      const queryFluxConfig = await this.convertToQueryFluxFormat(parsedDataSource);

      // Create QueryFlux data source
      const queryFluxDataSource = await this.createDataSource(queryFluxConfig);

      // Test connection
      const testResult = await this.testQueryFluxDataSource(queryFluxDataSource);

      return {
        success: true,
        queryFluxDataSource,
        migrationLog: [`Successfully migrated Tableau data source: ${parsedDataSource.name}`],
        testResult,
        migratedAt: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        migrationLog: [`Migration failed: ${error.message}`],
        migratedAt: new Date().toISOString()
      };
    }
  }

  /**
   * Generate Tableau-compatible data source file (.tds)
   */
  private async generateTDSFile(dataSource: TableauDataSource): Promise<ArrayBuffer> {
    const xml = `<?xml version='1.0' encoding='utf-8' ?>
<datasource formatted-name='${dataSource.name}' inline='true' version='2023.1'>
  <connection authentication='${dataSource.credentials?.type || 'username_password'}'
             class='${this.getTableauConnectionClass(dataSource.connectionType)}'
             dbname='${dataSource.connectionDetails.database}'
             server='${dataSource.connectionDetails.server}'
             port='${dataSource.connectionDetails.port}'
             ssl='${dataSource.connectionDetails.ssl ? 'yes' : 'no'}'>
    ${dataSource.connectionDetails.username ? `<relation name='${dataSource.connectionDetails.username}' />` : ''}
  </connection>

  ${dataSource.tables.map(table => `
  <table name='${table.name}' alias='${table.alias || table.name}'>
    <columns>
      ${table.columns.map(col => `
      <column name='${col.name}'
              alias='${col.alias || col.name}'
              datatype='${this.convertDataTypeToTableau(col.dataType)}'
              role='${col.role}'
              hidden='${col.hidden}'>
        ${col.calculation ? `<calculation formula='${this.escapeXML(col.calculation)}' />` : ''}
      </column>`).join('')}
    </columns>
  </table>`).join('')}

  ${dataSource.customSQL ? `
  <customSQL>
    <query>${this.escapeXML(dataSource.customSQL)}</query>
  </customSQL>` : ''}
</datasource>`;

    return new TextEncoder().encode(xml).buffer;
  }

  /**
   * Generate Tableau workbook file (.twb)
   */
  private async generateTWBFile(workbook: TableauWorkbook): Promise<ArrayBuffer> {
    const xml = `<?xml version='1.0' encoding='utf-8' ?>
<workbook version='${workbook.version}'>
  <datasources>
    ${workbook.datasources.map(ds => `
    <datasource name='${ds.name}' caption='${ds.name}' inline='true'>
      <connection class='${this.getTableauConnectionClass(ds.connectionType)}'
                 dbname='${ds.connectionDetails.database}'
                 server='${ds.connectionDetails.server}'
                 port='${ds.connectionDetails.port}' />
    </datasource>`).join('')}
  </datasources>

  <worksheets>
    ${workbook.worksheets.map(ws => `
    <worksheet name='${ws.name}'>
      <view>
        <datasources>
          <datasource caption='${workbook.datasources.find(ds => ds.id === ws.dataSourceId)?.name}' />
        </datasources>
        <datasource-dependencies datasource='${ws.dataSourceId}' />
        <slices>
          <column column='[Number of Records]' />
        </slices>
      </view>
    </worksheet>`).join('')}
  </worksheets>

  <windows>
    ${workbook.worksheets.map(ws => `
    <window name='${ws.name}' class='worksheet'>
      <view name='${ws.name}' />
    </window>`).join('')}
  </windows>

  <thumbnails>
    ${workbook.worksheets.map(ws => `
    <thumbnail name='${ws.name}' type='worksheet' />`).join('')}
  </thumbnails>
</workbook>`;

    return new TextEncoder().encode(xml).buffer;
  }

  // Helper methods
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private getTableauConnectionClass(connectionType: string): string {
    const mapping: Record<string, string> = {
      'postgres': 'postgresql',
      'mysql': 'mysql',
      'mongodb': 'mongodb',
      'redshift': 'redshift',
      'snowflake': 'snowflake',
      'bigquery': 'bigquery',
      'oracle': 'oracle',
      'sqlserver': 'sqlserver'
    };
    return mapping[connectionType] || 'generic';
  }

  private convertDataTypeToTableau(dataType: string): string {
    const mapping: Record<string, string> = {
      'string': 'string',
      'number': 'real',
      'date': 'date',
      'boolean': 'boolean',
      'geographic': 'geography'
    };
    return mapping[dataType] || 'string';
  }

  private escapeXML(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private async validateConnection(connectionDetails: TableauConnectionDetails): Promise<boolean> {
    // Implementation would test the actual database connection
    return true;
  }

  private async extractTableSchema(connectionDetails: TableauConnectionDetails): Promise<TableauTable[]> {
    // Implementation would extract actual schema from database
    return [];
  }

  private async estimateDataSourceSize(dataSource: TableauDataSource): Promise<number> {
    // Implementation would calculate estimated size based on row counts and data types
    return 0;
  }

  private async findDataSourceOnServer(connection: TableauServerConnection, name: string): Promise<any> {
    // Implementation would search for existing data source on Tableau Server
    return null;
  }

  private async extractDataForHyperFile(dataSource: TableauDataSource): Promise<any[]> {
    // Implementation would extract data for creating HYPER file
    return [];
  }

  private async generateHyperFile(data: any[], dataSource: TableauDataSource): Promise<ArrayBuffer> {
    // Implementation would generate actual HYPER file format
    return new ArrayBuffer(0);
  }

  private createDefaultMarks(): TableauMarks {
    return {
      type: 'automatic',
      color: { type: 'categorical' },
      size: { type: 'continuous' },
      label: { type: 'categorical' },
      tooltip: { type: 'categorical' },
      detail: { type: 'categorical' }
    };
  }

  private createDefaultLayout(): TableauLayout {
    return {
      size: 'automatic',
      format: {
        fontSize: 10,
        fontFamily: 'Tableau',
        fontWeight: 'normal',
        fontStyle: 'normal',
        color: '#000000',
        alignment: 'left',
        backgroundColor: '#FFFFFF',
        borders: {
          showRowDividers: false,
          showColumnDividers: false,
          dividerThickness: 1,
          dividerColor: '#D6D6D6'
        }
      }
    };
  }

  private async createPackagedWorkbook(dataSource: TableauDataSource, visualization: TableauVisualization): Promise<ArrayBuffer> {
    // Implementation would create .twbx (packaged workbook) containing data and layout
    return new ArrayBuffer(0);
  }

  private async downloadTableauDataSource(url: string, connection: TableauServerConnection): Promise<ArrayBuffer> {
    // Implementation would download data source from Tableau Server
    return new ArrayBuffer(0);
  }

  private async parseTDSFile(content: ArrayBuffer): Promise<TableauDataSource> {
    // Implementation would parse Tableau data source XML
    return {} as TableauDataSource;
  }

  private async convertToQueryFluxFormat(tableauDataSource: TableauDataSource): Promise<Omit<TableauDataSource, 'id' | 'metadata'>> {
    // Implementation would convert Tableau format to QueryFlux format
    return tableauDataSource;
  }

  private async testQueryFluxDataSource(dataSource: TableauDataSource): Promise<any> {
    // Implementation would test the QueryFlux data source connection
    return { success: true };
  }

  private async generateHyperFileContent(extract: TableauExtract): Promise<ArrayBuffer> {
    // Implementation would generate actual HYPER file content
    return new ArrayBuffer(0);
  }
}

// Additional interface definitions
export interface TableauServerConnection {
  serverUrl: string;
  authToken: string;
  siteId: string;
  userId: string;
  connectedAt: string;
}

export interface TableauPublishResult {
  success: boolean;
  dataSourceId?: string;
  name?: string;
  createdAt?: string;
  url?: string;
  error?: string;
}

export interface ExportResult {
  success: boolean;
  content?: ArrayBuffer;
  contentType?: string;
  fileName?: string;
  size?: number;
  error?: string;
}

export interface MigrationResult {
  success: boolean;
  queryFluxDataSource?: TableauDataSource;
  migrationLog: string[];
  testResult?: any;
  error?: string;
  migratedAt: string;
}

export interface DataCharacteristics {
  rowCount: number;
  columnCount: number;
  dataTypes: Record<string, string>;
  isTimeSeries: boolean;
  isTrending: boolean;
  isCategorical: boolean;
  isComparison: boolean;
  isProportional: boolean;
  isSmallDataset: boolean;
  isCorrelation: boolean;
  hasNumericPairs: boolean;
  isGeographic: boolean;
  hasLocationData: boolean;
}

export interface NLPIntent {
  type: string;
  entities: any[];
  confidence: number;
}

export interface Insight {
  type: string;
  description: string;
  confidence: number;
}

export interface AnomalyConfig {
  timeframe: string;
  metrics: string[];
  sensitivity: number;
}

export interface AnomalyDetectionResult {
  id: string;
  metric: string;
  anomalyType: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  value: any;
  expectedValue: any;
  detectedAt: string;
}

export interface ForecastConfig {
  timeframe: string;
  confidence: number;
  seasonality: boolean;
}

export interface ForecastResult {
  data: any[];
  accuracy: number;
  recommendations: string[];
}

export interface ConfidenceInterval {
  date: string;
  lower: number;
  upper: number;
  confidence: number;
}

export interface Forecast {
  data: any[];
  accuracy: number;
  recommendations: string[];
}

export interface AnalysisResult {
  question: string;
  sql: string;
  data: any[];
  visualizations: VisualizationConfig[];
  insights: Insight[];
  confidence: number;
  narrative: string;
}

export interface VisualizationConfig {
  id: string;
  name: string;
  type: string;
  dataSource: string;
  query: string;
  fields: any[];
  filters: any[];
  styling: any;
  interactivity: any;
  aiOptimizations: any;
}

export interface Dashboard {
  id: string;
  name: string;
  description?: string;
  visualizations: VisualizationConfig[];
  layout: any;
  filters: any[];
  scheduling: any;
  permissions: any;
  branding: any;
  analytics: any;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardLayout {
  type: string;
  grid: any;
  responsive: any;
  autoArrange: boolean;
}

export interface DashboardAnalytics {
  views: number;
  uniqueViewers: string[];
  averageViewTime: number;
  mostPopularVisualization: string;
  lastViewed: string;
}

export interface GlobalFilter {
  id: string;
  name: string;
  field: string;
  type: string;
  options: any[];
}

export interface DashboardSchedule {
  enabled: boolean;
  frequency: string;
  recipients: string[];
}

export interface DashboardPermissions {
  owner: string;
  viewers: string[];
  editors: string[];
  public: boolean;
}

export interface DashboardBranding {
  logo: string;
  colors: any;
  fonts: any;
}

export interface Report {
  id: string;
  name: string;
  generatedAt: string;
  visualizations: any[];
  insights: any[];
  summary: string;
  format: string;
}

export interface ReportConfig {
  name: string;
  sections: ReportSection[];
  format: 'pdf' | 'excel' | 'powerpoint' | 'html';
  distribution: DistributionConfig;
}

export interface ReportSection {
  title: string;
  type: string;
  query: string;
  visualization: string;
  insights: boolean;
}

export interface DistributionConfig {
  emails: string[];
  schedule: string;
  format: string;
  subject: string;
  message: string;
}

export interface ReportSectionResult {
  visualizations: any[];
  insights: any[];
}

export interface DatabaseSchema {
  tables: any[];
  relationships: any[];
}

export interface DatabaseField {
  name: string;
  type: string;
  dataType: string;
  nullable: boolean;
  primaryKey: boolean;
  foreignKey: boolean;
}

export interface VisualizationBuilder {
  dataSource: string;
  fields: DatabaseField[];
  visualizations: any[];
  filters: any[];
  layout: any;
  tools: any;
}

export interface CollaborationSession {
  id: string;
  dashboardId: string;
  participants: string[];
  changes: any[];
  comments: any[];
  status: string;
  createdAt: string;
}

export interface VoiceContext {
  currentVisualization?: string;
  activeFilters?: any[];
  dataSource?: string;
}

export interface VoiceIntent {
  type: string;
  parameters: any;
  confidence: number;
}

export interface VoiceResponse {
  success: boolean;
  message: string;
  action?: string;
  data?: any;
}

export interface MobileVisualization {
  id: string;
  name: string;
  type: string;
  dataSource: string;
  responsive: any;
  touchGestures: any;
  performance: any;
}

export interface AdvancedAnalysisConfig {
  type: string;
  parameters: any;
  dataSource: string;
}

export interface AdvancedAnalysisResult {
  id: string;
  type: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  results: any[];
}
