/**
 * Comprehensive Coverage Configuration
 * Defines coverage settings for different environments and components
 */

const path = require('path');

// Base coverage configuration
const baseCoverage = {
  all: true,
  cache: true,
  checkCoverage: true,
  skipFull: false,
  skipEmpty: false,
  clean: true,
  sourceMap: true,
  instrument: true,
  produceSourceMap: true,
  reporter: [
    'text',
    'text-summary',
    'html',
    'lcov',
    'json',
    'json-summary',
    'clover',
    'cobertura'
  ]
};

// Environment-specific configurations
const environments = {
  development: {
    ...baseCoverage,
    branches: 70,
    lines: 70,
    functions: 70,
    statements: 70,
    watermarks: {
      lines: [60, 80],
      functions: [60, 80],
      branches: [60, 80],
      statements: [60, 80]
    }
  },
  
  staging: {
    ...baseCoverage,
    branches: 80,
    lines: 80,
    functions: 80,
    statements: 80,
    watermarks: {
      lines: [75, 90],
      functions: [75, 90],
      branches: [75, 90],
      statements: [75, 90]
    }
  },
  
  production: {
    ...baseCoverage,
    branches: 85,
    lines: 85,
    functions: 85,
    statements: 85,
    watermarks: {
      lines: [80, 95],
      functions: [80, 95],
      branches: [80, 95],
      statements: [80, 95]
    }
  }
};

// Component-specific thresholds
const componentThresholds = {
  backend: {
    services: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    },
    controllers: {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85
    },
    middleware: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    utils: {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95
    }
  },
  
  frontend: {
    components: {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85
    },
    services: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    },
    hooks: {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85
    },
    utils: {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95
    }
  }
};

// File patterns to exclude from coverage
const excludePatterns = [
  '**/*.d.ts',
  '**/*.test.ts',
  '**/*.test.tsx',
  '**/*.spec.ts',
  '**/*.spec.tsx',
  '**/node_modules/**',
  '**/coverage/**',
  '**/dist/**',
  '**/build/**',
  '**/.nyc_output/**',
  '**/index.ts',
  '**/types/**',
  '**/*.config.ts',
  '**/*.config.js',
  '**/__tests__/**',
  '**/__mocks__/**',
  '**/test/**',
  '**/tests/**',
  '**/stories/**',
  '**/*.stories.ts',
  '**/*.stories.tsx'
];

// File patterns to include in coverage
const includePatterns = [
  'backend/src/**/*.ts',
  'backend/src/**/*.tsx',
  'frontend/src/**/*.ts',
  'frontend/src/**/*.tsx',
  'agent/src/**/*.ts'
];

// Coverage report configurations
const reportConfigurations = {
  html: {
    subdir: 'html',
    skipEmpty: false,
    skipFull: false
  },
  
  lcov: {
    subdir: 'lcov',
    file: 'lcov.info'
  },
  
  json: {
    subdir: 'json',
    file: 'coverage-final.json'
  },
  
  'json-summary': {
    subdir: 'json',
    file: 'coverage-summary.json'
  },
  
  cobertura: {
    subdir: 'cobertura',
    file: 'cobertura-coverage.xml'
  },
  
  clover: {
    subdir: 'clover',
    file: 'clover.xml'
  }
};

// Quality gates configuration
const qualityGates = {
  // Minimum acceptable coverage
  minimum: {
    branches: 70,
    functions: 70,
    lines: 70,
    statements: 70
  },
  
  // Target coverage levels
  target: {
    branches: 85,
    functions: 85,
    lines: 85,
    statements: 85
  },
  
  // Excellent coverage levels
  excellent: {
    branches: 95,
    functions: 95,
    lines: 95,
    statements: 95
  }
};

// CI/CD integration settings
const cicdSettings = {
  // Fail build if coverage drops below threshold
  failOnCoverageDecrease: true,
  
  // Maximum allowed coverage decrease (percentage points)
  maxCoverageDecrease: 2,
  
  // Upload coverage to external services
  uploadServices: {
    codecov: {
      enabled: process.env.CODECOV_TOKEN !== undefined,
      token: process.env.CODECOV_TOKEN,
      flags: ['backend', 'frontend', 'combined']
    },
    
    coveralls: {
      enabled: process.env.COVERALLS_REPO_TOKEN !== undefined,
      token: process.env.COVERALLS_REPO_TOKEN
    },
    
    sonarqube: {
      enabled: process.env.SONAR_TOKEN !== undefined,
      token: process.env.SONAR_TOKEN,
      host: process.env.SONAR_HOST_URL
    }
  }
};

// Get configuration for current environment
function getConfig(env = process.env.NODE_ENV || 'development') {
  const envConfig = environments[env] || environments.development;
  
  return {
    ...envConfig,
    include: includePatterns,
    exclude: excludePatterns,
    reportDir: path.join(process.cwd(), 'coverage'),
    tempDir: path.join(process.cwd(), '.nyc_output'),
    cacheDir: path.join(process.cwd(), '.nyc_cache'),
    componentThresholds,
    qualityGates,
    cicdSettings,
    reportConfigurations
  };
}

