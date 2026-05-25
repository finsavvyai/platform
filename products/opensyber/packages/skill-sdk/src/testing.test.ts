import { describe, it, expect } from 'vitest';
import { createMockContext } from './testing.js';

describe('createMockContext', () => {
  it('returns context and empty outputs', () => {
    const { context, outputs } = createMockContext();
    expect(context.orgId).toBe('org_test');
    expect(context.userId).toBe('user_test');
    expect(context.config).toEqual({});
    expect(outputs.findings).toEqual([]);
    expect(outputs.metrics).toEqual([]);
    expect(outputs.assets).toEqual([]);
    expect(outputs.logs).toEqual([]);
  });

  it('captures info, warn, and error logs', () => {
    const { context, outputs } = createMockContext();
    context.logger.info('hello', { key: 'val' });
    context.logger.warn('caution');
    context.logger.error('oops', { code: 500 });

    expect(outputs.logs).toHaveLength(3);
    expect(outputs.logs[0]).toEqual({ level: 'info', message: 'hello', data: { key: 'val' } });
    expect(outputs.logs[1]).toEqual({ level: 'warn', message: 'caution', data: undefined });
    expect(outputs.logs[2]).toEqual({ level: 'error', message: 'oops', data: { code: 500 } });
  });

  it('captures emitted findings', () => {
    const { context, outputs } = createMockContext();
    context.emit.finding({
      checkId: 'chk-1',
      severity: 'high',
      title: 'Test finding',
      description: 'desc',
      resourceId: 'res-1',
      resourceType: 'bucket',
    });

    expect(outputs.findings).toHaveLength(1);
    expect(outputs.findings[0]!.checkId).toBe('chk-1');
    expect(outputs.findings[0]!.severity).toBe('high');
  });

  it('captures emitted metrics', () => {
    const { context, outputs } = createMockContext();
    context.emit.metric({ name: 'latency', value: 42, unit: 'ms' });
    context.emit.metric({ name: 'count', value: 1 });

    expect(outputs.metrics).toHaveLength(2);
    expect(outputs.metrics[0]!.name).toBe('latency');
    expect(outputs.metrics[0]!.unit).toBe('ms');
    expect(outputs.metrics[1]!.value).toBe(1);
  });

  it('captures emitted assets', () => {
    const { context, outputs } = createMockContext();
    context.emit.asset({
      name: 'prod-db',
      identifier: 'arn:aws:rds:us-east-1:123:db/prod',
      assetType: 'rds',
      sensitivity: 'critical',
    });

    expect(outputs.assets).toHaveLength(1);
    expect(outputs.assets[0]!.name).toBe('prod-db');
    expect(outputs.assets[0]!.sensitivity).toBe('critical');
  });

  it('applies overrides to context', () => {
    const { context } = createMockContext({
      orgId: 'org_custom',
      userId: 'user_custom',
      config: { region: 'us-east-1' },
    });

    expect(context.orgId).toBe('org_custom');
    expect(context.userId).toBe('user_custom');
    expect(context.config).toEqual({ region: 'us-east-1' });
  });

  it('http.get returns empty JSON response by default', async () => {
    const { context } = createMockContext();
    const res = await context.http.get('https://example.com');
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toBe('{}');
  });

  it('vault.getSecret returns null by default', async () => {
    const { context } = createMockContext();
    const secret = await context.vault.getSecret('my-key');
    expect(secret).toBeNull();
  });
});
