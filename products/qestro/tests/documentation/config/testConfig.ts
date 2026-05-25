/**
 * Documentation Test Configuration
 *
 * Central configuration for all documentation testing including
 * thresholds, timeouts, and validation rules.
 */

export interface DocumentationTestConfig {
  // General settings
  testTimeout: number;
  parallelTests: number;
  retryAttempts: number;

  // File discovery
  documentationPaths: string[];
  fileExtensions: string[];
  excludePatterns: string[];

  // Link validation
  linkValidation: {
    timeout: number;
    userAgent: string;
    followRedirects: boolean;
    maxRedirects: number;
    allowedStatusCodes: number[];
    skipExternal: boolean;
    skipInternal: boolean;
  };

  // Content validation
  contentValidation: {
    minQualityScore: number;
    requiredSections: Record<string, string[]>;
    maxFileSize: number; // bytes
    encoding: string;
  };

  // API documentation
  apiValidation: {
    requireExamples: boolean;
    requireParameters: boolean;
    requireResponses: boolean;
    allowedMethods: string[];
    basePath: string;
  };

  // Code examples
  codeValidation: {
    syntaxCheck: boolean;
    securityCheck: boolean;
    executableCheck: boolean;
    timeoutMs: number;
    allowedLanguages: string[];
  };

  // Performance
  performance: {
    maxLoadTime: number; // milliseconds
    maxFileSize: number; // bytes
    imageOptimization: {
      maxWidth: number;
      maxFileSize: number;
      formats: string[];
    };
    searchPerformance: {
      maxResponseTime: number; // milliseconds
    };
  };

  // Accessibility
  accessibility: {
    wcagLevel: 'A' | 'AA' | 'AAA';
    checkContrast: boolean;
    checkAltText: boolean;
    checkHeadings: boolean;
    minHeadingLevels: number;
  };

  // Security
  security: {
    checkForSecrets: boolean;
    allowedDomains: string[];
    blockedDomains: string[];
    checkXSS: boolean;
    checkInsecureContent: boolean;
  };

  // Reporting
  reporting: {
    outputFormats: string[];
    includeCoverage: boolean;
    includePerformance: boolean;
    includeSecurity: boolean;
    outputDirectory: string;
  };
}

