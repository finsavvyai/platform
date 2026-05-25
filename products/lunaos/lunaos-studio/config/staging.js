/**
 * Staging Environment Configuration
 * Requirements: 6.1 - Environment-specific configuration files
 */

export const stagingConfig = {
  environment: 'staging',
  
  // API Configuration
  apiUrl: 'https://api-staging.lunaos.ai',
  
  // Monitoring and Error Tracking
  sentryDSN: null, // Set via environment variable
  datadogAppId: null, // Set via environment variable
  datadogClientToken: null, // Set via environment variable
  
  // Logging Configuration
  logLevel: 'info',
  enableConsoleLogging: true,
  enableFileLogging: false,
  
  // Analytics
  enableAnalytics: true,
  enableUserTracking: true,
  
  // Feature Flags
  featureFlags: {
    aiAssistant: true,
    collaboration: true,
    gamification: true,
    betaFeatures: true,
    debugMode: false
  },
  
  // Performance Settings
  performance: {
    enableServiceWorker: true,
    enableCodeSplitting: true,
    enableLazyLoading: true,
    maxCacheSize: 100 * 1024 * 1024, // 100MB
    enableHotReload: false,
    enableSourceMaps: true
  },
  
  // Security Settings
  security: {
    enforceHTTPS: true,
    enableCSP: true,
    enableHSTS: true,
    allowDevTools: false,
    enableCORS: false
  },
  
  // Development Tools
  devTools: {
    enableReduxDevTools: false,
    enableReactDevTools: false,
    enablePerformanceProfiler: true,
    enableErrorBoundaryDetails: true
  },
  
  // Build Configuration
  build: {
    minify: true,
    generateSourceMaps: true,
    enableTreeShaking: true,
    bundleAnalyzer: false
  },
  
  // Testing Configuration
  testing: {
    enableE2ETests: true,
    enableVisualRegression: true,
    enablePerformanceTests: true,
    testTimeout: 30000
  }
};

export default stagingConfig;