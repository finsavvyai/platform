import { DatabaseType } from '../types/database';

export interface ParsedConnectionURL {
  type: DatabaseType | null;
  protocol: string;
  username?: string;
  password?: string;
  host?: string;
  port?: number;
  database?: string;
  ssl?: boolean;
  params?: Record<string, string>;
}

export function parseConnectionURL(url: string): ParsedConnectionURL {
  try {
    const urlPattern = /^([a-z0-9+]+):\/\/(?:([^:@]+)?(?::([^@]+))?@)?([^:/?]+)?(?::(\d+))?(?:\/([^?]+))?(?:\?(.+))?$/i;
    const match = url.match(urlPattern);

    if (!match) {
      return { type: null, protocol: '' };
    }

    const [, protocol, username, password, host, portStr, database, queryString] = match;
    const port = portStr ? parseInt(portStr, 10) : undefined;

    const params: Record<string, string> = {};
    if (queryString) {
      queryString.split('&').forEach(param => {
        const [key, value] = param.split('=');
        if (key) params[key] = decodeURIComponent(value || '');
      });
    }

    const type = protocolToType(protocol);
    const ssl = params.ssl === 'true' || params.sslmode === 'require';

    return {
      type,
      protocol,
      username,
      password,
      host,
      port,
      database,
      ssl,
      params,
    };
  } catch (error) {
    console.error('Error parsing connection URL:', error);
    return { type: null, protocol: '' };
  }
}

function protocolToType(protocol: string): DatabaseType | null {
  const protocolMap: Record<string, DatabaseType> = {
    'postgres': 'postgresql',
    'postgresql': 'postgresql',
    'mysql': 'mysql',
    'mariadb': 'mariadb',
    'mongodb': 'mongodb',
    'mongo': 'mongodb',
    'redis': 'redis',
    'influxdb': 'influxdb',
    'cockroachdb': 'cockroachdb',
    'cockroach': 'cockroachdb',
    'neo4j': 'neo4j',
    'neo4j+s': 'neo4j',
    'neo4j+ssc': 'neo4j',
    'bolt': 'neo4j',
  };

  return protocolMap[protocol.toLowerCase()] || null;
}

export function buildConnectionURL(params: {
  type: DatabaseType;
  username?: string;
  password?: string;
  host?: string;
  port?: number;
  database?: string;
  ssl?: boolean;
}): string {
  const protocol = typeToProtocol(params.type);
  if (!protocol) return '';

  let url = `${protocol}://`;

  if (params.username) {
    url += params.username;
    if (params.password) {
      url += `:${params.password}`;
    }
    url += '@';
  }

  if (params.host) {
    url += params.host;
  }

  if (params.port) {
    url += `:${params.port}`;
  }

  if (params.database) {
    url += `/${params.database}`;
  }

  if (params.ssl) {
    url += '?ssl=true';
  }

  return url;
}

function typeToProtocol(type: DatabaseType): string | null {
  const typeMap: Record<DatabaseType, string> = {
    'postgresql': 'postgresql',
    'mysql': 'mysql',
    'mariadb': 'mysql',
    'mongodb': 'mongodb',
    'redis': 'redis',
    'influxdb': 'http',
    'cockroachdb': 'postgresql',
    'neo4j': 'neo4j',
    'timescaledb': 'postgresql',
    'supabase': 'postgresql',
    'neon': 'postgresql',
    'planetscale': 'mysql',
    'rds-postgresql': 'postgresql',
    'rds-mysql': 'mysql',
    'aurora': 'mysql',
    'sqlite': '',
    'oracle': 'oracle',
    'sqlserver': 'sqlserver',
    'cassandra': '',
    'couchdb': 'http',
    'dynamodb': '',
    'memcached': '',
    'questdb': 'http',
    'redshift': 'postgresql',
    'documentdb': 'mongodb',
    'elasticache': 'redis',
    'arangodb': 'http',
  };

  return typeMap[type] || null;
}
