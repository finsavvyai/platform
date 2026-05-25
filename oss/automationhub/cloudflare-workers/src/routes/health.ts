/**
 * Health Check Routes for Cloudflare Workers
 * Provides health status and monitoring endpoints
 */

import { Hono } from 'hono';
import { validator } from 'hono/validator';

const healthRoutes = new Hono();

// Basic health check
healthRoutes.get('/', async (c) => {
  const start = Date.now();

  // Check all dependencies
  const checks = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: c.env.ENVIRONMENT,
    version: '1.0.0',
    checks: {
      kv: await checkKV(c.env),
      d1: await checkD1(c.env),
      r2: await checkR2(c.env),
      analytics: await checkAnalytics(c.env),
      durable_objects: await checkDurableObjects(c.env)
    },
    performance: {
      response_time: Date.now() - start,
      memory_usage: 'N/A', // Workers don't expose memory usage
      cpu_time: 'N/A'
    }
  };

  // Determine overall health
  const failedChecks = Object.values(checks.checks).filter(check => !check.healthy);
  if (failedChecks.length > 0) {
    checks.status = 'degraded';
    return c.json(checks, 503);
  }

  return c.json(checks);
});

// Ready check - indicates if the service is ready to serve traffic
healthRoutes.get('/ready', async (c) => {
  const checks = await Promise.all([
    checkKV(c.env),
    checkD1(c.env),
    checkR2(c.env)
  ]);

  const allReady = checks.every(check => check.healthy);

  if (allReady) {
    return c.json({
      status: 'ready',
      timestamp: new Date().toISOString(),
      checks: checks
    });
  } else {
    return c.json({
      status: 'not_ready',
      timestamp: new Date().toISOString(),
      checks: checks
    }, 503);
  }
});

// Live check - indicates if the service is alive
healthRoutes.get('/live', (c) => {
  return c.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: 'N/A' // Workers don't have uptime info
  });
});

// Detailed health check with diagnostics
healthRoutes.get('/detailed', async (c) => {
  const diagnostics = {
    environment: {
      name: c.env.ENVIRONMENT,
      version: '1.0.0',
      region: c.req.cf?.colo || 'unknown',
      country: c.req.cf?.country || 'unknown',
      asn: c.req.cf?.asn || 'unknown'
    },
    services: {
      kv: await checkKVDetailed(c.env),
      d1: await checkD1Detailed(c.env),
      r2: await checkR2Detailed(c.env),
      analytics: await checkAnalyticsDetailed(c.env),
      durable_objects: await checkDurableObjectsDetailed(c.env)
    },
    performance: {
      cf_ray: c.req.header('cf-ray') || 'unknown',
      request_time: Date.now(),
      cache_status: c.req.cf?.cacheStatus || 'unknown'
    }
  };

  return c.json(diagnostics);
});

// Dependency check functions
async function checkKV(env: any): Promise<{ healthy: boolean; message: string }> {
  try {
    const testKey = 'health_check_test';
    await env.UPM_CACHE.put(testKey, 'test', { expirationTtl: 60 });
    const value = await env.UPM_CACHE.get(testKey);
    await env.UPM_CACHE.delete(testKey);

    if (value === 'test') {
      return { healthy: true, message: 'KV storage is operational' };
    } else {
      return { healthy: false, message: 'KV storage read/write test failed' };
    }
  } catch (error) {
    return { healthy: false, message: `KV storage error: ${error.message}` };
  }
}

async function checkD1(env: any): Promise<{ healthy: boolean; message: string }> {
  try {
    const result = await env.UPM_DB.prepare('SELECT 1 as test').first();
    if (result && result.test === 1) {
      return { healthy: true, message: 'D1 database is operational' };
    } else {
      return { healthy: false, message: 'D1 database query failed' };
    }
  } catch (error) {
    return { healthy: false, message: `D1 database error: ${error.message}` };
  }
}

async function checkR2(env: any): Promise<{ healthy: boolean; message: string }> {
  try {
    const testKey = 'health_check_test.txt';
    const testContent = 'test content';

    await env.UPM_FILES.put(testKey, testContent);
    const object = await env.UPM_FILES.get(testKey);
    const content = await object?.text();
    await env.UPM_FILES.delete(testKey);

    if (content === testContent) {
      return { healthy: true, message: 'R2 storage is operational' };
    } else {
      return { healthy: false, message: 'R2 storage read/write test failed' };
    }
  } catch (error) {
    return { healthy: false, message: `R2 storage error: ${error.message}` };
  }
}

async function checkAnalytics(env: any): Promise<{ healthy: boolean; message: string }> {
  try {
    // Test analytics engine by writing a data point
    env.UPM_ANALYTICS?.writeDataPoint({
      blobs: ['health_check'],
      doubles: [1],
      indexes: [0]
    });
    return { healthy: true, message: 'Analytics engine is operational' };
  } catch (error) {
    return { healthy: false, message: `Analytics engine error: ${error.message}` };
  }
}

async function checkDurableObjects(env: any): Promise<{ healthy: boolean; message: string }> {
  try {
    // Durable Objects health check would require actual DO instance
    // For now, just check if the binding exists
    if (env.UPM_COLLABORATION) {
      return { healthy: true, message: 'Durable Objects binding available' };
    } else {
      return { healthy: false, message: 'Durable Objects binding not found' };
    }
  } catch (error) {
    return { healthy: false, message: `Durable Objects error: ${error.message}` };
  }
}

// Detailed check functions
async function checkKVDetailed(env: any): Promise<any> {
  const basic = await checkKV(env);
  try {
    // Get KV namespace info
    const list = await env.UPM_CACHE.list({ limit: 1 });
    return {
      ...basic,
      details: {
        namespace_available: true,
        can_list: true,
        test_key_count: list.keys.length
      }
    };
  } catch (error) {
    return {
      ...basic,
      details: {
        namespace_available: false,
        error: error.message
      }
    };
  }
}

async function checkD1Detailed(env: any): Promise<any> {
  const basic = await checkD1(env);
  try {
    // Test database operations
    await env.UPM_DB.prepare(`
      CREATE TABLE IF NOT EXISTS health_checks (
        id INTEGER PRIMARY KEY,
        timestamp TEXT,
        status TEXT
      )
    `).run();

    const result = await env.UPM_DB.prepare(`
      SELECT COUNT(*) as count FROM health_checks
    `).first();

    return {
      ...basic,
      details: {
        tables_accessible: true,
        query_working: true,
        health_check_records: result?.count || 0
      }
    };
  } catch (error) {
    return {
      ...basic,
      details: {
        tables_accessible: false,
        error: error.message
      }
    };
  }
}

async function checkR2Detailed(env: any): Promise<any> {
  const basic = await checkR2(env);
  try {
    // List buckets/objects
    const objects = await env.UPM_FILES.list({ limit: 1 });
    return {
      ...basic,
      details: {
        bucket_accessible: true,
        can_list: true,
        object_count: objects.objects.length
      }
    };
  } catch (error) {
    return {
      ...basic,
      details: {
        bucket_accessible: false,
        error: error.message
      }
    };
  }
}

async function checkAnalyticsDetailed(env: any): Promise<any> {
  const basic = await checkAnalytics(env);
  return {
    ...basic,
    details: {
      engine_available: !!env.UPM_ANALYTICS,
      can_write: basic.healthy
    }
  };
}

async function checkDurableObjectsDetailed(env: any): Promise<any> {
  const basic = await checkDurableObjects(env);
  return {
    ...basic,
    details: {
      binding_available: !!env.UPM_COLLABORATION,
      class_name: 'CollaborationRoom'
    }
  };
}

export { healthRoutes };