/**
 * CDN Caching Service
 * Content Delivery Network integration for static assets and API responses
 */

import { logger } from '../utils/logger.js';

export interface CDNConfig {
  provider: 'cloudflare' | 'aws-cloudfront' | 'fastly' | 'custom';
  zoneId?: string;
  apiKey?: string;
  accountId?: string;
  distributionId?: string;
  region?: string;
}

export interface CacheRule {
  pattern: string;
  ttl: number;
  edgeTTL?: number;
  browserTTL?: number;
  cacheKey?: string;
  bypassCache?: boolean;
  compression?: boolean;
  polish?: boolean;
}

export interface PurgeRequest {
  urls?: string[];
  patterns?: string[];
  tags?: string[];
  purgeEverything?: boolean;
}

export interface CDNStats {
  requests: number;
  bandwidth: number;
  cachedRequests: number;
  cachedBandwidth: number;
  hitRate: number;
  avgResponseTime: number;
}

export abstract class CDNProvider {
  protected config: CDNConfig;

  constructor(config: CDNConfig) {
    this.config = config;
  }

  abstract purgeCache(request: PurgeRequest): Promise<boolean>;
  abstract getCacheRules(): Promise<CacheRule[]>;
  abstract createCacheRule(rule: CacheRule): Promise<boolean>;
  abstract updateCacheRule(ruleId: string, rule: CacheRule): Promise<boolean>;
  abstract deleteCacheRule(ruleId: string): Promise<boolean>;
  abstract getStats(): Promise<CDNStats>;
  abstract healthCheck(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; latency: number }>;
}

/**
 * Cloudflare CDN Provider
 */
export class CloudflareCDN extends CDNProvider {
  private baseURL: string;

  constructor(config: CDNConfig) {
    super(config);
    this.baseURL = 'https://api.cloudflare.com/client/v4';
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseURL}${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json',
      ...options.headers,
    };

    try {
      const response = await fetch(url, { ...options, headers });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(`Cloudflare API error: ${(data as any).errors?.[0]?.message || response.statusText}`);
      }

