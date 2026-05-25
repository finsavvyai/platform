import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { apiTestCases, projects, users } from '../../schema';
import { eq } from 'drizzle-orm';

// Test database connection
const testConnectionString = process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/questro_test';
const client = postgres(testConnectionString);
const db = drizzle(client);

describe('API Test Cases Model', () => {
  let testUser: any;
  let testProject: any;

  beforeAll(async () => {
    // Create test user
    const [user] = await db.insert(users).values({
      email: 'test-api@questro.com',
      password: 'hashed_password',
      firstName: 'API',
      lastName: 'Tester',
      role: 'user'
    }).returning();
    testUser = user;

    // Create test project
    const [project] = await db.insert(projects).values({
      userId: testUser.id,
      name: 'API Test Project',
      description: 'Project for API testing',
      type: 'web',
      platform: 'api'
    }).returning();
    testProject = project;
  });

  afterAll(async () => {
    // Clean up test data
    await db.delete(apiTestCases).where(eq(apiTestCases.projectId, testProject.id));
    await db.delete(projects).where(eq(projects.id, testProject.id));
    await db.delete(users).where(eq(users.id, testUser.id));
    await client.end();
  });

  beforeEach(async () => {
    // Clean up API test cases before each test
    await db.delete(apiTestCases).where(eq(apiTestCases.projectId, testProject.id));
  });

  describe('Creation and Basic Operations', () => {
    it('should create a basic API test case', async () => {
      const apiTestData = {
        projectId: testProject.id,
        userId: testUser.id,
        name: 'Get User Profile',
        description: 'Test getting user profile information',
        method: 'GET',
        endpoint: '/api/users/profile',
        headers: {
          'Authorization': 'Bearer {{token}}',
          'Accept': 'application/json'
        },
        statusCodeValidation: {
          expected: [200],
          rules: [
            { condition: 'authenticated', expectedStatus: 200 }
          ]
        },
        category: 'User Management',
        priority: 'high'
      };

      const [created] = await db.insert(apiTestCases).values(apiTestData).returning();

      expect(created).toBeDefined();
      expect(created.name).toBe('Get User Profile');
      expect(created.method).toBe('GET');
      expect(created.endpoint).toBe('/api/users/profile');
      expect(created.priority).toBe('high');
      expect(created.isActive).toBe(true);
    });

    it('should create API test case with POST method and request body', async () => {
      const apiTestData = {
        projectId: testProject.id,
        userId: testUser.id,
        name: 'Create User',
        description: 'Test user creation endpoint',
        method: 'POST',
        endpoint: '/api/users',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer {{adminToken}}'
        },
        requestBody: {
          email: '{{userEmail}}',
          firstName: '{{firstName}}',
          lastName: '{{lastName}}',
          role: 'user'
        },
        statusCodeValidation: {
          expected: [201, 400, 409],
          rules: [
            { condition: 'valid_data', expectedStatus: 201 },
            { condition: 'invalid_data', expectedStatus: 400 },
            { condition: 'duplicate_email', expectedStatus: 409 }
          ]
        },
        responseSchemaValidation: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            role: { type: 'string', enum: ['user', 'admin'] },
            createdAt: { type: 'string', format: 'date-time' }
          },
          required: ['id', 'email', 'role']
        }
      };

      const [created] = await db.insert(apiTestCases).values(apiTestData).returning();

      expect(created.method).toBe('POST');
      expect(created.requestBody).toMatchObject({
        email: '{{userEmail}}',
        role: 'user'
      });
      expect((created.responseSchemaValidation as any).properties.id).toMatchObject({
        type: 'string',
        format: 'uuid'
      });
    });

    it('should create API test case with comprehensive validations', async () => {
      const apiTestData = {
        projectId: testProject.id,
        userId: testUser.id,
        name: 'Login API Test',
        method: 'POST',
        endpoint: '/api/auth/login',
        statusCodeValidation: {
          expected: [200, 401, 422],
          rules: [
            { condition: 'valid_credentials', expectedStatus: 200 },
            { condition: 'invalid_credentials', expectedStatus: 401 },
            { condition: 'missing_fields', expectedStatus: 422 }
          ]
        },
        responseTimeValidation: {
          maxResponseTime: 2000,
          warningThreshold: 1000
        },
        customValidations: [
          {
            name: 'Token Format',
            rule: 'response.token && response.token.startsWith("Bearer ")',
            errorMessage: 'Token should start with "Bearer "'
          },
          {
            name: 'User Object Present',
            rule: 'response.user && response.user.id',
            errorMessage: 'Response should contain user object with id'
          }
        ],
        retryConfig: {
          maxRetries: 3,
          retryDelay: 1000,
          retryOnStatus: [500, 502, 503, 504]
        },
        timeoutMs: 5000,
        tags: ['authentication', 'security', 'critical']
      };

      const [created] = await db.insert(apiTestCases).values(apiTestData).returning();

      expect(created.responseTimeValidation).toMatchObject({
        maxResponseTime: 2000,
        warningThreshold: 1000
      });
      expect(created.customValidations).toHaveLength(2);
      expect(created.retryConfig).toMatchObject({
        maxRetries: 3,
        retryDelay: 1000
      });
      expect(created.tags).toContain('authentication');
      expect(created.timeoutMs).toBe(5000);
    });
  });

  describe('Dependencies and Prerequisites', () => {
    it('should create API test case with dependencies', async () => {
      const apiTestData = {
        projectId: testProject.id,
        userId: testUser.id,
        name: 'Update User Profile',
        method: 'PUT',
        endpoint: '/api/users/{{userId}}',
        statusCodeValidation: {
          expected: [200, 404, 403]
        },
        prerequisites: [
          {
            type: 'authentication',
            description: 'User must be authenticated'
          },
          {
            type: 'user_exists',
            description: 'Target user must exist in database'
          }
        ],
        dependencies: [
          {
            testCaseId: 'login_test',
            extractVariable: 'authToken',
            fromResponse: 'token'
          },
          {
            testCaseId: 'create_user_test',
            extractVariable: 'userId',
            fromResponse: 'id'
          }
        ]
      };

      const [created] = await db.insert(apiTestCases).values(apiTestData).returning();

      expect(created.prerequisites).toHaveLength(2);
      expect(created.dependencies).toHaveLength(2);
      expect(created.prerequisites[0]).toMatchObject({
        type: 'authentication',
        description: 'User must be authenticated'
      });
      expect(created.dependencies[0]).toMatchObject({
        testCaseId: 'login_test',
        extractVariable: 'authToken'
      });
    });
  });

  describe('Query Parameters and Headers', () => {
    it('should handle query parameters correctly', async () => {
      const apiTestData = {
        projectId: testProject.id,
        userId: testUser.id,
        name: 'Search Users',
        method: 'GET',
        endpoint: '/api/users/search',
        queryParams: {
          q: '{{searchQuery}}',
          limit: 10,
          offset: 0,
          sort: 'createdAt',
          order: 'desc'
        },
        headers: {
          'Authorization': 'Bearer {{token}}',
          'Accept': 'application/json',
          'X-Request-ID': '{{requestId}}'
        },
        statusCodeValidation: {
          expected: [200, 400]
        }
      };

      const [created] = await db.insert(apiTestCases).values(apiTestData).returning();

      expect(created.queryParams).toMatchObject({
        q: '{{searchQuery}}',
        limit: 10,
        sort: 'createdAt'
      });
      expect(created.headers).toMatchObject({
        'Authorization': 'Bearer {{token}}',
        'Accept': 'application/json'
      });
    });
  });

  describe('Relationships and Constraints', () => {
    it('should maintain foreign key relationships', async () => {
      const apiTestData = {
        projectId: testProject.id,
        userId: testUser.id,
        name: 'Test API',
        method: 'GET',
        endpoint: '/api/test',
        statusCodeValidation: { expected: [200] }
      };

      const [created] = await db.insert(apiTestCases).values(apiTestData).returning();

      // Verify relationships by joining
      const result = await db
        .select({
          testName: apiTestCases.name,
          projectName: projects.name,
          userEmail: users.email
        })
        .from(apiTestCases)
        .innerJoin(projects, eq(apiTestCases.projectId, projects.id))
        .innerJoin(users, eq(apiTestCases.userId, users.id))
        .where(eq(apiTestCases.id, created.id));

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        testName: 'Test API',
        projectName: 'API Test Project',
        userEmail: 'test-api@questro.com'
      });
    });

    it('should cascade delete when project is deleted', async () => {
      // Create temporary project and API test case
      const [tempProject] = await db.insert(projects).values({
        userId: testUser.id,
        name: 'Temp API Project',
        type: 'web'
      }).returning();

      const [apiTest] = await db.insert(apiTestCases).values({
        projectId: tempProject.id,
        userId: testUser.id,
        name: 'Temp API Test',
        method: 'GET',
        endpoint: '/api/temp',
        statusCodeValidation: { expected: [200] }
      }).returning();

      // Delete the project
      await db.delete(projects).where(eq(projects.id, tempProject.id));

      // Verify API test case was cascade deleted
      const remaining = await db
        .select()
        .from(apiTestCases)
        .where(eq(apiTestCases.id, apiTest.id));

      expect(remaining).toHaveLength(0);
    });
  });

  describe('Data Validation and Defaults', () => {
    it('should apply default values correctly', async () => {
      const minimalData = {
        projectId: testProject.id,
        userId: testUser.id,
        name: 'Minimal API Test',
        method: 'GET',
        endpoint: '/api/minimal',
        statusCodeValidation: { expected: [200] }
      };

      const [created] = await db.insert(apiTestCases).values(minimalData).returning();

      expect(created.headers).toEqual({});
      expect(created.queryParams).toEqual({});
      expect(created.customValidations).toEqual([]);
      expect(created.retryConfig).toEqual({});
      expect(created.prerequisites).toEqual([]);
      expect(created.dependencies).toEqual([]);
      expect(created.tags).toEqual([]);
      expect(created.priority).toBe('medium');
      expect(created.timeoutMs).toBe(30000);
      expect(created.isActive).toBe(true);
    });

    it('should handle timestamp fields correctly', async () => {
      const apiTestData = {
        projectId: testProject.id,
        userId: testUser.id,
        name: 'Timestamp Test',
        method: 'GET',
        endpoint: '/api/timestamp',
        statusCodeValidation: { expected: [200] }
      };

      const [created] = await db.insert(apiTestCases).values(apiTestData).returning();

      expect(created.createdAt).toBeInstanceOf(Date);
      expect(created.updatedAt).toBeInstanceOf(Date);
      expect(created.createdAt.getTime()).toBeLessThanOrEqual(Date.now());
      expect(created.updatedAt.getTime()).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('Filtering and Querying', () => {
    beforeEach(async () => {
      // Create multiple API test cases for testing
      await db.insert(apiTestCases).values([
        {
          projectId: testProject.id,
          userId: testUser.id,
          name: 'GET Test',
          method: 'GET',
          endpoint: '/api/get',
          statusCodeValidation: { expected: [200] },
          category: 'Read Operations',
          priority: 'high'
        },
        {
          projectId: testProject.id,
          userId: testUser.id,
          name: 'POST Test',
          method: 'POST',
          endpoint: '/api/post',
          statusCodeValidation: { expected: [201] },
          category: 'Write Operations',
          priority: 'medium'
        }
      ]);
    });

    it('should filter by HTTP method', async () => {
      const getTests = await db
        .select()
        .from(apiTestCases)
        .where(eq(apiTestCases.method, 'GET'));

      const postTests = await db
        .select()
        .from(apiTestCases)
        .where(eq(apiTestCases.method, 'POST'));

      expect(getTests.length).toBeGreaterThan(0);
      expect(postTests.length).toBeGreaterThan(0);
      expect(getTests[0].method).toBe('GET');
      expect(postTests[0].method).toBe('POST');
    });

    it('should filter by category and priority', async () => {
      const highPriorityTests = await db
        .select()
        .from(apiTestCases)
        .where(eq(apiTestCases.priority, 'high'));

      const readOperationTests = await db
        .select()
        .from(apiTestCases)
        .where(eq(apiTestCases.category, 'Read Operations'));

      expect(highPriorityTests.length).toBeGreaterThan(0);
      expect(readOperationTests.length).toBeGreaterThan(0);
      expect(highPriorityTests[0].priority).toBe('high');
      expect(readOperationTests[0].category).toBe('Read Operations');
    });
  });
});