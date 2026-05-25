import { describe, it, expect } from 'vitest';
import { generateWranglerConfig } from '../src/wrangler-config';

describe('generateWranglerConfig', () => {
  it('should generate minimal config with required fields', () => {
    const config = generateWranglerConfig({
      accountId: '12345',
      projectName: 'my-project',
    });

    expect(config).toContain('name = "my-project"');
    expect(config).toContain('account_id = "12345"');
    expect(config).toContain('compatibility_date = "2024-01-01"');
  });

  it('should include D1 database bindings', () => {
    const config = generateWranglerConfig({
      accountId: '12345',
      projectName: 'my-project',
      d1Databases: [
        { name: 'DB', databaseId: 'db-123' },
      ],
    });

    expect(config).toContain('[[d1_databases]]');
    expect(config).toContain('binding = "DB"');
    expect(config).toContain('database_id = "db-123"');
  });

  it('should include KV namespace bindings', () => {
    const config = generateWranglerConfig({
      accountId: '12345',
      projectName: 'my-project',
      kvNamespaces: [
        { name: 'KV', id: 'kv-123' },
      ],
    });

    expect(config).toContain('[[kv_namespaces]]');
    expect(config).toContain('binding = "KV"');
    expect(config).toContain('id = "kv-123"');
  });

  it('should include R2 bucket bindings', () => {
    const config = generateWranglerConfig({
      accountId: '12345',
      projectName: 'my-project',
      r2Buckets: [
        { name: 'BUCKET', bucketName: 'my-bucket' },
      ],
    });

    expect(config).toContain('[[r2_buckets]]');
    expect(config).toContain('binding = "BUCKET"');
    expect(config).toContain('bucket_name = "my-bucket"');
  });

  it('should include environment variables', () => {
    const config = generateWranglerConfig({
      accountId: '12345',
      projectName: 'my-project',
      vars: {
        API_URL: 'https://api.example.com',
        DEBUG: 'true',
      },
    });

    expect(config).toContain('[vars]');
    expect(config).toContain('API_URL = "https://api.example.com"');
    expect(config).toContain('DEBUG = "true"');
  });

  it('should include queue bindings', () => {
    const config = generateWranglerConfig({
      accountId: '12345',
      projectName: 'my-project',
      queues: [
        { name: 'QUEUE', queue: 'my-queue' },
      ],
    });

    expect(config).toContain('[[queues.producers]]');
    expect(config).toContain('binding = "QUEUE"');
    expect(config).toContain('queue = "my-queue"');
  });

  it('should include routes', () => {
    const config = generateWranglerConfig({
      accountId: '12345',
      projectName: 'my-project',
      routes: [
        { pattern: 'api.example.com/*', zone: 'example.com' },
      ],
    });

    expect(config).toContain('[[routes]]');
    expect(config).toContain('pattern = "api.example.com/*"');
    expect(config).toContain('zone_name = "example.com"');
  });

  it('should handle multiple bindings of same type', () => {
    const config = generateWranglerConfig({
      accountId: '12345',
      projectName: 'my-project',
      kvNamespaces: [
        { name: 'KV1', id: 'id1' },
        { name: 'KV2', id: 'id2' },
      ],
    });

    expect(config).toContain('binding = "KV1"');
    expect(config).toContain('binding = "KV2"');
  });

  it('should include preview bindings when provided', () => {
    const config = generateWranglerConfig({
      accountId: '12345',
      projectName: 'my-project',
      kvNamespaces: [
        { name: 'KV', id: 'id', preview: 'preview-id' },
      ],
    });

    expect(config).toContain('preview_id = "preview-id"');
  });

  it('should format config as valid TOML', () => {
    const config = generateWranglerConfig({
      accountId: '12345',
      projectName: 'my-project',
      d1Databases: [
        { name: 'DB', databaseId: 'db-123' },
      ],
      vars: { KEY: 'value' },
    });

    expect(config.startsWith('name =')).toBe(true);
    expect(config).toMatch(/^account_id/m);
    expect(config.endsWith('\n\n')).toBe(false);
  });
});