      return data;
    } catch (error) {
      logger.error('Cloudflare API request failed:', error);
      throw error;
    }
  }

  async purgeCache(request: PurgeRequest): Promise<boolean> {
    try {
      const payload: any = {};

      if (request.purgeEverything) {
        payload.purge_everything = true;
      } else if (request.urls && request.urls.length > 0) {
        payload.files = request.urls;
      } else if (request.patterns && request.patterns.length > 0) {
        payload.tags = request.patterns;
      } else if (request.tags && request.tags.length > 0) {
        payload.tags = request.tags;
      }

      const data = await this.makeRequest(`/zones/${this.config.zoneId}/purge_cache`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      logger.info(`Cloudflare cache purge completed: ${JSON.stringify(request)}`);
      return data.success;

    } catch (error) {
      logger.error('Failed to purge Cloudflare cache:', error);
      return false;
    }
  }

  async getCacheRules(): Promise<CacheRule[]> {
    try {
      const data = await this.makeRequest(`/zones/${this.config.zoneId}/pagerules`);

      return data.result.map((rule: any) => ({
        pattern: rule.targets[0]?.constraint?.value || '',
        ttl: 3600, // Default TTL
        edgeTTL: rule.actions?.find((a: any) => a.id === 'cache_ttl')?.value || null,
        bypassCache: rule.actions?.some((a: any) => a.id === 'bypass_cache_on_cookie') || false,
        compression: rule.actions?.some((a: any) => a.id === 'cache_level') || false,
      }));

    } catch (error) {
      logger.error('Failed to get Cloudflare cache rules:', error);
      return [];
    }
  }

  async createCacheRule(rule: CacheRule): Promise<boolean> {
    try {
      const actions = [];

      if (rule.edgeTTL) {
        actions.push({
          id: 'cache_ttl',
          value: rule.edgeTTL,
        });
      }

      if (rule.bypassCache) {
        actions.push({
          id: 'bypass_cache_on_cookie',
          value: 'bypass',
        });
      }

      if (rule.compression) {
        actions.push({
          id: 'cache_level',
          value: 'cache_everything',
        });
      }

      const payload = {
        targets: [
          {
            target: 'url',
            constraint: {
              operator: 'matches',
              value: rule.pattern,
            },
          },
        ],
        actions,
        status: 'active',
        priority: 1,
      };

      const data = await this.makeRequest(`/zones/${this.config.zoneId}/pagerules`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      logger.info(`Cloudflare cache rule created: ${rule.pattern}`);
      return data.success;

    } catch (error) {
      logger.error('Failed to create Cloudflare cache rule:', error);
      return false;
    }
  }

  async updateCacheRule(ruleId: string, rule: CacheRule): Promise<boolean> {
    try {
      const actions = [];

      if (rule.edgeTTL) {
        actions.push({
          id: 'cache_ttl',
          value: rule.edgeTTL,
        });
      }

      if (rule.bypassCache) {
        actions.push({
          id: 'bypass_cache_on_cookie',
          value: 'bypass',
        });
      }

      if (rule.compression) {
        actions.push({
          id: 'cache_level',
          value: 'cache_everything',
        });
      }

      const payload = {
        targets: [
          {
            target: 'url',
            constraint: {
              operator: 'matches',
              value: rule.pattern,
            },
          },
        ],
        actions,
        status: 'active',
        priority: 1,
      };

      const data = await this.makeRequest(`/zones/${this.config.zoneId}/pagerules/${ruleId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      logger.info(`Cloudflare cache rule updated: ${ruleId}`);
      return data.success;

    } catch (error) {
      logger.error('Failed to update Cloudflare cache rule:', error);
      return false;
    }
  }

  async deleteCacheRule(ruleId: string): Promise<boolean> {
    try {
      const data = await this.makeRequest(`/zones/${this.config.zoneId}/pagerules/${ruleId}`, {
        method: 'DELETE',
      });

      logger.info(`Cloudflare cache rule deleted: ${ruleId}`);
      return data.success;

    } catch (error) {
      logger.error('Failed to delete Cloudflare cache rule:', error);
      return false;
    }
  }

  async getStats(): Promise<CDNStats> {
    try {
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000); // Last 24 hours

      const analyticsData = await this.makeRequest(
        `/zones/${this.config.zoneId}/analytics/dashboard?since=${startTime.toISOString()}&until=${endTime.toISOString()}`
      );

      const stats = analyticsData.result;

      return {
        requests: stats.requests?.http?.all || 0,
        bandwidth: stats.bandwidth?.http?.all || 0,
        cachedRequests: stats.requests?.http?.cached || 0,
        cachedBandwidth: stats.bandwidth?.http?.cached || 0,
        hitRate: stats.requests?.http?.all > 0
          ? (stats.requests?.http?.cached / stats.requests?.http?.all) * 100
          : 0,
        avgResponseTime: stats.responseTime?.http?.all || 0,
      };

    } catch (error) {
      logger.error('Failed to get Cloudflare stats:', error);
      return {
        requests: 0,
        bandwidth: 0,
        cachedRequests: 0,
        cachedBandwidth: 0,
        hitRate: 0,
        avgResponseTime: 0,
      };
    }
  }

  async healthCheck(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; latency: number }> {
    try {
      const startTime = Date.now();
      await this.makeRequest(`/zones/${this.config.zoneId}`);
      const latency = Date.now() - startTime;

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

      if (latency > 2000) {
        status = 'degraded';
      }

      if (latency > 5000) {
        status = 'unhealthy';
      }

      return { status, latency };

    } catch (error) {
      logger.error('Cloudflare health check failed:', error);
      return {
        status: 'unhealthy',
        latency: -1,
      };
    }
  }
}

/**
 * AWS CloudFront CDN Provider
 */
export class CloudFrontCDN extends CDNProvider {
  private region: string;

  constructor(config: CDNConfig) {
    super(config);
    this.region = config.region || 'us-east-1';
  }

  async purgeCache(request: PurgeRequest): Promise<boolean> {
    // Implementation would use AWS SDK for CloudFront invalidation
    logger.info('CloudFront cache purge requested (placeholder implementation)');
    return true;
  }

  async getCacheRules(): Promise<CacheRule[]> {
    // Implementation would use AWS SDK for CloudFront cache policies
    logger.info('CloudFront cache rules requested (placeholder implementation)');
    return [];
  }

  async createCacheRule(rule: CacheRule): Promise<boolean> {
    logger.info('CloudFront cache rule creation requested (placeholder implementation)');
    return true;
  }

  async updateCacheRule(ruleId: string, rule: CacheRule): Promise<boolean> {
    logger.info('CloudFront cache rule update requested (placeholder implementation)');
    return true;
  }

  async deleteCacheRule(ruleId: string): Promise<boolean> {
    logger.info('CloudFront cache rule deletion requested (placeholder implementation)');
    return true;
  }

  async getStats(): Promise<CDNStats> {
    // Implementation would use CloudWatch metrics
    logger.info('CloudFront stats requested (placeholder implementation)');
    return {
      requests: 0,
      bandwidth: 0,
      cachedRequests: 0,
      cachedBandwidth: 0,
      hitRate: 0,
      avgResponseTime: 0,
    };
  }

  async healthCheck(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; latency: number }> {
    try {
      const startTime = Date.now();
      // Simple health check using a HEAD request to CloudFront distribution
      const testUrl = `https://${this.config.distributionId}.cloudfront.net/health`;
      const response = await fetch(testUrl, { method: 'HEAD' });
      const latency = Date.now() - startTime;

      return { status: response.ok ? 'healthy' : 'unhealthy', latency };

    } catch (error) {
      logger.error('CloudFront health check failed:', error);
      return {
        status: 'unhealthy',
        latency: -1,
      };
    }
  }
}

/**
 * CDN Service Manager
 */
export class CDNService {
  private provider: CDNProvider;
  private config: CDNConfig;

  constructor(config: CDNConfig) {
    this.config = config;

    switch (config.provider) {
      case 'cloudflare':
        this.provider = new CloudflareCDN(config);
        break;
      case 'aws-cloudfront':
        this.provider = new CloudFrontCDN(config);
        break;
      default:
        throw new Error(`Unsupported CDN provider: ${config.provider}`);
    }
  }

  /**
   * Purge cache
   */
  async purgeCache(request: PurgeRequest): Promise<boolean> {
    return await this.provider.purgeCache(request);
  }

  /**
   * Purge specific URLs
   */
  async purgeURLs(urls: string[]): Promise<boolean> {
    return await this.provider.purgeCache({ urls });
  }

  /**
   * Purge cache by patterns
   */
  async purgePatterns(patterns: string[]): Promise<boolean> {
    return await this.provider.purgeCache({ patterns });
  }

  /**
   * Purge cache by tags
   */
  async purgeByTags(tags: string[]): Promise<boolean> {
    return await this.provider.purgeCache({ tags });
  }

  /**
   * Purge all cache
   */
  async purgeAll(): Promise<boolean> {
    return await this.provider.purgeCache({ purgeEverything: true });
  }

  /**
   * Get cache rules
   */
  async getCacheRules(): Promise<CacheRule[]> {
    return await this.provider.getCacheRules();
  }

  /**
   * Create cache rule
   */
  async createCacheRule(rule: CacheRule): Promise<boolean> {
    return await this.provider.createCacheRule(rule);
  }

  /**
   * Update cache rule
   */
  async updateCacheRule(ruleId: string, rule: CacheRule): Promise<boolean> {
    return await this.provider.updateCacheRule(ruleId, rule);
  }

  /**
   * Delete cache rule
   */
  async deleteCacheRule(ruleId: string): Promise<boolean> {
    return await this.provider.deleteCacheRule(ruleId);
  }

  /**
   * Get CDN statistics
   */
  async getStats(): Promise<CDNStats> {
    return await this.provider.getStats();
  }

  /**
   * Perform health check
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; latency: number }> {
    return await this.provider.healthCheck();
  }

  /**
   * Configure cache rules for common patterns
   */
  async setupDefaultRules(): Promise<boolean> {
    const defaultRules: CacheRule[] = [
      {
        pattern: '/api/health*',
        ttl: 60, // 1 minute
        edgeTTL: 30,
        browserTTL: 0, // No browser caching for health checks
      },
      {
        pattern: '/api/v*/public/*',
        ttl: 300, // 5 minutes
        edgeTTL: 600, // 10 minutes
        browserTTL: 300,
        compression: true,
      },
      {
        pattern: '/static/*',
        ttl: 86400, // 24 hours
        edgeTTL: 604800, // 7 days
        browserTTL: 86400,
        compression: true,
      },
      {
        pattern: '/assets/*',
        ttl: 604800, // 7 days
        edgeTTL: 2592000, // 30 days
        browserTTL: 604800,
        compression: true,
      },
      {
        pattern: '/images/*',
        ttl: 2592000, // 30 days
        edgeTTL: 7776000, // 90 days
        browserTTL: 2592000,
        compression: true,
      },
    ];

    const results = await Promise.all(
      defaultRules.map(rule => this.createCacheRule(rule))
    );

    const successCount = results.filter(Boolean).length;
    logger.info(`Setup ${successCount}/${defaultRules.length} default CDN cache rules`);

    return successCount === defaultRules.length;
  }
}

// Create and export singleton instance
export const cdnService = new CDNService({
  provider: (process.env.CDN_PROVIDER as any) || 'cloudflare',
  zoneId: process.env.CLOUDFLARE_ZONE_ID || '',
  apiKey: process.env.CLOUDFLARE_API_KEY || '',
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID || '',
  distributionId: process.env.AWS_CLOUDFRONT_DISTRIBUTION_ID || '',
  region: process.env.AWS_REGION || 'us-east-1',
});

export default cdnService;