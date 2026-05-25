/**
 * Questro Development Data Seeder
 *
 * This script seeds the development database with realistic test data including:
 * - Users with different roles and permissions
 * - Projects with various configurations
 * - Test suites and test cases
 * - Test runs with different statuses
 * - Analytics and usage data
 */

import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';

interface SeedData {
  users: typeof schema.$UserInsert[];
  projects: typeof schema.$ProjectInsert[];
  testSuites: typeof schema.$TestSuiteInsert[];
  testCases: typeof schema.$TestCaseInsert[];
  testRuns: typeof schema.$TestRunInsert[];
  testResults: typeof schema.$TestResultInsert[];
}

export class DataSeeder {
  private db: any;

  constructor(d1Database: D1Database) {
    this.db = drizzle(d1Database, { schema });
  }

  /**
   * Generate and seed all development data
   */
  async seedAll(): Promise<void> {
    console.log('🌱 Starting Questro development data seeding...');

    try {
      const seedData = this.generateSeedData();

      await this.seedUsers(seedData.users);
      await this.seedProjects(seedData.projects);
      await this.seedTestSuites(seedData.testSuites);
      await this.seedTestCases(seedData.testCases);
      await this.seedTestRuns(seedData.testRuns);
      await this.seedTestResults(seedData.testResults);

      console.log('✅ Development data seeding completed successfully!');
      await this.printSummary();

    } catch (error) {
      console.error('❌ Error during data seeding:', error);
      throw error;
    }
  }

  /**
   * Clear all existing data (for development reset)
   */
  async clearAll(): Promise<void> {
    console.log('🧹 Clearing existing development data...');

    try {
      // Delete in order of dependencies
      await this.db.delete(schema.testResults);
      await this.db.delete(schema.testRuns);
      await this.db.delete(schema.testCases);
      await this.db.delete(schema.testSuites);
      await this.db.delete(schema.projects);
      await this.db.delete(schema.users);

      console.log('✅ All data cleared successfully');
    } catch (error) {
      console.error('❌ Error clearing data:', error);
      throw error;
    }
  }

  /**
   * Generate realistic seed data
   */
  private generateSeedData(): SeedData {
    const users = this.generateUsers();
    const projects = this.generateProjects(users);
    const testSuites = this.generateTestSuites(projects);
    const testCases = this.generateTestCases(testSuites);
    const testRuns = this.generateTestRuns(projects);
    const testResults = this.generateTestResults(testRuns, testCases);

    return {
      users,
      projects,
      testSuites,
      testCases,
      testRuns,
      testResults
    };
  }

  /**
   * Generate users with different roles
   */
  private generateUsers(): typeof schema.$UserInsert[] {
    const now = new Date().toISOString();

    return [
      {
        id: 'user-admin-001',
        email: 'admin@questro.dev',
        name: 'Alex Admin',
        role: 'admin',
        status: 'active',
        emailVerified: true,
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin',
        settings: {},
        subscriptionTier: 'enterprise',
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'user-dev-001',
        email: 'developer@questro.dev',
        name: 'Sam Developer',
        role: 'user',
        status: 'active',
        emailVerified: true,
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=developer',
        settings: { theme: 'dark', notifications: true },
        subscriptionTier: 'professional',
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'user-qa-001',
        email: 'qa@questro.dev',
        name: 'Jordan QA',
        role: 'user',
        status: 'active',
        emailVerified: true,
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=qa',
        settings: { theme: 'light', notifications: false },
        subscriptionTier: 'professional',
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'user-demo-001',
        email: 'demo@questro.dev',
        name: 'Casey Demo',
        role: 'user',
        status: 'active',
        emailVerified: true,
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=demo',
        settings: { theme: 'light', notifications: true },
        subscriptionTier: 'starter',
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'user-trial-001',
        email: 'trial@questro.dev',
        name: 'Riley Trial',
        role: 'user',
        status: 'active',
        emailVerified: false,
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=trial',
        settings: {},
        subscriptionTier: 'free',
        createdAt: now,
        updatedAt: now
      }
    ];
  }

