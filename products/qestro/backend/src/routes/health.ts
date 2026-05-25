import { Router } from 'express';
import { healthCheckService } from '../services/HealthCheckService.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * GET /health
 * Basic health check endpoint for load balancers
 */
router.get('/', async (req, res) => {
  try {
    const healthStatus = await healthCheckService.checkSystemHealth();
    
    // Return appropriate HTTP status based on health
    const statusCode = healthStatus.overall === 'healthy' ? 200 : 
                      healthStatus.overall === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json({
      status: healthStatus.overall,
      timestamp: healthStatus.timestamp,
      uptime: healthStatus.uptime,
      version: healthStatus.version,
      environment: healthStatus.environment
    });
  } catch (error) {
    logger.error('Health check endpoint failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: 'Health check failed',
      timestamp: new Date()
    });
  }
});

/**
 * GET /health/detailed
 * Detailed health check with all service statuses
 */
router.get('/detailed', async (req, res) => {
  try {
    const healthStatus = await healthCheckService.checkSystemHealth();
    
    const statusCode = healthStatus.overall === 'healthy' ? 200 : 
                      healthStatus.overall === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json({
      success: true,
      data: healthStatus
    });
  } catch (error) {
    logger.error('Detailed health check failed:', error);
    res.status(503).json({
      success: false,
      error: 'Detailed health check failed',
      details: error.message,
      timestamp: new Date()
    });
  }
});

/**
 * GET /health/service/:serviceName
 * Health check for a specific service
 */
router.get('/service/:serviceName', async (req, res) => {
  try {
    const { serviceName } = req.params;
    const serviceHealth = await healthCheckService.checkServiceHealth(serviceName);
    
    if (!serviceHealth) {
      return res.status(404).json({
        success: false,
        error: `Service '${serviceName}' not found`,
        timestamp: new Date()
      });
    }
    
    const statusCode = serviceHealth.status === 'healthy' ? 200 : 
                      serviceHealth.status === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json({
      success: true,
      data: serviceHealth
    });
  } catch (error) {
    logger.error(`Service health check failed for ${req.params.serviceName}:`, error);
    res.status(503).json({
      success: false,
      error: 'Service health check failed',
      details: error.message,
      timestamp: new Date()
    });
  }
});

/**
 * GET /health/ready
 * Readiness probe - checks if the service is ready to accept traffic
 */
router.get('/ready', async (req, res) => {
  try {
    const healthStatus = await healthCheckService.checkSystemHealth();
    
    // Service is ready if overall status is healthy or degraded
    const isReady = healthStatus.overall !== 'unhealthy';
    
    if (isReady) {
      res.status(200).json({
        ready: true,
        status: healthStatus.overall,
        timestamp: healthStatus.timestamp
      });
    } else {
      res.status(503).json({
        ready: false,
        status: healthStatus.overall,
        timestamp: healthStatus.timestamp,
        unhealthyServices: healthStatus.services
          .filter(s => s.status === 'unhealthy')
          .map(s => s.service)
      });
    }
  } catch (error) {
    logger.error('Readiness check failed:', error);
    res.status(503).json({
      ready: false,
      error: 'Readiness check failed',
      timestamp: new Date()
    });
  }
});

/**
 * GET /health/live
 * Liveness probe - checks if the service is alive
 */
router.get('/live', (req, res) => {
  // Simple liveness check - if we can respond, we're alive
  res.status(200).json({
    alive: true,
    timestamp: new Date(),
    uptime: process.uptime(),
    pid: process.pid
  });
});

/**
 * GET /health/metrics
 * Comprehensive metrics endpoint for monitoring (Prometheus format)
 */
router.get('/metrics', async (req, res) => {
  try {
    const { monitoringService } = await import('../services/MonitoringService.js');
    const { scalingManager } = await import('../config/scaling.js');
    
    // Get comprehensive metrics from monitoring service
    const prometheusMetrics = monitoringService.generatePrometheusMetrics();
    
    // Add scaling metrics
    const scalingStatus = scalingManager.getScalingStatus();
    const scalingMetrics = [
      '',
      '# HELP qestro_scaling_current_instances Current number of instances',
      '# TYPE qestro_scaling_current_instances gauge',
      `qestro_scaling_current_instances ${scalingStatus.currentInstances}`,
      '',
      '# HELP qestro_scaling_min_instances Minimum number of instances',
      '# TYPE qestro_scaling_min_instances gauge',
      `qestro_scaling_min_instances ${scalingStatus.minInstances}`,
      '',
      '# HELP qestro_scaling_max_instances Maximum number of instances',
      '# TYPE qestro_scaling_max_instances gauge',
      `qestro_scaling_max_instances ${scalingStatus.maxInstances}`,
      '',
      '# HELP qestro_circuit_breaker_state Circuit breaker state (0=closed, 1=half-open, 2=open)',
      '# TYPE qestro_circuit_breaker_state gauge',
      `qestro_circuit_breaker_state ${
        scalingStatus.circuitBreakerState === 'closed' ? 0 :
        scalingStatus.circuitBreakerState === 'half-open' ? 1 : 2
      }`,
      '',
      '# HELP qestro_circuit_breaker_failures Circuit breaker failure count',
      '# TYPE qestro_circuit_breaker_failures counter',
      `qestro_circuit_breaker_failures ${scalingStatus.failureCount}`,
      ''
    ].join('\n');

    const combinedMetrics = prometheusMetrics + scalingMetrics;

    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.status(200).send(combinedMetrics);
  } catch (error) {
    logger.error('Metrics endpoint failed:', error);
    res.status(500).send('# Error generating metrics\n');
  }
});

export default router;