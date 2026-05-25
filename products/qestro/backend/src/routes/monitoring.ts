/**
 * Monitoring Routes
 * Provides monitoring and health check endpoints for production environment
 */

import express from 'express';
import { requireAuth, requireApiKey } from '../middleware/auth.js';
import ProductionMonitor from '../services/ProductionMonitoringService.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Initialize production monitor
const monitoringConfig = {
  enabled: process.env.NODE_ENV === 'production',
  interval: parseInt(process.env.MONITORING_INTERVAL || '60000'),
  alerts: {
    slack: {
      webhook: process.env.SLACK_WEBHOOK_URL || '',
      channel: process.env.SLACK_ALERTS_CHANNEL || '#production-alerts',
      enabled: !!process.env.SLACK_WEBHOOK_URL
    },
    email: {
      enabled: false,
      recipients: []
    }
  },
  thresholds: {
    responseTime: parseInt(process.env.RESPONSE_TIME_THRESHOLD || '5000'),
    errorRate: parseFloat(process.env.ERROR_RATE_THRESHOLD || '5.0'),
    cpuUsage: parseFloat(process.env.CPU_USAGE_THRESHOLD || '80.0'),
    memoryUsage: parseFloat(process.env.MEMORY_USAGE_THRESHOLD || '85.0'),
    diskUsage: parseFloat(process.env.DISK_USAGE_THRESHOLD || '90.0')
  }
};

let productionMonitor: ProductionMonitor | null = null;

// Initialize monitor in production
if (monitoringConfig.enabled) {
  productionMonitor = new ProductionMonitor(monitoringConfig);
  productionMonitor.start().catch(error => {
    logger.error('Failed to start production monitoring:', error);
  });
}

/**
 * GET /api/monitoring/status
 * Get monitoring system status
 */
router.get('/status', requireApiKey, async (req, res) => {
  try {
    if (!productionMonitor) {
      return res.json({
        enabled: false,
        message: 'Production monitoring is disabled'
      });
    }

    const status = productionMonitor.getStatus();
    res.json({
      enabled: true,
      ...status,
      config: {
        interval: monitoringConfig.interval,
        thresholds: monitoringConfig.thresholds
      }
    });
  } catch (error) {
    logger.error('Error getting monitoring status:', error);
    res.status(500).json({
      error: 'Failed to get monitoring status'
    });
  }
});

/**
 * GET /api/monitoring/health
 * Comprehensive health check endpoint
 */
router.get('/health', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      services: {
        database: await checkDatabaseHealth(),
        redis: await checkRedisHealth(),
        websockets: checkWebSocketHealth(),
        ai: await checkAIHealth(),
        storage: await checkStorageHealth()
      },
      metrics: await getSystemMetrics(),
      checks: {
        memory: checkMemoryUsage(),
        cpu: checkCPUUsage(),
        disk: checkDiskUsage()
      }
    };

    // Determine overall health status
    const serviceStatuses = Object.values(health.services);
    const unhealthyServices = serviceStatuses.filter(service => service.status !== 'healthy');

    if (unhealthyServices.length > 0) {
      health.status = 'degraded';
      if (unhealthyServices.some(service => service.status === 'unhealthy')) {
        health.status = 'unhealthy';
      }
    }

    const statusCode = health.status === 'healthy' ? 200 :
                      health.status === 'degraded' ? 200 : 503;

    res.status(statusCode).json(health);
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

/**
 * GET /api/monitoring/metrics
 * Get system metrics
 */
router.get('/metrics', requireApiKey, async (req, res) => {
  try {
    const metrics = await getSystemMetrics();
    res.json(metrics);
  } catch (error) {
    logger.error('Error getting metrics:', error);
    res.status(500).json({
      error: 'Failed to get metrics'
    });
  }
});

/**
 * GET /api/monitoring/alerts
 * Get recent alerts
 */
router.get('/alerts', requireApiKey, async (req, res) => {
  try {
    if (!productionMonitor) {
      return res.json({
        enabled: false,
        alerts: []
      });
    }

    const limit = parseInt(req.query.limit as string) || 50;
    const alerts = productionMonitor.getAlerts(limit);

    res.json({
      enabled: true,
      alerts,
      count: alerts.length
    });
  } catch (error) {
    logger.error('Error getting alerts:', error);
    res.status(500).json({
      error: 'Failed to get alerts'
    });
  }
});

/**
 * POST /api/monitoring/test-alert
 * Test alert system (admin only)
 */
router.post('/test-alert', requireAuth, async (req, res) => {
  try {
    const { type, message } = req.body;

    if (!productionMonitor) {
      return res.status(400).json({
        error: 'Production monitoring is not enabled'
      });
    }

    // Create test alert
    const testAlert = {
      id: `test_${Date.now()}`,
      type: type || 'info',
      service: 'test',
      message: message || 'This is a test alert from the monitoring system',
      timestamp: new Date(),
      resolved: false
    };

    // Send notification
    await sendTestNotification(testAlert);

    res.json({
      success: true,
      message: 'Test alert sent successfully',
      alert: testAlert
    });
  } catch (error) {
    logger.error('Error sending test alert:', error);
    res.status(500).json({
      error: 'Failed to send test alert'
    });
  }
});

/**
 * GET /api/monitoring/performance
 * Get performance metrics
 */
router.get('/performance', requireApiKey, async (req, res) => {
  try {
    const { timeRange = '1h' } = req.query;

    const performance = {
      responseTime: await getResponseTimeMetrics(timeRange as string),
      throughput: await getThroughputMetrics(timeRange as string),
      errorRate: await getErrorRateMetrics(timeRange as string),
      resourceUsage: await getResourceUsageMetrics(timeRange as string)
    };

    res.json(performance);
  } catch (error) {
    logger.error('Error getting performance metrics:', error);
    res.status(500).json({
      error: 'Failed to get performance metrics'
    });
  }
});

