/**
 * InfluxDB Adapter
 * Time series database with Flux query language
 */

import { DatabaseAdapter, DatabaseConnection, QueryResult, DatabaseSchema, TableInfo, ColumnInfo } from '../types';

interface InfluxDBConfig extends DatabaseConnection {
  org?: string;
  bucket?: string;
  token?: string;
  ssl?: boolean;
  timeout?: number;
}

interface Point {
  measurement: string;
  tags: Record<string, string>;
  fields: Record<string, any>;
  timestamp?: Date;
}

interface Bucket {
  name: string;
  orgID: string;
  retentionPolicy?: string;
  description?: string;
}

interface Measurement {
  name: string;
  fieldCount: number;
  tagCount: number;
}

export class InfluxDBAdapter implements DatabaseAdapter {
  private config: InfluxDBConfig;
  private token: string | null = null;

  constructor(config: InfluxDBConfig) {
    this.config = {
      timeout: 30000,
      ssl: true,
      ...config
    };
  }

  async connect(): Promise<void> {
    try {
      // Validate connection to InfluxDB
      const response = await this.makeRequest('/health', 'GET');
      if (!response.ok) {
        throw new Error(`InfluxDB connection failed: ${response.statusText}`);
      }

      // Authenticate if token is provided
      if (this.config.token) {
        this.token = this.config.token;
        // Verify token validity
        const authResponse = await this.makeRequest('/api/v2/me', 'GET');
        if (!authResponse.ok) {
          throw new Error('Invalid InfluxDB token');
        }
      }

      console.log('Connected to InfluxDB successfully');
    } catch (error) {
      throw new Error(`InfluxDB connection failed: ${error}`);
    }
  }

  async disconnect(): Promise<void> {
    this.token = null;
  }

  async testConnection(): Promise<boolean> {
    try {
      if (!this.token) {
        await this.connect();
      }
      const response = await this.makeRequest('/api/v2/me', 'GET');
      return response.ok;
    } catch (error) {
      console.error('InfluxDB connection test failed:', error);
      return false;
    }
  }

  async executeQuery(query: string, params?: any[]): Promise<QueryResult> {
    if (!this.token) {
      throw new Error('Not authenticated with InfluxDB');
    }

    const start = Date.now();

    try {
      // Check if it's a Flux query or InfluxQL
      const isFluxQuery = query.toLowerCase().includes('from(bucket:') ||
                        query.toLowerCase().includes('|>') ||
                        query.toLowerCase().includes('range(');

      let response: Response;
      let data: any;

      if (isFluxQuery) {
        // Execute Flux query
        response = await this.makeRequest('/api/v2/query?org=' + encodeURIComponent(this.config.org || ''), 'POST', {
          query: query,
          type: 'flux'
        });

        const result = await response.json();
        data = this.parseFluxResult(result);
      } else {
        // Execute InfluxQL query (for InfluxDB 1.x compatibility)
        response = await this.makeRequest('/query', 'GET', null, {
          q: query,
          db: this.config.database
        });

        const result = await response.json();
        data = this.parseInfluxQLResult(result);
      }

      const executionTime = Date.now() - start;

      return {
        rows: data.rows,
        rowCount: data.rows.length,
        columns: data.columns,
        executionTime,
        query
      };
    } catch (error) {
      throw new Error(`Query execution failed: ${error}`);
    }
  }

  async getSchema(): Promise<DatabaseSchema> {
    if (!this.token) {
      throw new Error('Not authenticated with InfluxDB');
    }

    try {
      // Get buckets (databases)
      const buckets = await this.getBuckets();

      // Get measurements for each bucket
      const tables: TableInfo[] = [];

      for (const bucket of buckets) {
        const measurements = await this.getMeasurements(bucket.name);

        for (const measurement of measurements) {
          const columns = await this.getFields(bucket.name, measurement.name);

          tables.push({
            name: measurement.name,
            schema: bucket.name,
            type: 'MEASUREMENT',
            rowEstimate: 0,
            size: 0,
            columns: columns.map(col => ({
              name: col,
              type: 'field',
              nullable: true
            }))
          });
        }
      }

      return {
        name: 'InfluxDB',
        tables,
        functions: this.getFluxFunctions(),
        procedures: this.getInfluxQLFunctions()
      };
    } catch (error) {
      throw new Error(`Schema retrieval failed: ${error}`);
    }
  }

