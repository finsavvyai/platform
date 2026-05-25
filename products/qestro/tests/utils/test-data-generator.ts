/**
 * Test Data Generator
 *
 * Utility class for generating realistic test data for E2E tests.
 * Provides factory methods for users, projects, test flows, and other entities.
 */

import { faker } from '@faker-js/faker';

export interface TestUser {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  password: string;
  company: string;
  role: string;
  department: string;
  phoneNumber: string;
  avatar?: string;
  preferences: UserPreferences;
}

export interface UserPreferences {
  language: string;
  timezone: string;
  theme: 'light' | 'dark' | 'auto';
  notifications: {
    email: boolean;
    push: boolean;
    slack: boolean;
  };
  dashboard: {
    layout: 'grid' | 'list';
    widgets: string[];
  };
}

export interface TestProject {
  id: string;
  name: string;
  description: string;
  type: 'web' | 'mobile' | 'api' | 'desktop';
  framework: string;
  url: string;
  repository?: string;
  team: TeamMember[];
  settings: ProjectSettings;
  metadata: ProjectMetadata;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'developer' | 'tester' | 'viewer';
  avatar?: string;
  joinedAt: Date;
}

export interface ProjectSettings {
  environment: 'development' | 'staging' | 'production';
  parallelExecution: boolean;
  maxConcurrency: number;
  timeout: number;
  retries: number;
  notifications: boolean;
  reporting: {
    enabled: boolean;
    frequency: 'daily' | 'weekly' | 'monthly';
    recipients: string[];
  };
}

export interface ProjectMetadata {
  industry: string;
  companySize: 'startup' | 'small' | 'medium' | 'large' | 'enterprise';
  complexity: 'simple' | 'moderate' | 'complex' | 'enterprise';
  testingMaturity: 'initial' | 'developing' | 'established' | 'optimizing';
  complianceRequirements: string[];
  tags: string[];
}

export interface MobileTestFlow {
  appId: string;
  platform: 'android' | 'ios';
  version: string;
  flow: MobileTestStep[];
  deviceRequirements: DeviceRequirements;
  performance: PerformanceExpectations;
}

export interface MobileTestStep {
  id: string;
  action: 'launch' | 'tap' | 'input' | 'swipe' | 'scroll' | 'wait' | 'assert' | 'screenshot';
  target?: string;
  value?: string;
  parameters?: Record<string, any>;
  assertions?: Assertion[];
  timeout?: number;
  description: string;
}

export interface WebTestFlow {
  url: string;
  browser: string;
  version: string;
  flow: WebTestStep[];
  viewport: Viewport;
  performance: PerformanceExpectations;
}

export interface WebTestStep {
  id: string;
  action: 'navigate' | 'click' | 'fill' | 'select' | 'hover' | 'scroll' | 'wait' | 'assert' | 'screenshot' | 'execute';
  target: string;
  value?: string;
  parameters?: Record<string, any>;
  assertions?: Assertion[];
  timeout?: number;
  description: string;
}

export interface Assertion {
  type: 'visible' | 'hidden' | 'text' | 'value' | 'attribute' | 'count' | 'url' | 'title';
  target: string;
  expected: any;
  operator?: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'matches' | 'greaterThan' | 'lessThan';
  description: string;
}

export interface DeviceRequirements {
  platform: string;
  version: string;
  memory: string;
  storage: string;
  resolution?: string;
  orientation?: 'portrait' | 'landscape';
}

export interface PerformanceExpectations {
  maxLoadTime: number;
  maxResponseTime: number;
  maxCpuUsage: number;
  maxMemoryUsage: number;
  maxNetworkUsage: number;
}

export interface Viewport {
  width: number;
  height: number;
  deviceScaleFactor?: number;
  isMobile?: boolean;
  hasTouch?: boolean;
}

/**
 * Test Data Generator Class
 */
export class TestDataGenerator {
  private static readonly COMPANY_NAMES = [
    'TechCorp Solutions', 'Digital Innovations Inc', 'Global Systems Ltd',
    'FutureTech Enterprises', 'CloudFirst Corporation', 'DataDriven Solutions'
  ];

  private static readonly INDUSTRIES = [
    'E-commerce', 'FinTech', 'Healthcare', 'Education', 'Entertainment',
    'Manufacturing', 'Retail', 'Transportation', 'Real Estate', 'Energy'
  ];

