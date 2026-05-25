export const APP_CONFIG = {
  name: 'SDLC.ai Admin',
  description: 'Admin interface for SDLC.ai platform',
  version: '1.0.0',
  author: 'SDLC.ai Team',
} as const

export const API_ENDPOINTS = {
  auth: {
    login: '/api/auth/login',
    logout: '/api/auth/logout',
    register: '/api/auth/register',
    refresh: '/api/auth/refresh',
    forgotPassword: '/api/auth/forgot-password',
    resetPassword: '/api/auth/reset-password',
    verifyEmail: '/api/auth/verify-email',
  },
  users: {
    list: '/api/users',
    create: '/api/users',
    get: (id: string) => `/api/users/${id}`,
    update: (id: string) => `/api/users/${id}`,
    delete: (id: string) => `/api/users/${id}`,
    roles: '/api/users/roles',
    permissions: '/api/users/permissions',
    bulk: '/api/users/bulk',
    activity: (id: string) => `/api/users/${id}/activity`,
    stats: '/api/users/stats',
  },
  tenants: {
    list: '/api/tenants',
    create: '/api/tenants',
    get: (id: string) => `/api/tenants/${id}`,
    update: (id: string) => `/api/tenants/${id}`,
    delete: (id: string) => `/api/tenants/${id}`,
    usage: (id: string) => `/api/tenants/${id}/usage`,
    activity: (id: string) => `/api/tenants/${id}/activity`,
    policies: (id: string) => `/api/tenants/${id}/policies`,
  },
  projects: {
    list: '/api/projects',
    create: '/api/projects',
    get: (id: string) => `/api/projects/${id}`,
    update: (id: string) => `/api/projects/${id}`,
    delete: (id: string) => `/api/projects/${id}`,
    members: (id: string) => `/api/projects/${id}/members`,
    activity: (id: string) => `/api/projects/${id}/activity`,
  },
  analytics: {
    overview: '/api/analytics/overview',
    users: '/api/analytics/users',
    projects: '/api/analytics/projects',
    performance: '/api/analytics/performance',
    reports: '/api/analytics/reports',
  },
  settings: {
    general: '/api/settings/general',
    security: '/api/settings/security',
    notifications: '/api/settings/notifications',
    integrations: '/api/settings/integrations',
  },
} as const

export const ROLES = {
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  DEVELOPER: 'DEVELOPER',
  USER: 'USER',
} as const

export const PERMISSIONS = {
  // User permissions
  USER_READ: 'user:read',
  USER_CREATE: 'user:create',
  USER_UPDATE: 'user:update',
  USER_DELETE: 'user:delete',

  // Project permissions
  PROJECT_READ: 'project:read',
  PROJECT_CREATE: 'project:create',
  PROJECT_UPDATE: 'project:update',
  PROJECT_DELETE: 'project:delete',
  PROJECT_MEMBERS_MANAGE: 'project:members:manage',

  // Analytics permissions
  ANALYTICS_VIEW: 'analytics:view',
  ANALYTICS_EXPORT: 'analytics:export',

  // Settings permissions
  SETTINGS_READ: 'settings:read',
  SETTINGS_UPDATE: 'settings:update',

  // System permissions
  SYSTEM_ADMIN: 'system:admin',
  SYSTEM_MONITORING: 'system:monitoring',
} as const

export const USER_STATUSES = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  SUSPENDED: 'SUSPENDED',
  PENDING: 'PENDING',
} as const

export const PROJECT_STATUSES = {
  PLANNING: 'PLANNING',
  IN_PROGRESS: 'IN_PROGRESS',
  ON_HOLD: 'ON_HOLD',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const

export const TASK_PRIORITIES = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
} as const

export const NOTIFICATION_TYPES = {
  INFO: 'INFO',
  SUCCESS: 'SUCCESS',
  WARNING: 'WARNING',
  ERROR: 'ERROR',
} as const

export const DATE_FORMATS = {
  DATE: 'YYYY-MM-DD',
  DATETIME: 'YYYY-MM-DD HH:mm:ss',
  TIME: 'HH:mm:ss',
  DISPLAY_DATE: 'MMMM DD, YYYY',
  DISPLAY_DATETIME: 'MMMM DD, YYYY at HH:mm',
  RELATIVE: 'relative',
} as const

export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  PAGE_SIZES: [10, 20, 50, 100],
} as const

export const ANIMATION_DURATION = {
  FAST: 150,
  NORMAL: 300,
  SLOW: 500,
} as const

export const BREAKPOINTS = {
  SM: 640,
  MD: 768,
  LG: 1024,
  XL: 1280,
  '2XL': 1536,
} as const

export const LOCAL_STORAGE_KEYS = {
  THEME: 'sdlc-theme',
  SIDEBAR_STATE: 'sdlc-sidebar-state',
  USER_PREFERENCES: 'sdlc-user-preferences',
  RECENT_PROJECTS: 'sdlc-recent-projects',
  AUTH_TOKEN: 'sdlc-auth-token',
} as const

export const SESSION_STORAGE_KEYS = {
  RETURN_URL: 'sdlc-return-url',
  FLASH_MESSAGE: 'sdlc-flash-message',
  MODAL_STATE: 'sdlc-modal-state',
} as const

export const VALIDATION_RULES = {
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_MAX_LENGTH: 128,
  USERNAME_MIN_LENGTH: 3,
  USERNAME_MAX_LENGTH: 30,
  PROJECT_NAME_MAX_LENGTH: 100,
  DESCRIPTION_MAX_LENGTH: 1000,
  FILE_MAX_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_FILE_TYPES: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'text/plain',
    'application/json',
    'application/xml',
  ],
} as const

export const ROUTES = {
  HOME: '/',
  DASHBOARD: '/dashboard',
  AUTH: {
    SIGNIN: '/auth/signin',
    SIGNUP: '/auth/signup',
    SIGNOUT: '/auth/signout',
    FORGOT_PASSWORD: '/auth/forgot-password',
    RESET_PASSWORD: '/auth/reset-password',
    VERIFY_EMAIL: '/auth/verify-email',
  },
  USERS: {
    LIST: '/users',
    CREATE: '/users/create',
    EDIT: (id: string) => `/users/${id}/edit`,
    VIEW: (id: string) => `/users/${id}`,
  },
  PROJECTS: {
    LIST: '/projects',
    CREATE: '/projects/create',
    EDIT: (id: string) => `/projects/${id}/edit`,
    VIEW: (id: string) => `/projects/${id}`,
    SETTINGS: (id: string) => `/projects/${id}/settings`,
  },
  ANALYTICS: '/analytics',
  SETTINGS: '/settings',
  ADMIN: '/admin',
} as const

export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error occurred. Please check your connection.',
  UNAUTHORIZED: 'You are not authorized to perform this action.',
  FORBIDDEN: 'You do not have permission to access this resource.',
  NOT_FOUND: 'The requested resource was not found.',
  SERVER_ERROR: 'An unexpected error occurred. Please try again.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  TIMEOUT_ERROR: 'Request timed out. Please try again.',
} as const

export const SUCCESS_MESSAGES = {
  SAVE_SUCCESS: 'Changes saved successfully.',
  DELETE_SUCCESS: 'Item deleted successfully.',
  CREATE_SUCCESS: 'Item created successfully.',
  UPDATE_SUCCESS: 'Item updated successfully.',
  COPY_SUCCESS: 'Copied to clipboard.',
  UPLOAD_SUCCESS: 'File uploaded successfully.',
} as const
