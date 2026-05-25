/**
 * Database Service Test Worker
 * Tests the complete database service layer implementation
 */

import { DatabaseService, initializeDatabaseService } from './services/database-service';
import { eq } from 'drizzle-orm';
import * as schema from './db/schema';

export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Initialize database service
    const dbService = initializeDatabaseService(env.DB);

    try {
      // Route handling
      if (url.pathname === '/') {
        return new Response(`
          <html>
            <head><title>Questro Database Service Test</title></head>
            <body>
              <h1>🗄️ Questro Database Service Test</h1>
              <h2>Available Endpoints:</h2>
              <ul>
                <li><a href="/health">/health</a> - Database health check</li>
                <li><a href="/test-operations">/test-operations</a> - Test CRUD operations</li>
                <li><a href="/test-relationships">/test-relationships</a> - Test data relationships</li>
                <li><a href="/test-analytics">/test-analytics</a> - Test analytics functions</li>
                <li><a href="/test-search">/test-search</a> - Test search functionality</li>
                <li><a href="/test-performance">/test-performance</a> - Performance benchmarks</li>
              </ul>
            </body>
          </html>
        `, { headers: { 'Content-Type': 'text/html' } });
      }

      if (url.pathname === '/health') {
        const startTime = Date.now();
        const health = await dbService.healthCheck();
        const totalTime = Date.now() - startTime;

        return Response.json({
          service: 'DatabaseService',
          health,
          responseTime: `${totalTime}ms`,
          timestamp: new Date().toISOString()
        });
      }

      if (url.pathname === '/test-operations') {
        return await testCrudOperations(dbService);
      }

      if (url.pathname === '/test-relationships') {
        return await testRelationships(dbService, env.DB);
      }

      if (url.pathname === '/test-analytics') {
        return await testAnalytics(dbService);
      }

      if (url.pathname === '/test-search') {
        return await testSearchFunctionality(dbService);
      }

      if (url.pathname === '/test-performance') {
        return await testPerformance(dbService);
      }

      return new Response('Not found', { status: 404 });

    } catch (error) {
      console.error('Worker error:', error);
      return Response.json({
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }, { status: 500 });
    }
  }
};

// Test CRUD operations
async function testCrudOperations(dbService: DatabaseService) {
  const results = {
    createUser: null as any,
    getUser: null as any,
    createProject: null as any,
    getProject: null as any,
    createTestCase: null as any,
    getTestCase: null as any,
    errors: [] as string[]
  };

  try {
    // Test user creation
    const testUser = {
      id: `test-user-${Date.now()}`,
      email: `test-${Date.now()}@example.com`,
      name: 'Test User',
      role: 'user' as const,
      status: 'active' as const
    };

    const createdUsers = await dbService.createUser(testUser);
    results.createUser = { success: true, count: createdUsers.length };

    // Test user retrieval
    const retrievedUsers = await dbService.getUserById(testUser.id);
    results.getUser = {
      success: true,
      found: retrievedUsers.length > 0,
      name: retrievedUsers[0]?.name
    };

    // Test project creation
    const testProject = {
      id: `test-project-${Date.now()}`,
      name: 'Test Project',
      description: 'Test project for database service',
      createdBy: testUser.id,
      status: 'active' as const,
      settings: {}
    };

    const createdProjects = await dbService.createProject(testProject);
    results.createProject = { success: true, count: createdProjects.length };

    // Test project retrieval
    const retrievedProjects = await dbService.getProjectById(testProject.id);
    results.getProject = {
      success: true,
      found: retrievedProjects.length > 0,
      name: retrievedProjects[0]?.name
    };

    // Test test case creation
    const testTestCase = {
      id: `test-case-${Date.now()}`,
      name: 'Test Case',
      description: 'Test case for database service',
      projectId: testProject.id,
      testSuiteId: 'test-suite',
      status: 'active' as const,
      testData: {}
    };

    const createdTestCases = await dbService.createTestCase(testTestCase);
    results.createTestCase = { success: true, count: createdTestCases.length };

    // Test test case retrieval
    const retrievedTestCases = await dbService.getTestCaseById(testTestCase.id);
    results.getTestCase = {
      success: true,
      found: retrievedTestCases.length > 0,
      name: retrievedTestCases[0]?.name
    };

  } catch (error) {
    results.errors.push(error instanceof Error ? error.message : 'Unknown error');
  }

  return Response.json({
    test: 'CRUD Operations',
    timestamp: new Date().toISOString(),
    results
  });
}

