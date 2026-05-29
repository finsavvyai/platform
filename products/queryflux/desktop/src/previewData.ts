import {
  getDatabaseLabel,
  getDatabaseMeta,
  type DatabaseType,
} from './appTypes';
import {
  getDefaultPort,
  type ConnectionConfig,
  type ConnectionStatus,
  type QueryResult,
} from './lib/tauri-ipc';

export const PREVIEW_LINKS: Array<{
  database: string;
  dbType: DatabaseType;
  host: string;
  latency: string;
  name: string;
  region: string;
  signal: string;
  ssl: boolean;
  username: string;
}> = [
  {
    database: 'app_core',
    dbType: 'postgresql',
    host: 'core-eu.queryflux.internal',
    latency: '42ms',
    name: 'Prod Core',
    region: 'eu-west-1 / encrypted',
    signal: 'Write-safe',
    ssl: true,
    username: 'service_rw',
  },
  {
    database: 'finance_analytics',
    dbType: 'snowflake',
    host: 'snowflake.queryflux.internal',
    latency: '88ms',
    name: 'Revenue Mesh',
    region: 'analytics cloud / read',
    signal: 'AI-ready',
    ssl: true,
    username: 'analyst_ro',
  },
  {
    database: 'cache_edge',
    dbType: 'redis',
    host: '127.0.0.1',
    latency: '11ms',
    name: 'Cache Edge',
    region: 'local tunnel / hot',
    signal: 'Realtime',
    ssl: false,
    username: 'cache_ops',
  },
];

