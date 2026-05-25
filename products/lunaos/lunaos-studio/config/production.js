/**
 * Production Environment Configuration
 * Requirements: 6.1 - Environment-specific configuration files
 */

export const productionConfig = {
  environment: 'production',
  
  // API Configuration
  apiUrl: 'https://api.lunaos.ai',
  
  // Monitoring and Error Tracking
  sentryDSN: null, // Set via environment variable
  datadogAppId: null, // Set via environment variable
  datadogClientToken: null, // Set via environment variable
  
  // Logging Configuration
  logLevel: 'warn',
  enableConsoleLogging: false,
  enableFileLogging: true,
  
  // Analytics
  enableAnalytics: true,
  enableUserTracking: true,
  
  // Feature Flags
  featureFlags: {
    aiAssistant: true,
    collaboration: true,
    gamification: true,
    betaFeatures: false,
    debugMode: false
  },
  
  // Performance Settings
  performance: {
    enableServiceWorker: true,
    enableCodeSplitting: true,
    enableLazyLoading: true,
    maxCacheSize: 100 * 1024 * 1024, // 100MB
    enableHotReload: false,
    enableSourceMaps: false
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
    enablePerformanceProfiler: false,
    enableErrorBoundaryDetails: false
  },
  
  // Build Configuration
  build: {
    minify: true,
    generateSourceMaps: false,
    enableTreeShaking: true,
    bundleAnalyzer: false
  },
  
  // Production Optimizations
  optimizations: {
    enableGzipCompression: true,
    enableBrotliCompression: true,
    enableImageOptimization: true,
    enableFontSubsetting: true,
    enableCDN: true
  },
  
  // Monitoring Thresholds
  monitoring: {
    errorRateThreshold: 0.01, // 1%
    responseTimeThreshold: 2000, // 2 seconds
    availabilityThreshold: 0.999, // 99.9%
    memoryUsageThreshold: 0.8 // 80%
  }
};

export default productionConfig;