// Test data relationships
async function testRelationships(dbService: DatabaseService, db: any) {
  const results = {
    userProjects: null as any,
    projectTestCases: null as any,
    testRuns: null as any,
    errors: [] as string[]
  };

  try {
    // Create test data
    const userId = `relation-user-${Date.now()}`;
    const projectId = `relation-project-${Date.now()}`;

    const testUser = {
      id: userId,
      email: `relation-${Date.now()}@example.com`,
      name: 'Relation Test User',
      role: 'user' as const,
      status: 'active' as const
    };

    const testProject = {
      id: projectId,
      name: 'Relation Test Project',
      description: 'Testing relationships',
      createdBy: userId,
      status: 'active' as const,
      settings: {}
    };

    const testTestCase = {
      id: `relation-case-${Date.now()}`,
      name: 'Relation Test Case',
      description: 'Testing case relationships',
      projectId: projectId,
      testSuiteId: 'test-suite',
      status: 'active' as const,
      testData: {}
    };

    // Insert test data
    await dbService.createUser(testUser);
    await dbService.createProject(testProject);
    await dbService.createTestCase(testTestCase);

    // Test user projects relationship
    const userProjects = await dbService.getProjectsByUserId(userId);
    results.userProjects = {
      success: true,
      count: userProjects.length,
      projectNames: userProjects.map(p => p.name)
    };

    // Test project test cases relationship
    const projectTestCases = await dbService.getTestCasesBySuite('test-suite');
    results.projectTestCases = {
      success: true,
      count: projectTestCases.length,
      caseNames: projectTestCases.map(c => c.name)
    };

    // Test test runs
    const testRunData = {
      id: `relation-run-${Date.now()}`,
      projectId: projectId,
      status: 'pending' as const,
      config: {}
    };

    await dbService.createTestRun(testRunData);
    const testRuns = await dbService.getTestRunsByProject(projectId);
    results.testRuns = {
      success: true,
      count: testRuns.length,
      statuses: testRuns.map(r => r.status)
    };

  } catch (error) {
    results.errors.push(error instanceof Error ? error.message : 'Unknown error');
  }

  return Response.json({
    test: 'Data Relationships',
    timestamp: new Date().toISOString(),
    results
  });
}

// Test analytics functions
async function testAnalytics(dbService: DatabaseService) {
  const results = {
    projectStats: null as any,
    errors: [] as string[]
  };

  try {
    // Create test project
    const userId = `analytics-user-${Date.now()}`;
    const projectId = `analytics-project-${Date.now()}`;

    await dbService.createUser({
      id: userId,
      email: `analytics-${Date.now()}@example.com`,
      name: 'Analytics User',
      role: 'user' as const,
      status: 'active' as const
    });

    await dbService.createProject({
      id: projectId,
      name: 'Analytics Test Project',
      description: 'Testing analytics',
      createdBy: userId,
      status: 'active' as const,
      settings: {}
    });

    // Create some test cases and runs
    for (let i = 0; i < 5; i++) {
      await dbService.createTestCase({
        id: `analytics-case-${Date.now()}-${i}`,
        name: `Analytics Test Case ${i + 1}`,
        description: `Test case ${i + 1} for analytics`,
        projectId: projectId,
        testSuiteId: 'analytics-suite',
        status: 'active' as const,
        testData: {}
      });

      await dbService.createTestRun({
        id: `analytics-run-${Date.now()}-${i}`,
        projectId: projectId,
        status: i % 2 === 0 ? 'passed' as const : 'failed' as const,
        config: {}
      });
    }

    // Test project stats
    const stats = await dbService.getProjectStats(projectId);
    results.projectStats = {
      success: true,
      stats,
      expectedTestCases: 5,
      expectedTestRuns: 5
    };

  } catch (error) {
    results.errors.push(error instanceof Error ? error.message : 'Unknown error');
  }

  return Response.json({
    test: 'Analytics Functions',
    timestamp: new Date().toISOString(),
    results
  });
}

