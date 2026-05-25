import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { databaseTestCases, dataSources, projects, users } from '../schema/index.js';

export async function seedDatabaseTestCases(
  db: PostgresJsDatabase<any>,
  seedUsers: any[],
  seedProjects: any[],
  seedDataSources: any[]
) {
  console.log('🗄️ Seeding database test cases...');

  const sampleDatabaseTestCases = [
    {
      projectId: seedProjects[0].id,
      userId: seedUsers[0].id,
      dataSourceId: seedDataSources[0].id,
      name: 'User Data Integrity Test',
      description: 'Verify user data integrity and constraints',
      testType: 'data-integrity',
      setupQueries: [
        {
          description: 'Create test user',
          query: "INSERT INTO users (id, email, password, role) VALUES (gen_random_uuid(), 'test@example.com', 'hashed_password', 'user')",
          expectedResult: 'success'
        }
      ],
      testQueries: [
        {
          description: 'Check user email uniqueness constraint',
          query: "SELECT COUNT(*) as count FROM users WHERE email = 'test@example.com'",
          expectedResult: { count: 1 }
        },
        {
          description: 'Verify user role constraint',
          query: "SELECT role FROM users WHERE email = 'test@example.com'",
          expectedResult: { role: 'user' }
        }
      ],
      teardownQueries: [
        {
          description: 'Clean up test user',
          query: "DELETE FROM users WHERE email = 'test@example.com'",
          expectedResult: 'success'
        }
      ],
      dataValidations: [
        {
          name: 'Email Format Validation',
          rule: 'email LIKE \'%@%\'',
          description: 'All user emails should contain @ symbol'
        },
        {
          name: 'Password Not Null',
          rule: 'password IS NOT NULL',
          description: 'User passwords should never be null'
        }
      ],
      constraintValidations: [
        {
          name: 'Email Uniqueness',
          constraint: 'UNIQUE(email)',
          table: 'users',
          description: 'User emails must be unique'
        }
      ],
      performanceThresholds: {
        maxExecutionTime: 1000,
        maxRowsAffected: 1000
      },
      tags: ['data-integrity', 'users', 'constraints'],
      category: 'Data Integrity',
      priority: 'high'
    },
    {
      projectId: seedProjects[0].id,
      userId: seedUsers[0].id,
      dataSourceId: seedDataSources[0].id,
      name: 'Project Cascade Delete Test',
      description: 'Test cascade delete behavior for projects',
      testType: 'data-integrity',
      setupQueries: [
        {
          description: 'Create test project',
          query: "INSERT INTO projects (id, user_id, name, type) VALUES (gen_random_uuid(), (SELECT id FROM users LIMIT 1), 'Test Project', 'web')",
          expectedResult: 'success'
        },
        {
          description: 'Create test recording session',
          query: "INSERT INTO recording_sessions (id, project_id, user_id, type, platform) VALUES (gen_random_uuid(), (SELECT id FROM projects WHERE name = 'Test Project'), (SELECT id FROM users LIMIT 1), 'web', 'chrome')",
          expectedResult: 'success'
        }
      ],
      testQueries: [
        {
          description: 'Verify project and session exist',
          query: "SELECT COUNT(*) as project_count FROM projects WHERE name = 'Test Project'",
          expectedResult: { project_count: 1 }
        },
        {
          description: 'Delete project and verify cascade',
          query: "DELETE FROM projects WHERE name = 'Test Project'",
          expectedResult: 'success'
        },
        {
          description: 'Verify recording session was cascade deleted',
          query: "SELECT COUNT(*) as session_count FROM recording_sessions WHERE project_id = (SELECT id FROM projects WHERE name = 'Test Project')",
          expectedResult: { session_count: 0 }
        }
      ],
      teardownQueries: [
        {
          description: 'Clean up any remaining test data',
          query: "DELETE FROM projects WHERE name = 'Test Project'",
          expectedResult: 'success'
        }
      ],
      constraintValidations: [
        {
          name: 'Project User Foreign Key',
          constraint: 'FOREIGN KEY (user_id) REFERENCES users(id)',
          table: 'projects',
          description: 'Projects must reference valid users'
        }
      ],
      performanceThresholds: {
        maxExecutionTime: 2000,
        maxRowsAffected: 100
      },
      tags: ['cascade-delete', 'foreign-keys', 'projects'],
      category: 'Data Integrity',
      priority: 'high'
    },
    {
      projectId: seedProjects[0].id,
      userId: seedUsers[0].id,
      dataSourceId: seedDataSources[0].id,
      name: 'Query Performance Test',
      description: 'Test query performance for user lookup',
      testType: 'performance',
      testQueries: [
        {
          description: 'Test user lookup by email performance',
          query: "SELECT * FROM users WHERE email = 'admin@questro.com'",
          expectedResult: 'performance_check'
        },
        {
          description: 'Test project listing performance',
          query: "SELECT p.*, u.email FROM projects p JOIN users u ON p.user_id = u.id LIMIT 100",
          expectedResult: 'performance_check'
        }
      ],
      performanceThresholds: {
        maxExecutionTime: 500,
        maxMemoryUsage: 10485760, // 10MB
        maxCpuUsage: 50
      },
      tags: ['performance', 'queries', 'optimization'],
      category: 'Performance',
      priority: 'medium'
    },
    {
      projectId: seedProjects[0].id,
      userId: seedUsers[0].id,
      dataSourceId: seedDataSources[0].id,
      name: 'Plugin Security Test',
      description: 'Test plugin security constraints and permissions',
      testType: 'security',
      testQueries: [
        {
          description: 'Check for plugins with excessive permissions',
          query: "SELECT id, name, permissions FROM plugins WHERE jsonb_array_length(permissions) > 10",
          expectedResult: 'security_check'
        },
        {
          description: 'Verify plugin security scan status',
          query: "SELECT COUNT(*) as unscanned_count FROM plugins WHERE security_scan_status = 'pending'",
          expectedResult: { unscanned_count: 0 }
        }
      ],
      dataValidations: [
        {
          name: 'Plugin Permissions Validation',
          rule: 'jsonb_array_length(permissions) <= 20',
          description: 'Plugins should not have more than 20 permissions'
        },
        {
          name: 'Security Scan Required',
          rule: 'security_scan_status IN (\'passed\', \'warning\')',
          description: 'All plugins must pass security scan'
        }
      ],
      tags: ['security', 'plugins', 'permissions'],
      category: 'Security',
      priority: 'high'
    }
  ];

  try {
    const insertedDatabaseTestCases = await db.insert(databaseTestCases).values(sampleDatabaseTestCases as any).returning();
    console.log(`✅ Seeded ${insertedDatabaseTestCases.length} database test cases`);
    return insertedDatabaseTestCases;
  } catch (error) {
    console.error('❌ Error seeding database test cases:', error);
    throw error;
  }
}