  /**
   * Generate diverse projects
   */
  private generateProjects(users: typeof schema.$UserInsert[]): typeof schema.$ProjectInsert[] {
    const now = new Date().toISOString();
    const adminUser = users.find(u => u.role === 'admin')!;
    const devUser = users.find(u => u.name === 'Sam Developer')!;
    const qaUser = users.find(u => u.name === 'Jordan QA')!;

    return [
      {
        id: 'proj-mobile-001',
        name: 'Questro Mobile App',
        description: 'iOS and Android mobile application for automated testing',
        createdBy: adminUser.id,
        status: 'active',
        platform: 'mobile',
        repositoryUrl: 'https://github.com/questro/mobile-app',
        settings: {
          deviceCoverage: ['iPhone 14', 'Samsung Galaxy S23'],
          testFrameworks: ['Maestro', 'Appium'],
          notifications: { slack: '#mobile-testing', email: true }
        },
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'proj-web-001',
        name: 'Questro Web Platform',
        description: 'Web-based testing platform with real-time collaboration',
        createdBy: devUser.id,
        status: 'active',
        platform: 'web',
        repositoryUrl: 'https://github.com/questro/web-platform',
        settings: {
          browsers: ['Chrome', 'Firefox', 'Safari'],
          testFrameworks: ['Playwright', 'Cypress'],
          viewports: ['1920x1080', '1366x768', '375x667']
        },
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'proj-ecommerce-001',
        name: 'E-commerce Test Suite',
        description: 'Comprehensive testing for e-commerce platform',
        createdBy: qaUser.id,
        status: 'active',
        platform: 'web',
        repositoryUrl: 'https://github.com/questro/ecommerce-tests',
        settings: {
          testEnvironments: ['staging', 'production'],
          criticalPaths: ['checkout', 'payment', 'user-registration'],
          performanceThresholds: { responseTime: 2000, errorRate: 0.01 }
        },
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'proj-api-001',
        name: 'API Gateway Tests',
        description: 'RESTful API testing and validation',
        createdBy: devUser.id,
        status: 'inactive',
        platform: 'api',
        repositoryUrl: 'https://github.com/questro/api-tests',
        settings: {
          apiVersions: ['v1', 'v2'],
          authentication: ['JWT', 'OAuth2'],
          rateLimits: { requestsPerMinute: 1000 }
        },
        createdAt: now,
        updatedAt: now
      }
    ];
  }

  /**
   * Generate test suites for projects
   */
  private generateTestSuites(projects: typeof schema.$ProjectInsert[]): typeof schema.$TestSuiteInsert[] {
    const now = new Date().toISOString();
    const mobileProject = projects.find(p => p.name === 'Questro Mobile App')!;
    const webProject = projects.find(p => p.name === 'Questro Web Platform')!;
    const ecommerceProject = projects.find(p => p.name === 'E-commerce Test Suite')!;

    return [
      // Mobile App Test Suites
      {
        id: 'suite-mobile-auth-001',
        name: 'Mobile Authentication',
        description: 'User authentication flows for mobile app',
        projectId: mobileProject.id,
        status: 'active',
        priority: 'high',
        tags: ['authentication', 'mobile', 'critical'],
        settings: { devices: ['iPhone 14'], executionOrder: 'parallel' },
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'suite-mobile-checkout-001',
        name: 'Mobile Checkout Flow',
        description: 'Complete purchase flow testing on mobile',
        projectId: mobileProject.id,
        status: 'active',
        priority: 'high',
        tags: ['checkout', 'payment', 'mobile'],
        settings: { devices: ['iPhone 14', 'Samsung Galaxy S23'], testdata: 'realistic' },
        createdAt: now,
        updatedAt: now
      },

      // Web Platform Test Suites
      {
        id: 'suite-web-ui-001',
        name: 'Web UI Components',
        description: 'User interface component testing',
        projectId: webProject.id,
        status: 'active',
        priority: 'medium',
        tags: ['ui', 'components', 'accessibility'],
        settings: { browsers: ['Chrome', 'Firefox'], viewportVariants: true },
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'suite-web-collaboration-001',
        name: 'Real-time Collaboration',
        description: 'Multi-user collaboration features',
        projectId: webProject.id,
        status: 'active',
        priority: 'high',
        tags: ['collaboration', 'realtime', 'websocket'],
        settings: { concurrentUsers: 5, testDuration: 300 },
        createdAt: now,
        updatedAt: now
      },

      // E-commerce Test Suites
      {
        id: 'suite-ecommerce-critical-001',
        name: 'Critical User Paths',
        description: 'Critical business flows testing',
        projectId: ecommerceProject.id,
        status: 'active',
        priority: 'high',
        tags: ['critical', 'revenue', 'smoke'],
        settings: { environment: 'production', retries: 3 },
        createdAt: now,
        updatedAt: now
      }
    ];
  }

