#!/usr/bin/env tsx

/**
 * Additional seed data for test runs, integrations, and analytics
 * This script extends the base seed data with more comprehensive test data
 */

import { drizzle } from 'drizzle-orm/d1';
import { eq, and, inArray, desc } from 'drizzle-orm';
import * as schema from '../src/schema/index.js';
import { nanoid } from 'nanoid';

type ExtendedSeedContext = {
  db: ReturnType<typeof drizzle>;
  createdIds: {
    testRuns: string[];
    integrations: string[];
    apiKeys: string[];
    usageAnalytics: string[];
  };
};

// Utility functions
function randomChoice<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function randomNumber(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomBoolean(probability: number = 0.5): boolean {
  return Math.random() < probability;
}

function randomTimestamp(start: Date, end: Date): number {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime())).getTime();
}

function generateId(): string {
  return nanoid();
}

// Test run creation
async function createTestRuns(ctx: ExtendedSeedContext, testCaseIds: string[]) {
  console.log('🏃 Creating test runs...');

  const statuses = ['passed', 'failed', 'error', 'passed', 'passed']; // 60% pass rate
  const testRunIds: string[] = [];

  for (const testCaseId of testCaseIds) {
    // Get test case details
    const testCase = await ctx.db.select().from(schema.testCases)
      .where(eq(schema.testCases.id, testCaseId))
      .limit(1)
      .then(rows => rows[0]);

    if (!testCase) continue;

    // Create 1-5 test runs per test case
    const numRuns = randomNumber(1, 5);

    for (let i = 0; i < numRuns; i++) {
      const testRunId = generateId();
      const status = randomChoice(statuses);
      const startTime = randomTimestamp(
        new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 14 days ago
        new Date()
      );
      const duration = randomNumber(5000, 60000); // 5 seconds to 1 minute
      const endTime = startTime + duration;

      // Generate results based on status
      let results;
      let errorMessage;

      if (status === 'passed') {
        results = {
          passed: randomNumber(5, 15),
          failed: 0,
          skipped: randomNumber(0, 2),
          assertions: randomNumber(10, 30),
          coverage: `${randomNumber(70, 95)}%`
        };
      } else if (status === 'failed') {
        results = {
          passed: randomNumber(3, 10),
          failed: randomNumber(1, 3),
          skipped: randomNumber(0, 1),
          assertions: randomNumber(5, 20),
          coverage: `${randomNumber(40, 70)}%`
        };
        errorMessage = randomChoice([
          'Element not found: #submit-button',
          'Timeout waiting for element .loading',
          'Assertion failed: Expected text to contain "Welcome"',
          'Network error: Failed to load resource',
          'Element not visible: #modal'
        ]);
      } else {
        results = {
          passed: 0,
          failed: 0,
          skipped: 0,
          assertions: 0,
          coverage: '0%'
        };
        errorMessage = randomChoice([
          'Test execution interrupted',
          'Browser crashed unexpectedly',
          'Network connection lost',
          'Out of memory error',
          'Test runner crashed'
        ]);
      }

      // Generate environment info
      const environment = {
        platform: testCase.platform,
        browser: testCase.type === 'web' ? randomChoice(['Chrome 108', 'Firefox 107', 'Safari 16']) : null,
        device: testCase.type === 'mobile' ? randomChoice(['iPhone 13', 'Samsung Galaxy S22', 'Pixel 7']) : null,
        os: testCase.type === 'mobile' ? randomChoice(['iOS 16.0', 'Android 13']) : randomChoice(['Windows 11', 'macOS 13', 'Ubuntu 22.04']),
        resolution: testCase.type === 'mobile'
          ? randomChoice(['390x844', '428x926', '1080x2400'])
          : randomChoice(['1920x1080', '1366x768', '1440x900']),
        testRunner: 'Qestro Test Runner v1.0.0'
      };

      // Generate logs
      const logs = [];
      const logTypes = status === 'passed' ? ['info', 'debug', 'info'] : ['info', 'error', 'warn'];

      for (let j = 0; j < randomNumber(3, 8); j++) {
        const logType = randomChoice(logTypes);
        const logTimestamp = startTime + (j * (duration / 8));

        logs.push({
          timestamp: logTimestamp,
          level: logType,
          message: logType === 'error'
            ? errorMessage || 'An error occurred'
            : logType === 'warn'
            ? 'Warning: Element found with delay'
            : logType === 'debug'
            ? `Executing step ${j + 1}: ${randomChoice(['click', 'type', 'wait', 'assert'])}`
            : `Test step ${j + 1} completed`,
          source: randomChoice(['test-runner', 'browser', 'device', 'network'])
        });
      }

      // Generate screenshots (1-3 per test)
      const screenshots = [];
      if (randomBoolean(0.8)) {
        const numScreenshots = randomNumber(1, 3);
        for (let s = 0; s < numScreenshots; s++) {
          screenshots.push({
            url: `https://storage.qestro.dev/screenshots/${generateId()}.png`,
            timestamp: startTime + (s * (duration / numScreenshots)),
            name: `Step ${s + 1} Screenshot`,
            size: randomNumber(50000, 200000)
          });
        }
      }

      // Generate video (optional)
      const videos = randomBoolean(0.4) ? [{
        url: `https://storage.qestro.dev/videos/${generateId()}.webm`,
        duration: Math.floor(duration / 1000),
        size: randomNumber(1000000, 5000000),
        resolution: environment.resolution
      }] : [];

      const testRun = {
        id: testRunId,
        testSuiteId: null, // Not linking to suites for now
        testCaseId,
        projectId: testCase.projectId,
        userId: testCase.userId,
        status,
        startTime,
        endTime,
        duration,
        results: JSON.stringify(results),
        logs: JSON.stringify(logs),
        screenshots: JSON.stringify(screenshots),
        videos: JSON.stringify(videos),
        errorMessage,
        environment: JSON.stringify(environment),
        createdAt: startTime
      };

      await ctx.db.insert(schema.testRuns).values(testRun);
      testRunIds.push(testRunId);
      ctx.createdIds.testRuns.push(testRunId);
    }
  }

  console.log(`✓ Created ${testRunIds.length} test runs`);
  return testRunIds;
}

