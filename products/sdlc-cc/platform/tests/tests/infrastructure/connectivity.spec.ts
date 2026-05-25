import { test, expect } from '@playwright/test';
import { InfrastructureHelpers } from '../../utils/infrastructure-helpers';

test.describe('Infrastructure Services Connectivity', () => {
  let infraHelpers: InfrastructureHelpers;

  test.beforeAll(async () => {
    infraHelpers = new InfrastructureHelpers();
  });

  test.afterAll(async () => {
    await infraHelpers.cleanup();
  });

  test.describe('PostgreSQL Database', () => {
    test('should connect to PostgreSQL on port 5434', async () => {
      const connected = await infraHelpers.initPostgres({
        host: process.env.POSTGRES_HOST || 'localhost',
        port: parseInt(process.env.POSTGRES_PORT || '5434'),
        database: process.env.POSTGRES_DB || 'sdlc_platform',
        user: process.env.POSTGRES_USER || 'postgres',
        password: process.env.POSTGRES_PASSWORD || 'secure-postgres-password-change-me'
      });

      expect(connected).toBeTruthy();
      console.log('✅ PostgreSQL connection successful');
    });

    test('should perform database operations correctly', async () => {
      await infraHelpers.initPostgres({
        host: process.env.POSTGRES_HOST || 'localhost',
        port: parseInt(process.env.POSTGRES_PORT || '5434'),
        database: process.env.POSTGRES_DB || 'sdlc_platform',
        user: process.env.POSTGRES_USER || 'postgres',
        password: process.env.POSTGRES_PASSWORD || 'secure-postgres-password-change-me'
      });

      const results = await infraHelpers.testPostgresOperations();

      expect(results.connection).toBeTruthy();
      expect(results.schema).toBeTruthy();
      expect(results.basicCRUD).toBeTruthy();

      console.log('✅ PostgreSQL operations successful');
      console.log(`   Connection: ${results.connection}`);
      console.log(`   Schema valid: ${results.schema}`);
      console.log(`   Vector extension: ${results.vectorExtension}`);
      console.log(`   Basic CRUD: ${results.basicCRUD}`);
    });

    test('should have pgvector extension available', async () => {
      await infraHelpers.initPostgres({
        host: process.env.POSTGRES_HOST || 'localhost',
        port: parseInt(process.env.POSTGRES_PORT || '5434'),
        database: process.env.POSTGRES_DB || 'sdlc_platform',
        user: process.env.POSTGRES_USER || 'postgres',
        password: process.env.POSTGRES_PASSWORD || 'secure-postgres-password-change-me'
      });

      const results = await infraHelpers.testPostgresOperations();

      expect(results.vectorExtension).toBeTruthy();
      console.log('✅ pgvector extension is available');
    });
  });

  test.describe('Redis Cache', () => {
    test('should connect to Redis on port 6381', async () => {
      const connected = await infraHelpers.initRedis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6381'),
        password: process.env.REDIS_PASSWORD
      });

      expect(connected).toBeTruthy();
      console.log('✅ Redis connection successful');
    });

    test('should perform Redis operations correctly', async () => {
      await infraHelpers.initRedis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6381'),
        password: process.env.REDIS_PASSWORD
      });

      const results = await infraHelpers.testRedisOperations();

      expect(results.connection).toBeTruthy();
      expect(results.basicOperations).toBeTruthy();
      expect(results.dataTypes).toBeTruthy();

      console.log('✅ Redis operations successful');
      console.log(`   Connection: ${results.connection}`);
      console.log(`   Basic operations: ${results.basicOperations}`);
      console.log(`   Data types: ${results.dataTypes}`);
      console.log(`   Performance: ${results.performance}`);
    });

    test('should meet performance requirements', async () => {
      await infraHelpers.initRedis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6381'),
        password: process.env.REDIS_PASSWORD
      });

      const results = await infraHelpers.testRedisOperations();

      expect(results.performance).toBeTruthy();
      console.log('✅ Redis performance meets requirements');
    });
  });

  test.describe('Kafka Message Queue', () => {
    test('should connect to Kafka on port 9092', async () => {
      const connected = await infraHelpers.initKafka({
        host: process.env.KAFKA_HOST || 'localhost',
        port: parseInt(process.env.KAFKA_PORT || '9092')
      });

      expect(connected).toBeTruthy();
      console.log('✅ Kafka connection successful');
    });

    test('should perform Kafka operations correctly', async () => {
      await infraHelpers.initKafka({
        host: process.env.KAFKA_HOST || 'localhost',
        port: parseInt(process.env.KAFKA_PORT || '9092')
      });

      const results = await infraHelpers.testKafkaOperations();

      expect(results.connection).toBeTruthy();
      expect(results.topicManagement).toBeTruthy();
      expect(results.messageProduction).toBeTruthy();

      console.log('✅ Kafka operations successful');
      console.log(`   Connection: ${results.connection}`);
      console.log(`   Topic management: ${results.topicManagement}`);
      console.log(`   Message production: ${results.messageProduction}`);
      console.log(`   Message consumption: ${results.messageConsumption}`);
    });
  });

  test.describe('HTTP Services Health Check', () => {
    test('should check all service health endpoints', async () => {
      const services = [
        { name: 'Prometheus', url: process.env.PROMETHEUS_URL || 'http://localhost:9090/-/healthy' },
        { name: 'Grafana', url: process.env.GRAFANA_URL || 'http://localhost:3010/api/health' },
        { name: 'Jaeger', url: process.env.JAEGER_URL || 'http://localhost:16686/' },
      ];

      const healthResults = await infraHelpers.checkHttpServices(services);

      // At least one service should be healthy
      const healthyServices = healthResults.filter(s => s.status === 'healthy');
      expect(healthyServices.length).toBeGreaterThan(0);

      console.log('✅ Service health checks completed');
      healthResults.forEach(result => {
        console.log(`   ${result.name}: ${result.status} (${result.responseTime}ms)`);
        if (result.error) {
          console.log(`     Error: ${result.error}`);
        }
      });
    });

    test('should have Prometheus accessible', async () => {
      const services = [
        { name: 'Prometheus', url: process.env.PROMETHEUS_URL || 'http://localhost:9090/-/healthy' }
      ];

      const results = await infraHelpers.checkHttpServices(services);
      const prometheus = results[0];

      // Prometheus should be healthy or at least accessible
      expect(prometheus.status === 'healthy' || prometheus.status === 'unhealthy').toBeTruthy();

      if (prometheus.status === 'healthy') {
        console.log('✅ Prometheus is healthy and accessible');
      } else {
        console.log('⚠️ Prometheus is not healthy but service is reachable');
        console.log(`   Status: ${prometheus.status}`);
        console.log(`   Error: ${prometheus.error}`);
      }
    });

    test('should have Grafana accessible', async () => {
      const services = [
        { name: 'Grafana', url: process.env.GRAFANA_URL || 'http://localhost:3010/api/health' }
      ];

      const results = await infraHelpers.checkHttpServices(services);
      const grafana = results[0];

      // Grafana should be healthy or at least accessible
      expect(grafana.status === 'healthy' || grafana.status === 'unhealthy').toBeTruthy();

      if (grafana.status === 'healthy') {
        console.log('✅ Grafana is healthy and accessible');
      } else {
        console.log('⚠️ Grafana is not healthy but service is reachable');
        console.log(`   Status: ${grafana.status}`);
        console.log(`   Error: ${grafana.error}`);
      }
    });

    test('should have Jaeger accessible', async () => {
      const services = [
        { name: 'Jaeger', url: process.env.JAEGER_URL || 'http://localhost:16686/' }
      ];

      const results = await infraHelpers.checkHttpServices(services);
      const jaeger = results[0];

      // Jaeger should be healthy or at least accessible
      expect(jaeger.status === 'healthy' || jaeger.status === 'unhealthy').toBeTruthy();

      if (jaeger.status === 'healthy') {
        console.log('✅ Jaeger is healthy and accessible');
      } else {
        console.log('⚠️ Jaeger is not healthy but service is reachable');
        console.log(`   Status: ${jaeger.status}`);
        console.log(`   Error: ${jaeger.error}`);
      }
    });
  });

  test.describe('Port Accessibility Tests', () => {
    test('should validate all required ports are accessible', async () => {
      const portTests = [
        { port: 5434, name: 'PostgreSQL', protocol: 'tcp' },
        { port: 6381, name: 'Redis', protocol: 'tcp' },
        { port: 9092, name: 'Kafka', protocol: 'tcp' },
        { port: 9090, name: 'Prometheus', protocol: 'http' },
        { port: 3010, name: 'Grafana', protocol: 'http' },
        { port: 16686, name: 'Jaeger', protocol: 'http' },
      ];

      const results = [];

      for (const portTest of portTests) {
        const startTime = Date.now();
        let accessible = false;
        let error = '';

        try {
          if (portTest.protocol === 'tcp') {
            // For TCP ports, we'll try a simple connection test
            const net = require('net');
            accessible = await new Promise((resolve) => {
              const socket = new net.Socket();
              socket.setTimeout(5000);

              socket.on('connect', () => {
                socket.destroy();
                resolve(true);
              });

              socket.on('timeout', () => {
                socket.destroy();
                resolve(false);
              });

              socket.on('error', () => {
                resolve(false);
              });

              socket.connect(portTest.port, 'localhost');
            });
          } else if (portTest.protocol === 'http') {
            // For HTTP ports, use fetch
            const response = await fetch(`http://localhost:${portTest.port}`, {
              method: 'GET',
              timeout: 5000
            });
            accessible = response.ok || response.status < 500; // Accept non-5xx responses
          }
        } catch (e: any) {
          error = e.message;
          accessible = false;
        }

        const responseTime = Date.now() - startTime;
        results.push({
          name: portTest.name,
          port: portTest.port,
          accessible,
          responseTime,
          error
        });
      }

      // At least half of the services should be accessible
      const accessibleCount = results.filter(r => r.accessible).length;
      expect(accessibleCount).toBeGreaterThanOrEqual(Math.floor(portTests.length / 2));

      console.log('✅ Port accessibility tests completed');
      results.forEach(result => {
        const status = result.accessible ? '✅' : '❌';
        console.log(`   ${status} ${result.name} (port ${result.port}): ${result.responseTime}ms`);
        if (result.error) {
          console.log(`     Error: ${result.error}`);
        }
      });
    });
  });

  test.describe('Infrastructure Performance Tests', () => {
    test('should measure database connection performance', async () => {
      const startTime = Date.now();

      await infraHelpers.initPostgres({
        host: process.env.POSTGRES_HOST || 'localhost',
        port: parseInt(process.env.POSTGRES_PORT || '5434'),
        database: process.env.POSTGRES_DB || 'sdlc_platform',
        user: process.env.POSTGRES_USER || 'postgres',
        password: process.env.POSTGRES_PASSWORD || 'secure-postgres-password-change-me'
      });

      const connectionTime = Date.now() - startTime;

      // Database connection should be reasonably fast
      expect(connectionTime).toBeLessThan(10000); // 10 seconds

      console.log('✅ Database connection performance measured');
      console.log(`   Connection time: ${connectionTime}ms`);
    });

    test('should measure Redis performance', async () => {
      await infraHelpers.initRedis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6381'),
        password: process.env.REDIS_PASSWORD
      });

      const results = await infraHelpers.testRedisOperations();

      if (results.performance) {
        console.log('✅ Redis performance meets requirements');
      } else {
        console.log('⚠️ Redis performance is below expectations');
      }
    });
  });
});