  private static readonly TESTING_FRAMEWORKS = {
    web: ['playwright', 'cypress', 'selenium', 'testcafe'],
    mobile: ['maestro', 'detox', 'appium', 'espresso', 'xcuitest'],
    api: ['postman', 'insomnia', 'rest-assured', 'supertest']
  };

  /**
   * Generate a test user with specified role type
   */
  static async generateTestUser(roleType: 'admin' | 'user' | 'enterprise-admin' | 'tester' = 'user'): Promise<TestUser> {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const company = faker.helpers.arrayElement(this.COMPANY_NAMES);

    const roleMapping = {
      admin: 'QA Manager',
      user: 'QA Engineer',
      'enterprise-admin': 'Head of Quality',
      tester: 'Software Tester'
    };

    return {
      id: faker.string.uuid(),
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`,
      email: faker.internet.email({ firstName, lastName }).toLowerCase(),
      password: 'TestPassword123!', // Consistent password for testing
      company,
      role: roleMapping[roleType],
      department: faker.helpers.arrayElement(['Engineering', 'Quality Assurance', 'Product', 'DevOps']),
      phoneNumber: faker.phone.number(),
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${firstName}${lastName}`,
      preferences: {
        language: 'en-US',
        timezone: faker.helpers.arrayElement(['America/New_York', 'America/Los_Angeles', 'Europe/London', 'Asia/Tokyo']),
        theme: faker.helpers.arrayElement(['light', 'dark', 'auto']),
        notifications: {
          email: faker.datatype.boolean(),
          push: faker.datatype.boolean(),
          slack: faker.datatype.boolean()
        },
        dashboard: {
          layout: faker.helpers.arrayElement(['grid', 'list']),
          widgets: faker.helpers.arrayElements(['recent-tests', 'analytics', 'team-activity', 'system-health'], { min: 2, max: 4 })
        }
      }
    };
  }

  /**
   * Generate a test project with specified characteristics
   */
  static async generateTestProject(type: 'ecommerce-platform' | 'mobile-banking' | 'healthcare-portal' | 'saas-dashboard' = 'ecommerce-platform'): Promise<TestProject> {
    const projectConfigs = {
      'ecommerce-platform': {
        name: 'E-commerce Platform Testing',
        description: 'Comprehensive testing suite for our e-commerce platform including user registration, product catalog, shopping cart, and payment processing workflows.',
        type: 'web' as const,
        framework: faker.helpers.arrayElement(this.TESTING_FRAMEWORKS.web),
        url: 'https://shop.example.com',
        industry: 'E-commerce'
      },
      'mobile-banking': {
        name: 'Mobile Banking App',
        description: 'End-to-end testing for mobile banking application covering login, balance inquiry, transfers, and transaction history.',
        type: 'mobile' as const,
        framework: faker.helpers.arrayElement(this.TESTING_FRAMEWORKS.mobile),
        url: 'com.example.banking',
        industry: 'FinTech'
      },
      'healthcare-portal': {
        name: 'Patient Portal',
        description: 'Healthcare portal testing including patient registration, appointment scheduling, medical records access, and telemedicine features.',
        type: 'web' as const,
        framework: faker.helpers.arrayElement(this.TESTING_FRAMEWORKS.web),
        url: 'https://portal.healthcare.com',
        industry: 'Healthcare'
      },
      'saas-dashboard': {
        name: 'Analytics Dashboard',
        description: 'SaaS analytics dashboard testing covering data visualization, report generation, user management, and API integrations.',
        type: 'web' as const,
        framework: faker.helpers.arrayElement(this.TESTING_FRAMEWORKS.web),
        url: 'https://analytics.saas.com',
        industry: 'Software'
      }
    };

    const config = projectConfigs[type];

    return {
      id: faker.string.uuid(),
      ...config,
      repository: `https://github.com/example/${config.name.toLowerCase().replace(/\s+/g, '-')}`,
      team: this.generateTeamMembers(faker.number.int({ min: 3, max: 8 })),
      settings: {
        environment: faker.helpers.arrayElement(['development', 'staging', 'production'] as const),
        parallelExecution: faker.datatype.boolean(),
        maxConcurrency: faker.number.int({ min: 2, max: 10 }),
        timeout: faker.number.int({ min: 30000, max: 300000 }),
        retries: faker.number.int({ min: 0, max: 3 }),
        notifications: faker.datatype.boolean(),
        reporting: {
          enabled: true,
          frequency: faker.helpers.arrayElement(['daily', 'weekly', 'monthly'] as const),
          recipients: faker.helpers.arrayElements([
            'manager@example.com',
            'team@example.com',
            'stakeholders@example.com'
          ], { min: 1, max: 3 })
        }
      },
      metadata: {
        industry: config.industry,
        companySize: faker.helpers.arrayElement(['startup', 'small', 'medium', 'large', 'enterprise'] as const),
        complexity: faker.helpers.arrayElement(['simple', 'moderate', 'complex', 'enterprise'] as const),
        testingMaturity: faker.helpers.arrayElement(['initial', 'developing', 'established', 'optimizing'] as const),
        complianceRequirements: faker.helpers.arrayElements([
          'SOC 2', 'GDPR', 'HIPAA', 'PCI DSS', 'ISO 27001'
        ], { min: 1, max: 3 }),
        tags: faker.helpers.arrayElements([
          'critical-path', 'regression', 'smoke-tests', 'api-testing',
          'ui-testing', 'performance', 'security', 'accessibility'
        ], { min: 3, max: 6 })
      }
    };
  }