// Export configuration
module.exports = {
  getConfig,
  environments,
  componentThresholds,
  excludePatterns,
  includePatterns,
  reportConfigurations,
  qualityGates,
  cicdSettings,
  
  // Helper functions
  isCI: () => process.env.CI === 'true',
  getEnvironment: () => process.env.NODE_ENV || 'development',
  
  // Validation functions
  validateThresholds: (coverage) => {
    const config = getConfig();
    const { branches, functions, lines, statements } = coverage;
    
    return {
      branches: branches >= config.branches,
      functions: functions >= config.functions,
      lines: lines >= config.lines,
      statements: statements >= config.statements,
      overall: branches >= config.branches && 
               functions >= config.functions && 
               lines >= config.lines && 
               statements >= config.statements
    };
  }
};/**
 * Coverage Thresholds Configuration
 * Defines coverage thresholds for different components and environments
 */

const path = require('path');

// Environment-based thresholds
const environmentThresholds = {
  development: {
    global: { branches: 70, functions: 70, lines: 70, statements: 70 },
    watermarks: { lines: [60, 80], functions: [60, 80], branches: [60, 80], statements: [60, 80] }
  },
  staging: {
    global: { branches: 80, functions: 80, lines: 80, statements: 80 },
    watermarks: { lines: [75, 90], functions: [75, 90], branches: [75, 90], statements: [75, 90] }
  },
  production: {
    global: { branches: 85, functions: 85, lines: 85, statements: 85 },
    watermarks: { lines: [80, 95], functions: [80, 95], branches: [80, 95], statements: [80, 95] }
  }
};

// Component-specific thresholds
const componentThresholds = {
  // Backend thresholds
  'backend/src/services/': { branches: 90, functions: 90, lines: 90, statements: 90 },
  'backend/src/controllers/': { branches: 85, functions: 85, lines: 85, statements: 85 },
  'backend/src/middleware/': { branches: 80, functions: 80, lines: 80, statements: 80 },
  'backend/src/utils/': { branches: 95, functions: 95, lines: 95, statements: 95 },
  'backend/src/validation/': { branches: 90, functions: 90, lines: 90, statements: 90 },
  
  // Frontend thresholds
  'frontend/src/components/': { branches: 85, functions: 85, lines: 85, statements: 85 },
  'frontend/src/services/': { branches: 90, functions: 90, lines: 90, statements: 90 },
  'frontend/src/hooks/': { branches: 85, functions: 85, lines: 85, statements: 85 },
  'frontend/src/utils/': { branches: 95, functions: 95, lines: 95, statements: 95 },
  'frontend/src/stores/': { branches: 85, functions: 85, lines: 85, statements: 85 },
  
  // Agent thresholds
  'agent/src/': { branches: 85, functions: 85, lines: 85, statements: 85 }
};

// Critical file patterns that require higher coverage
const criticalFilePatterns = [
  /src\/services\/.*Service\.ts$/,
  /src\/controllers\/.*Controller\.ts$/,
  /src\/middleware\/auth.*\.ts$/,
  /src\/utils\/security.*\.ts$/,
  /src\/validation\/.*\.ts$/
];

// File patterns that can have lower coverage
const lowPriorityPatterns = [
  /src\/types\/.*\.ts$/,
  /src\/constants\/.*\.ts$/,
  /src\/config\/.*\.ts$/,
  /\.stories\.tsx?$/,
  /\.test\.tsx?$/,
  /\.spec\.tsx?$/
];

/**
 * Get coverage thresholds for current environment
 */
function getThresholds(env = process.env.NODE_ENV || 'development') {
  const envThresholds = environmentThresholds[env] || environmentThresholds.development;
  
  return {
    ...envThresholds,
    ...componentThresholds
  };
}

/**
 * Get threshold for specific file
 */
function getFileThreshold(filePath, env = process.env.NODE_ENV || 'development') {
  const envThresholds = environmentThresholds[env] || environmentThresholds.development;
  
  // Check if file is critical
  if (criticalFilePatterns.some(pattern => pattern.test(filePath))) {
    return {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95
    };
  }
  
  // Check if file is low priority
  if (lowPriorityPatterns.some(pattern => pattern.test(filePath))) {
    return {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50
    };
  }
  
  // Check component-specific thresholds
  for (const [pattern, threshold] of Object.entries(componentThresholds)) {
    if (filePath.includes(pattern)) {
      return threshold;
    }
  }
  
  // Return global threshold
  return envThresholds.global;
}

/**
 * Validate coverage against thresholds
 */
function validateCoverage(coverage, filePath, env = process.env.NODE_ENV || 'development') {
  const threshold = getFileThreshold(filePath, env);
  
  return {
    lines: coverage.lines >= threshold.lines,
    functions: coverage.functions >= threshold.functions,
    branches: coverage.branches >= threshold.branches,
    statements: coverage.statements >= threshold.statements,
    overall: coverage.lines >= threshold.lines && 
             coverage.functions >= threshold.functions && 
             coverage.branches >= threshold.branches && 
             coverage.statements >= threshold.statements
  };
}

/**
 * Get quality gate configuration
 */
function getQualityGate(env = process.env.NODE_ENV || 'development') {
  const envThresholds = environmentThresholds[env] || environmentThresholds.development;
  
  return {
    // Minimum acceptable coverage
    minimum: envThresholds.global,
    
    // Target coverage levels
    target: {
      branches: envThresholds.global.branches + 10,
      functions: envThresholds.global.functions + 10,
      lines: envThresholds.global.lines + 10,
      statements: envThresholds.global.statements + 10
    },
    
    // Excellent coverage levels
    excellent: {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95
    },
    
    // Watermarks for visualization
    watermarks: envThresholds.watermarks
  };
}

module.exports = {
  environmentThresholds,
  componentThresholds,
  criticalFilePatterns,
  lowPriorityPatterns,
  getThresholds,
  getFileThreshold,
  validateCoverage,
  getQualityGate
};