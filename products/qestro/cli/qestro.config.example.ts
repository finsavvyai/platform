/**
 * Qestro Configuration Example
 * Copy to qestro.config.ts and customize for your project
 */

export default {
  // Project metadata
  projectName: 'E-Commerce Testing Suite',
  projectId: 'proj_abc123',

  // API Configuration
  api: {
    url: process.env.QESTRO_API_URL || 'https://api.qestro.io',
    key: process.env.QESTRO_API_KEY,
    timeout: 30000,
    retries: 3,
  },

  // Testing Framework
  framework: 'playwright', // or 'cypress'

  // Test directories
  testDir: './tests',
  testsPattern: '**/*.spec.ts',

  // Base URL for browser tests
  baseUrl: process.env.BASE_URL || 'https://example.com',

  // Execution settings
  execution: {
    parallel: true,
    maxWorkers: 4,
    timeout: 60000,
    retries: 1,
    failFast: false,
  },

  // Browser configuration (Playwright)
  browsers: {
    chromium: true,
    firefox: true,
    webkit: false,
  },

  // Report generation
  reports: {
    enabled: true,
    formats: ['html', 'junit', 'json', 'markdown'],
    outputDir: './test-results',
    uploadToServer: true,
  },

  // Self-healing settings
  selfHealing: {
    enabled: true,
    autoApplyHighConfidence: false,
    minConfidenceThreshold: 0.8,
    strategies: [
      'selector-relaxation',
      'timing-adjustment',
      'assertion-normalization',
    ],
  },

  // Visual regression settings
  visual: {
    enabled: false,
    threshold: 0.1, // 0-1, difference threshold
    updateBaselines: false,
    screenshotDir: './visual-baselines',
  },

  // Performance monitoring
  performance: {
    enabled: true,
    thresholds: {
      pageLoadTime: 3000, // ms
      apiResponseTime: 1000, // ms
      navigationTime: 2000, // ms
    },
  },

  // CI/CD Integration
  cicd: {
    // GitHub Actions
    github: {
      enabled: false,
      token: process.env.GITHUB_TOKEN,
      owner: 'your-org',
      repo: 'your-repo',
    },

    // GitLab CI
    gitlab: {
      enabled: false,
      token: process.env.GITLAB_TOKEN,
      projectId: 'your-project-id',
    },

    // Jenkins
    jenkins: {
      enabled: false,
      url: process.env.JENKINS_URL,
      token: process.env.JENKINS_TOKEN,
    },
  },

  // Test scheduling
  scheduling: {
    enabled: true,
    // Cron expression for scheduled runs
    schedules: [
      { cron: '0 2 * * *', suites: ['smoke'], name: 'nightly-smoke' },
      { cron: '0 9 * * 1-5', suites: ['regression'], name: 'daily-regression' },
    ],
  },

  // Notifications
  notifications: {
    enabled: true,
    channels: {
      slack: {
        enabled: false,
        webhook: process.env.SLACK_WEBHOOK,
        mentions: '@qa-team',
      },
      email: {
        enabled: false,
        recipients: ['team@example.com'],
        onFailureOnly: false,
      },
      webhook: {
        enabled: false,
        url: process.env.WEBHOOK_URL,
      },
    },
  },

  // Analytics tracking
  analytics: {
    enabled: true,
    trackFlakiness: true,
    trackPerformance: true,
    retentionDays: 90,
  },

  // Advanced settings
  advanced: {
    // Test data management
    testData: {
      fixtures: './fixtures',
      generateFakeData: true,
    },

    // Debugging
    debug: {
      enabled: process.env.DEBUG === 'true',
      slowMo: 100, // Slow down actions by ms
      headless: !process.env.DEBUG,
    },

    // Custom headers for all requests
    headers: {
      'X-Custom-Header': 'qestro-cli',
    },

    // Proxy configuration
    proxy: {
      enabled: false,
      url: process.env.HTTP_PROXY,
    },
  },

  // Test data and environment variables
  env: {
    development: {
      apiUrl: 'http://localhost:3000',
      dbUrl: 'postgres://localhost/testdb',
    },
    staging: {
      apiUrl: 'https://staging-api.example.com',
      dbUrl: process.env.STAGING_DB_URL,
    },
    production: {
      apiUrl: 'https://api.example.com',
      dbUrl: process.env.PROD_DB_URL,
    },
  },
};