  /**
   * Generate detailed test cases
   */
  private generateTestCases(testSuites: typeof schema.$TestSuiteInsert[]): typeof schema.$TestCaseInsert[] {
    const now = new Date().toISOString();
    const testCases: typeof schema.$TestCaseInsert[] = [];

    // Mobile Authentication Test Cases
    const mobileAuthSuite = testSuites.find(s => s.name === 'Mobile Authentication')!;
    testCases.push(
      {
        id: 'tc-mobile-login-001',
        name: 'Valid Login with Email',
        description: 'Test user login with valid email and password',
        testSuiteId: mobileAuthSuite.id,
        projectId: mobileAuthSuite.projectId,
        status: 'active',
        priority: 'high',
        tags: ['login', 'positive'],
        testData: { email: 'test@example.com', password: 'ValidPass123!' },
        expectedResults: { statusCode: 200, redirectTo: '/dashboard' },
        steps: [
          'Open mobile app',
          'Tap login button',
          'Enter valid email',
          'Enter valid password',
          'Submit form',
          'Verify redirect to dashboard'
        ],
        createdBy: 'user-dev-001',
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'tc-mobile-login-002',
        name: 'Invalid Login Attempts',
        description: 'Test login with invalid credentials',
        testSuiteId: mobileAuthSuite.id,
        projectId: mobileAuthSuite.projectId,
        status: 'active',
        priority: 'high',
        tags: ['login', 'negative'],
        testData: { email: 'invalid@example.com', password: 'WrongPass' },
        expectedResults: { statusCode: 401, errorMessage: 'Invalid credentials' },
        steps: [
          'Open mobile app',
          'Tap login button',
          'Enter invalid email',
          'Enter invalid password',
          'Submit form',
          'Verify error message'
        ],
        createdBy: 'user-dev-001',
        createdAt: now,
        updatedAt: now
      }
    );

    // Web UI Component Test Cases
    const webUISuite = testSuites.find(s => s.name === 'Web UI Components')!;
    testCases.push(
      {
        id: 'tc-web-form-001',
        name: 'Contact Form Validation',
        description: 'Test contact form client-side validation',
        testSuiteId: webUISuite.id,
        projectId: webUISuite.projectId,
        status: 'active',
        priority: 'medium',
        tags: ['form', 'validation', 'ui'],
        testData: { email: '', message: 'Short' },
        expectedResults: { fieldErrors: ['Email required', 'Message too short'] },
        steps: [
          'Navigate to contact page',
          'Leave email field empty',
          'Enter short message',
          'Submit form',
          'Verify validation errors'
        ],
        createdBy: 'user-qa-001',
        createdAt: now,
        updatedAt: now
      }
    );

    // E-commerce Critical Path Test Cases
    const ecommerceSuite = testSuites.find(s => s.name === 'Critical User Paths')!;
    testCases.push(
      {
        id: 'tc-ecommerce-checkout-001',
        name: 'Complete Purchase Flow',
        description: 'Test end-to-end checkout process',
        testSuiteId: ecommerceSuite.id,
        projectId: ecommerceSuite.projectId,
        status: 'active',
        priority: 'high',
        tags: ['checkout', 'payment', 'critical'],
        testData: {
          product: 'Premium Plan',
          quantity: 1,
          paymentMethod: 'credit_card',
          shippingAddress: 'Valid Address'
        },
        expectedResults: {
          orderConfirmation: true,
          paymentProcessed: true,
          emailSent: true
        },
        steps: [
          'Select product',
          'Add to cart',
          'Proceed to checkout',
          'Enter shipping information',
          'Select payment method',
          'Complete purchase',
          'Verify order confirmation'
        ],
        createdBy: 'user-qa-001',
        createdAt: now,
        updatedAt: now
      }
    );

    return testCases;
  }

  /**
   * Generate test runs with various statuses
   */
  private generateTestRuns(projects: typeof schema.$ProjectInsert[]): typeof schema.$TestRunInsert[] {
    const now = new Date().toISOString();
    const runs: typeof schema.$TestRunInsert[] = [];

    projects.forEach(project => {
      // Generate multiple runs per project
      for (let i = 1; i <= 5; i++) {
        const statuses: Array<'passed' | 'failed' | 'running' | 'pending'> = ['passed', 'failed', 'running', 'pending'];
        const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];

        runs.push({
          id: `run-${project.id}-${i.toString().padStart(3, '0')}`,
          name: `Test Run ${i} - ${project.name}`,
          description: `Automated test run ${i} for ${project.name}`,
          projectId: project.id,
          status: randomStatus,
          config: {
            environment: 'staging',
            parallel: true,
            retries: 2,
            timeout: 300000
          },
          triggeredBy: 'user-dev-001',
          startedAt: randomStatus === 'pending' ? null : new Date(Date.now() - Math.random() * 86400000).toISOString(),
          completedAt: ['passed', 'failed'].includes(randomStatus) ? new Date().toISOString() : null,
          createdAt: new Date(Date.now() - Math.random() * 86400000 * 7).toISOString(),
          updatedAt: now
        });
      }
    });

