/**
 * NYC (Istanbul) Configuration
 * Enhanced configuration for comprehensive test coverage reporting
 */

const path = require('path');
const coverageConfig = require('./coverage.config.js');

// Get environment-specific configuration
const config = coverageConfig.getConfig();

module.exports = {
  // Extend the TypeScript configuration
  extends: '@istanbuljs/nyc-config-typescript',
  
  // Coverage collection settings
  all: true,
  cache: true,
  'check-coverage': true,
  'skip-full': false,
  'skip-empty': false,
  clean: true,
  
  // Source map support
  'source-map': true,
  instrument: true,
  'produce-source-map': true,
  
  // File patterns
  include: config.include,
  exclude: config.exclude,
  extension: ['.ts', '.tsx', '.js', '.jsx'],
  
  // TypeScript support
  require: [
    'ts-node/register',
    'source-map-support/register'
  ],
  
  // Output configuration
  'report-dir': config.reportDir,
  'temp-dir': config.tempDir,
  'cache-dir': config.cacheDir,
  
  // Reporters
  reporter: config.reporter,
  
  // Coverage thresholds
  branches: config.branches,
  lines: config.lines,
  functions: config.functions,
  statements: config.statements,
  
  // Per-file coverage
  'per-file': true,
  
  // Watermarks for color coding
  watermarks: config.watermarks,
  
  // Advanced Istanbul options
  hookRequire: true,
  hookRunInContext: true,
  hookRunInThisContext: true,
  preserveComments: true,
  compact: false,
  completeCopy: true,
  excludeAfterRemap: true,
  excludeNodeModules: true,
  
  // Environment-specific settings
  ...(process.env.NODE_ENV === 'production' && {
    branches: 90,
    lines: 90,
    functions: 90,
    statements: 90
  }),
  
  // CI-specific settings
  ...(process.env.CI === 'true' && {
    'check-coverage': true,
    'fail-fast': false,
    'report-dir': 'coverage/ci',
    reporter: [
      'text',
      'text-summary',
      'html',
      'lcov',
      'json',
      'json-summary',
      'cobertura',
      'teamcity'
    ]
  })
};