  /**
   * Generate team members for a project
   */
  static generateTeamMembers(count: number): TeamMember[] {
    const members: TeamMember[] = [];
    const roles: TeamMember['role'][] = ['owner', 'admin', 'developer', 'tester', 'viewer'];

    for (let i = 0; i < count; i++) {
      const firstName = faker.person.firstName();
      const lastName = faker.person.lastName();

      members.push({
        id: faker.string.uuid(),
        name: `${firstName} ${lastName}`,
        email: faker.internet.email({ firstName, lastName }).toLowerCase(),
        role: i === 0 ? 'owner' : faker.helpers.arrayElement(roles.slice(1)),
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${firstName}${lastName}`,
        joinedAt: faker.date.past({ years: 2 })
      });
    }

    return members;
  }

  /**
   * Generate mobile test flow
   */
  static generateMobileTestFlow(testType: string): MobileTestFlow {
    const flows = {
      'android-app-login': {
        appId: 'com.example.banking',
        platform: 'android' as const,
        version: '2.4.1',
        flow: [
          {
            id: 'step-1',
            action: 'launch' as const,
            target: 'com.example.banking',
            description: 'Launch mobile banking app'
          },
          {
            id: 'step-2',
            action: 'wait' as const,
            parameters: { duration: 3000 },
            description: 'Wait for app to load completely'
          },
          {
            id: 'step-3',
            action: 'tap' as const,
            target: '//android.widget.Button[@content-desc="Login"]',
            description: 'Tap on Login button'
          },
          {
            id: 'step-4',
            action: 'input' as const,
            target: '//android.widget.EditText[@resource-id="email-input"]',
            value: '${USER_EMAIL}',
            description: 'Enter email address'
          },
          {
            id: 'step-5',
            action: 'input' as const,
            target: '//android.widget.EditText[@resource-id="password-input"]',
            value: '${USER_PASSWORD}',
            description: 'Enter password'
          },
          {
            id: 'step-6',
            action: 'tap' as const,
            target: '//android.widget.Button[@content-desc="Sign In"]',
            description: 'Tap Sign In button'
          },
          {
            id: 'step-7',
            action: 'assert' as const,
            target: '//android.widget.TextView[@resource-id="welcome-message"]',
            assertions: [{
              type: 'visible' as const,
              target: '//android.widget.TextView[@resource-id="welcome-message"]',
              expected: 'Welcome',
              operator: 'contains' as const,
              description: 'Verify welcome message is displayed'
            }],
            description: 'Verify successful login'
          },
          {
            id: 'step-8',
            action: 'screenshot' as const,
            description: 'Take screenshot of dashboard'
          }
        ],
        deviceRequirements: {
          platform: 'Android',
          version: '>= 10',
          memory: '>= 4GB',
          storage: '>= 2GB'
        },
        performance: {
          maxLoadTime: 5000,
          maxResponseTime: 2000,
          maxCpuUsage: 70,
          maxMemoryUsage: 300,
          maxNetworkUsage: 10
        }
      },
      'ios-app-navigation': {
        appId: 'com.example.iosapp',
        platform: 'ios' as const,
        version: '3.2.0',
        flow: [
          {
            id: 'step-1',
            action: 'launch' as const,
            target: 'com.example.iosapp',
            description: 'Launch iOS application'
          },
          {
            id: 'step-2',
            action: 'wait' as const,
            parameters: { duration: 2000 },
            description: 'Wait for app initialization'
          },
          {
            id: 'step-3',
            action: 'tap' as const,
            target: '**/XCUIElementTypeButton[`label="Menu"`]',
            description: 'Tap on menu button'
          },
          {
            id: 'step-4',
            action: 'swipe' as const,
            parameters: { direction: 'up', distance: 200 },
            description: 'Swipe up to scroll menu'
          },
          {
            id: 'step-5',
            action: 'tap' as const,
            target: '**/XCUIElementTypeCell[`label="Profile"`]',
            description: 'Tap on Profile option'
          },
          {
            id: 'step-6',
            action: 'assert' as const,
            target: '**/XCUIElementTypeStaticText[`label="User Profile"`]',
            assertions: [{
              type: 'visible' as const,
              target: '**/XCUIElementTypeStaticText[`label="User Profile"`]',
              expected: 'User Profile',
              operator: 'equals' as const,
              description: 'Verify profile page title'
            }],
            description: 'Verify profile page loads'
          }
        ],
        deviceRequirements: {
          platform: 'iOS',
          version: '>= 14.0',
          memory: '>= 3GB',
          storage: '>= 2GB'
        },
        performance: {
          maxLoadTime: 4000,
          maxResponseTime: 1500,
          maxCpuUsage: 60,
          maxMemoryUsage: 250,
          maxNetworkUsage: 8
        }
      }
    };

    return flows[testType] || flows['android-app-login'];
  }

  /**
   * Generate web test flow
   */
  static generateWebTestFlow(testType: string): WebTestFlow {
    const flows = {
      'user-login-workflow': {
        url: 'https://app.example.com/login',
        browser: 'chromium',
        version: '120.0.0',
        flow: [
          {
            id: 'step-1',
            action: 'navigate' as const,
            target: '/login',
            description: 'Navigate to login page'
          },
          {
            id: 'step-2',
            action: 'assert' as const,
            target: '[data-testid=login-form]',
            assertions: [{
              type: 'visible' as const,
              target: '[data-testid=login-form]',
              expected: true,
              operator: 'equals' as const,
              description: 'Verify login form is visible'
            }],
            description: 'Verify login form is displayed'
          },
          {
            id: 'step-3',
            action: 'fill' as const,
            target: '[data-testid=email-input]',
            value: '${USER_EMAIL}',
            description: 'Enter email address'
          },
          {
            id: 'step-4',
            action: 'fill' as const,
            target: '[data-testid=password-input]',
            value: '${USER_PASSWORD}',
            description: 'Enter password'
          },
          {
            id: 'step-5',
            action: 'click' as const,
            target: '[data-testid=login-button]',
            description: 'Click login button'
          },
          {
            id: 'step-6',
            action: 'wait' as const,
            target: '[data-testid=dashboard]',
            description: 'Wait for dashboard to load'
          },
          {
            id: 'step-7',
            action: 'assert' as const,
            target: '[data-testid=user-profile]',
            assertions: [
              {
                type: 'visible' as const,
                target: '[data-testid=user-profile]',
                expected: true,
                operator: 'equals' as const,
                description: 'Verify user profile is visible'
              },
              {
                type: 'text' as const,
                target: '[data-testid=user-name]',
                expected: '${USER_NAME}',
                operator: 'equals' as const,
                description: 'Verify user name is displayed'
              }
            ],
            description: 'Verify successful authentication'
          },
          {
            id: 'step-8',
            action: 'screenshot' as const,
            description: 'Take screenshot of dashboard'
          }
        ],
        viewport: {
          width: 1920,
          height: 1080,
          deviceScaleFactor: 1,
          isMobile: false,
          hasTouch: false
        },
        performance: {
          maxLoadTime: 3000,
          maxResponseTime: 1000,
          maxCpuUsage: 50,
          maxMemoryUsage: 200,
          maxNetworkUsage: 5
        }
      },
      'ecommerce-checkout': {
        url: 'https://shop.example.com',
        browser: 'chromium',
        version: '120.0.0',
        flow: [
          {
            id: 'step-1',
            action: 'navigate' as const,
            target: '/products/laptop-pro',
            description: 'Navigate to product page'
          },
          {
            id: 'step-2',
            action: 'assert' as const,
            target: '[data-testid=product-title]',
            assertions: [{
              type: 'text' as const,
              target: '[data-testid=product-title]',
              expected: 'Laptop Pro',
              operator: 'contains' as const,
              description: 'Verify product title'
            }],
            description: 'Verify product page loads'
          },
          {
            id: 'step-3',
            action: 'click' as const,
            target: '[data-testid=add-to-cart-button]',
            description: 'Add product to cart'
          },
          {
            id: 'step-4',
            action: 'click' as const,
            target: '[data-testid=cart-icon]',
            description: 'Open shopping cart'
          },
          {
            id: 'step-5',
            action: 'assert' as const,
            target: '[data-testid=cart-item]',
            assertions: [{
              type: 'count' as const,
              target: '[data-testid=cart-item]',
              expected: 1,
              operator: 'equals' as const,
              description: 'Verify cart has 1 item'
            }],
            description: 'Verify item added to cart'
          },
          {
            id: 'step-6',
            action: 'click' as const,
            target: '[data-testid=checkout-button]',
            description: 'Proceed to checkout'
          },
          {
            id: 'step-7',
            action: 'fill' as const,
            target: '[data-testid=shipping-address]',
            value: '${TEST_ADDRESS}',
            description: 'Enter shipping address'
          },
          {
            id: 'step-8',
            action: 'click' as const,
            target: '[data-testid=payment-method]',
            description: 'Select payment method'
          },
          {
            id: 'step-9',
            action: 'click' as const,
            target: '[data-testid=place-order-button]',
            description: 'Place order'
          },
          {
            id: 'step-10',
            action: 'assert' as const,
            target: '[data-testid=order-confirmation]',
            assertions: [{
              type: 'visible' as const,
              target: '[data-testid=order-confirmation]',
              expected: true,
              operator: 'equals' as const,
              description: 'Verify order confirmation'
            }],
            description: 'Verify order placed successfully'
          }
        ],
        viewport: {
          width: 1920,
          height: 1080,
          deviceScaleFactor: 1,
          isMobile: false,
          hasTouch: false
        },
        performance: {
          maxLoadTime: 4000,
          maxResponseTime: 2000,
          maxCpuUsage: 60,
          maxMemoryUsage: 300,
          maxNetworkUsage: 15
        }
      }
    };

    return flows[testType] || flows['user-login-workflow'];
  }

  /**
   * Generate test execution data
   */
  static generateTestExecutionData() {
    return {
      executionId: faker.string.uuid(),
      startTime: faker.date.recent(),
      endTime: faker.date.soon(),
      status: faker.helpers.arrayElement(['running', 'passed', 'failed', 'skipped']),
      duration: faker.number.int({ min: 1000, max: 300000 }),
      steps: {
        total: faker.number.int({ min: 5, max: 50 }),
        passed: faker.number.int({ min: 0, max: 45 }),
        failed: faker.number.int({ min: 0, max: 5 }),
        skipped: faker.number.int({ min: 0, max: 3 })
      },
      environment: faker.helpers.arrayElement(['development', 'staging', 'production']),
      browser: faker.helpers.arrayElement(['chromium', 'firefox', 'webkit', 'chrome', 'edge']),
      device: faker.helpers.arrayElement(['Desktop', 'Mobile', 'Tablet']),
      screenshots: faker.number.int({ min: 0, max: 20 }),
      video: faker.datatype.boolean(),
      trace: faker.datatype.boolean(),
      performance: {
        cpuUsage: faker.number.float({ min: 10, max: 90, precision: 0.1 }),
        memoryUsage: faker.number.int({ min: 100, max: 500 }),
        networkUsage: faker.number.float({ min: 0, max: 20, precision: 0.1 }),
        loadTime: faker.number.int({ min: 500, max: 10000 })
      }
    };
  }

  /**
   * Generate analytics data
   */
  static generateAnalyticsData() {
    return {
      overview: {
        totalTests: faker.number.int({ min: 100, max: 10000 }),
        automatedTests: faker.number.int({ min: 50, max: 8000 }),
        manualTests: faker.number.int({ min: 20, max: 2000 }),
        automationRate: faker.number.float({ min: 40, max: 95, precision: 0.1 }),
        testsThisMonth: faker.number.int({ min: 50, max: 500 }),
        testsLastMonth: faker.number.int({ min: 40, max: 450 }),
        growth: faker.number.float({ min: -20, max: 50, precision: 0.1 })
      },
      performance: {
        avgExecutionTime: faker.number.float({ min: 1, max: 10, precision: 0.1 }),
        successRate: faker.number.float({ min: 85, max: 99, precision: 0.1 }),
        failureRate: faker.number.float({ min: 1, max: 15, precision: 0.1 }),
        flakyRate: faker.number.float({ min: 0, max: 10, precision: 0.1 }),
        avgWaitTime: faker.number.float({ min: 0.5, max: 5, precision: 0.1 }),
        resourceUtilization: faker.number.float({ min: 30, max: 90, precision: 0.1 })
      },
      businessImpact: {
        hoursSaved: faker.number.int({ min: 50, max: 1000 }),
        costSavings: faker.number.int({ min: 25000, max: 500000 }),
        defectsFound: faker.number.int({ min: 10, max: 500 }),
        releaseAcceleration: faker.number.float({ min: 1, max: 10, precision: 0.1 }),
        teamProductivity: faker.number.float({ min: 60, max: 95, precision: 0.1 }),
        customerSatisfaction: faker.number.float({ min: 80, max: 98, precision: 0.1 })
      }
    };
  }

  /**
   * Generate SSO test data
   */
  static generateSSOTestData(provider: 'azure-ad' | 'okta' | 'auth0' = 'azure-ad') {
    const providers = {
      'azure-ad': {
        name: 'Azure Active Directory',
        type: 'oidc',
        domain: 'login.microsoftonline.com',
        clientId: 'azure-client-id-123',
        scopes: ['openid', 'profile', 'email'],
        endpoints: {
          authorization: 'https://login.microsoftonline.com/tenant/oauth2/v2.0/authorize',
          token: 'https://login.microsoftonline.com/tenant/oauth2/v2.0/token',
          userInfo: 'https://graph.microsoft.com/v1.0/me'
        }
      },
      'okta': {
        name: 'Okta',
        type: 'oidc',
        domain: 'okta.com',
        clientId: 'okta-client-id-456',
        scopes: ['openid', 'profile', 'email', 'groups'],
        endpoints: {
          authorization: 'https://company.okta.com/oauth2/v1/authorize',
          token: 'https://company.okta.com/oauth2/v1/token',
          userInfo: 'https://company.okta.com/oauth2/v1/userinfo'
        }
      },
      'auth0': {
        name: 'Auth0',
        type: 'oidc',
        domain: 'auth0.com',
        clientId: 'auth0-client-id-789',
        scopes: ['openid', 'profile', 'email'],
        endpoints: {
          authorization: 'https://company.auth0.com/authorize',
          token: 'https://company.auth0.com/oauth/token',
          userInfo: 'https://company.auth0.com/userinfo'
        }
      }
    };

    return {
      provider: providers[provider],
      user: {
        id: faker.string.uuid(),
        email: faker.internet.email(),
        name: faker.person.fullName(),
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        roles: faker.helpers.arrayElements(['admin', 'user', 'tester'], { min: 1, max: 2 }),
        groups: faker.helpers.arrayElements(['engineering', 'qa-team', 'product'], { min: 1, max: 2 })
      },
      tokens: {
        accessToken: faker.string.alphanumeric(40),
        refreshToken: faker.string.alphanumeric(40),
        idToken: faker.string.alphanumeric(60),
        expiresIn: faker.number.int({ min: 2700, max: 3600 }),
        tokenType: 'Bearer'
      }
    };
  }

  /**
   * Generate error scenarios for testing
   */
  static generateErrorScenarios() {
    return {
      networkError: {
        status: 500,
        message: 'Network connection failed',
        code: 'NETWORK_ERROR',
        retryable: true
      },
      authenticationError: {
        status: 401,
        message: 'Authentication failed',
        code: 'AUTHENTICATION_ERROR',
        retryable: false
      },
      validationError: {
        status: 400,
        message: 'Invalid input data',
        code: 'VALIDATION_ERROR',
        retryable: false
      },
      timeoutError: {
        status: 408,
        message: 'Request timeout',
        code: 'TIMEOUT_ERROR',
        retryable: true
      },
      rateLimitError: {
        status: 429,
        message: 'Too many requests',
        code: 'RATE_LIMIT_ERROR',
        retryable: true,
        retryAfter: 60
      }
    };
  }
}

// Export convenience functions
export const generateTestUser = TestDataGenerator.generateTestUser;
export const generateTestProject = TestDataGenerator.generateTestProject;
export const generateMobileTestFlow = TestDataGenerator.generateMobileTestFlow;
export const generateWebTestFlow = TestDataGenerator.generateWebTestFlow;
export const generateTestExecutionData = TestDataGenerator.generateTestExecutionData;
export const generateAnalyticsData = TestDataGenerator.generateAnalyticsData;
export const generateSSOTestData = TestDataGenerator.generateSSOTestData;
export const generateErrorScenarios = TestDataGenerator.generateErrorScenarios;
