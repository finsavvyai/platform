const express = require('express');
const promClient = require('prom-client');

// Create a Registry to register the metrics
const register = new promClient.Registry();

// Add a default label which can be used to identify metrics
register.setDefaultLabels({
  app: 'sdlc-health-checker'
});

// Enable the collection of default metrics
promClient.collectDefaultMetrics({ register });

// Create custom metrics
const httpRequestDurationMicroseconds = new promClient.Histogram({
  name: 'http_request_duration_ms',
  help: 'Duration of HTTP requests in ms',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [50, 100, 200, 300, 400, 500, 1000, 2000, 5000]
});

const httpRequestTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

const healthCheckDuration = new promClient.Histogram({
  name: 'health_check_duration_ms',
  help: 'Duration of health checks in ms',
  labelNames: ['service', 'status'],
  buckets: [100, 500, 1000, 2000, 5000, 10000]
});

const serviceUp = new promClient.Gauge({
  name: 'service_up',
  help: 'Whether a service is up (1) or down (0)',
  labelNames: ['service']
});

// Services to monitor
const services = [
  { name: 'landing-page', url: 'http://landing-page:3000/api/health' },
  { name: 'sdlc-gateway', url: 'http://sdlc-gateway:8080/health' },
  { name: 'sdlc-api', url: 'http://sdlc-api:8081/health' },
  { name: 'postgres', url: 'http://postgres-exporter:9187/metrics' },
  { name: 'redis', url: 'http://redis-exporter:9121/metrics' }
];

const app = express();
app.use(express.json());

// Middleware to collect metrics
app.use((req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const route = req.route ? req.route.path : req.path;

    httpRequestDurationMicroseconds
      .labels(req.method, route, res.statusCode)
      .observe(duration);

    httpRequestTotal
      .labels(req.method, route, res.statusCode)
      .inc();
  });

  next();
});

// Health check endpoint for each service
app.get('/health/:service?', async (req, res) => {
  const serviceName = req.params.service;
  const start = Date.now();

  try {
    if (serviceName) {
      // Check specific service
      const service = services.find(s => s.name === serviceName);
      if (!service) {
        return res.status(404).json({ error: 'Service not found' });
      }

      const isHealthy = await checkServiceHealth(service);
      const duration = Date.now() - start;

      healthCheckDuration
        .labels(serviceName, isHealthy ? 'healthy' : 'unhealthy')
        .observe(duration);

      serviceUp.labels(serviceName).set(isHealthy ? 1 : 0);

      res.status(isHealthy ? 200 : 503).json({
        service: serviceName,
        status: isHealthy ? 'healthy' : 'unhealthy',
        duration: `${duration}ms`,
        timestamp: new Date().toISOString()
      });
    } else {
      // Check all services
      const results = await Promise.all(
        services.map(async (service) => {
          const isHealthy = await checkServiceHealth(service);
          serviceUp.labels(service.name).set(isHealthy ? 1 : 0);
          return {
            name: service.name,
            status: isHealthy ? 'healthy' : 'unhealthy',
            url: service.url
          };
        })
      );

      const allHealthy = results.every(r => r.status === 'healthy');
      const duration = Date.now() - start;

      res.status(allHealthy ? 200 : 503).json({
        status: allHealthy ? 'healthy' : 'degraded',
        duration: `${duration}ms`,
        services: results,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    console.error('Metrics error:', error);
    res.status(500).end('Error generating metrics');
  }
});

// Readiness probe
app.get('/ready', (req, res) => {
  res.json({ status: 'ready', timestamp: new Date().toISOString() });
});

// Liveness probe
app.get('/live', (req, res) => {
  res.json({ status: 'alive', timestamp: new Date().toISOString() });
});

// Health check function
async function checkServiceHealth(service) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const response = await fetch(service.url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'SDLC-Health-Checker/1.0'
      }
    });

    clearTimeout(timeoutId);

    return response.ok;
  } catch (error) {
    console.error(`Health check failed for ${service.name}:`, error.message);
    return false;
  }
}

// Periodic health checks
setInterval(async () => {
  console.log('Running periodic health checks...');

  for (const service of services) {
    try {
      const isHealthy = await checkServiceHealth(service);
      serviceUp.labels(service.name).set(isHealthy ? 1 : 0);
      console.log(`${service.name}: ${isHealthy ? 'UP' : 'DOWN'}`);
    } catch (error) {
      console.error(`Periodic health check failed for ${service.name}:`, error.message);
      serviceUp.labels(service.name).set(0);
    }
  }
}, 30000); // Check every 30 seconds

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`SDLC Health Checker running on port ${PORT}`);
  console.log(`Health check endpoint: http://localhost:${PORT}/health`);
  console.log(`Metrics endpoint: http://localhost:${PORT}/metrics`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});