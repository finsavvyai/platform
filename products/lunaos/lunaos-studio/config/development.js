/**
 * Development Environment Configuration
 * Requirements: 6.1 - Environment-specific configuration files
 */

export const developmentConfig = {
  environment: 'development',
  
  // API Configuration
  apiUrl: 'http://localhost:8000',
  
  // Monitoring and Error Tracking
  sentryDSN: null, // Set via environment variable
  datadogAppId: null, // Set via environment variable
  datadogClientToken: null, // Set via environment variable
  
  // Logging Configuration
  logLevel: 'debug',
  enableConsoleLogging: true,
  enableFileLogging: false,
  
  // Analytics
  enableAnalytics: false,
  enableUserTracking: false,
  
  // Feature Flags
  featureFlags: {
    aiAssistant: true,
    collaboration: true,
    gamification: false,
    betaFeatures: true,
    debugMode: true
  },
  
  // Performance Settings
  performance: {
    enableServiceWorker: false,
    enableCodeSplitting: true,
    enableLazyLoading: true,
    maxCacheSize: 50 * 1024 * 1024, // 50MB
    enableHotReload: true,
    enableSourceMaps: true
  },
  
  // Security Settings
  security: {
    enforceHTTPS: false,
    enableCSP: true,
    enableHSTS: false,
    allowDevTools: true,
    enableCORS: true
  },
  
  // Development Tools
  devTools: {
    enableReduxDevTools: true,
    enableReactDevTools: true,
    enablePerformanceProfiler: true,
    enableErrorBoundaryDetails: true
  },
  
  // Build Configuration
  build: {
    minify: false,
    generateSourceMaps: true,
    enableTreeShaking: false,
    bundleAnalyzer: false
  }
};

export default developmentConfig;