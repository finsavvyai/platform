import {
  getAuthConfig,
  TIER_RATE_LIMITS,
  TIER_MONTHLY_LIMITS,
  ROLE_PERMISSIONS,
} from '../config';
import type { AuthConfig, Role, PricingTier } from '../config';

describe('getAuthConfig', () => {
  it('returns defaults when no env vars are set', () => {
    const config = getAuthConfig({});

    expect(config.jwtSecret).toBe('finsavvy-dev-secret-change-in-prod');
    expect(config.jwtRefreshSecret).toBe('finsavvy-refresh-secret-change-in-prod');
    expect(config.jwtIssuer).toBe('finsavvy-shield');
    expect(config.jwtAudience).toBe('finsavvy-api');
    expect(config.accessTokenTTL).toBe(3600);
    expect(config.refreshTokenTTL).toBe(604800);
    expect(config.apiKeyPrefix).toBe('fs');
    expect(config.apiKeyHashSalt).toBe('finsavvy-key-salt');
    expect(config.rateLimitWindowMs).toBe(60000);
    expect(config.rateLimitMaxRequests).toBe(100);
    expect(config.redisUrl).toBeUndefined();
  });

  it('uses JWT_SECRET env var', () => {
    const config = getAuthConfig({ JWT_SECRET: 'my-secret' });
    expect(config.jwtSecret).toBe('my-secret');
  });

  it('falls back to FINSAVVY_JWT_SECRET', () => {
    const config = getAuthConfig({ FINSAVVY_JWT_SECRET: 'finsavvy-secret' });
    expect(config.jwtSecret).toBe('finsavvy-secret');
  });

  it('uses JWT_REFRESH_SECRET env var', () => {
    const config = getAuthConfig({ JWT_REFRESH_SECRET: 'refresh-secret' });
    expect(config.jwtRefreshSecret).toBe('refresh-secret');
  });

  it('falls back to FINSAVVY_JWT_REFRESH_SECRET', () => {
    const config = getAuthConfig({ FINSAVVY_JWT_REFRESH_SECRET: 'fs-refresh' });
    expect(config.jwtRefreshSecret).toBe('fs-refresh');
  });

  it('parses numeric env vars', () => {
    const config = getAuthConfig({
      ACCESS_TOKEN_TTL: '7200',
      REFRESH_TOKEN_TTL: '86400',
      RATE_LIMIT_WINDOW_MS: '30000',
      RATE_LIMIT_MAX_REQUESTS: '500',
    });

    expect(config.accessTokenTTL).toBe(7200);
    expect(config.refreshTokenTTL).toBe(86400);
    expect(config.rateLimitWindowMs).toBe(30000);
    expect(config.rateLimitMaxRequests).toBe(500);
  });

  it('uses REDIS_URL env var', () => {
    const config = getAuthConfig({ REDIS_URL: 'redis://localhost:6379' });
    expect(config.redisUrl).toBe('redis://localhost:6379');
  });

  it('falls back to UPSTASH_REDIS_URL', () => {
    const config = getAuthConfig({ UPSTASH_REDIS_URL: 'rediss://upstash.io' });
    expect(config.redisUrl).toBe('rediss://upstash.io');
  });

  it('uses custom issuer and audience', () => {
    const config = getAuthConfig({
      JWT_ISSUER: 'custom-issuer',
      JWT_AUDIENCE: 'custom-audience',
    });
    expect(config.jwtIssuer).toBe('custom-issuer');
    expect(config.jwtAudience).toBe('custom-audience');
  });

  it('uses custom API key settings', () => {
    const config = getAuthConfig({
      API_KEY_PREFIX: 'myapp',
      API_KEY_SALT: 'custom-salt',
    });
    expect(config.apiKeyPrefix).toBe('myapp');
    expect(config.apiKeyHashSalt).toBe('custom-salt');
  });
});

describe('TIER_RATE_LIMITS', () => {
  it('has rate limits for all tiers', () => {
    expect(TIER_RATE_LIMITS.free).toBe(60);
    expect(TIER_RATE_LIMITS.startup).toBe(600);
    expect(TIER_RATE_LIMITS.growth).toBe(3000);
    expect(TIER_RATE_LIMITS.enterprise).toBe(30000);
  });

  it('tiers increase monotonically', () => {
    expect(TIER_RATE_LIMITS.startup).toBeGreaterThan(TIER_RATE_LIMITS.free);
    expect(TIER_RATE_LIMITS.growth).toBeGreaterThan(TIER_RATE_LIMITS.startup);
    expect(TIER_RATE_LIMITS.enterprise).toBeGreaterThan(TIER_RATE_LIMITS.growth);
  });
});

describe('TIER_MONTHLY_LIMITS', () => {
  it('has monthly limits for all tiers', () => {
    expect(TIER_MONTHLY_LIMITS.free).toBe(1000);
    expect(TIER_MONTHLY_LIMITS.startup).toBe(10000);
    expect(TIER_MONTHLY_LIMITS.growth).toBe(100000);
    expect(TIER_MONTHLY_LIMITS.enterprise).toBe(Infinity);
  });
});

describe('ROLE_PERMISSIONS', () => {
  it('admin has all permissions', () => {
    expect(ROLE_PERMISSIONS.admin).toContain('read');
    expect(ROLE_PERMISSIONS.admin).toContain('write');
    expect(ROLE_PERMISSIONS.admin).toContain('delete');
    expect(ROLE_PERMISSIONS.admin).toContain('manage_users');
    expect(ROLE_PERMISSIONS.admin).toContain('manage_billing');
    expect(ROLE_PERMISSIONS.admin).toContain('view_analytics');
  });

  it('developer has read, write, and analytics', () => {
    expect(ROLE_PERMISSIONS.developer).toContain('read');
    expect(ROLE_PERMISSIONS.developer).toContain('write');
    expect(ROLE_PERMISSIONS.developer).toContain('view_analytics');
    expect(ROLE_PERMISSIONS.developer).not.toContain('delete');
    expect(ROLE_PERMISSIONS.developer).not.toContain('manage_users');
  });

  it('analyst has read and analytics only', () => {
    expect(ROLE_PERMISSIONS.analyst).toContain('read');
    expect(ROLE_PERMISSIONS.analyst).toContain('view_analytics');
    expect(ROLE_PERMISSIONS.analyst).not.toContain('write');
  });

  it('viewer has read only', () => {
    expect(ROLE_PERMISSIONS.viewer).toEqual(['read']);
  });
});
