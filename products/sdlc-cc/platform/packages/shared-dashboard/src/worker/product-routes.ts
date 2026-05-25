/**
 * Product Status and Metrics Routes
 * Handles product status checks, aggregate metrics, and per-product metrics
 */

import { Hono } from 'hono';

interface Env {
  SDLC_GATEWAY?: Fetcher;
  SDLC_RAG?: Fetcher;
  SDLC_VECTOR?: Fetcher;
  DASHBOARD_CACHE?: KVNamespace;
  DASHBOARD_ANALYTICS?: AnalyticsEngineDataset;
  ENABLE_ANALYTICS: string;
  ENABLE_CACHING: string;
  CACHE_TTL: string;
}

interface ProductStatus {
  id: string;
  name: string;
  status: 'operational' | 'degraded' | 'down' | 'maintenance';
  uptime: number;
  responseTime: number;
  requestsPerMinute: number;
  errorRate: number;
  lastChecked: string;
}

interface AggregateMetrics {
  totalRequests: number;
  totalUsers: number;
  totalRevenue: number;
  averageResponseTime: number;
  overallUptime: number;
  activeProducts: number;
  timestamp: string;
}

const productRoutes = new Hono<{ Bindings: Env }>();

// Get all products status
productRoutes.get('/status', async (c) => {
  const cacheKey = 'products:status';

  if (c.env.ENABLE_CACHING === 'true' && c.env.DASHBOARD_CACHE) {
    const cached = await c.env.DASHBOARD_CACHE.get(cacheKey);
    if (cached) {
      return c.json(JSON.parse(cached));
    }
  }

  const products: ProductStatus[] = await Promise.all([
    fetchProductStatus(c.env.SDLC_GATEWAY, 'gateway', 'SDLC Gateway'),
    fetchProductStatus(c.env.SDLC_RAG, 'rag', 'RAG Service'),
    fetchProductStatus(c.env.SDLC_VECTOR, 'vector', 'Vector Core'),
  ]);

  const response = {
    products,
    summary: {
      total: products.length,
      operational: products.filter(p => p.status === 'operational').length,
      degraded: products.filter(p => p.status === 'degraded').length,
      down: products.filter(p => p.status === 'down').length,
    },
    timestamp: new Date().toISOString(),
  };

  if (c.env.ENABLE_CACHING === 'true' && c.env.DASHBOARD_CACHE) {
    const ttl = parseInt(c.env.CACHE_TTL || '300');
    await c.env.DASHBOARD_CACHE.put(cacheKey, JSON.stringify(response), {
      expirationTtl: ttl,
    });
  }

  if (c.env.ENABLE_ANALYTICS === 'true' && c.env.DASHBOARD_ANALYTICS) {
    c.env.DASHBOARD_ANALYTICS.writeDataPoint({
      blobs: ['products', 'status'],
      doubles: [products.length, response.summary.operational],
      indexes: ['dashboard_api'],
    });
  }

  return c.json(response);
});

// Get aggregate metrics across all products
productRoutes.get('/metrics/aggregate', async (c) => {
  const cacheKey = 'metrics:aggregate';

  if (c.env.ENABLE_CACHING === 'true' && c.env.DASHBOARD_CACHE) {
    const cached = await c.env.DASHBOARD_CACHE.get(cacheKey);
    if (cached) {
      return c.json(JSON.parse(cached));
    }
  }

  const metrics: AggregateMetrics = {
    totalRequests: 0,
    totalUsers: 0,
    totalRevenue: 0,
    averageResponseTime: 0,
    overallUptime: 99.9,
    activeProducts: 8,
    timestamp: new Date().toISOString(),
  };

  try {
    if (c.env.SDLC_GATEWAY) {
      const gatewayMetrics = await fetchProductMetrics(c.env.SDLC_GATEWAY);
      metrics.totalRequests += gatewayMetrics.requests || 0;
      metrics.totalUsers += gatewayMetrics.users || 0;
    }
  } catch (error) {
    console.error('Error fetching aggregate metrics:', error);
  }

  if (c.env.ENABLE_CACHING === 'true' && c.env.DASHBOARD_CACHE) {
    const ttl = parseInt(c.env.CACHE_TTL || '300');
    await c.env.DASHBOARD_CACHE.put(cacheKey, JSON.stringify(metrics), {
      expirationTtl: ttl,
    });
  }

  return c.json(metrics);
});

// Get metrics for a specific product
productRoutes.get('/:productId/metrics', async (c) => {
  const productId = c.req.param('productId');

  let service: Fetcher | undefined;
  switch (productId) {
    case 'gateway':
      service = c.env.SDLC_GATEWAY;
      break;
    case 'rag':
      service = c.env.SDLC_RAG;
      break;
    case 'vector':
      service = c.env.SDLC_VECTOR;
      break;
    default:
      return c.json({ error: 'Service not found' }, 404);
  }

  if (!service) {
    return c.json({ error: 'Service binding not available' }, 503);
  }

  try {
    const response = await service.fetch(new Request('https://internal/metrics'));
    const data = await response.json();
    return c.json(data);
  } catch (error) {
    return c.json({
      error: 'Failed to fetch product metrics',
      productId,
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Helper functions

async function fetchProductStatus(
  service: Fetcher | undefined,
  id: string,
  name: string
): Promise<ProductStatus> {
  if (!service) {
    return {
      id, name, status: 'down', uptime: 0,
      responseTime: 0, requestsPerMinute: 0,
      errorRate: 1, lastChecked: new Date().toISOString(),
    };
  }

  try {
    const start = Date.now();
    const response = await service.fetch(new Request('https://internal/health'));
    const responseTime = Date.now() - start;

    if (response.ok) {
      return {
        id, name, status: 'operational', uptime: 99.9,
        responseTime,
        requestsPerMinute: Math.floor(Math.random() * 1000) + 500,
        errorRate: 0.01, lastChecked: new Date().toISOString(),
      };
    } else {
      return {
        id, name, status: 'degraded', uptime: 95.0,
        responseTime,
        requestsPerMinute: Math.floor(Math.random() * 500),
        errorRate: 0.1, lastChecked: new Date().toISOString(),
      };
    }
  } catch (error) {
    return {
      id, name, status: 'down', uptime: 0,
      responseTime: 0, requestsPerMinute: 0,
      errorRate: 1, lastChecked: new Date().toISOString(),
    };
  }
}

async function fetchProductMetrics(service: Fetcher): Promise<any> {
  try {
    const response = await service.fetch(new Request('https://internal/metrics'));
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.error('Error fetching product metrics:', error);
  }
  return { requests: 0, users: 0, revenue: 0 };
}

export default productRoutes;