// Test search functionality
async function testSearchFunctionality(dbService: DatabaseService) {
  const results = {
    nameSearch: null as any,
    descriptionSearch: null as any,
    noResults: null as any,
    errors: [] as string[]
  };

  try {
    // Create test project
    const userId = `search-user-${Date.now()}`;
    const projectId = `search-project-${Date.now()}`;

    await dbService.createUser({
      id: userId,
      email: `search-${Date.now()}@example.com`,
      name: 'Search User',
      role: 'user' as const,
      status: 'active' as const
    });

    await dbService.createProject({
      id: projectId,
      name: 'Search Test Project',
      description: 'Project for testing search functionality',
      createdBy: userId,
      status: 'active' as const,
      settings: {}
    });

    // Create test cases with searchable content
    const testCases = [
      {
        id: `search-case-1-${Date.now()}`,
        name: 'Login Functionality Test',
        description: 'Test the login authentication flow',
        projectId: projectId,
        testSuiteId: 'search-suite',
        status: 'active' as const,
        testData: {}
      },
      {
        id: `search-case-2-${Date.now()}`,
        name: 'User Registration Test',
        description: 'Test the user registration process',
        projectId: projectId,
        testSuiteId: 'search-suite',
        status: 'active' as const,
        testData: {}
      },
      {
        id: `search-case-3-${Date.now()}`,
        name: 'Payment Processing Test',
        description: 'Test payment gateway integration',
        projectId: projectId,
        testSuiteId: 'search-suite',
        status: 'active' as const,
        testData: {}
      }
    ];

    for (const testCase of testCases) {
      await dbService.createTestCase(testCase);
    }

    // Test name search
    const nameResults = await dbService.searchTestCases('login', projectId);
    results.nameSearch = {
      success: true,
      count: nameResults.length,
      found: nameResults.map(tc => tc.name)
    };

    // Test description search
    const descResults = await dbService.searchTestCases('payment', projectId);
    results.descriptionSearch = {
      success: true,
      count: descResults.length,
      found: descResults.map(tc => tc.name)
    };

    // Test no results
    const noResults = await dbService.searchTestCases('nonexistent', projectId);
    results.noResults = {
      success: true,
      count: noResults.length,
      expected: 0
    };

  } catch (error) {
    results.errors.push(error instanceof Error ? error.message : 'Unknown error');
  }

  return Response.json({
    test: 'Search Functionality',
    timestamp: new Date().toISOString(),
    results
  });
}

// Test performance
async function testPerformance(dbService: DatabaseService) {
  const results = {
    healthCheckTimes: [] as number[],
    crudTimes: [] as number[],
    searchTimes: [] as number[],
    analyticsTimes: [] as number[],
    errors: [] as string[]
  };

  try {
    // Test health check performance
    for (let i = 0; i < 10; i++) {
      const start = Date.now();
      await dbService.healthCheck();
      results.healthCheckTimes.push(Date.now() - start);
    }

    // Test CRUD performance
    for (let i = 0; i < 5; i++) {
      const start = Date.now();

      const userId = `perf-user-${Date.now()}-${i}`;
      await dbService.createUser({
        id: userId,
        email: `perf-${i}-${Date.now()}@example.com`,
        name: `Performance Test User ${i}`,
        role: 'user' as const,
        status: 'active' as const
      });

      await dbService.getUserById(userId);
      results.crudTimes.push(Date.now() - start);
    }

    // Calculate averages
    const avgHealthCheck = results.healthCheckTimes.reduce((a, b) => a + b, 0) / results.healthCheckTimes.length;
    const avgCrud = results.crudTimes.reduce((a, b) => a + b, 0) / results.crudTimes.length;

    return Response.json({
      test: 'Performance Benchmarks',
      timestamp: new Date().toISOString(),
      results: {
        healthCheck: {
          times: results.healthCheckTimes,
          average: avgHealthCheck,
          min: Math.min(...results.healthCheckTimes),
          max: Math.max(...results.healthCheckTimes)
        },
        crud: {
          times: results.crudTimes,
          average: avgCrud,
          min: Math.min(...results.crudTimes),
          max: Math.max(...results.crudTimes)
        },
        performanceRating: avgHealthCheck < 10 && avgCrud < 50 ? 'excellent' : 'good'
      }
    });

  } catch (error) {
    results.errors.push(error instanceof Error ? error.message : 'Unknown error');

    return Response.json({
      test: 'Performance Benchmarks',
      timestamp: new Date().toISOString(),
      results: {
        errors: results.errors
      }
    });
  }
}
