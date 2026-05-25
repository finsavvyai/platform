/**
 * Data Seeding Test Worker
 * Tests the development data seeding functionality
 */

import { DataSeeder, seedDevelopmentData } from './scripts/seed-development-data';

export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    try {
      if (url.pathname === '/') {
        return new Response(`
          <html>
            <head><title>Questro Data Seeding Test</title></head>
            <body>
              <h1>🌱 Questro Data Seeding Test</h1>
              <h2>Available Endpoints:</h2>
              <ul>
                <li><a href="/seed">/seed</a> - Seed development data</li>
                <li><a href="/seed-clear">/seed-clear</a> - Clear and seed fresh data</li>
                <li><a href="/seed-status">/seed-status</a> - Check seeding status</li>
                <li><a href="/seed-validate">/seed-validate</a> - Validate seeded data</li>
              </ul>
            </body>
          </html>
        `, { headers: { 'Content-Type': 'text/html' } });
      }

      if (url.pathname === '/seed') {
        return await seedData(env.DB, false);
      }

      if (url.pathname === '/seed-clear') {
        return await seedData(env.DB, true);
      }

      if (url.pathname === '/seed-status') {
        return await checkSeedingStatus(env.DB);
      }

      if (url.pathname === '/seed-validate') {
        return await validateSeededData(env.DB);
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

// Seed data endpoint
async function seedData(db: D1Database, clear: boolean = false) {
  const startTime = Date.now();

  try {
    if (clear) {
      const seeder = new DataSeeder(db);
      await seeder.clearAll();
    }

    await seedDevelopmentData(db, { clear });
    const duration = Date.now() - startTime;

    return Response.json({
      success: true,
      action: clear ? 'cleared-and-seeded' : 'seeded',
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
      message: `Development data ${clear ? 'cleared and ' : ''}seeded successfully!`
    });

  } catch (error) {
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: `${Date.now() - startTime}ms`,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// Check seeding status
async function checkSeedingStatus(db: D1Database) {
  const startTime = Date.now();

  try {
    const { drizzle } = await import('drizzle-orm/d1');
    const * as schema = await import('./db/schema');
    const dbClient = drizzle(db, { schema });

    const [users, projects, testSuites, testCases, testRuns, testResults] = await Promise.all([
      dbClient.select().from(schema.users),
      dbClient.select().from(schema.projects),
      dbClient.select().from(schema.testSuites),
      dbClient.select().from(schema.testCases),
      dbClient.select().from(schema.testRuns),
      dbClient.select().from(schema.testResults)
    ]);

    const duration = Date.now() - startTime;

    return Response.json({
      success: true,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
      data: {
        users: {
          count: users.length,
          sample: users.slice(0, 3).map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role }))
        },
        projects: {
          count: projects.length,
          sample: projects.slice(0, 3).map(p => ({ id: p.id, name: p.name, platform: p.platform, status: p.status }))
        },
        testSuites: {
          count: testSuites.length,
          sample: testSuites.slice(0, 3).map(ts => ({ id: ts.id, name: ts.name, priority: ts.priority, status: ts.status }))
        },
        testCases: {
          count: testCases.length,
          sample: testCases.slice(0, 3).map(tc => ({ id: tc.id, name: tc.name, priority: tc.priority, status: tc.status }))
        },
        testRuns: {
          count: testRuns.length,
          sample: testRuns.slice(0, 3).map(tr => ({ id: tr.id, name: tr.name, status: tr.status, triggeredBy: tr.triggeredBy }))
        },
        testResults: {
          count: testResults.length,
          sample: testResults.slice(0, 3).map(tr => ({ id: tr.id, status: tr.status, duration: tr.duration }))
        }
      },
      summary: {
        totalRecords: users.length + projects.length + testSuites.length + testCases.length + testRuns.length + testResults.length,
        isSeeded: users.length > 0 && projects.length > 0
      }
    });

  } catch (error) {
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: `${Date.now() - startTime}ms`,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// Validate seeded data integrity
async function validateSeededData(db: D1Database) {
  const startTime = Date.now();
  const validationResults = {
    passed: 0,
    failed: 0,
    errors: [] as string[],
    warnings: [] as string[]
  };

  try {
    const { drizzle } = await import('drizzle-orm/d1');
    const { eq, count } = await import('drizzle-orm');
    const * as schema = await import('./db/schema');
    const dbClient = drizzle(db, { schema });

    // Validation 1: Check minimum data counts
    const [userCount, projectCount, testCaseCount] = await Promise.all([
      dbClient.select({ count: count() }).from(schema.users),
      dbClient.select({ count: count() }).from(schema.projects),
      dbClient.select({ count: count() }).from(schema.testCases)
    ]);

    if (userCount[0].count >= 5) {
      validationResults.passed++;
    } else {
      validationResults.failed++;
      validationResults.errors.push(`Expected at least 5 users, found ${userCount[0].count}`);
    }

    if (projectCount[0].count >= 3) {
      validationResults.passed++;
    } else {
      validationResults.failed++;
      validationResults.errors.push(`Expected at least 3 projects, found ${projectCount[0].count}`);
    }

    if (testCaseCount[0].count >= 5) {
      validationResults.passed++;
    } else {
      validationResults.failed++;
      validationResults.errors.push(`Expected at least 5 test cases, found ${testCaseCount[0].count}`);
    }

    // Validation 2: Check data relationships
    const usersWithProjects = await dbClient
      .select({ userId: schema.users.id })
      .from(schema.users)
      .innerJoin(schema.projects, eq(schema.users.id, schema.projects.createdBy));

    if (usersWithProjects.length > 0) {
      validationResults.passed++;
    } else {
      validationResults.failed++;
      validationResults.errors.push('No users associated with projects found');
    }

    // Validation 3: Check required admin user
    const adminUser = await dbClient
      .select()
      .from(schema.users)
      .where(eq(schema.users.role, 'admin'))
      .limit(1);

    if (adminUser.length > 0) {
      validationResults.passed++;
    } else {
      validationResults.failed++;
      validationResults.errors.push('No admin user found');
    }

    // Validation 4: Check test case completeness
    const testCasesWithSteps = await dbClient
      .select()
      .from(schema.testCases)
      .where(eq(schema.testCases.status, 'active'));

    const casesWithSteps = testCasesWithSteps.filter(tc => tc.steps && tc.steps.length > 0);

    if (casesWithSteps.length >= testCasesWithSteps.length * 0.8) {
      validationResults.passed++;
    } else {
      validationResults.warnings.push('Some test cases may not have detailed steps');
    }

    const duration = Date.now() - startTime;
    const isValid = validationResults.failed === 0;

    return Response.json({
      success: isValid,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
      validation: {
        ...validationResults,
        totalTests: validationResults.passed + validationResults.failed,
        successRate: validationResults.passed / (validationResults.passed + validationResults.failed) * 100
      },
      status: isValid ? 'All validations passed! ✅' : 'Some validations failed! ❌',
      recommendations: validationResults.warnings.length > 0 ? 'Review warnings for data quality improvements' : 'Data quality looks good!'
    });

  } catch (error) {
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: `${Date.now() - startTime}ms`,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
