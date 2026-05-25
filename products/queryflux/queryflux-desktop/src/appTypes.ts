import type { ConnectionConfig } from './lib/tauri-ipc';

export const DATABASE_TYPES = [
  { id: 'postgresql', label: 'PostgreSQL', initials: 'Pg', color: '#008fd3', defaultPort: 5432, description: 'Reliable relational app data.' },
  { id: 'redshift', label: 'Amazon Redshift', initials: 'Rs', color: '#1462a4', defaultPort: 5439, description: 'Warehouse analytics.' },
  { id: 'mysql', label: 'MySQL', initials: 'Ms', color: '#f59e0b', defaultPort: 3306, description: 'Application workloads.' },
  { id: 'mariadb', label: 'MariaDB & SingleStore', initials: 'Mr', color: '#199ca4', defaultPort: 3306, description: 'MySQL-compatible engines.' },
  { id: 'sqlserver', label: 'Microsoft SQL Server', initials: 'Ss', color: '#8b98a4', defaultPort: 1433, description: 'Enterprise SQL Server.' },
  { id: 'cassandra', label: 'Cassandra', initials: 'Cs', color: '#2f2f31', defaultPort: 9042, description: 'Wide-column data.' },
  { id: 'clickhouse', label: 'ClickHouse', initials: 'Ch', color: '#facc15', defaultPort: 8123, description: 'Columnar analytics.' },
  { id: 'bigquery', label: 'BigQuery', initials: 'Bq', color: '#4376dd', defaultPort: 443, description: 'Google data warehouse.' },
  { id: 'dynamodb', label: 'DynamoDB', initials: 'Dn', color: '#0f5ea8', defaultPort: 443, description: 'Managed key-value data.' },
  { id: 'libsql', label: 'LibSQL', initials: 'Ls', color: '#2cb088', defaultPort: 443, description: 'SQLite-compatible edge DB.' },
  { id: 'd1', label: 'Cloudflare D1', initials: 'D1', color: '#f28c31', defaultPort: 443, description: 'Cloudflare SQLite edge.' },
  { id: 'mongodb', label: 'Mongo', initials: 'Mg', color: '#08713d', defaultPort: 27017, description: 'Document collections.' },
  { id: 'snowflake', label: 'Snowflake', initials: 'Nf', color: '#2cbce8', defaultPort: 443, description: 'Cloud data platform.' },
  { id: 'redis', label: 'Redis', initials: 'Re', color: '#b61d10', defaultPort: 6379, description: 'Cache and key-value.' },
  { id: 'sqlite', label: 'SQLite', initials: 'Sl', color: '#8619f6', defaultPort: 0, description: 'Local app data files.' },
  { id: 'duckdb', label: 'DuckDB', initials: 'Du', color: '#050505', defaultPort: 0, description: 'Local analytics engine.' },
  { id: 'oracle', label: 'Oracle', initials: 'Oc', color: '#f00000', defaultPort: 1521, description: 'Oracle database.' },
  { id: 'cockroachdb', label: 'Cockroach', initials: 'Cr', color: '#3fad10', defaultPort: 26257, description: 'Distributed SQL.' },
] as const;

export const TABS = [
  { id: 'connections', label: 'Connections', icon: 'connections' },
  { id: 'query', label: 'Query Workbench', icon: 'query' },
  { id: 'insights', label: 'Visual Canvas', icon: 'monitor' },
  { id: 'monitor', label: 'Activity', icon: 'monitor' },
  { id: 'backup', label: 'Backup', icon: 'backup' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
] as const;

export type DatabaseType = (typeof DATABASE_TYPES)[number]['id'];
export type DesktopTab = (typeof TABS)[number]['id'];
export type IconName =
  | 'backup'
  | 'chevron'
  | 'close'
  | 'connections'
  | 'database'
  | 'history'
  | 'monitor'
  | 'plug'
  | 'plus'
  | 'query'
  | 'run'
  | 'search'
  | 'settings'
  | 'spark'
  | 'table';

export interface ConnectionFormState {
  name: string;
  dbType: DatabaseType;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
}

export const initialConnectionForm: ConnectionFormState = {
  name: '',
  dbType: 'postgresql',
  host: '127.0.0.1',
  port: 5432,
  database: '',
  username: '',
  password: '',
  ssl: true,
};

export function isDesktopTab(value: unknown): value is DesktopTab {
  return typeof value === 'string' && TABS.some((tab) => tab.id === value);
}

export function getDatabaseMeta(dbType: string) {
  return DATABASE_TYPES.find((database) => database.id === dbType) ?? DATABASE_TYPES[0];
}

export function getDatabaseLabel(dbType: string): string {
  return getDatabaseMeta(dbType).label;
}

export function getHostLabel(connection: ConnectionConfig): string {
  if (!connection.host || connection.host === '127.0.0.1' || connection.host === 'localhost') {
    return 'local';
  }

  return connection.host;
}
