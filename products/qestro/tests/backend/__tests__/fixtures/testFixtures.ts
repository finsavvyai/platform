/**
 * Test Fixtures
 * Provides predefined test data for consistent testing
 */

import { randomUUID } from 'crypto';

// User fixtures
export const userFixtures = {
  validUser: {
    id: '550e8400-e29b-41d4-a716-446655440000',
    email: 'test@example.com',
    name: 'Test User',
    role: 'user' as const,
    subscriptionTier: 'free' as const,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z')
  },
  
  adminUser: {
    id: '550e8400-e29b-41d4-a716-446655440001',
    email: 'admin@example.com',
    name: 'Admin User',
    role: 'admin' as const,
    subscriptionTier: 'enterprise' as const,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z')
  },

  premiumUser: {
    id: '550e8400-e29b-41d4-a716-446655440002',
    email: 'premium@example.com',
    name: 'Premium User',
    role: 'user' as const,
    subscriptionTier: 'premium' as const,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z')
  }
};

// Test script fixtures
export const testScriptFixtures = {
  webTest: {
    id: '660e8400-e29b-41d4-a716-446655440000',
    userId: userFixtures.validUser.id,
    name: 'Login Test',
    description: 'Test user login functionality',
    type: 'web' as const,
    framework: 'playwright' as const,
    content: {
      actions: [
        {
          id: '1',
          type: 'navigate',
          selector: '',
          data: { url: 'https://example.com/login' },
          timestamp: 1000
        },
        {
          id: '2',
          type: 'fill',
          selector: '#email',
          data: { value: 'test@example.com' },
          timestamp: 2000
        },
        {
          id: '3',
          type: 'fill',
          selector: '#password',
          data: { value: 'password123' },
          timestamp: 3000
        },
        {
          id: '4',
          type: 'click',
          selector: '#login-button',
          data: {},
          timestamp: 4000
        }
      ],
      assertions: [
        {
          id: '1',
          type: 'visible',
          target: '#dashboard',
          expected: true,
          operator: 'equals',
          message: 'Dashboard should be visible after login'
        }
      ]
    },
    metadata: {
      tags: ['login', 'authentication'],
      priority: 'high',
      estimatedDuration: 30000
    },
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z')
  },

  apiTest: {
    id: '660e8400-e29b-41d4-a716-446655440001',
    userId: userFixtures.validUser.id,
    name: 'API Health Check',
    description: 'Test API health endpoint',
    type: 'api' as const,
    framework: 'jest' as const,
    content: {
      actions: [
        {
          id: '1',
          type: 'request',
          selector: '',
          data: {
            method: 'GET',
            url: '/api/health',
            headers: {}
          },
          timestamp: 1000
        }
      ],
      assertions: [
        {
          id: '1',
          type: 'status',
          target: 'response.status',
          expected: 200,
          operator: 'equals',
          message: 'Health endpoint should return 200'
        },
        {
          id: '2',
          type: 'property',
          target: 'response.body.status',
          expected: 'healthy',
          operator: 'equals',
          message: 'Health status should be healthy'
        }
      ]
    },
    metadata: {
      tags: ['api', 'health'],
      priority: 'medium',
      estimatedDuration: 5000
    },
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z')
  }
};

// Recording session fixtures
export const recordingSessionFixtures = {
  activeSession: {
    id: '770e8400-e29b-41d4-a716-446655440000',
    userId: userFixtures.validUser.id,
    url: 'https://example.com',
    browserInfo: {
      name: 'chromium',
      version: '119.0.0.0',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    },
    viewport: {
      width: 1920,
      height: 1080
    },
    actions: [
      {
        id: '1',
        type: 'click',
        selector: '#button',
        data: { coordinates: { x: 100, y: 200 } },
        timestamp: 1000
      }
    ],
    status: 'active' as const,
    createdAt: new Date('2024-01-01T00:00:00Z')
  },

  completedSession: {
    id: '770e8400-e29b-41d4-a716-446655440001',
    userId: userFixtures.validUser.id,
    url: 'https://example.com/form',
    browserInfo: {
      name: 'firefox',
      version: '118.0.0.0',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:118.0) Gecko/20100101 Firefox/118.0'
    },
    viewport: {
      width: 1366,
      height: 768
    },
    actions: [
      {
        id: '1',
        type: 'fill',
        selector: '#name',
        data: { value: 'John Doe' },
        timestamp: 1000
      },
      {
        id: '2',
        type: 'click',
        selector: '#submit',
        data: {},
        timestamp: 2000
      }
    ],
    status: 'completed' as const,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    completedAt: new Date('2024-01-01T00:05:00Z')
  }
};