// Integrations creation
async function createIntegrations(ctx: ExtendedSeedContext, userIds: string[]) {
  console.log('🔗 Creating integrations...');

  const integrationIds: string[] = [];
  const integrationTypes = ['slack', 'teams', 'discord', 'email', 'webhook', 'github', 'jira'];

  for (const userId of userIds.slice(0, Math.ceil(userIds.length * 0.6))) { // 60% of users
    const numIntegrations = randomNumber(1, 2);

    for (let i = 0; i < numIntegrations; i++) {
      const integrationId = generateId();
      const type = randomChoice(integrationTypes);

      // Generate config based on type
      let config;
      switch (type) {
        case 'slack':
          config = {
            webhookUrl: `https://hooks.slack.com/services/T${generateId()}/B${generateId()}/${generateId()}`,
            channel: randomChoice(['#general', '#testing', '#alerts', '#ci-cd']),
            notifyOn: ['failure', 'success'],
            includeScreenshots: true
          };
          break;
        case 'teams':
          config = {
            webhookUrl: `https://outlook.office.com/webhook/${generateId()}`,
            team: randomChoice(['Dev Team', 'QA Team', 'Product Team']),
            notifyOn: ['failure']
          };
          break;
        case 'discord':
          config = {
            webhookUrl: `https://discord.com/api/webhooks/${generateId()}/${generateId()}`,
            serverId: generateId(),
            channelId: generateId()
          };
          break;
        case 'email':
          config = {
            recipients: [randomChoice(['dev-team@company.com', 'qa@company.com', 'alerts@company.com'])],
            subject: 'Test Results - {{status}}',
            includeReport: true
          };
          break;
        case 'webhook':
          config = {
            url: `https://api.company.com/webhooks/test-results/${generateId()}`,
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${generateId()}`,
              'Content-Type': 'application/json'
            }
          };
          break;
        case 'github':
          config = {
            token: `ghp_${generateId()}`,
            owner: randomChoice(['qestro', 'testorg', 'company']),
            repo: randomChoice(['test-repo', 'automation', 'e2e-tests']),
            createIssues: true,
            updateStatus: true
          };
          break;
        case 'jira':
          config = {
            url: 'https://company.atlassian.net',
            username: 'test-automation@company.com',
            token: generateId(),
            project: randomChoice(['TEST', 'QA', 'AUTO']),
            issueType: 'Bug'
          };
          break;
      }

      const integration = {
        id: integrationId,
        userId,
        projectId: null, // Global integrations for now
        type,
        name: `${type.charAt(0).toUpperCase() + type.slice(1)} Integration`,
        config: JSON.stringify(config),
        isActive: randomBoolean(0.8) ? 1 : 0,
        lastTriggeredAt: randomBoolean(0.5)
          ? randomTimestamp(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), new Date())
          : null,
        createdAt: randomTimestamp(new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), new Date()),
        updatedAt: new Date().getTime()
      };

      await ctx.db.insert(schema.integrations).values(integration);
      integrationIds.push(integrationId);
      ctx.createdIds.integrations.push(integrationId);
    }
  }

  console.log(`✓ Created ${integrationIds.length} integrations`);
  return integrationIds;
}

// API Keys creation
async function createApiKeys(ctx: ExtendedSeedContext, userIds: string[]) {
  console.log('🔑 Creating API keys...');

  const apiKeyIds: string[] = [];

  for (const userId of userIds.slice(0, Math.ceil(userIds.length * 0.4))) { // 40% of users
    const numKeys = randomNumber(1, 2);

    for (let i = 0; i < numKeys; i++) {
      const apiKeyId = generateId();
      const keyName = randomChoice([
        'Production API Key',
        'Testing API Key',
        'CI/CD Key',
        'Mobile App Key',
        'Integration Key'
      ]);

      // Generate a fake API key
      const keyValue = `qsk_${generateId().replace(/-/g, '')}`;
      const keyPrefix = keyValue.substring(0, 7);
      const keyHash = `hashed_${Buffer.from(keyValue).toString('base64')}`;

      // Generate permissions based on user role
      const permissions = [
        'tests:read',
        'tests:write',
        'projects:read',
        'projects:write',
        'results:read',
        'analytics:read'
      ];

      const apiKey = {
        id: apiKeyId,
        userId,
        name: keyName,
        keyHash,
        keyPrefix,
        permissions: JSON.stringify(randomChoices(permissions, randomNumber(2, 4))),
        lastUsedAt: randomBoolean(0.6)
          ? randomTimestamp(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), new Date())
          : null,
        expiresAt: randomBoolean(0.3)
          ? randomTimestamp(new Date(), new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)) // 1 year from now
          : null,
        isActive: randomBoolean(0.9) ? 1 : 0,
        createdAt: randomTimestamp(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), new Date())
      };

      await ctx.db.insert(schema.apiKeys).values(apiKey);
      apiKeyIds.push(apiKeyId);
      ctx.createdIds.apiKeys.push(apiKeyId);
    }
  }

  console.log(`✓ Created ${apiKeyIds.length} API keys`);
  return apiKeyIds;
}

// Usage analytics creation
async function createUsageAnalytics(ctx: ExtendedSeedContext, userIds: string[]) {
  console.log('📊 Creating usage analytics...');

  const analyticsIds: string[] = [];
  const eventTypes = [
    'test_run_started',
    'test_run_completed',
    'recording_started',
    'recording_completed',
    'test_case_created',
    'project_created',
    'user_login',
    'api_request'
  ];

  // Create analytics for the last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  for (const userId of userIds) {
    // Create 5-15 analytics events per user
    const numEvents = randomNumber(5, 15);

    for (let i = 0; i < numEvents; i++) {
      const analyticsId = generateId();
      const eventType = randomChoice(eventTypes);
      const timestamp = randomTimestamp(thirtyDaysAgo, new Date());

      // Generate metadata based on event type
      let metadata;
      switch (eventType) {
        case 'test_run_started':
        case 'test_run_completed':
          metadata = {
            testType: randomChoice(['mobile', 'web']),
            platform: randomChoice(['iOS', 'Android', 'Chrome', 'Firefox']),
            duration: randomNumber(5000, 60000)
          };
          break;
        case 'recording_started':
        case 'recording_completed':
          metadata = {
            recordingType: randomChoice(['mobile', 'web']),
            deviceType: randomChoice(['mobile', 'desktop', 'tablet'])
          };
          break;
        case 'test_case_created':
          metadata = {
            testCaseType: randomChoice(['manual', 'automated']),
            complexity: randomChoice(['simple', 'medium', 'complex'])
          };
          break;
        case 'project_created':
          metadata = {
            projectType: randomChoice(['mobile', 'web', 'hybrid'])
          };
          break;
        case 'user_login':
          metadata = {
            method: randomChoice(['email', 'sso']),
            userAgent: 'Qestro Dashboard'
          };
          break;
        case 'api_request':
          metadata = {
            endpoint: randomChoice(['/api/tests', '/api/projects', '/api/results']),
            method: randomChoice(['GET', 'POST', 'PUT', 'DELETE']),
            statusCode: randomChoice([200, 201, 400, 404, 500])
          };
          break;
      }

      const analytics = {
        id: analyticsId,
        userId,
        projectId: null, // Could be linked to specific projects
        eventType,
        metadata: JSON.stringify(metadata),
        timestamp,
        ipAddress: `192.168.${randomNumber(0, 255)}.${randomNumber(1, 254)}`,
        userAgent: randomChoice([
          'Qestro Dashboard/1.0.0',
          'Qestro CLI/1.0.0',
          'Qestro Mobile/1.0.0'
        ])
      };

      await ctx.db.insert(schema.usageAnalytics).values(analytics);
      analyticsIds.push(analyticsId);
      ctx.createdIds.usageAnalytics.push(analyticsId);
    }
  }

  console.log(`✓ Created ${analyticsIds.length} usage analytics records`);
  return analyticsIds;
}

// Main extended seeding function
async function seedExtendedData() {
  console.log('🌱 Starting extended database seeding...\n');

  // Initialize database connection
  const d1Database = globalThis.D1_DATABASE;
  if (!d1Database) {
    throw new Error('D1_DATABASE not found. Make sure you\'re running this with wrangler.');
  }

  const db = drizzle(d1Database, { schema });

  const ctx: ExtendedSeedContext = {
    db,
    createdIds: {
      testRuns: [],
      integrations: [],
      apiKeys: [],
      usageAnalytics: []
    }
  };

  try {
    // Get existing data
    console.log('📋 Fetching existing data...');

    const testCases = await db.select().from(schema.testCases);
    const users = await db.select().from(schema.users);

    console.log(`   Found ${testCases.length} test cases`);
    console.log(`   Found ${users.length} users`);

    if (testCases.length === 0 || users.length === 0) {
      console.log('\n⚠️  No test cases or users found. Please run the base seed script first:');
      console.log('   npm run db:seed');
      return;
    }

    // Create extended data
    await createTestRuns(ctx, testCases.map(tc => tc.id));
    await createIntegrations(ctx, users.map(u => u.id));
    await createApiKeys(ctx, users.map(u => u.id));
    await createUsageAnalytics(ctx, users.map(u => u.id));

    console.log('\n✅ Extended database seeding completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   Test Runs: ${ctx.createdIds.testRuns.length}`);
    console.log(`   Integrations: ${ctx.createdIds.integrations.length}`);
    console.log(`   API Keys: ${ctx.createdIds.apiKeys.length}`);
    console.log(`   Usage Analytics: ${ctx.createdIds.usageAnalytics.length}`);

  } catch (error) {
    console.error('❌ Error during extended seeding:', error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedExtendedData().catch(console.error);
}

// Export for use in tests
export {
  seedExtendedData,
  createTestRuns,
  createIntegrations,
  createApiKeys,
  createUsageAnalytics
};