export function buildPreviewConnections(): ConnectionConfig[] {
  return PREVIEW_LINKS.map((link) => ({
    id: `preview_${link.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
    name: link.name,
    db_type: link.dbType,
    host: link.host,
    port: getDatabaseMeta(link.dbType).defaultPort || getDefaultPort(link.dbType),
    database: link.database,
    username: link.username,
    password: undefined,
    ssl: link.ssl,
    options: {
      previewLatency: link.latency,
      previewRegion: link.region,
      previewSignal: link.signal,
    },
  }));
}

export function buildPreviewStatuses(connections: ConnectionConfig[]): Record<string, ConnectionStatus> {
  return connections.reduce<Record<string, ConnectionStatus>>((statuses, connection) => {
    statuses[connection.id] = {
      id: connection.id,
      name: connection.name,
      connected: true,
      last_error: null,
    };
    return statuses;
  }, {});
}

export function buildPreviewConnectionStatus(connection: ConnectionConfig): ConnectionStatus {
  const fingerprint = `${connection.name} ${connection.host}`.toLowerCase();
  const connected = !/(invalid|fail|legacy|offline)/.test(fingerprint);

  return {
    id: connection.id,
    name: connection.name,
    connected,
    last_error: connected ? null : 'Preview handshake rejected. Validate host, credentials, or network path.',
  };
}

export interface PreviewSchemaTable {
  name: string;
  schema: string;
  rowCount: string;
  columns: Array<{
    name: string;
    type: string;
    key?: boolean;
  }>;
}

export function buildPreviewSchema(connection: ConnectionConfig): PreviewSchemaTable[] {
  if (connection.db_type === 'redis') {
    return [
      {
        name: 'session_tokens',
        schema: 'edge',
        rowCount: '84.2k',
        columns: [
          { name: 'token_hash', type: 'string', key: true },
          { name: 'user_id', type: 'string' },
          { name: 'expires_at', type: 'timestamp' },
          { name: 'region', type: 'string' },
        ],
      },
      {
        name: 'schema_index',
        schema: 'edge',
        rowCount: '4.8k',
        columns: [
          { name: 'connection_id', type: 'string', key: true },
          { name: 'table_name', type: 'string' },
          { name: 'embedding_ref', type: 'string' },
          { name: 'last_seen_at', type: 'timestamp' },
        ],
      },
    ];
  }

  if (connection.db_type === 'snowflake') {
    return [
      {
        name: 'customer_health',
        schema: 'analytics',
        rowCount: '18.4k',
        columns: [
          { name: 'account_id', type: 'varchar', key: true },
          { name: 'customer_segment', type: 'varchar' },
          { name: 'arr_usd', type: 'number' },
          { name: 'health_score', type: 'number' },
        ],
      },
      {
        name: 'warehouse_costs',
        schema: 'finance',
        rowCount: '9.7k',
        columns: [
          { name: 'warehouse_id', type: 'varchar', key: true },
          { name: 'credits_used', type: 'number' },
          { name: 'cost_usd', type: 'number' },
          { name: 'billing_day', type: 'date' },
        ],
      },
    ];
  }

  return [
    {
      name: 'users',
      schema: 'public',
      rowCount: '18.2k',
      columns: [
        { name: 'user_id', type: 'uuid', key: true },
        { name: 'account_tier', type: 'text' },
        { name: 'last_seen_at', type: 'timestamp' },
        { name: 'weekly_queries', type: 'integer' },
      ],
    },
    {
      name: 'query_runs',
      schema: 'public',
      rowCount: '241k',
      columns: [
        { name: 'run_id', type: 'uuid', key: true },
        { name: 'connection_id', type: 'uuid' },
        { name: 'duration_ms', type: 'integer' },
        { name: 'status', type: 'text' },
      ],
    },
    {
      name: 'audit_events',
      schema: 'security',
      rowCount: '72.6k',
      columns: [
        { name: 'event_id', type: 'uuid', key: true },
        { name: 'actor', type: 'text' },
        { name: 'action', type: 'text' },
        { name: 'created_at', type: 'timestamp' },
      ],
    },
  ];
}

function inferPreviewColumnType(value: unknown): string {
  if (typeof value === 'boolean') {
    return 'boolean';
  }

  if (typeof value === 'number') {
    return Number.isInteger(value) ? 'integer' : 'numeric';
  }

  return 'text';
}

function buildPreviewColumns(rows: Record<string, unknown>[]): QueryResult['columns'] {
  const [firstRow] = rows;

  if (!firstRow) {
    return [];
  }

  return Object.entries(firstRow).map(([name, value]) => ({
    name,
    data_type: inferPreviewColumnType(value),
    nullable: value === null,
  }));
}

export function buildPreviewSql(
  naturalLanguage: string,
  connection: ConnectionConfig,
): { confidence: number; explanation: string; sql: string } {
  const prompt = naturalLanguage.trim().toLowerCase();

  if (prompt.includes('revenue') || prompt.includes('arr') || prompt.includes('segment')) {
    return {
      confidence: 0.94,
      explanation: 'Mapped the request to a segment-level revenue summary for the active analytics model.',
      sql: [
        'SELECT customer_segment,',
        '       SUM(arr_usd) AS total_arr_usd,',
        '       COUNT(*) AS account_count',
        'FROM analytics.customer_health',
        'GROUP BY customer_segment',
        'ORDER BY total_arr_usd DESC',
        'LIMIT 8;',
      ].join('\n'),
    };
  }

  if (prompt.includes('active users') || prompt.includes('signup') || prompt.includes('users')) {
    return {
      confidence: 0.91,
      explanation: 'Generated a recent active-user slice with lifecycle and spend signals.',
      sql: [
        'SELECT user_id,',
        '       account_tier,',
        '       last_seen_at,',
        '       weekly_queries,',
        '       arr_usd',
        'FROM mart.active_users',
        'ORDER BY last_seen_at DESC',
        'LIMIT 25;',
      ].join('\n'),
    };
  }

  if (prompt.includes('cache') || prompt.includes('latency') || prompt.includes('realtime')) {
    return {
      confidence: 0.89,
      explanation: 'Routed the request to cache-health telemetry for the low-latency edge layer.',
      sql: [
        'SELECT keyspace,',
        '       hit_rate_pct,',
        '       eviction_rate_pct,',
        '       p95_latency_ms',
        'FROM edge.cache_health',
        'ORDER BY hit_rate_pct DESC',
        'LIMIT 12;',
      ].join('\n'),
    };
  }

  return {
    confidence: 0.86,
    explanation: `Built a safe default query for ${getDatabaseLabel(connection.db_type)} using the active preview connection.`,
    sql: [
      'SELECT metric_name,',
      '       current_value,',
      '       trend_direction,',
      '       recorded_at',
      'FROM observability.command_center_metrics',
      'ORDER BY recorded_at DESC',
      'LIMIT 20;',
    ].join('\n'),
  };
}

export function buildPreviewQueryResult(query: string, connection: ConnectionConfig): QueryResult {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return {
      columns: [],
      rows: [],
      row_count: 0,
      execution_time_ms: 0,
      success: false,
      error: 'Preview workbench needs a SQL statement before execution.',
    };
  }

  if (/\b(drop|truncate|alter|delete)\b/.test(normalized)) {
    return {
      columns: [],
      rows: [],
      row_count: 0,
      execution_time_ms: 14,
      success: false,
      error: 'Preview guardrail blocked a destructive statement. Run native mode for real write-path testing.',
    };
  }

  let rows: Record<string, unknown>[];

  if (normalized.includes('count(')) {
    rows = [
      {
        total_records: connection.db_type === 'redis' ? 128744 : connection.db_type === 'snowflake' ? 8241 : 18241,
      },
    ];
  } else if (normalized.includes('revenue') || normalized.includes('arr') || normalized.includes('segment')) {
    rows = [
      { customer_segment: 'Enterprise', total_arr_usd: 1824000, account_count: 42 },
      { customer_segment: 'Scale-Up', total_arr_usd: 964000, account_count: 71 },
      { customer_segment: 'Mid-Market', total_arr_usd: 612000, account_count: 118 },
      { customer_segment: 'Starter', total_arr_usd: 188000, account_count: 304 },
    ];
  } else if (normalized.includes('cache') || normalized.includes('latency') || connection.db_type === 'redis') {
    rows = [
      { keyspace: 'session_tokens', hit_rate_pct: 99.14, eviction_rate_pct: 0.02, p95_latency_ms: 4.8 },
      { keyspace: 'schema_index', hit_rate_pct: 97.82, eviction_rate_pct: 0.11, p95_latency_ms: 6.2 },
      { keyspace: 'query_suggestions', hit_rate_pct: 96.41, eviction_rate_pct: 0.23, p95_latency_ms: 7.4 },
    ];
  } else if (normalized.includes('users') || normalized.includes('signup') || connection.db_type === 'postgresql') {
    rows = [
      { user_id: 'usr_2048', account_tier: 'enterprise', last_seen_at: '2026-04-23 09:14:22', weekly_queries: 812, arr_usd: 48000 },
      { user_id: 'usr_1984', account_tier: 'scale-up', last_seen_at: '2026-04-23 09:10:09', weekly_queries: 531, arr_usd: 18000 },
      { user_id: 'usr_1761', account_tier: 'mid-market', last_seen_at: '2026-04-23 08:57:41', weekly_queries: 320, arr_usd: 9600 },
      { user_id: 'usr_1417', account_tier: 'starter', last_seen_at: '2026-04-23 08:41:16', weekly_queries: 108, arr_usd: 2400 },
    ];
  } else {
    rows = [
      { metric_name: 'query_success_rate', current_value: '99.82%', trend_direction: 'up', recorded_at: '2026-04-23 09:15:00' },
      { metric_name: 'p95_execution_ms', current_value: 82, trend_direction: 'down', recorded_at: '2026-04-23 09:10:00' },
      { metric_name: 'active_links', current_value: 3, trend_direction: 'steady', recorded_at: '2026-04-23 09:05:00' },
    ];
  }

  return {
    columns: buildPreviewColumns(rows),
    rows,
    row_count: rows.length,
    execution_time_ms: Math.max(
      connection.db_type === 'redis' ? 9 : connection.db_type === 'snowflake' ? 72 : 24,
      12 + (query.length % 57),
    ),
    success: true,
    error: null,
  };
}
