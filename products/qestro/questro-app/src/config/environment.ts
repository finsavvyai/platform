// Environment configuration management
export const ENV = {
  // Application
  APP_NAME: import.meta.env.VITE_APP_NAME || 'Questro',
  APP_VERSION: import.meta.env.VITE_APP_VERSION || '1.0.0',
  APP_ENV: import.meta.env.VITE_APP_ENV || 'development',
  
  // API
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
  WS_URL: import.meta.env.VITE_WS_URL || 'ws://localhost:8000',
  
  // Supabase
  SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL || '',
  SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
  
  // Authentication
  JWT_STORAGE_KEY: import.meta.env.VITE_JWT_STORAGE_KEY || 'questro_token',
  REFRESH_TOKEN_KEY: import.meta.env.VITE_REFRESH_TOKEN_KEY || 'questro_refresh_token',
  
  // Feature Flags
  ENABLE_RECORDING: import.meta.env.VITE_ENABLE_RECORDING === 'true',
  ENABLE_MOBILE_TESTING: import.meta.env.VITE_ENABLE_MOBILE_TESTING === 'true',
  ENABLE_WEB_TESTING: import.meta.env.VITE_ENABLE_WEB_TESTING === 'true',
  ENABLE_API_DOCS: import.meta.env.VITE_ENABLE_API_DOCS === 'true',
  ENABLE_ANALYTICS: import.meta.env.VITE_ENABLE_ANALYTICS === 'true',
  ENABLE_BETA_FEATURES: import.meta.env.VITE_ENABLE_BETA_FEATURES === 'true',
  
  // Analytics & Monitoring
  MIXPANEL_TOKEN: import.meta.env.VITE_MIXPANEL_TOKEN || '',
  GOOGLE_ANALYTICS_ID: import.meta.env.VITE_GOOGLE_ANALYTICS_ID || '',
  SENTRY_DSN: import.meta.env.VITE_SENTRY_DSN || '',
  
  // Upload Configuration
  MAX_FILE_SIZE: parseInt(import.meta.env.VITE_MAX_FILE_SIZE || '10485760'),
  ALLOWED_FILE_TYPES: import.meta.env.VITE_ALLOWED_FILE_TYPES?.split(',') || ['.png', '.jpg', '.jpeg', '.gif', '.mp4', '.mov', '.avi'],
  
  // Social Login
  GOOGLE_CLIENT_ID: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
  GITHUB_CLIENT_ID: import.meta.env.VITE_GITHUB_CLIENT_ID || '',
  
  // Branding
  COMPANY_NAME: import.meta.env.VITE_COMPANY_NAME || 'Questro',
  SUPPORT_EMAIL: import.meta.env.VITE_SUPPORT_EMAIL || 'support@questro.io',
  DOCS_URL: import.meta.env.VITE_DOCS_URL || 'https://docs.questro.io',
  STATUS_PAGE_URL: import.meta.env.VITE_STATUS_PAGE_URL || 'https://status.questro.io',
  
  // Development
  DEV_TOOLS: import.meta.env.VITE_DEV_TOOLS === 'true',
  MOCK_API: import.meta.env.VITE_MOCK_API === 'true',
  LOG_LEVEL: import.meta.env.VITE_LOG_LEVEL || 'info',
};

// Environment checks
export const isDevelopment = ENV.APP_ENV === 'development';
export const isProduction = ENV.APP_ENV === 'production';
export const isPreview = ENV.APP_ENV === 'preview';

// API endpoints
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    REFRESH: '/auth/refresh',
    LOGOUT: '/auth/logout',
    VERIFY_EMAIL: '/auth/verify-email',
    FORGOT_PASSWORD: '/auth/forgot-password',
    RESET_PASSWORD: '/auth/reset-password',
  },
  USERS: {
    PROFILE: '/users/profile',
    UPDATE_PROFILE: '/users/profile',
    CHANGE_PASSWORD: '/users/change-password',
    DELETE_ACCOUNT: '/users/delete-account',
  },
  PROJECTS: {
    LIST: '/projects',
    CREATE: '/projects',
    GET: (id: string) => `/projects/${id}`,
    UPDATE: (id: string) => `/projects/${id}`,
    DELETE: (id: string) => `/projects/${id}`,
  },
  RECORDING: {
    START: '/recording/start',
    STOP: '/recording/stop',
    STATUS: (id: string) => `/recording/${id}/status`,
    EXPORT: (id: string) => `/recording/${id}/export`,
    LIST: '/recording/sessions',
  },
  TEST_SUITES: {
    LIST: '/test-suites',
    CREATE: '/test-suites',
    GET: (id: string) => `/test-suites/${id}`,
    UPDATE: (id: string) => `/test-suites/${id}`,
    DELETE: (id: string) => `/test-suites/${id}`,
    RUN: (id: string) => `/test-suites/${id}/run`,
  },
  TEST_CASES: {
    LIST: '/test-cases',
    CREATE: '/test-cases',
    GET: (id: string) => `/test-cases/${id}`,
    UPDATE: (id: string) => `/test-cases/${id}`,
    DELETE: (id: string) => `/test-cases/${id}`,
    RUN: (id: string) => `/test-cases/${id}/run`,
  },
  INTEGRATIONS: {
    LIST: '/integrations',
    CREATE: '/integrations',
    UPDATE: (id: string) => `/integrations/${id}`,
    DELETE: (id: string) => `/integrations/${id}`,
    TEST: (id: string) => `/integrations/${id}/test`,
  },
  ANALYTICS: {
    USAGE: '/analytics/usage',
    DASHBOARD: '/analytics/dashboard',
    EXPORT: '/analytics/export',
  },
};

// Validation
const requiredEnvVars = [
  'VITE_API_BASE_URL',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
];

if (isProduction) {
  requiredEnvVars.forEach((envVar) => {
    if (!import.meta.env[envVar]) {
      console.error(`Missing required environment variable: ${envVar}`);
    }
  });
}

export default ENV;