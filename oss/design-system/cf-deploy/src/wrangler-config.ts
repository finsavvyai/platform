import type { WranglerOptions } from './types';

export function generateWranglerConfig(options: WranglerOptions): string {
  const {
    accountId,
    projectName,
    environment = 'production',
    d1Databases = [],
    kvNamespaces = [],
    r2Buckets = [],
    vars = {},
    routes = [],
    queues = [],
  } = options;

  let config = '';
  config += `name = "${projectName}"\n`;
  config += `account_id = "${accountId}"\n`;
  config += `compatibility_date = "2024-01-01"\n\n`;

  if (Object.keys(vars).length > 0) {
    config += `[vars]\n`;
    Object.entries(vars).forEach(([key, value]) => {
      config += `${key} = "${value}"\n`;
    });
    config += '\n';
  }

  if (d1Databases.length > 0) {
    config += `[[d1_databases]]\n`;
    d1Databases.forEach((db, idx) => {
      if (idx > 0) config += `[[d1_databases]]\n`;
      config += `binding = "${db.name}"\n`;
      config += `database_name = "${db.databaseId}"\n`;
      config += `database_id = "${db.databaseId}"\n`;
    });
    config += '\n';
  }

  if (kvNamespaces.length > 0) {
    config += `[[kv_namespaces]]\n`;
    kvNamespaces.forEach((kv, idx) => {
      if (idx > 0) config += `[[kv_namespaces]]\n`;
      config += `binding = "${kv.name}"\n`;
      config += `id = "${kv.id}"\n`;
      if (kv.preview) {
        config += `preview_id = "${kv.preview}"\n`;
      }
    });
    config += '\n';
  }

  if (r2Buckets.length > 0) {
    config += `[[r2_buckets]]\n`;
    r2Buckets.forEach((bucket, idx) => {
      if (idx > 0) config += `[[r2_buckets]]\n`;
      config += `binding = "${bucket.name}"\n`;
      config += `bucket_name = "${bucket.bucketName}"\n`;
      if (bucket.preview) {
        config += `preview_bucket_name = "${bucket.preview}"\n`;
      }
    });
    config += '\n';
  }

  if (queues.length > 0) {
    config += `[[queues.producers]]\n`;
    queues.forEach((q, idx) => {
      if (idx > 0) config += `[[queues.producers]]\n`;
      config += `binding = "${q.name}"\n`;
      config += `queue = "${q.queue}"\n`;
    });
    config += '\n';
  }

  if (routes.length > 0) {
    config += `[[routes]]\n`;
    routes.forEach((route, idx) => {
      if (idx > 0) config += `[[routes]]\n`;
      config += `pattern = "${route.pattern}"\n`;
      if (route.zone) {
        config += `zone_name = "${route.zone}"\n`;
      }
    });
    config += '\n';
  }

  return config.trim();
}