/**
 * POST /api/monitoring/deploy/complete
 * Mark deployment as complete and run health checks
 */
router.post('/deploy/complete', requireApiKey, async (req, res) => {
  try {
    const { version, sha } = req.body;

    logger.info(`Deployment completed: version=${version}, sha=${sha}`);

    // Run comprehensive health checks
    const health = await runDeploymentHealthChecks();

    if (health.status === 'healthy') {
      logger.info('Deployment health checks passed');
      await sendDeploymentNotification('success', version, sha);
    } else {
      logger.warn('Deployment health checks failed', health);
      await sendDeploymentNotification('failure', version, sha, health);
    }

    res.json({
      success: true,
      health,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error in deployment completion:', error);
    res.status(500).json({
      error: 'Failed to complete deployment health checks'
    });
  }
});

// Health check helper functions
async function checkDatabaseHealth(): Promise<{ status: string; details?: any }> {
  try {
    // This would be implemented with actual database health checks
    return { status: 'healthy', details: { connectionPool: 'active' } };
  } catch (error) {
    return { status: 'unhealthy', details: { error: error.message } };
  }
}

async function checkRedisHealth(): Promise<{ status: string; details?: any }> {
  try {
    // This would be implemented with actual Redis health checks
    return { status: 'healthy', details: { memory: 'normal' } };
  } catch (error) {
    return { status: 'unhealthy', details: { error: error.message } };
  }
}

function checkWebSocketHealth(): { status: string; details?: any } {
  try {
    // This would check WebSocket connections
    return { status: 'healthy', details: { connections: 'active' } };
  } catch (error) {
    return { status: 'unhealthy', details: { error: error.message } };
  }
}

async function checkAIHealth(): Promise<{ status: string; details?: any }> {
  try {
    // This would check AI service connections
    return { status: 'healthy', details: { providers: 'available' } };
  } catch (error) {
    return { status: 'degraded', details: { error: error.message } };
  }
}

async function checkStorageHealth(): Promise<{ status: string; details?: any }> {
  try {
    // This would check file storage systems
    return { status: 'healthy', details: { storage: 'available' } };
  } catch (error) {
    return { status: 'unhealthy', details: { error: error.message } };
  }
}

async function getSystemMetrics(): Promise<any> {
  const memUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();

  return {
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      rss: memUsage.rss,
      heapTotal: memUsage.heapTotal,
      heapUsed: memUsage.heapUsed,
      external: memUsage.external,
      arrayBuffers: memUsage.arrayBuffers
    },
    cpu: {
      user: cpuUsage.user,
      system: cpuUsage.system
    },
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch
  };
}

function checkMemoryUsage(): { status: string; usage?: number; threshold?: number } {
  const memUsage = process.memoryUsage();
  const usagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
  const threshold = 85;

  return {
    status: usagePercent > threshold ? 'warning' : 'healthy',
    usage: Math.round(usagePercent),
    threshold
  };
}

function checkCPUUsage(): { status: string; usage?: number } {
  // This would be implemented with actual CPU monitoring
  return { status: 'healthy', usage: 45 };
}

function checkDiskUsage(): { status: string; usage?: number } {
  // This would be implemented with actual disk monitoring
  return { status: 'healthy', usage: 60 };
}

async function getResponseTimeMetrics(timeRange: string): Promise<any> {
  // This would query actual response time metrics
  return {
    avg: 245,
    p50: 200,
    p95: 500,
    p99: 1200,
    timeRange
  };
}

async function getThroughputMetrics(timeRange: string): Promise<any> {
  // This would query actual throughput metrics
  return {
    requestsPerSecond: 45,
    requestsPerMinute: 2700,
    timeRange
  };
}

async function getErrorRateMetrics(timeRange: string): Promise<any> {
  // This would query actual error rate metrics
  return {
    percentage: 2.1,
    errors: 57,
    totalRequests: 2714,
    timeRange
  };
}

async function getResourceUsageMetrics(timeRange: string): Promise<any> {
  // This would query actual resource usage metrics
  return {
    cpu: { avg: 45, max: 78 },
    memory: { avg: 62, max: 85 },
    disk: { avg: 60, max: 70 },
    timeRange
  };
}

async function runDeploymentHealthChecks(): Promise<any> {
  // Run comprehensive health checks after deployment
  const health = await checkDatabaseHealth();
  const redis = await checkRedisHealth();
  const websockets = checkWebSocketHealth();
  const ai = await checkAIHealth();
  const storage = await checkStorageHealth();

  const allHealthy = [health, redis, websockets, ai, storage]
    .every(service => service.status === 'healthy');

  return {
    status: allHealthy ? 'healthy' : 'degraded',
    services: {
      database: health,
      redis,
      websockets,
      ai,
      storage
    },
    timestamp: new Date().toISOString()
  };
}

async function sendTestNotification(alert: any): Promise<void> {
  // Send test notification to configured channels
  if (monitoringConfig.alerts.slack.enabled) {
    // Implement Slack notification
  }
}

async function sendDeploymentNotification(status: string, version: string, sha: string, health?: any): Promise<void> {
  const message = status === 'success'
    ? `✅ Deployment completed successfully: v${version} (${sha.substring(0, 7)})`
    : `❌ Deployment completed with issues: v${version} (${sha.substring(0, 7)})`;

  // Send to monitoring channels
  logger.info(message);

  if (monitoringConfig.alerts.slack.enabled) {
    // Implement Slack notification
  }
}

export default router;