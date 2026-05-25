import { describe, it, expect } from 'vitest';
import { createHealthCheck } from '../src/health/check.js';
import type { HealthCheckResult } from '../src/types.js';

describe('health check', () => {
  it('should create a health check handler', () => {
    const handler = createHealthCheck([]);
    expect(handler).toBeDefined();
    expect(typeof handler).toBe('function');
  });

  it('should return healthy status when all checks pass', async () => {
    const check1 = async (): Promise<HealthCheckResult> => ({
      name: 'check1',
      status: 'healthy',
    });

    const check2 = async (): Promise<HealthCheckResult> => ({
      name: 'check2',
      status: 'healthy',
    });

    const handler = createHealthCheck([check1, check2]);
    const result = await handler();

    expect(result.status).toBe('healthy');
    expect(result.checks).toHaveLength(2);
  });

  it('should return degraded status when any check is degraded', async () => {
    const check1 = async (): Promise<HealthCheckResult> => ({
      name: 'check1',
      status: 'healthy',
    });

    const check2 = async (): Promise<HealthCheckResult> => ({
      name: 'check2',
      status: 'degraded',
    });

    const handler = createHealthCheck([check1, check2]);
    const result = await handler();

    expect(result.status).toBe('degraded');
  });

  it('should return unhealthy status when any check fails', async () => {
    const check1 = async (): Promise<HealthCheckResult> => ({
      name: 'check1',
      status: 'healthy',
    });

    const check2 = async (): Promise<HealthCheckResult> => ({
      name: 'check2',
      status: 'unhealthy',
    });

    const handler = createHealthCheck([check1, check2]);
    const result = await handler();

    expect(result.status).toBe('unhealthy');
  });

  it('should include uptime in response', async () => {
    const check = async (): Promise<HealthCheckResult> => ({
      name: 'check',
      status: 'healthy',
    });

    const handler = createHealthCheck([check]);
    const result = await handler();

    expect(result.uptime).toBeGreaterThanOrEqual(0);
  });

  it('should include timestamp in response', async () => {
    const check = async (): Promise<HealthCheckResult> => ({
      name: 'check',
      status: 'healthy',
    });

    const handler = createHealthCheck([check]);
    const result = await handler();

    expect(result.timestamp).toBeDefined();
    expect(new Date(result.timestamp)).toBeInstanceOf(Date);
  });

  it('should handle check failures gracefully', async () => {
    const failingCheck = async (): Promise<HealthCheckResult> => {
      throw new Error('Check failed');
    };

    const handler = createHealthCheck([failingCheck]);
    const result = await handler();

    expect(result.status).toBe('unhealthy');
    expect(result.checks[0].status).toBe('unhealthy');
  });

  it('should include version in response', async () => {
    const check = async (): Promise<HealthCheckResult> => ({
      name: 'check',
      status: 'healthy',
    });

    const handler = createHealthCheck([check]);
    const result = await handler();

    expect(result.version).toBeDefined();
    expect(typeof result.version).toBe('string');
  });
});