    return runs;
  }

  /**
   * Generate test results for test runs
   */
  private generateTestResults(testRuns: typeof schema.$TestRunInsert[], testCases: typeof schema.$TestCaseInsert[]): typeof schema.$TestResultInsert[] {
    const now = new Date().toISOString();
    const results: typeof schema.$TestResultInsert[] = [];

    testRuns.forEach(run => {
      // Assign random test cases to each run
      const selectedTestCases = testCases
        .filter(tc => tc.projectId === run.projectId)
        .slice(0, Math.floor(Math.random() * 3) + 1);

      selectedTestCases.forEach(testCase => {
        const status = run.status === 'passed' ? 'passed' :
                     run.status === 'failed' ? 'failed' :
                     run.status === 'running' ? 'running' : 'pending';

        results.push({
          id: `result-${run.id}-${testCase.id}`,
          testRunId: run.id,
          testCaseId: testCase.id,
          projectId: run.projectId,
          status,
          duration: Math.floor(Math.random() * 60000) + 5000,
          errorMessage: status === 'failed' ? 'Assertion failed: Expected element to be visible' : null,
          screenshots: status === 'failed' ? ['screenshot-1.png', 'screenshot-2.png'] : [],
          artifacts: status === 'passed' ? ['logs.txt', 'metrics.json'] : [],
          startedAt: run.startedAt,
          completedAt: ['passed', 'failed'].includes(status) ? new Date().toISOString() : null,
          createdAt: now,
          updatedAt: now
        });
      });
    });

    return results;
  }

  /**
   * Seed individual data types
   */
  private async seedUsers(users: typeof schema.$UserInsert[]): Promise<void> {
    console.log('👥 Seeding users...');
    await this.db.insert(schema.users).values(users);
    console.log(`✅ Created ${users.length} users`);
  }

  private async seedProjects(projects: typeof schema.$ProjectInsert[]): Promise<void> {
    console.log('📁 Seeding projects...');
    await this.db.insert(schema.projects).values(projects);
    console.log(`✅ Created ${projects.length} projects`);
  }

  private async seedTestSuites(testSuites: typeof schema.$TestSuiteInsert[]): Promise<void> {
    console.log('📋 Seeding test suites...');
    await this.db.insert(schema.testSuites).values(testSuites);
    console.log(`✅ Created ${testSuites.length} test suites`);
  }

  private async seedTestCases(testCases: typeof schema.$TestCaseInsert[]): Promise<void> {
    console.log('🧪 Seeding test cases...');
    await this.db.insert(schema.testCases).values(testCases);
    console.log(`✅ Created ${testCases.length} test cases`);
  }

  private async seedTestRuns(testRuns: typeof schema.$TestRunInsert[]): Promise<void> {
    console.log('🏃 Seeding test runs...');
    await this.db.insert(schema.testRuns).values(testRuns);
    console.log(`✅ Created ${testRuns.length} test runs`);
  }

  private async seedTestResults(testResults: typeof schema.$TestResultInsert[]): Promise<void> {
    console.log('📊 Seeding test results...');
    await this.db.insert(schema.testResults).values(testResults);
    console.log(`✅ Created ${testResults.length} test results`);
  }

  /**
   * Print seeding summary
   */
  private async printSummary(): Promise<void> {
    const [userCount, projectCount, suiteCount, caseCount, runCount, resultCount] = await Promise.all([
      this.db.select().from(schema.users),
      this.db.select().from(schema.projects),
      this.db.select().from(schema.testSuites),
      this.db.select().from(schema.testCases),
      this.db.select().from(schema.testRuns),
      this.db.select().from(schema.testResults)
    ]);

    console.log('\n📈 Seeding Summary:');
    console.log(`   Users: ${userCount.length}`);
    console.log(`   Projects: ${projectCount.length}`);
    console.log(`   Test Suites: ${suiteCount.length}`);
    console.log(`   Test Cases: ${caseCount.length}`);
    console.log(`   Test Runs: ${runCount.length}`);
    console.log(`   Test Results: ${resultCount.length}`);

    console.log('\n🔑 Login Credentials:');
    console.log('   Admin: admin@questro.dev');
    console.log('   Developer: developer@questro.dev');
    console.log('   QA: qa@questro.dev');
    console.log('   Demo: demo@questro.dev');
    console.log('   Trial: trial@questro.dev');
  }
}

/**
 * Seed data for development environment
 */
export async function seedDevelopmentData(d1Database: D1Database, options: { clear?: boolean } = {}): Promise<void> {
  const seeder = new DataSeeder(d1Database);

  if (options.clear) {
    await seeder.clearAll();
  }

  await seeder.seedAll();
}
