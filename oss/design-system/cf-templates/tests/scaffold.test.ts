import { describe, it, expect } from 'vitest';
import { scaffoldProject } from '../src/scaffold';

describe('scaffoldProject', () => {
  it('should scaffold API template', async () => {
    const result = await scaffoldProject({
      template: 'api',
      name: 'my-api',
      outputDir: '/tmp/my-api',
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain('api');
    expect(result.message).toContain('my-api');
    expect(result.files).toContain('/tmp/my-api/src/index.ts');
  });

  it('should scaffold webhook template', async () => {
    const result = await scaffoldProject({
      template: 'webhook',
      name: 'stripe-webhook',
      outputDir: '/tmp/webhook',
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain('webhook');
    expect(result.files).toContain('/tmp/webhook/src/webhooks.ts');
  });

  it('should scaffold cron template', async () => {
    const result = await scaffoldProject({
      template: 'cron',
      name: 'cron-worker',
      outputDir: '/tmp/cron',
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain('cron');
    expect(result.files).toContain('/tmp/cron/src/cron.ts');
  });

  it('should reject invalid template', async () => {
    const result = await scaffoldProject({
      template: 'invalid' as any,
      name: 'test',
      outputDir: '/tmp/test',
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('Unknown template');
  });

  it('should include common config files', async () => {
    const result = await scaffoldProject({
      template: 'api',
      name: 'api-project',
      outputDir: '/tmp/api',
    });

    expect(result.files).toContain('/tmp/api/package.json');
    expect(result.files).toContain('/tmp/api/wrangler.toml');
    expect(result.files).toContain('/tmp/api/tsconfig.json');
    expect(result.files).toContain('/tmp/api/.gitignore');
  });

  it('should return correct file count for API template', async () => {
    const result = await scaffoldProject({
      template: 'api',
      name: 'test',
      outputDir: '/tmp/test',
    });

    expect(result.files.length).toBe(5);
  });

  it('should return correct file count for webhook template', async () => {
    const result = await scaffoldProject({
      template: 'webhook',
      name: 'test',
      outputDir: '/tmp/test',
    });

    expect(result.files.length).toBe(5);
  });
});