export const defaultDocumentationTestConfig: DocumentationTestConfig = {
  // General settings
  testTimeout: 30000, // 30 seconds
  parallelTests: 5,
  retryAttempts: 3,

  // File discovery
  documentationPaths: [
    'docs',
    'docs/api',
    'docs/guides',
    'docs/tutorials',
    'README.md'
  ],
  fileExtensions: ['.md', '.txt', '.json', '.yaml', '.yml'],
  excludePatterns: [
    'node_modules',
    '.git',
    'dist',
    'coverage',
    '.next',
    'build',
    '*.log',
    '*.tmp'
  ],

  // Link validation
  linkValidation: {
    timeout: 10000, // 10 seconds
    userAgent: 'Questro-Doc-Validator/1.0',
    followRedirects: true,
    maxRedirects: 5,
    allowedStatusCodes: [200, 201, 202, 204, 301, 302, 304],
    skipExternal: false,
    skipInternal: false,
  },

  // Content validation
  contentValidation: {
    minQualityScore: 85,
    requiredSections: {
      'api': ['Overview', 'Authentication', 'Endpoints', 'Error Handling'],
      'deployment': ['Prerequisites', 'Installation', 'Configuration', 'Troubleshooting'],
      'user-guide': ['Getting Started', 'Features', 'FAQ'],
      'troubleshooting': ['Common Issues', 'Solutions', 'Support'],
    },
    maxFileSize: 10 * 1024 * 1024, // 10MB
    encoding: 'utf-8',
  },

  // API documentation
  apiValidation: {
    requireExamples: true,
    requireParameters: true,
    requireResponses: true,
    allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'],
    basePath: 'https://api.questro.com',
  },

  // Code examples
  codeValidation: {
    syntaxCheck: true,
    securityCheck: true,
    executableCheck: false, // Disabled for safety
    timeoutMs: 5000,
    allowedLanguages: [
      'javascript', 'js', 'typescript', 'ts',
      'python', 'py',
      'bash', 'shell', 'sh',
      'json', 'yaml', 'yml',
      'sql',
      'html', 'css',
      'http'
    ],
  },

  // Performance
  performance: {
    maxLoadTime: 3000, // 3 seconds
    maxFileSize: 1024 * 1024, // 1MB per file
    imageOptimization: {
      maxWidth: 1920,
      maxFileSize: 500 * 1024, // 500KB
      formats: ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'],
    },
    searchPerformance: {
      maxResponseTime: 1000, // 1 second
    },
  },

  // Accessibility
  accessibility: {
    wcagLevel: 'AA',
    checkContrast: true,
    checkAltText: true,
    checkHeadings: true,
    minHeadingLevels: 2,
  },

  // Security
  security: {
    checkForSecrets: true,
    allowedDomains: [
      'questro.com',
      'github.com',
      'npmjs.com',
      'developer.mozilla.org',
      'nodejs.org',
      'reactjs.org',
      'postgresql.org',
      'redis.io',
      'stripe.com',
      'aws.amazon.com',
      'cloud.google.com'
    ],
    blockedDomains: [
      'example.com',
      'test.com',
      'localhost',
      '127.0.0.1'
    ],
    checkXSS: true,
    checkInsecureContent: true,
  },

  // Reporting
  reporting: {
    outputFormats: ['json', 'html', 'markdown'],
    includeCoverage: true,
    includePerformance: true,
    includeSecurity: true,
    outputDirectory: 'test-results',
  },
};

// Environment-specific configurations
export const environmentConfigs: Record<string, Partial<DocumentationTestConfig>> = {
  development: {
    linkValidation: {
      skipExternal: true, // Skip external link checks during development
    },
    reporting: {
      outputFormats: ['console'], // Only console output during development
    },
  },

  ci: {
    parallelTests: 10, // More parallel tests in CI
    linkValidation: {
      timeout: 15000, // Longer timeout for CI environments
    },
    reporting: {
      outputFormats: ['json', 'junit'], // CI-friendly formats
    },
  },

  production: {
    testTimeout: 60000, // Longer timeout for production validation
    contentValidation: {
      minQualityScore: 95, // Higher quality standards for production
    },
    linkValidation: {
      timeout: 20000, // Longer timeout for production links
    },
    performance: {
      maxLoadTime: 2000, // Stricter performance requirements
    },
  },
};

/**
 * Get configuration for current environment
 */
export function getTestConfig(override: Partial<DocumentationTestConfig> = {}): DocumentationTestConfig {
  const env = process.env.NODE_ENV || 'development';
  const envConfig = environmentConfigs[env] || {};

  return {
    ...defaultDocumentationTestConfig,
    ...envConfig,
    ...override,
  };
}

/**
 * Validate configuration object
 */
export function validateConfig(config: DocumentationTestConfig): string[] {
  const errors: string[] = [];

  if (config.testTimeout <= 0) {
    errors.push('testTimeout must be greater than 0');
  }

  if (config.parallelTests <= 0) {
    errors.push('parallelTests must be greater than 0');
  }

  if (config.contentValidation.minQualityScore < 0 || config.contentValidation.minQualityScore > 100) {
    errors.push('minQualityScore must be between 0 and 100');
  }

  if (config.performance.maxLoadTime <= 0) {
    errors.push('maxLoadTime must be greater than 0');
  }

  if (config.linkValidation.timeout <= 0) {
    errors.push('linkValidation.timeout must be greater than 0');
  }

  return errors;
}

export default {
  defaultDocumentationTestConfig,
  environmentConfigs,
  getTestConfig,
  validateConfig,
};
