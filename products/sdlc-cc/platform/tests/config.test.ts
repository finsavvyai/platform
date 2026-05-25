import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config';

describe('loadConfig', () => {
  it('should load production-safe defaults', () => {
    const config = loadConfig({});

    expect(config.env).toBe('development');
    expect(config.host).toBe('0.0.0.0');
    expect(config.port).toBe(3000);
    expect(config.trustProxy).toBe(true);
    expect(config.jsonBodyLimit).toBe('1mb');
    expect(config.logLevel).toBe('info');
  });

  it('should parse custom configuration from environment variables', () => {
    const config = loadConfig({
      NODE_ENV: 'production',
      HOST: '127.0.0.1',
      PORT: '8080',
      TRUST_PROXY: 'false',
      JSON_BODY_LIMIT: '2mb',
      SHUTDOWN_TIMEOUT_MS: '15000',
      LOG_LEVEL: 'debug',
      SERVICE_NAME: 'release-api',
      APP_VERSION: '2.4.1',
    });

    expect(config.env).toBe('production');
    expect(config.host).toBe('127.0.0.1');
    expect(config.port).toBe(8080);
    expect(config.trustProxy).toBe(false);
    expect(config.jsonBodyLimit).toBe('2mb');
    expect(config.shutdownTimeoutMs).toBe(15000);
    expect(config.logLevel).toBe('debug');
    expect(config.serviceName).toBe('release-api');
    expect(config.version).toBe('2.4.1');
  });

  it('should reject invalid numeric values', () => {
    expect(() => loadConfig({ PORT: '99999' })).toThrow('PORT must be between 1 and 65535');
    expect(() => loadConfig({ SHUTDOWN_TIMEOUT_MS: '500' })).toThrow(
      'SHUTDOWN_TIMEOUT_MS must be between 1000 and 120000'
    );
  });

  it('should reject invalid log levels', () => {
    expect(() => loadConfig({ LOG_LEVEL: 'verbose' })).toThrow(
      'LOG_LEVEL must be one of: fatal, error, warn, info, debug, trace'
    );
  });
});
