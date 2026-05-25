import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { testExecutionEnvironments, projects, users } from '../schema/index.js';

export async function seedTestExecutionEnvironments(
  db: PostgresJsDatabase<any>,
  seedUsers: any[],
  seedProjects: any[]
) {
  console.log('🌐 Seeding test execution environments...');

  const sampleEnvironments = [
    {
      projectId: seedProjects[0].id,
      userId: seedUsers[0].id,
      name: 'Local Development Environment',
      description: 'Local development environment for testing',
      type: 'local',
      browserConfig: {
        browsers: ['chrome', 'firefox', 'safari'],
        defaultBrowser: 'chrome',
        headless: false,
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      },
      deviceConfig: {
        devices: ['desktop'],
        defaultDevice: 'desktop',
        touchEnabled: false,
        geolocation: { latitude: 37.7749, longitude: -122.4194 }
      },
      networkConfig: {
        throttling: 'none',
        offline: false,
        latency: 0,
        downloadSpeed: 0,
        uploadSpeed: 0
      },
      environmentVariables: {
        NODE_ENV: 'development',
        API_BASE_URL: 'http://localhost:3001',
        FRONTEND_URL: 'http://localhost:3000'
      },
      customSettings: {
        screenshotOnFailure: true,
        videoRecording: false,
        debugMode: true,
        waitTimeout: 30000
      },
      status: 'active',
      isDefault: true
    },
    {
      projectId: seedProjects[0].id,
      userId: seedUsers[0].id,
      name: 'BrowserStack Cross-Browser',
      description: 'BrowserStack environment for cross-browser testing',
      type: 'cloud',
      browserConfig: {
        browsers: ['chrome', 'firefox', 'safari', 'edge'],
        versions: {
          chrome: ['latest', 'latest-1', 'latest-2'],
          firefox: ['latest', 'latest-1'],
          safari: ['latest'],
          edge: ['latest', 'latest-1']
        },
        platforms: ['Windows 10', 'Windows 11', 'macOS Monterey', 'macOS Ventura']
      },
      deviceConfig: {
        devices: ['desktop', 'tablet', 'mobile'],
        mobileDevices: ['iPhone 14', 'iPhone 13', 'Samsung Galaxy S22', 'Google Pixel 6'],
        tabletDevices: ['iPad Pro', 'Samsung Galaxy Tab S8']
      },
      networkConfig: {
        throttling: 'none',
        networkProfiles: ['wifi', '4g', '3g', 'edge']
      },
      cloudProvider: 'browserstack',
      cloudCredentials: {
        username: '{{BROWSERSTACK_USERNAME}}',
        accessKey: '{{BROWSERSTACK_ACCESS_KEY}}',
        project: 'Questro Testing',
        build: 'CI Build {{BUILD_NUMBER}}'
      },
      environmentVariables: {
        NODE_ENV: 'testing',
        API_BASE_URL: 'https://api.questro.app',
        FRONTEND_URL: 'https://questro.app'
      },
      customSettings: {
        screenshotOnFailure: true,
        videoRecording: true,
        debugMode: false,
        waitTimeout: 45000,
        resolution: '1920x1080',
        timezone: 'UTC'
      },
      status: 'active'
    },
    {
      projectId: seedProjects[0].id,
      userId: seedUsers[0].id,
      name: 'Mobile Testing - AWS Device Farm',
      description: 'AWS Device Farm for mobile device testing',
      type: 'cloud',
      deviceConfig: {
        devices: ['mobile'],
        mobileDevices: [
          'Apple iPhone 14 Pro',
          'Apple iPhone 13',
          'Samsung Galaxy S22 Ultra',
          'Google Pixel 7',
          'OnePlus 10 Pro'
        ],
        platforms: ['iOS', 'Android'],
        orientations: ['portrait', 'landscape']
      },
      networkConfig: {
        throttling: 'realistic',
        networkProfiles: ['wifi', '4g', '3g']
      },
      cloudProvider: 'aws-device-farm',
      cloudCredentials: {
        accessKeyId: '{{AWS_ACCESS_KEY_ID}}',
        secretAccessKey: '{{AWS_SECRET_ACCESS_KEY}}',
        region: 'us-west-2',
        devicePoolArn: '{{DEVICE_POOL_ARN}}'
      },
      environmentVariables: {
        NODE_ENV: 'testing',
        API_BASE_URL: 'https://api.questro.app',
        MOBILE_APP_VERSION: '1.0.0'
      },
      customSettings: {
        screenshotOnFailure: true,
        videoRecording: true,
        appiumVersion: '1.22.0',
        testTimeout: 60000,
        deviceCleanup: true
      },
      status: 'active'
    },
    {
      projectId: seedProjects[1]?.id || seedProjects[0].id,
      userId: seedUsers[1]?.id || seedUsers[0].id,
      name: 'Performance Testing Environment',
      description: 'Dedicated environment for performance and load testing',
      type: 'cloud',
      browserConfig: {
        browsers: ['chrome'],
        headless: true,
        viewport: { width: 1920, height: 1080 },
        args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
      },
      networkConfig: {
        throttling: 'custom',
        latency: 100,
        downloadSpeed: 10000,
        uploadSpeed: 2000
      },
      cloudProvider: 'lambdatest',
      cloudCredentials: {
        username: '{{LAMBDATEST_USERNAME}}',
        accessKey: '{{LAMBDATEST_ACCESS_KEY}}',
        tunnel: true,
        tunnelName: 'questro-performance-tunnel'
      },
      environmentVariables: {
        NODE_ENV: 'performance',
        API_BASE_URL: 'https://api.questro.app',
        PERFORMANCE_MONITORING: 'true',
        METRICS_COLLECTION: 'true'
      },
      customSettings: {
        screenshotOnFailure: false,
        videoRecording: false,
        performanceMetrics: true,
        resourceMonitoring: true,
        concurrentSessions: 10,
        loadTestDuration: 300000 // 5 minutes
      },
      status: 'active'
    },
    {
      projectId: seedProjects[0].id,
      userId: seedUsers[0].id,
      name: 'Staging Environment',
      description: 'Staging environment for pre-production testing',
      type: 'hybrid',
      browserConfig: {
        browsers: ['chrome', 'firefox'],
        defaultBrowser: 'chrome',
        headless: false,
        viewport: { width: 1440, height: 900 }
      },
      deviceConfig: {
        devices: ['desktop', 'tablet'],
        defaultDevice: 'desktop'
      },
      networkConfig: {
        throttling: 'slow-3g',
        offline: false
      },
      environmentVariables: {
        NODE_ENV: 'staging',
        API_BASE_URL: 'https://staging-api.questro.app',
        FRONTEND_URL: 'https://staging.questro.app',
        DATABASE_URL: '{{STAGING_DATABASE_URL}}'
      },
      customSettings: {
        screenshotOnFailure: true,
        videoRecording: true,
        debugMode: false,
        waitTimeout: 30000,
        retryFailedTests: true,
        maxRetries: 2
      },
      status: 'active'
    }
  ];

  try {
    const insertedEnvironments = await db.insert(testExecutionEnvironments).values(sampleEnvironments).returning();
    console.log(`✅ Seeded ${insertedEnvironments.length} test execution environments`);
    return insertedEnvironments;
  } catch (error) {
    console.error('❌ Error seeding test execution environments:', error);
    throw error;
  }
}