import { FullConfig } from '@playwright/test';
import { InfrastructureHelpers } from './utils/infrastructure-helpers';
import * as fs from 'fs';
import * as path from 'path';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting global test setup...');

  const startTime = Date.now();
  const setupResults = {
    infrastructure: false,
    directories: false,
    environment: false
  };

  // Create necessary directories
  try {
    const directories = [
      'test-results',
      'test-results/screenshots',
      'test-results/artifacts',
      'test-results/videos',
      'test-results/traces',
      'reports'
    ];

    directories.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    setupResults.directories = true;
    console.log('✅ Directories created successfully');
  } catch (error) {
    console.error('❌ Failed to create directories:', error);
  }

  // Validate environment variables
  try {
    const requiredEnvVars = [
      'BASE_URL',
      'POSTGRES_HOST',
      'POSTGRES_PORT',
      'REDIS_HOST',
      'REDIS_PORT',
      'KAFKA_HOST',
      'KAFKA_PORT'
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

    if (missingVars.length > 0) {
      console.warn('⚠️ Missing environment variables:', missingVars.join(', '));
      console.log('   Using default values for missing variables...');
    }

    // Set defaults if not provided
    if (!process.env.BASE_URL) process.env.BASE_URL = 'https://sdlc.finsavvyai.com';
    if (!process.env.POSTGRES_HOST) process.env.POSTGRES_HOST = 'localhost';
    if (!process.env.POSTGRES_PORT) process.env.POSTGRES_PORT = '5434';
    if (!process.env.POSTGRES_DB) process.env.POSTGRES_DB = 'sdlc_platform';
    if (!process.env.POSTGRES_USER) process.env.POSTGRES_USER = 'postgres';
    if (!process.env.POSTGRES_PASSWORD) process.env.POSTGRES_PASSWORD = 'secure-postgres-password-change-me';
    if (!process.env.REDIS_HOST) process.env.REDIS_HOST = 'localhost';
    if (!process.env.REDIS_PORT) process.env.REDIS_PORT = '6381';
    if (!process.env.KAFKA_HOST) process.env.KAFKA_HOST = 'localhost';
    if (!process.env.KAFKA_PORT) process.env.KAFKA_PORT = '9092';
    if (!process.env.PROMETHEUS_URL) process.env.PROMETHEUS_URL = 'http://localhost:9090/-/healthy';
    if (!process.env.GRAFANA_URL) process.env.GRAFANA_URL = 'http://localhost:3010/api/health';
    if (!process.env.JAEGER_URL) process.env.JAEGER_URL = 'http://localhost:16686/';

    setupResults.environment = true;
    console.log('✅ Environment variables validated');
  } catch (error) {
    console.error('❌ Environment setup failed:', error);
  }

  // Pre-test infrastructure connectivity check
  try {
    const infraHelpers = new InfrastructureHelpers();

    console.log('🔍 Checking infrastructure connectivity...');

    const checks = [
      {
        name: 'PostgreSQL',
        check: () => infraHelpers.initPostgres({
          host: process.env.POSTGRES_HOST!,
          port: parseInt(process.env.POSTGRES_PORT!),
          database: process.env.POSTGRES_DB!,
          user: process.env.POSTGRES_USER!,
          password: process.env.POSTGRES_PASSWORD!
        })
      },
      {
        name: 'Redis',
        check: () => infraHelpers.initRedis({
          host: process.env.REDIS_HOST!,
          port: parseInt(process.env.REDIS_PORT!),
          password: process.env.REDIS_PASSWORD
        })
      },
      {
        name: 'Kafka',
        check: () => infraHelpers.initKafka({
          host: process.env.KAFKA_HOST!,
          port: parseInt(process.env.KAFKA_PORT!)
        })
      }
    ];

    let successfulChecks = 0;
    const checkResults = [];

    for (const check of checks) {
      try {
        const result = await check.check();
        if (result) {
          successfulChecks++;
          checkResults.push(`${check.name}: ✅`);
        } else {
          checkResults.push(`${check.name}: ❌`);
        }
      } catch (error) {
        checkResults.push(`${check.name}: ❌ (${(error as Error).message})`);
      }
    }

    await infraHelpers.cleanup();

    console.log('📊 Infrastructure check results:');
    checkResults.forEach(result => console.log(`   ${result}`));
    console.log(`   Overall: ${successfulChecks}/${checks.length} services available`);

    setupResults.infrastructure = successfulChecks > 0;

  } catch (error) {
    console.error('❌ Infrastructure check failed:', error);
    setupResults.infrastructure = false;
  }

  // Create test configuration file
  try {
    const testConfig = {
      timestamp: new Date().toISOString(),
      setupTime: Date.now() - startTime,
      results: setupResults,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        baseUrl: process.env.BASE_URL,
        postgresHost: process.env.POSTGRES_HOST,
        redisHost: process.env.REDIS_HOST,
        kafkaHost: process.env.KAFKA_HOST
      }
    };

    fs.writeFileSync(
      path.join('test-results', 'setup-config.json'),
      JSON.stringify(testConfig, null, 2)
    );

    console.log('✅ Test configuration saved');
  } catch (error) {
    console.error('❌ Failed to save test configuration:', error);
  }

  // Health check for landing page
  try {
    const axios = require('axios');
    const response = await axios.get(process.env.BASE_URL, {
      timeout: 10000,
      validateStatus: () => true
    });

    if (response.status === 200) {
      console.log(`✅ Landing page accessible: ${process.env.BASE_URL} (${response.status})`);
    } else {
      console.warn(`⚠️ Landing page returned status: ${response.status}`);
    }
  } catch (error: any) {
    console.warn(`⚠️ Landing page health check failed: ${error.message}`);
  }

  const totalSetupTime = Date.now() - startTime;
  console.log(`🏁 Global setup completed in ${totalSetupTime}ms`);
  console.log('📋 Setup summary:', setupResults);

  // Return any cleanup data if needed
  return {
    setupTime: totalSetupTime,
    setupResults
  };
}

export default globalSetup;