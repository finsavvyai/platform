import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { apiTestCases, projects, users } from '../schema/index.js';

export async function seedApiTestCases(
  db: PostgresJsDatabase<any>,
  seedUsers: any[],
  seedProjects: any[]
) {
  console.log('🔗 Seeding API test cases...');

  const sampleApiTestCases = [
    {
      projectId: seedProjects[0].id,
      userId: seedUsers[0].id,
      name: 'User Authentication API Test',
      description: 'Test user login endpoint with various scenarios',
      method: 'POST',
      endpoint: '/api/auth/login',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      requestBody: {
        email: '{{email}}',
        password: '{{password}}'
      },
      statusCodeValidation: {
        expected: [200, 401],
        rules: [
          { condition: 'valid_credentials', expectedStatus: 200 },
          { condition: 'invalid_credentials', expectedStatus: 401 }
        ]
      },
      responseSchemaValidation: {
        type: 'object',
        properties: {
          token: { type: 'string' },
          user: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              email: { type: 'string' },
              role: { type: 'string' }
            }
          }
        },
        required: ['token', 'user']
      },
      responseTimeValidation: {
        maxResponseTime: 2000,
        warningThreshold: 1000
      },
      customValidations: [
        {
          name: 'Token Format Validation',
          rule: 'response.token.startsWith("Bearer ")',
          errorMessage: 'Token should start with "Bearer "'
        }
      ],
      retryConfig: {
        maxRetries: 3,
        retryDelay: 1000,
        retryOnStatus: [500, 502, 503, 504]
      },
      prerequisites: [
        {
          type: 'database_setup',
          description: 'Ensure test user exists in database'
        }
      ],
      tags: ['authentication', 'security', 'critical'],
      category: 'Authentication',
      priority: 'high'
    },
    {
      projectId: seedProjects[0].id,
      userId: seedUsers[0].id,
      name: 'Get User Profile API Test',
      description: 'Test retrieving user profile information',
      method: 'GET',
      endpoint: '/api/users/profile',
      headers: {
        'Authorization': 'Bearer {{token}}',
        'Accept': 'application/json'
      },
      statusCodeValidation: {
        expected: [200, 401, 403],
        rules: [
          { condition: 'valid_token', expectedStatus: 200 },
          { condition: 'invalid_token', expectedStatus: 401 },
          { condition: 'expired_token', expectedStatus: 401 }
        ]
      },
      responseSchemaValidation: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          email: { type: 'string', format: 'email' },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          role: { type: 'string', enum: ['user', 'admin', 'enterprise'] },
          createdAt: { type: 'string', format: 'date-time' }
        },
        required: ['id', 'email', 'role']
      },
      responseTimeValidation: {
        maxResponseTime: 1500,
        warningThreshold: 800
      },
      customValidations: [
        {
          name: 'Email Format Validation',
          rule: 'response.email.includes("@")',
          errorMessage: 'Email should contain @ symbol'
        }
      ],
      dependencies: [
        {
          testCaseId: 'auth_login_test',
          extractVariable: 'token',
          fromResponse: 'token'
        }
      ],
      tags: ['user-management', 'profile', 'medium'],
      category: 'User Management',
      priority: 'medium'
    },
    {
      projectId: seedProjects[1]?.id || seedProjects[0].id,
      userId: seedUsers[1]?.id || seedUsers[0].id,
      name: 'Create Project API Test',
      description: 'Test project creation endpoint',
      method: 'POST',
      endpoint: '/api/projects',
      headers: {
        'Authorization': 'Bearer {{token}}',
        'Content-Type': 'application/json'
      },
      requestBody: {
        name: '{{projectName}}',
        description: '{{projectDescription}}',
        type: 'web',
        platform: 'chrome'
      },
      statusCodeValidation: {
        expected: [201, 400, 401, 403],
        rules: [
          { condition: 'valid_data', expectedStatus: 201 },
          { condition: 'invalid_data', expectedStatus: 400 },
          { condition: 'unauthorized', expectedStatus: 401 }
        ]
      },
      responseSchemaValidation: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          type: { type: 'string' },
          platform: { type: 'string' },
          userId: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' }
        },
        required: ['id', 'name', 'type', 'userId']
      },
      responseTimeValidation: {
        maxResponseTime: 3000,
        warningThreshold: 1500
      },
      customValidations: [
        {
          name: 'Project Name Length',
          rule: 'response.name.length >= 3 && response.name.length <= 255',
          errorMessage: 'Project name should be between 3 and 255 characters'
        }
      ],
      tags: ['project-management', 'creation', 'medium'],
      category: 'Project Management',
      priority: 'medium'
    }
  ];

  try {
    const insertedApiTestCases = await db.insert(apiTestCases).values(sampleApiTestCases).returning();
    console.log(`✅ Seeded ${insertedApiTestCases.length} API test cases`);
    return insertedApiTestCases;
  } catch (error) {
    console.error('❌ Error seeding API test cases:', error);
    throw error;
  }
}