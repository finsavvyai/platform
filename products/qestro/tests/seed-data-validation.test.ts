/**
 * Test suite to validate seed data integrity
 * This test ensures that the seeded data meets all requirements
 * and relationships are properly maintained
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and, count, inArray } from 'drizzle-orm';
import * as schema from '../../src/schema/index.js';

describe('Seed Data Validation', () => {
  let db: ReturnType<typeof drizzle>;

  beforeAll(async () => {
    // Initialize database connection
    const d1Database = globalThis.D1_DATABASE;
    if (!d1Database) {
      throw new Error('D1_DATABASE not found. Tests must be run with wrangler.');
    }
    db = drizzle(d1Database, { schema });
  });

  describe('User Data Validation', () => {
    it('should have created the expected number of users', async () => {
      const users = await db.select().from(schema.users);
      expect(users.length).toBeGreaterThan(0);
      expect(users.length).toBeGreaterThanOrEqual(10); // At least 10 users
    });

    it('should have users with different roles', async () => {
      const roles = await db.selectDistinct({ role: schema.users.role }).from(schema.users);
      const roleValues = roles.map(r => r.role);
      expect(roleValues).toContain('user');
      expect(roleValues).toContain('admin');
    });

    it('should have users with different subscription levels', async () => {
      const subscriptions = await db.selectDistinct({ subscription: schema.users.subscription }).from(schema.users);
      const subscriptionValues = subscriptions.map(s => s.subscription);
      expect(subscriptionValues).toContain('free');
      expect(subscriptionValues).toContain('pro');
      expect(subscriptionValues).toContain('enterprise');
    });

    it('should have an admin user with enterprise subscription', async () => {
      const adminUsers = await db.select()
        .from(schema.users)
        .where(and(
          eq(schema.users.role, 'admin'),
          eq(schema.users.subscription, 'enterprise')
        ));

      expect(adminUsers.length).toBeGreaterThanOrEqual(1);
      expect(adminUsers[0].email).toBe('admin@qestro.dev');
    });

    it('should have unique email addresses', async () => {
      const emails = await db.select({ email: schema.users.email }).from(schema.users);
      const uniqueEmails = new Set(emails.map(e => e.email));
      expect(uniqueEmails.size).toBe(emails.length);
    });
  });

  describe('Project Data Validation', () => {
    it('should have created projects for users', async () => {
      const projects = await db.select().from(schema.projects);
      expect(projects.length).toBeGreaterThan(0);

      // Each project should have a valid user
      for (const project of projects.slice(0, 5)) {
        const user = await db.select()
          .from(schema.users)
          .where(eq(schema.users.id, project.userId))
          .limit(1);
        expect(user.length).toBe(1);
      }
    });

    it('should have projects with different types', async () => {
      const types = await db.selectDistinct({ type: schema.projects.type }).from(schema.projects);
      const typeValues = types.map(t => t.type);
      expect(typeValues.length).toBeGreaterThan(0);
      expect(typeValues).toContain('mobile');
      expect(typeValues).toContain('web');
    });

    it('should have valid project settings (JSON)', async () => {
      const projects = await db.select().from(schema.projects).limit(10);

      for (const project of projects) {
        expect(() => JSON.parse(project.settings || '{}')).not.toThrow();
      }
    });
  });

  describe('Test Suite and Test Case Validation', () => {
    it('should have created test suites with associated projects', async () => {
      const testSuites = await db.select().from(schema.testSuites);
      expect(testSuites.length).toBeGreaterThan(0);

      // Check random test suites have valid projects
      for (const suite of testSuites.slice(0, 5)) {
        const project = await db.select()
          .from(schema.projects)
          .where(eq(schema.projects.id, suite.projectId))
          .limit(1);
        expect(project.length).toBe(1);
      }
    });

    it('should have test cases linked to projects', async () => {
      const testCases = await db.select().from(schema.testCases);
      expect(testCases.length).toBeGreaterThan(0);

      // Verify each test case has a valid project
      for (const testCase of testCases.slice(0, 5)) {
        const project = await db.select()
          .from(schema.projects)
          .where(eq(schema.projects.id, testCase.projectId))
          .limit(1);
        expect(project.length).toBe(1);
      }
    });

    it('should have test suites with linked test cases', async () => {
      const testSuites = await db.select().from(schema.testSuites);
      let totalLinkedCases = 0;

      for (const suite of testSuites) {
        const testCases = JSON.parse(suite.testCases || '[]');
        totalLinkedCases += testCases.length;

        if (testCases.length > 0) {
          // Verify linked test cases exist
          const existingCases = await db.select()
            .from(schema.testCases)
            .where(inArray(schema.testCases.id, testCases));
          expect(existingCases.length).toBe(testCases.length);
        }
      }

      expect(totalLinkedCases).toBeGreaterThan(0);
    });

    it('should have valid test data (JSON) in test cases', async () => {
      const testCases = await db.select().from(schema.testCases).limit(10);

      for (const testCase of testCases) {
        expect(() => JSON.parse(testCase.testData)).not.toThrow();
        expect(() => JSON.parse(testCase.expectedResults || '[]')).not.toThrow();
        expect(() => JSON.parse(testCase.tags || '[]')).not.toThrow();
      }
    });
  });

  describe('Recording Session and Actions Validation', () => {
    it('should have recording sessions with valid projects', async () => {
      const sessions = await db.select().from(schema.recordingSessions);
      expect(sessions.length).toBeGreaterThan(0);

      for (const session of sessions.slice(0, 5)) {
        const project = await db.select()
          .from(schema.projects)
          .where(eq(schema.projects.id, session.projectId))
          .limit(1);
        expect(project.length).toBe(1);
      }
    });

    it('should have recorded actions for sessions', async () => {
      const sessions = await db.select().from(schema.recordingSessions);
      let totalActions = 0;

      for (const session of sessions.slice(0, 5)) {
        const actions = await db.select()
          .from(schema.recordedActions)
          .where(eq(schema.recordedActions.sessionId, session.id));

        totalActions += actions.length;

        if (actions.length > 0) {
          // Verify actions are in sequence
          const sequenceNumbers = actions.map(a => a.sequenceNumber).sort((a, b) => a - b);
          for (let i = 1; i < sequenceNumbers.length; i++) {
            expect(sequenceNumbers[i]).toBe(sequenceNumbers[i - 1] + 1);
          }
        }
      }

      expect(totalActions).toBeGreaterThan(0);
    });

    it('should have valid metadata in recorded actions', async () => {
      const actions = await db.select().from(schema.recordedActions).limit(10);

      for (const action of actions) {
        expect(() => JSON.parse(action.metadata || '{}')).not.toThrow();

        if (action.coordinates) {
          expect(() => JSON.parse(action.coordinates)).not.toThrow();
        }
      }
    });
  });

  describe('Data Relationship Integrity', () => {
    it('should maintain foreign key constraints between users and projects', async () => {
      const orphanedProjects = await db.select({ count: count() })
        .from(schema.projects)
        .leftJoin(schema.users, eq(schema.users.id, schema.projects.userId))
        .where(eq(schema.users.id, null));

      expect(orphanedProjects[0].count).toBe(0);
    });

    it('should maintain foreign key constraints between projects and test cases', async () => {
      const orphanedTestCases = await db.select({ count: count() })
        .from(schema.testCases)
        .leftJoin(schema.projects, eq(schema.projects.id, schema.testCases.projectId))
        .where(eq(schema.projects.id, null));

      expect(orphanedTestCases[0].count).toBe(0);
    });

    it('should maintain foreign key constraints between sessions and actions', async () => {
      const orphanedActions = await db.select({ count: count() })
        .from(schema.recordedActions)
        .leftJoin(schema.recordingSessions, eq(schema.recordingSessions.id, schema.recordedActions.sessionId))
        .where(eq(schema.recordingSessions.id, null));

      expect(orphanedActions[0].count).toBe(0);
    });
  });

  describe('Data Distribution Validation', () => {
    it('should have a reasonable distribution of project types', async () => {
      const projectTypes = await db.select({
        type: schema.projects.type,
        count: count()
      })
        .from(schema.projects)
        .groupBy(schema.projects.type);

      const totalProjects = projectTypes.reduce((sum, pt) => sum + pt.count, 0);

      for (const projectType of projectTypes) {
        const percentage = (projectType.count / totalProjects) * 100;
        // Each type should be between 20% and 60% of total
        expect(percentage).toBeGreaterThanOrEqual(20);
        expect(percentage).toBeLessThanOrEqual(60);
      }
    });

    it('should have a reasonable distribution of user roles', async () => {
      const userRoles = await db.select({
        role: schema.users.role,
        count: count()
      })
        .from(schema.users)
        .groupBy(schema.users.role);

      const totalUsers = userRoles.reduce((sum, ur) => sum + ur.count, 0);
      const adminUsers = userRoles.find(ur => ur.role === 'admin');
      const regularUsers = userRoles.find(ur => ur.role === 'user');

      if (adminUsers) {
        const adminPercentage = (adminUsers.count / totalUsers) * 100;
        // Admins should be less than 20% of users
        expect(adminPercentage).toBeLessThan(20);
      }

      if (regularUsers) {
        const userPercentage = (regularUsers.count / totalUsers) * 100;
        // Regular users should be more than 50% of users
        expect(userPercentage).toBeGreaterThan(50);
      }
    });
  });

  describe('Timestamp and Creation Order Validation', () => {
    it('should have valid timestamps in all tables', async () => {
      // Check users table
      const users = await db.select().from(schema.users).limit(5);
      for (const user of users) {
        expect(user.createdAt).toBeGreaterThan(0);
        expect(user.updatedAt).toBeGreaterThanOrEqual(user.createdAt);
      }

      // Check projects table
      const projects = await db.select().from(schema.projects).limit(5);
      for (const project of projects) {
        expect(project.createdAt).toBeGreaterThan(0);
        expect(project.updatedAt).toBeGreaterThanOrEqual(project.createdAt);
      }

      // Check recording sessions
      const sessions = await db.select().from(schema.recordingSessions).limit(5);
      for (const session of sessions) {
        if (session.startTime && session.endTime) {
          expect(session.endTime).toBeGreaterThan(session.startTime);
          expect(session.duration).toBeGreaterThan(0);
        }
      }
    });

    it('should have sequential action timestamps within sessions', async () => {
      const sessions = await db.select().from(schema.recordingSessions).limit(3);

      for (const session of sessions) {
        const actions = await db.select()
          .from(schema.recordedActions)
          .where(eq(schema.recordedActions.sessionId, session.id))
          .orderBy(schema.recordedActions.sequenceNumber);

        if (actions.length > 1) {
          for (let i = 1; i < actions.length; i++) {
            expect(actions[i].timestamp).toBeGreaterThan(actions[i - 1].timestamp);
          }
        }
      }
    });
  });
});