// Test execution fixtures
export const testExecutionFixtures = {
  successfulExecution: {
    id: '880e8400-e29b-41d4-a716-446655440000',
    testScriptId: testScriptFixtures.webTest.id,
    environment: {
      name: 'staging',
      url: 'https://staging.example.com',
      variables: {
        API_URL: 'https://api-staging.example.com'
      }
    },
    browserInfo: {
      name: 'chromium',
      version: '119.0.0.0'
    },
    status: 'passed' as const,
    duration: 15000,
    results: {
      passed: 4,
      failed: 0,
      skipped: 0,
      total: 4
    },
    logs: [
      {
        level: 'info',
        message: 'Test execution started',
        timestamp: new Date('2024-01-01T10:00:00Z')
      },
      {
        level: 'info',
        message: 'All assertions passed',
        timestamp: new Date('2024-01-01T10:00:15Z')
      }
    ],
    metrics: {
      loadTime: 1200,
      firstPaint: 800,
      firstContentfulPaint: 1000,
      largestContentfulPaint: 1500
    },
    executedAt: new Date('2024-01-01T10:00:00Z')
  },

  failedExecution: {
    id: '880e8400-e29b-41d4-a716-446655440001',
    testScriptId: testScriptFixtures.webTest.id,
    environment: {
      name: 'production',
      url: 'https://example.com',
      variables: {
        API_URL: 'https://api.example.com'
      }
    },
    browserInfo: {
      name: 'webkit',
      version: '17.0.0'
    },
    status: 'failed' as const,
    duration: 8000,
    results: {
      passed: 2,
      failed: 2,
      skipped: 0,
      total: 4
    },
    logs: [
      {
        level: 'info',
        message: 'Test execution started',
        timestamp: new Date('2024-01-01T11:00:00Z')
      },
      {
        level: 'error',
        message: 'Element not found: #dashboard',
        timestamp: new Date('2024-01-01T11:00:08Z')
      }
    ],
    metrics: {
      loadTime: 2500,
      firstPaint: 1800,
      firstContentfulPaint: 2200,
      largestContentfulPaint: 3000
    },
    executedAt: new Date('2024-01-01T11:00:00Z')
  }
};

// Plugin fixtures
export const pluginFixtures = {
  validPlugin: {
    id: '990e8400-e29b-41d4-a716-446655440000',
    name: 'Custom Assertion Plugin',
    version: '1.0.0',
    authorId: userFixtures.validUser.id,
    type: 'assertion' as const,
    manifest: {
      name: 'Custom Assertion Plugin',
      version: '1.0.0',
      description: 'Provides custom assertion capabilities',
      author: 'Test Author',
      type: 'assertion',
      permissions: ['dom-access'],
      dependencies: [],
      entry: 'index.js',
      exports: ['customAssert']
    },
    code: `
      export function customAssert(element, expected) {
        return element.textContent === expected;
      }
    `,
    status: 'approved' as const,
    downloads: 150,
    rating: 4.5,
    createdAt: new Date('2024-01-01T00:00:00Z')
  }
};

// API request/response fixtures
export const apiFixtures = {
  loginRequest: {
    email: 'test@example.com',
    password: 'password123'
  },

  loginResponse: {
    success: true,
    data: {
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      user: userFixtures.validUser,
      expiresIn: 3600
    }
  },

  errorResponse: {
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Invalid input data',
      details: [
        {
          field: 'email',
          message: 'Email is required'
        }
      ]
    }
  },

  healthResponse: {
    status: 'healthy',
    timestamp: new Date('2024-01-01T12:00:00Z'),
    version: '1.0.0',
    services: {
      database: 'connected',
      redis: 'connected',
      external_apis: 'connected'
    }
  }
};

// Environment fixtures
export const environmentFixtures = {
  development: {
    NODE_ENV: 'development',
    DATABASE_URL: 'postgresql://localhost:5432/questro_dev',
    REDIS_URL: 'redis://localhost:6379/0',
    JWT_SECRET: 'dev-secret-key',
    API_URL: 'http://localhost:3001',
    FRONTEND_URL: 'http://localhost:3000'
  },

  test: {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://localhost:5432/questro_test',
    REDIS_URL: 'redis://localhost:6379/1',
    JWT_SECRET: 'test-secret-key',
    API_URL: 'http://localhost:3001',
    FRONTEND_URL: 'http://localhost:3000'
  },

  production: {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://prod-host:5432/questro_prod',
    REDIS_URL: 'redis://prod-redis:6379/0',
    JWT_SECRET: 'prod-secret-key',
    API_URL: 'https://api.qestro.app',
    FRONTEND_URL: 'https://qestro.app'
  }
};

// Export all fixtures
export {
  userFixtures,
  testScriptFixtures,
  recordingSessionFixtures,
  testExecutionFixtures,
  pluginFixtures,
  apiFixtures,
  environmentFixtures
};