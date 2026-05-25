import { describe, expect, it } from 'vitest';
import {
  createHealthResponse,
  createNotFoundResponse,
  createReadinessResponse,
} from '../src/app';
import type { AppConfig } from '../src/config';

const config: AppConfig = {
  env: 'test',
  host: '127.0.0.1',
  port: 3001,
  trustProxy: false,
  jsonBodyLimit: '1mb',
  shutdownTimeoutMs: 10000,
  logLevel: 'error',
  serviceName: 'sdlc-platform-test',
  version: '1.0.0-test',
};

describe('createApp', () => {
  it('should build health and readiness payloads', () => {
    const healthResponse = createHealthResponse(config, 42, '2026-04-03T12:00:00.000Z');
    expect(healthResponse.status).toBe('ok');
    expect(healthResponse.service).toBe('sdlc-platform-test');
    expect(healthResponse.uptimeSeconds).toBe(42);
    expect(healthResponse.timestamp).toBe('2026-04-03T12:00:00.000Z');

    const readinessResponse = createReadinessResponse(config, '2026-04-03T12:00:00.000Z');
    expect(readinessResponse.status).toBe('ready');
    expect(readinessResponse.service).toBe('sdlc-platform-test');
  });

  it('should return structured 404 payloads', () => {
    const response = createNotFoundResponse('GET', '/does-not-exist', 'req-123');

    expect(response.error).toContain('Route not found');
    expect(response.requestId).toBe('req-123');
  });
});