  private async makeRequest(
    endpoint: string,
    method: string,
    body?: any,
    params?: Record<string, string>
  ): Promise<Response> {
    const url = new URL(`${this.config.ssl ? 'https' : 'http'}://${this.config.host}:${this.config.port}${endpoint}`);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Token ${this.token}`;
    }

    const response = await fetch(url.toString(), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(this.config.timeout!)
    });

    return response;
  }

  private parseFluxResult(result: any): { rows: any[], columns: any[] } {
    const rows: any[] = [];
    const columns: any[] = [];

    if (result && result._results && result._results.length > 0) {
      const data = result._results[0];

      if (data._series && data._series.length > 0) {
        const series = data._series[0];

        // Extract column information
        if (series.columns) {
          series.columns.forEach((col: any, index: number) => {
            columns.push({
              name: col.label || col._value || `col_${index}`,
              type: 'string', // Flux doesn't have strict types
              nullable: true
            });
          });
        }

        // Extract rows
        if (series.values) {
          series.values.forEach((row: any[]) => {
            const rowObj: any = {};
            columns.forEach((col, index) => {
              rowObj[col.name] = row[index];
            });
            rows.push(rowObj);
          });
        }
      }
    }

    return { rows, columns };
  }

  private parseInfluxQLResult(result: any): { rows: any[], columns: any[] } {
    const rows: any[] = [];
    const columns: any[] = [];

    if (result.results && result.results.length > 0) {
      const series = result.results[0].series;

      if (series && series.length > 0) {
        const firstSeries = series[0];

        // Extract columns
        if (firstSeries.columns) {
          firstSeries.columns.forEach((col: string) => {
            columns.push({
              name: col,
              type: this.inferType(col),
              nullable: true
            });
          });
        }

        // Extract rows
        if (firstSeries.values) {
          firstSeries.values.forEach((row: any[]) => {
            const rowObj: any = {};
            columns.forEach((col, index) => {
              rowObj[col.name] = row[index];
            });
            rows.push(rowObj);
          });
        }
      }
    }

    return { rows, columns };
  }

  private inferType(columnName: string): string {
    const name = columnName.toLowerCase();
    if (name === 'time') return 'timestamp';
    if (name.includes('value') || name.includes('count') || name.includes('sum')) return 'number';
    if (name.includes('flag') || name.includes('bool')) return 'boolean';
    return 'string';
  }

  // InfluxDB specific methods

  async getBuckets(): Promise<Bucket[]> {
    const response = await this.makeRequest('/api/v2/buckets', 'GET');
    const data = await response.json();

    return data.buckets.map((bucket: any) => ({
      name: bucket.name,
      orgID: bucket.orgID,
      retentionPolicy: bucket.retentionRules?.[0]?.typeSeconds,
      description: bucket.description
    }));
  }

  async createBucket(
    name: string,
    orgID: string,
    retentionRules?: any[]
  ): Promise<void> {
    await this.makeRequest('/api/v2/buckets', 'POST', {
      name,
      orgID,
      retentionRules
    });
  }

  async deleteBucket(bucketID: string): Promise<void> {
    await this.makeRequest(`/api/v2/buckets/${bucketID}`, 'DELETE');
  }

  async getMeasurements(bucket: string): Promise<Measurement[]> {
    const query = `import "influxdata/influxdb/schema"
schema.measurements(bucket: "${bucket}")`;

    const result = await this.executeQuery(query);
    const measurements: Measurement[] = [];

    // Group by measurement name and count fields/tags
    const measurementMap = new Map();

    result.rows.forEach(row => {
      const name = row._value;
      if (!measurementMap.has(name)) {
        measurementMap.set(name, { fieldCount: 0, tagCount: 0 });
      }
    });

    measurementMap.forEach((value, key) => {
      measurements.push({
        name: key,
        fieldCount: value.fieldCount,
        tagCount: value.tagCount
      });
    });

    return measurements;
  }

  async getFields(bucket: string, measurement: string): Promise<string[]> {
    const query = `import "influxdata/influxdb/schema"
schema.fields(bucket: "${bucket}", measurement: "${measurement}")`;

    const result = await this.executeQuery(query);
    return result.rows.map(row => row._value);
  }

  async getTags(bucket: string, measurement: string): Promise<string[]> {
    const query = `import "influxdata/influxdb/schema"
schema.tagKeys(bucket: "${bucket}", measurement: "${measurement}")`;

    const result = await this.executeQuery(query);
    return result.rows.map(row => row._value);
  }

  async writePoints(bucket: string, org: string, points: Point[]): Promise<void> {
    if (!this.token) {
      throw new Error('Not authenticated with InfluxDB');
    }

    const lines: string[] = [];

    points.forEach(point => {
      const tagsStr = Object.entries(point.tags)
        .map(([key, value]) => `${key}=${value}`)
        .join(',');

      const fieldsStr = Object.entries(point.fields)
        .map(([key, value]) => {
          if (typeof value === 'string') {
            return `${key}="${value}"`;
          } else if (typeof value === 'boolean') {
            return `${key}=${value ? 't' : 'f'}`;
          } else {
            return `${key}=${value}`;
          }
        })
        .join(',');

      const timestampStr = point.timestamp ? ` ${point.timestamp.getTime()}000000` : '';

      lines.push(`${point.measurement}${tagsStr ? ',' + tagsStr : ''} ${fieldsStr}${timestampStr}`);
    });

    const response = await this.makeRequest(
      `/api/v2/write?org=${encodeURIComponent(org)}&bucket=${encodeURIComponent(bucket)}`,
      'POST',
      lines.join('\n'),
      { 'Content-Type': 'text/plain; charset=utf-8' }
    );

    if (!response.ok) {
      throw new Error(`Write failed: ${response.statusText}`);
    }
  }

  async deleteData(
    bucket: string,
    org: string,
    start: Date,
    stop: Date,
    predicate?: string
  ): Promise<void> {
    const deleteParams = {
      start: start.toISOString(),
      stop: stop.toISOString(),
      predicate: predicate || '_measurement="*"'
    };

    await this.makeRequest(
      `/api/v2/delete?org=${encodeURIComponent(org)}&bucket=${encodeURIComponent(bucket)}`,
      'POST',
      deleteParams
    );
  }

  // Flux query helpers

  async timeSeriesQuery(
    bucket: string,
    measurement: string,
    field: string,
    start: Date,
    stop: Date,
    aggregateFunction?: string,
    window?: string
  ): Promise<QueryResult> {
    let query = `from(bucket: "${bucket}")
  |> range(start: ${start.toISOString()}, stop: ${stop.toISOString()})
  |> filter(fn: (r) => r._measurement == "${measurement}")
  |> filter(fn: (r) => r._field == "${field}")`;

    if (aggregateFunction && window) {
      query += `
  |> aggregateWindow(every: ${window}, fn: ${aggregateFunction})`;
    }

    query += `
  |> yield(name: "result")`;

    return this.executeQuery(query);
  }

  async groupByQuery(
    bucket: string,
    measurement: string,
    field: string,
    start: Date,
    stop: Date,
    groupBy: string[]
  ): Promise<QueryResult> {
    const groupByClause = groupBy.map(tag => `r.${tag}`).join(', ');

    const query = `from(bucket: "${bucket}")
  |> range(start: ${start.toISOString()}, stop: ${stop.toISOString()})
  |> filter(fn: (r) => r._measurement == "${measurement}")
  |> filter(fn: (r) => r._field == "${field}")
  |> group(columns: [${groupByClause}])
  |> mean()
  |> yield(name: "grouped_result")`;

    return this.executeQuery(query);
  }

  async pivotQuery(
    bucket: string,
    measurement: string,
    start: Date,
    stop: Date
  ): Promise<QueryResult> {
    const query = `from(bucket: "${bucket}")
  |> range(start: ${start.toISOString()}, stop: ${stop.toISOString()})
  |> filter(fn: (r) => r._measurement == "${measurement}")
  |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
  |> yield(name: "pivoted_result")`;

    return this.executeQuery(query);
  }

  // Database management

  async getOrganizations(): Promise<any[]> {
    const response = await this.makeRequest('/api/v2/orgs', 'GET');
    const data = await response.json();
    return data.orgs;
  }

  async createOrganization(name: string): Promise<any> {
    const response = await this.makeRequest('/api/v2/orgs', 'POST', { name });
    return response.json();
  }

  async getTokens(orgID: string): Promise<any[]> {
    const response = await this.makeRequest('/api/v2/tokens', 'GET', null, { orgID });
    const data = await response.json();
    return data.tokens;
  }

  async createToken(
    orgID: string,
    description: string,
    permissions: any[]
  ): Promise<any> {
    const response = await this.makeRequest('/api/v2/tokens', 'POST', {
      orgID,
      description,
      permissions
    });
    return response.json();
  }

  // Monitoring and statistics

  async getBucketStats(bucket: string): Promise<any> {
    const query = `from(bucket: "${bucket}")
  |> range(start: -30d)
  |> group()
  |> count()`;

    const result = await this.executeQuery(query);
    return result.rows[0] || { count: 0 };
  }

  async getSeriesCardinality(bucket: string): Promise<any> {
    const query = `from(bucket: "${bucket}")
  |> range(start: -1h)
  |> group()
  |> distinct(column: "_measurement")
  |> count()`;

    const result = await this.executeQuery(query);
    return result.rows[0];
  }

  async getFieldCardinality(bucket: string, measurement: string): Promise<any> {
    const query = `from(bucket: "${bucket}")
  |> range(start: -1h)
  |> filter(fn: (r) => r._measurement == "${measurement}")
  |> group()
  |> distinct(column: "_field")
  |> count()`;

    const result = await this.executeQuery(query);
    return result.rows[0];
  }

  getFluxFunctions(): any[] {
    return [
      { name: 'from', category: 'Sources', description: 'Query data from a bucket' },
      { name: 'range', category: 'Transformations', description: 'Filter time range' },
      { name: 'filter', category: 'Transformations', description: 'Filter data based on conditions' },
      { name: 'aggregateWindow', category: 'Aggregations', description: 'Aggregate data in time windows' },
      { name: 'mean', category: 'Aggregations', description: 'Calculate mean value' },
      { name: 'sum', category: 'Aggregations', description: 'Calculate sum of values' },
      { name: 'count', category: 'Aggregations', description: 'Count number of records' },
      { name: 'max', category: 'Aggregations', description: 'Find maximum value' },
      { name: 'min', category: 'Aggregations', description: 'Find minimum value' },
      { name: 'group', category: 'Transformations', description: 'Group data by columns' },
      { name: 'pivot', category: 'Transformations', description: 'Pivot data from wide to long format' },
      { name: 'map', category: 'Transformations', description: 'Apply function to each record' },
      { name: 'keep', category: 'Transformations', description: 'Keep only specified columns' },
      { name: 'drop', category: 'Transformations', description: 'Drop specified columns' },
      { name: 'duplicate', category: 'Transformations', description: 'Duplicate columns' },
      { name: 'rename', category: 'Transformations', description: 'Rename columns' },
      { name: 'set', category: 'Transformations', description: 'Set column values' },
      { name: 'fill', category: 'Transformations', description: 'Fill null values' },
      { name: 'limit', category: 'Transformations', description: 'Limit number of records' },
      { name: 'sort', category: 'Transformations', description: 'Sort records' },
      { name: 'window', category: 'Transformations', description: 'Create windows over time' },
      { name: 'elapsed', category: 'Transformations', description: 'Calculate elapsed time' },
      { name: 'integral', category: 'Aggregations', description: 'Calculate integral over time' },
      { name: 'derivative', category: 'Transformations', description: 'Calculate derivative' },
      { name: 'difference', category: 'Transformations', description: 'Calculate difference between consecutive values' },
      { name: 'exponentialMovingAverage', category: 'Aggregations', description: 'Calculate exponential moving average' },
      { name: 'median', category: 'Aggregations', description: 'Calculate median value' },
      { name: 'mode', category: 'Aggregations', description: 'Find mode value' },
      { name: 'stddev', category: 'Aggregations', description: 'Calculate standard deviation' },
      { name: 'skew', category: 'Aggregations', description: 'Calculate skewness' },
      { name: 'kurtosis', category: 'Aggregations', description: 'Calculate kurtosis' },
      { name: 'histogram', category: 'Aggregations', description: 'Create histogram' },
      { name: 'quantile', category: 'Aggregations', description: 'Calculate quantiles' },
      { name: 'linearRegression', category: 'Predictions', description: 'Perform linear regression' },
      { name: 'holtWinters', category: 'Predictions', description: 'Holt-Winters forecasting' },
      { name: 'join', category: 'Joins', description: 'Join two data streams' },
      { name: 'union', category: 'Joins', description: 'Union two data streams' },
      { name: 'intersect', category: 'Joins', description: 'Intersect two data streams' },
      { name: 'difference', category: 'Joins', description: 'Difference between two data streams' }
    ];
  }

  getInfluxQLFunctions(): any[] {
    return [
      { name: 'SELECT', category: 'Query', description: 'Select data from measurements' },
      { name: 'FROM', category: 'Query', description: 'Specify measurement' },
      { name: 'WHERE', category: 'Filter', description: 'Filter data conditions' },
      { name: 'GROUP BY', category: 'Aggregation', description: 'Group results' },
      { name: 'ORDER BY', category: 'Sort', description: 'Sort results' },
      { name: 'LIMIT', category: 'Limit', description: 'Limit number of results' },
      { name: 'OFFSET', category: 'Limit', description: 'Skip number of results' },
      { name: 'SLIMIT', category: 'Limit', description: 'Limit series' },
      { name: 'SOFFSET', category: 'Limit', description: 'Skip series' },
      { name: 'fill', category: 'Function', description: 'Fill null values' },
      { name: 'time', category: 'Function', description: 'Time function' },
      { name: 'now', category: 'Function', description: 'Current time' },
      { name: 'mean', category: 'Aggregation', description: 'Calculate mean' },
      { name: 'median', category: 'Aggregation', description: 'Calculate median' },
      { name: 'mode', category: 'Aggregation', description: 'Calculate mode' },
      { name: 'sum', category: 'Aggregation', description: 'Calculate sum' },
      { name: 'count', category: 'Aggregation', description: 'Count values' },
      { name: 'min', category: 'Aggregation', description: 'Find minimum' },
      { name: 'max', category: 'Aggregation', description: 'Find maximum' },
      { name: 'first', category: 'Aggregation', description: 'Find first value' },
      { name: 'last', category: 'Aggregation', description: 'Find last value' },
      { name: 'distinct', category: 'Aggregation', description: 'Find distinct values' },
      { name: 'derivative', category: 'Function', description: 'Calculate derivative' },
      { name: 'difference', category: 'Function', description: 'Calculate difference' },
      { name: 'moving_average', category: 'Function', description: 'Calculate moving average' },
      { name: 'cumulative_sum', category: 'Function', description: 'Calculate cumulative sum' },
      { name: 'elapsed', category: 'Function', description: 'Calculate elapsed time' },
      { name: 'stddev', category: 'Aggregation', description: 'Calculate standard deviation' },
      { name: 'spread', category: 'Aggregation', description: 'Calculate spread' }
    ];
  }

  getHelperTemplates(): Record<string, string> {
    return {
      'basic_flux_query': `
// Basic Flux query to get data from a bucket
from(bucket: "your-bucket")
  |> range(start: -1h)
  |> filter(fn: (r) => r._measurement == "your-measurement")
  |> filter(fn: (r) => r._field == "your-field")
  |> yield(name: "result")
      `,
      'aggregation_query': `
// Aggregate data over time windows
from(bucket: "your-bucket")
  |> range(start: -24h)
  |> filter(fn: (r) => r._measurement == "sensor-data")
  |> filter(fn: (r) => r._field == "temperature")
  |> aggregateWindow(every: 1h, fn: mean, createEmpty: false)
  |> yield(name: "hourly-avg")
      `,
      'group_by_tags': `
// Group data by tags
from(bucket: "your-bucket")
  |> range(start: -1h)
  |> filter(fn: (r) => r._measurement == "sensor-data")
  |> filter(fn: (r) => r._field == "temperature")
  |> group(columns: ["location", "device"])
  |> mean()
  |> group()
  |> yield(name: "avg-by-location-device")
      `,
      'pivot_data': `
// Pivot data from long to wide format
from(bucket: "your-bucket")
  |> range(start: -1h)
  |> filter(fn: (r) => r._measurement == "sensor-data")
  |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
  |> yield(name: "pivoted-data")
      `,
      'fill_missing_data': `
// Fill missing data using previous value
from(bucket: "your-bucket")
  |> range(start: -1h)
  |> filter(fn: (r) => r._measurement == "sensor-data")
  |> filter(fn: (r) => r._field == "temperature")
  |> aggregateWindow(every: 5m, fn: mean, createEmpty: false)
  |> fill(column: "_value", usePrevious: true)
  |> yield(name: "filled-data")
      `,
      'calculate_derivative': `
// Calculate rate of change
from(bucket: "your-bucket")
  |> range(start: -1h)
  |> filter(fn: (r) => r._measurement == "sensor-data")
  |> filter(fn: (r) => r._field == "pressure")
  |> derivative(unit: 1m)
  |> yield(name: "pressure-rate")
      `,
      'moving_average': `
// Calculate moving average
from(bucket: "your-bucket")
  |> range(start: -1h)
  |> filter(fn: (r) => r._measurement == "sensor-data")
  |> filter(fn: (r) => r._field == "temperature")
  |> movingAverage(every: 5m, n: 12)
  |> yield(name: "smoothed-temperature")
      `,
      'multiple_measurements': `
// Query multiple measurements
sensor_data = from(bucket: "your-bucket")
  |> range(start: -1h)
  |> filter(fn: (r) => r._measurement == "sensor-data")

alerts = from(bucket: "your-bucket")
  |> range(start: -1h)
  |> filter(fn: (r) => r._measurement == "alerts")

join(tables: {sensor: sensor_data, alert: alerts}, on: ["_time", "device_id"])
  |> yield(name: "sensor-with-alerts")
      `,
      'conditional_filtering': `
// Conditional filtering with multiple conditions
from(bucket: "your-bucket")
  |> range(start: -1h)
  |> filter(fn: (r) =>
    r._measurement == "sensor-data" and
    (r.location == "server-room" or r.location == "lab") and
    r._value > 25.0
  )
  |> alert()
  |> yield(name: "high-temp-alerts")
      `
    };
  }

  validateQuery(query: string): { isValid: boolean; error?: string } {
    const queryLower = query.toLowerCase();

    // Check for required Flux syntax
    if (queryLower.includes('from(bucket:') && !queryLower.includes('range(')) {
      return {
        isValid: false,
        error: 'Flux queries with from(bucket:) must include a range() call'
      };
    }

    // Check for balanced parentheses
    let parenCount = 0;
    for (const char of query) {
      if (char === '(') parenCount++;
      if (char === ')') parenCount--;
    }
    if (parenCount !== 0) {
      return {
        isValid: false,
        error: 'Unbalanced parentheses in query'
      };
    }

    return { isValid: true };
  }
}
