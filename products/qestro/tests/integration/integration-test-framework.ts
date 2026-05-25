/**
 * Qestro SaaS Platform - Integration Testing Framework
 *
 * This framework provides comprehensive testing capabilities for the entire platform,
 * including API testing, database integration, WebSocket communication, and end-to-end workflows.
 */

import { describe, beforeAll, afterAll, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import request from 'supertest';
import { WebSocket } from 'ws';
import Redis from 'ioredis';
import { Pool } from 'pg';
import app from '../../backend/src/app';
import { DatabaseService } from '../../backend/src/services/DatabaseService';
import { TokenService } from '../../backend/src/services/TokenService';
import { logger } from '../../backend/src/utils/logger';

// Test configuration
const TEST_CONFIG = {
  API_BASE_URL: process.env.TEST_API_URL || 'http://localhost:8000',
  WS_URL: process.env.TEST_WS_URL || 'ws://localhost:8001',
  DATABASE_URL: process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/qestro_test',
  REDIS_URL: process.env.TEST_REDIS_URL || 'redis://localhost:6379/1',
  TIMEOUT: 30000,
};

// Test data factory
class TestDataFactory {
  static createUser(overrides = {}) {
    return {
      email: `test-${Date.now()}@example.com`,
      password: 'SecurePassword123!',
      firstName: 'Test',
      lastName: 'User',
      company: 'Test Company',
      ...overrides,
    };
  }

  static createTeam(overrides = {}) {
    return {
      name: `Test Team ${Date.now()}`,
      description: 'Integration test team',
      settings: {
        allowInvites: true,
        defaultRole: 'member',
      },
      ...overrides,
    };
  }

  static createProject(overrides = {}) {
    return {
      name: `Test Project ${Date.now()}`,
      description: 'Integration test project',
      type: 'web',
      settings: {
        framework: 'react',
        targetPlatform: 'chrome',
      },
      ...overrides,
    };
  }

  static createTestCase(overrides = {}) {
    return {
      name: `Test Case ${Date.now()}`,
      description: 'Integration test case',
      type: 'e2e',
      priority: 'medium',
      steps: [
        {
          action: 'Navigate to homepage',
          expected: 'Homepage loads successfully',
          timeout: 5000,
        },
      ],
      ...overrides,
    };
  }
}

// Database helper
class DatabaseHelper {
  private db: Pool;
  private redis: Redis;

  constructor() {
    this.db = new Pool({
      connectionString: TEST_CONFIG.DATABASE_URL,
      max: 20,
    });
    this.redis = new Redis(TEST_CONFIG.REDIS_URL);
  }

  async cleanup(): Promise<void> {
    const client = await this.db.connect();
    try {
      // Clean up in proper order to avoid foreign key constraints
      await client.query('DELETE FROM test_results');
      await client.query('DELETE FROM test_runs');
      await client.query('DELETE FROM test_cases');
      await client.query('DELETE FROM test_suites');
      await client.query('DELETE FROM project_members');
      await client.query('DELETE FROM projects');
      await client.query('DELETE FROM team_members');
      await client.query('DELETE FROM teams');
      await client.query('DELETE FROM subscriptions');
      await client.query('DELETE FROM user_sessions');
      await client.query('DELETE FROM users WHERE email LIKE \'test-%@example.com\'');

      // Clear Redis cache
      await this.redis.flushdb();
    } finally {
      client.release();
    }
  }

  async createTestUser(userData = TestDataFactory.createUser()) {
    const hashedPassword = await new TokenService().hashPassword(userData.password);

    const result = await this.db.query(`
      INSERT INTO users (email, password_hash, first_name, last_name, company, email_verified, status)
      VALUES ($1, $2, $3, $4, $5, true, 'active')
      RETURNING id, email, first_name, last_name, company
    `, [userData.email, hashedPassword, userData.firstName, userData.lastName, userData.company]);

    return result.rows[0];
  }

  async createTestTeam(ownerId: string, teamData = TestDataFactory.createTeam()) {
    const result = await this.db.query(`
      INSERT INTO teams (name, description, owner_id, settings)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [teamData.name, teamData.description, ownerId, teamData.settings]);

    const team = result.rows[0];

    // Add owner as admin
    await this.db.query(`
      INSERT INTO team_members (team_id, user_id, role, permissions)
      VALUES ($1, $2, 'admin', '["*"]')
    `, [team.id, ownerId]);

    return team;
  }

  async createTestProject(ownerId: string, teamId: string, projectData = TestDataFactory.createProject()) {
    const result = await this.db.query(`
      INSERT INTO projects (name, description, owner_id, team_id, type, settings, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'active')
      RETURNING *
    `, [
      projectData.name,
      projectData.description,
      ownerId,
      teamId,
      projectData.type,
      projectData.settings,
    ]);

    const project = result.rows[0];

    // Add owner as admin
    await this.db.query(`
      INSERT INTO project_members (project_id, user_id, role, permissions)
      VALUES ($1, $2, 'admin', '["*"]')
    `, [project.id, ownerId]);

    return project;
  }

  async close(): Promise<void> {
    await this.db.end();
    await this.redis.quit();
  }
}

// WebSocket test helper
class WebSocketHelper {
  private connections: WebSocket[] = [];

  async createConnection(token?: string): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(TEST_CONFIG.WS_URL);

      const timeout = setTimeout(() => {
        ws.terminate();
        reject(new Error('WebSocket connection timeout'));
      }, 5000);

      ws.on('open', () => {
        clearTimeout(timeout);

        if (token) {
          ws.send(JSON.stringify({
            type: 'auth',
            token,
          }));
        }

        this.connections.push(ws);
        resolve(ws);
      });

      ws.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  async waitForMessage(ws: WebSocket, expectedType?: string, timeout = 5000): Promise<any> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Message timeout'));
      }, timeout);

      ws.once('message', (data) => {
        clearTimeout(timer);
        const message = JSON.parse(data.toString());

        if (expectedType && message.type !== expectedType) {
          reject(new Error(`Expected message type ${expectedType}, got ${message.type}`));
          return;
        }

        resolve(message);
      });
    });
  }

  async closeAll(): Promise<void> {
    for (const ws of this.connections) {
      ws.terminate();
    }
    this.connections = [];
  }
}

// API test helper
class APIHelper {
  private accessToken: string = '';
  private refreshToken: string = '';
  private userId: string = '';

  async login(email: string, password: string): Promise<void> {
    const response = await request(TEST_CONFIG.API_BASE_URL)
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);

    this.accessToken = response.body.data.tokens.accessToken;
    this.refreshToken = response.body.data.tokens.refreshToken;
    this.userId = response.body.data.user.id;
  }

  async register(userData: TestDataFactory): Promise<void> {
    const response = await request(TEST_CONFIG.API_BASE_URL)
      .post('/api/auth/register')
      .send(userData)
      .expect(201);

    this.accessToken = response.body.data.tokens.accessToken;
    this.refreshToken = response.body.data.tokens.refreshToken;
    this.userId = response.body.data.user.id;
  }

  getAuthHeaders() {
    return {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  async refreshToken(): Promise<void> {
    const response = await request(TEST_CONFIG.API_BASE_URL)
      .post('/api/auth/refresh')
      .send({ refreshToken: this.refreshToken })
      .expect(200);

    this.accessToken = response.body.data.tokens.accessToken;
    this.refreshToken = response.body.data.tokens.refreshToken;
  }

  async logout(): Promise<void> {
    await request(TEST_CONFIG.API_BASE_URL)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${this.accessToken}`)
      .send({ refreshToken: this.refreshToken })
      .expect(200);

    this.accessToken = '';
    this.refreshToken = '';
    this.userId = '';
  }
}

// Main integration test framework
class IntegrationTestFramework {
  private dbHelper: DatabaseHelper;
  private wsHelper: WebSocketHelper;
  private apiHelpers: Map<string, APIHelper> = new Map();

  constructor() {
    this.dbHelper = new DatabaseHelper();
    this.wsHelper = new WebSocketHelper();
  }

  async setup(): Promise<void> {
    // Clean up any existing test data
    await this.dbHelper.cleanup();

    // Setup test environment
    await this.setupTestEnvironment();
  }

  async teardown(): Promise<void> {
    // Close WebSocket connections
    await this.wsHelper.closeAll();

    // Clean up database
    await this.dbHelper.cleanup();

    // Close database connections
    await this.dbHelper.close();
  }

  private async setupTestEnvironment(): Promise<void> {
    // Any additional test environment setup
    logger.info('Setting up integration test environment');
  }

  createAPIHelper(name: string = 'default'): APIHelper {
    const helper = new APIHelper();
    this.apiHelpers.set(name, helper);
    return helper;
  }

  getAPIHelper(name: string = 'default'): APIHelper {
    const helper = this.apiHelpers.get(name);
    if (!helper) {
      throw new Error(`API helper '${name}' not found`);
    }
    return helper;
  }

  getDbHelper(): DatabaseHelper {
    return this.dbHelper;
  }

  getWsHelper(): WebSocketHelper {
    return this.wsHelper;
  }

  async createAuthenticatedUser(userData = TestDataFactory.createUser()): Promise<{
    user: any;
    apiHelper: APIHelper;
  }> {
    const apiHelper = this.createAPIHelper();
    await apiHelper.register(userData);

    const user = await this.dbHelper.createTestUser(userData);

    return { user, apiHelper };
  }

  async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Global test framework instance
let testFramework: IntegrationTestFramework;

// Jest setup and teardown
beforeAll(async () => {
  testFramework = new IntegrationTestFramework();
  await testFramework.setup();
}, 60000);

afterAll(async () => {
  await testFramework.teardown();
}, 30000);

beforeEach(async () => {
  // Clean up before each test
  await testFramework.getDbHelper().cleanup();
});

// Export for use in test files
export {
  IntegrationTestFramework,
  TestDataFactory,
  DatabaseHelper,
  WebSocketHelper,
  APIHelper,
  TEST_CONFIG,
  testFramework,
};

// Test utilities
export const createTestSuite = (name: string, tests: () => void) => {
  describe(name, tests);
};

export const expectAPIResponse = (response: any, expectedStatus: number = 200) => {
  expect(response.status).toBe(expectedStatus);
  expect(response.body).toHaveProperty('success');
  expect(response.body.success).toBe(expectedStatus < 400);
};

export const expectValidUser = (user: any) => {
  expect(user).toHaveProperty('id');
  expect(user).toHaveProperty('email');
  expect(user).toHaveProperty('firstName');
  expect(user).toHaveProperty('lastName');
  expect(user).not.toHaveProperty('password');
  expect(user).not.toHaveProperty('passwordHash');
};

export const expectValidProject = (project: any) => {
  expect(project).toHaveProperty('id');
  expect(project).toHaveProperty('name');
  expect(project).toHaveProperty('type');
  expect(project).toHaveProperty('status');
  expect(project).toHaveProperty('permissions');
};

export const expectValidTeam = (team: any) => {
  expect(team).toHaveProperty('id');
  expect(team).toHaveProperty('name');
  expect(team).toHaveProperty('ownerId');
  expect(team).toHaveProperty('settings');
};

// Performance testing utilities
export const measureResponseTime = async (operation: () => Promise<any>): Promise<{
  result: any;
  responseTime: number;
}> => {
  const start = Date.now();
  const result = await operation();
  const responseTime = Date.now() - start;

  return { result, responseTime };
};

export const expectPerformanceThreshold = (responseTime: number, threshold: number) => {
  expect(responseTime).toBeLessThan(threshold);
};

// Load testing utilities
export const runLoadTest = async (
  operation: () => Promise<any>,
  concurrency: number,
  iterations: number
): Promise<{
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  maxResponseTime: number;
  minResponseTime: number;
}> => {
  const results: number[] = [];
  let successfulRequests = 0;
  let failedRequests = 0;

  const runBatch = async (batchSize: number) => {
    const promises = Array(batchSize).fill(null).map(async () => {
      try {
        const start = Date.now();
        await operation();
        const responseTime = Date.now() - start;
        results.push(responseTime);
        successfulRequests++;
      } catch (error) {
        failedRequests++;
      }
    });

    await Promise.all(promises);
  };

  // Run in batches to control concurrency
  for (let i = 0; i < iterations; i += concurrency) {
    const batchSize = Math.min(concurrency, iterations - i);
    await runBatch(batchSize);
  }

  return {
    totalRequests: iterations,
    successfulRequests,
    failedRequests,
    averageResponseTime: results.length > 0 ? results.reduce((a, b) => a + b, 0) / results.length : 0,
    maxResponseTime: results.length > 0 ? Math.max(...results) : 0,
    minResponseTime: results.length > 0 ? Math.min(...results) : 0,
  };
};

// WebSocket testing utilities
export const expectWebSocketMessage = async (
  ws: WebSocket,
  expectedType: string,
  timeout: number = 5000
): Promise<any> => {
  const message = await testFramework.getWsHelper().waitForMessage(ws, expectedType, timeout);
  expect(message).toHaveProperty('type', expectedType);
  return message;
};

export const sendWebSocketMessage = (ws: WebSocket, message: any): Promise<void> => {
  return new Promise((resolve, reject) => {
    ws.send(JSON.stringify(message));
    resolve();
  });
};

// Database testing utilities
export const expectDatabaseRecord = async (
  table: string,
  conditions: Record<string, any>,
  expectedFields?: Record<string, any>
): Promise<any> => {
  const dbHelper = testFramework.getDbHelper();
  const client = await dbHelper['db'].connect();

  try {
    const whereClause = Object.keys(conditions).map((key, index) => `${key} = $${index + 1}`).join(' AND ');
    const values = Object.values(conditions);

    const result = await client.query(`SELECT * FROM ${table} WHERE ${whereClause}`, values);

    expect(result.rows.length).toBeGreaterThan(0);

    if (expectedFields) {
      const record = result.rows[0];
      for (const [field, value] of Object.entries(expectedFields)) {
        expect(record[field]).toEqual(value);
      }
    }

    return result.rows[0];
  } finally {
    client.release();
  }
};

export const expectNoDatabaseRecord = async (
  table: string,
  conditions: Record<string, any>
): Promise<void> => {
  const dbHelper = testFramework.getDbHelper();
  const client = await dbHelper['db'].connect();

  try {
    const whereClause = Object.keys(conditions).map((key, index) => `${key} = $${index + 1}`).join(' AND ');
    const values = Object.values(conditions);

    const result = await client.query(`SELECT * FROM ${table} WHERE ${whereClause}`, values);

    expect(result.rows.length).toBe(0);
  } finally {
    client.release();
  }
};
