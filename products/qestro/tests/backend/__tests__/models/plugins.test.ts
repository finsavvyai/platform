import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { 
  plugins, 
  pluginVersions, 
  pluginDependencies, 
  pluginInstallations,
  pluginExecutionLogs,
  pluginAnalytics,
  pluginReviews,
  pluginCategories,
  pluginTags,
  pluginTagAssociations,
  users 
} from '../../../../backend/src/schema/index.js';
import { eq, and } from 'drizzle-orm';

describe('Plugin System Database Models', () => {
  let db: any;
  let client: any;
  let testUser: any;
  let testPlugin: any;

  beforeAll(async () => {
    // Use test database
    const connectionString = process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/qestro_test';
    client = postgres(connectionString);
    db = drizzle(client);
  });

  afterAll(async () => {
    await client.end();
  });

  beforeEach(async () => {
    // Clean up test data
    await db.delete(pluginTagAssociations);
    await db.delete(pluginExecutionLogs);
    await db.delete(pluginInstallations);
    await db.delete(pluginReviews);
    await db.delete(pluginDependencies);
    await db.delete(pluginVersions);
    await db.delete(plugins);
    await db.delete(pluginCategories);
    await db.delete(pluginTags);
    await db.delete(users);

    // Create test user (unique email to avoid conflicts)
    const [user] = await db.insert(users).values({
      email: `plugin-test-${Date.now()}@example.com`,
      password: 'hashedpassword',
      firstName: 'Test',
      lastName: 'User',
      role: 'user',
      isEmailVerified: true,
    }).returning();
    testUser = user;

    // Create test plugin
    const [plugin] = await db.insert(plugins).values({
      name: 'Test Plugin',
      slug: 'test-plugin',
      version: '1.0.0',
      authorId: testUser.id,
      type: 'test-generator',
      category: 'Test Generators',
      description: 'A test plugin for testing',
      code: 'export default class TestPlugin {}',
      entryPoint: 'TestPlugin',
      isPublic: true,
      status: 'published',
    }).returning();
    testPlugin = plugin;
  });

  describe('Plugins Table', () => {
    it('should create a plugin with all required fields', async () => {
      const [plugin] = await db.insert(plugins).values({
        name: 'New Test Plugin',
        slug: 'new-test-plugin',
        version: '2.0.0',
        authorId: testUser.id,
        type: 'validator',
        category: 'Validators',
        description: 'Another test plugin',
        code: 'export default class NewTestPlugin {}',
        entryPoint: 'NewTestPlugin',
      }).returning();

      expect(plugin).toBeDefined();
      expect(plugin.name).toBe('New Test Plugin');
      expect(plugin.slug).toBe('new-test-plugin');
      expect(plugin.version).toBe('2.0.0');
      expect(plugin.authorId).toBe(testUser.id);
      expect(plugin.type).toBe('validator');
      expect(plugin.status).toBe('draft'); // default value
      expect(plugin.isPublic).toBe(false); // default value
      expect(plugin.downloads).toBe(0); // default value
      expect(plugin.rating).toBe('0.00'); // default value
    });

    it('should enforce unique slug constraint', async () => {
      await expect(
        db.insert(plugins).values({
          name: 'Duplicate Plugin',
          slug: 'test-plugin', // same slug as testPlugin
          version: '1.0.0',
          authorId: testUser.id,
          type: 'test-generator',
          category: 'Test Generators',
          description: 'Duplicate plugin',
          code: 'export default class DuplicatePlugin {}',
          entryPoint: 'DuplicatePlugin',
        })
      ).rejects.toThrow();
    });

    it('should handle AI generation metadata', async () => {
      const [plugin] = await db.insert(plugins).values({
        name: 'AI Generated Plugin',
        slug: 'ai-generated-plugin',
        version: '1.0.0',
        authorId: testUser.id,
        type: 'test-generator',
        category: 'Test Generators',
        description: 'AI generated plugin',
        code: 'export default class AIGeneratedPlugin {}',
        entryPoint: 'AIGeneratedPlugin',
        aiGenerated: true,
        generationPrompt: 'Create a test generator plugin',
        confidence: '0.95',
      }).returning();

      expect(plugin.aiGenerated).toBe(true);
      expect(plugin.generationPrompt).toBe('Create a test generator plugin');
      expect(plugin.confidence).toBe('0.95');
    });
  });

  describe('Plugin Versions Table', () => {
    it('should create plugin versions with proper relationships', async () => {
      const [version] = await db.insert(pluginVersions).values({
        pluginId: testPlugin.id,
        version: '1.1.0',
        changelog: 'Bug fixes and improvements',
        code: 'export default class TestPluginV11 {}',
        entryPoint: 'TestPluginV11',
        isLatest: true,
        isStable: true,
      }).returning();

      expect(version).toBeDefined();
      expect(version.pluginId).toBe(testPlugin.id);
      expect(version.version).toBe('1.1.0');
      expect(version.isLatest).toBe(true);
      expect(version.isStable).toBe(true);
    });

    it('should enforce unique plugin-version constraint', async () => {
      await db.insert(pluginVersions).values({
        pluginId: testPlugin.id,
        version: '1.0.0',
        code: 'export default class TestPlugin {}',
        entryPoint: 'TestPlugin',
      });

      await expect(
        db.insert(pluginVersions).values({
          pluginId: testPlugin.id,
          version: '1.0.0', // duplicate version for same plugin
          code: 'export default class TestPlugin {}',
          entryPoint: 'TestPlugin',
        })
      ).rejects.toThrow();
    });
  });

  describe('Plugin Dependencies Table', () => {
    it('should create plugin dependencies', async () => {
      const [dependency] = await db.insert(pluginDependencies).values({
        pluginId: testPlugin.id,
        dependencyName: 'lodash',
        dependencyType: 'npm',
        versionConstraint: '^4.17.0',
        isOptional: false,
      }).returning();

      expect(dependency).toBeDefined();
      expect(dependency.pluginId).toBe(testPlugin.id);
      expect(dependency.dependencyName).toBe('lodash');
      expect(dependency.dependencyType).toBe('npm');
      expect(dependency.versionConstraint).toBe('^4.17.0');
      expect(dependency.isOptional).toBe(false);
    });

    it('should handle plugin-to-plugin dependencies', async () => {
      // Create another plugin to depend on
      const [dependencyPlugin] = await db.insert(plugins).values({
        name: 'Dependency Plugin',
        slug: 'dependency-plugin',
        version: '1.0.0',
        authorId: testUser.id,
        type: 'validator',
        category: 'Validators',
        description: 'A dependency plugin',
        code: 'export default class DependencyPlugin {}',
        entryPoint: 'DependencyPlugin',
      }).returning();

      const [dependency] = await db.insert(pluginDependencies).values({
        pluginId: testPlugin.id,
        dependencyPluginId: dependencyPlugin.id,
        dependencyName: 'dependency-plugin',
        dependencyType: 'plugin',
        versionConstraint: '>=1.0.0',
      }).returning();

      expect(dependency.dependencyPluginId).toBe(dependencyPlugin.id);
      expect(dependency.dependencyType).toBe('plugin');
    });
  });

  describe('Plugin Installations Table', () => {
    it('should create plugin installations', async () => {
      const [installation] = await db.insert(pluginInstallations).values({
        userId: testUser.id,
        pluginId: testPlugin.id,
        installedVersion: '1.0.0',
        autoUpdate: true,
        userConfiguration: { theme: 'dark', notifications: true },
      }).returning();

      expect(installation).toBeDefined();
      expect(installation.userId).toBe(testUser.id);
      expect(installation.pluginId).toBe(testPlugin.id);
      expect(installation.installedVersion).toBe('1.0.0');
      expect(installation.autoUpdate).toBe(true);
      expect(installation.userConfiguration).toEqual({ theme: 'dark', notifications: true });
      expect(installation.isActive).toBe(true); // default value
      expect(installation.usageCount).toBe(0); // default value
    });

    it('should enforce unique user-plugin constraint', async () => {
      await db.insert(pluginInstallations).values({
        userId: testUser.id,
        pluginId: testPlugin.id,
        installedVersion: '1.0.0',
      });

      await expect(
        db.insert(pluginInstallations).values({
          userId: testUser.id,
          pluginId: testPlugin.id, // duplicate user-plugin combination
          installedVersion: '1.1.0',
        })
      ).rejects.toThrow();
    });
  });

  describe('Plugin Execution Logs Table', () => {
    let testInstallation: any;

    beforeEach(async () => {
      const [installation] = await db.insert(pluginInstallations).values({
        userId: testUser.id,
        pluginId: testPlugin.id,
        installedVersion: '1.0.0',
      }).returning();
      testInstallation = installation;
    });

    it('should create execution logs', async () => {
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + 5000);

      const [log] = await db.insert(pluginExecutionLogs).values({
        pluginId: testPlugin.id,
        userId: testUser.id,
        installationId: testInstallation.id,
        executionContext: 'test-generation',
        startTime,
        endTime,
        duration: 5000,
        status: 'success',
        input: { recordingId: 'test-recording-123' },
        output: { testCode: 'generated test code' },
        memoryUsage: 1024000,
        cpuUsage: '15.5',
      }).returning();

      expect(log).toBeDefined();
      expect(log.pluginId).toBe(testPlugin.id);
      expect(log.userId).toBe(testUser.id);
      expect(log.installationId).toBe(testInstallation.id);
      expect(log.executionContext).toBe('test-generation');
      expect(log.status).toBe('success');
      expect(log.duration).toBe(5000);
      expect(log.input).toEqual({ recordingId: 'test-recording-123' });
      expect(log.output).toEqual({ testCode: 'generated test code' });
      expect(log.memoryUsage).toBe(1024000);
      expect(log.cpuUsage).toBe('15.5');
    });

    it('should handle failed executions', async () => {
      const [log] = await db.insert(pluginExecutionLogs).values({
        pluginId: testPlugin.id,
        userId: testUser.id,
        installationId: testInstallation.id,
        executionContext: 'validation',
        startTime: new Date(),
        status: 'error',
        error: 'Plugin execution failed: Invalid input',
      }).returning();

      expect(log.status).toBe('error');
      expect(log.error).toBe('Plugin execution failed: Invalid input');
      expect(log.endTime).toBeNull();
      expect(log.duration).toBeNull();
    });
  });

  describe('Plugin Analytics Table', () => {
    it('should create analytics records', async () => {
      const date = new Date('2024-01-01T00:00:00Z');

      const [analytics] = await db.insert(pluginAnalytics).values({
        pluginId: testPlugin.id,
        date,
        granularity: 'day',
        executionCount: 100,
        successCount: 95,
        errorCount: 5,
        timeoutCount: 0,
        totalDuration: 50000,
        minDuration: 100,
        maxDuration: 2000,
        avgMemoryUsage: 512000,
        avgCpuUsage: '12.5',
        uniqueUsers: 25,
        newInstallations: 5,
        uninstallations: 1,
      }).returning();

      expect(analytics).toBeDefined();
      expect(analytics.pluginId).toBe(testPlugin.id);
      expect(analytics.granularity).toBe('day');
      expect(analytics.executionCount).toBe(100);
      expect(analytics.successCount).toBe(95);
      expect(analytics.errorCount).toBe(5);
      expect(analytics.uniqueUsers).toBe(25);
    });

    it('should enforce unique plugin-date-granularity constraint', async () => {
      const date = new Date('2024-01-01T00:00:00Z');

      await db.insert(pluginAnalytics).values({
        pluginId: testPlugin.id,
        date,
        granularity: 'day',
        executionCount: 100,
      });

      await expect(
        db.insert(pluginAnalytics).values({
          pluginId: testPlugin.id,
          date, // same date
          granularity: 'day', // same granularity
          executionCount: 200,
        })
      ).rejects.toThrow();
    });
  });

  describe('Plugin Reviews Table', () => {
    it('should create plugin reviews', async () => {
      const [review] = await db.insert(pluginReviews).values({
        pluginId: testPlugin.id,
        userId: testUser.id,
        rating: 5,
        title: 'Excellent plugin!',
        content: 'This plugin works perfectly and saves me a lot of time.',
        version: '1.0.0',
        isVerifiedPurchase: true,
      }).returning();

      expect(review).toBeDefined();
      expect(review.pluginId).toBe(testPlugin.id);
      expect(review.userId).toBe(testUser.id);
      expect(review.rating).toBe(5);
      expect(review.title).toBe('Excellent plugin!');
      expect(review.content).toBe('This plugin works perfectly and saves me a lot of time.');
      expect(review.version).toBe('1.0.0');
      expect(review.isVerifiedPurchase).toBe(true);
      expect(review.isApproved).toBe(true); // default value
      expect(review.helpfulCount).toBe(0); // default value
    });

    it('should enforce unique user-plugin constraint for reviews', async () => {
      await db.insert(pluginReviews).values({
        pluginId: testPlugin.id,
        userId: testUser.id,
        rating: 5,
        version: '1.0.0',
      });

      await expect(
        db.insert(pluginReviews).values({
          pluginId: testPlugin.id,
          userId: testUser.id, // same user-plugin combination
          rating: 4,
          version: '1.0.0',
        })
      ).rejects.toThrow();
    });
  });

  describe('Plugin Categories and Tags', () => {
    it('should create plugin categories', async () => {
      const [category] = await db.insert(pluginCategories).values({
        name: 'Test Category',
        slug: 'test-category',
        description: 'A test category',
        icon: 'test-icon',
        color: '#FF0000',
        sortOrder: 1,
      }).returning();

      expect(category).toBeDefined();
      expect(category.name).toBe('Test Category');
      expect(category.slug).toBe('test-category');
      expect(category.description).toBe('A test category');
      expect(category.icon).toBe('test-icon');
      expect(category.color).toBe('#FF0000');
      expect(category.sortOrder).toBe(1);
      expect(category.isActive).toBe(true); // default value
    });

    it('should create plugin tags', async () => {
      const [tag] = await db.insert(pluginTags).values({
        name: 'test-tag',
        slug: 'test-tag',
        description: 'A test tag',
        color: '#00FF00',
      }).returning();

      expect(tag).toBeDefined();
      expect(tag.name).toBe('test-tag');
      expect(tag.slug).toBe('test-tag');
      expect(tag.description).toBe('A test tag');
      expect(tag.color).toBe('#00FF00');
      expect(tag.usageCount).toBe(0); // default value
    });

    it('should create plugin-tag associations', async () => {
      const [tag] = await db.insert(pluginTags).values({
        name: 'web-testing',
        slug: 'web-testing',
        description: 'Web testing tag',
      }).returning();

      const [association] = await db.insert(pluginTagAssociations).values({
        pluginId: testPlugin.id,
        tagId: tag.id,
      }).returning();

      expect(association).toBeDefined();
      expect(association.pluginId).toBe(testPlugin.id);
      expect(association.tagId).toBe(tag.id);
    });

    it('should enforce unique plugin-tag association constraint', async () => {
      const [tag] = await db.insert(pluginTags).values({
        name: 'duplicate-tag',
        slug: 'duplicate-tag',
      }).returning();

      await db.insert(pluginTagAssociations).values({
        pluginId: testPlugin.id,
        tagId: tag.id,
      });

      await expect(
        db.insert(pluginTagAssociations).values({
          pluginId: testPlugin.id,
          tagId: tag.id, // duplicate association
        })
      ).rejects.toThrow();
    });
  });

  describe('Complex Queries and Relationships', () => {
    it('should query plugins with their versions', async () => {
      // Create plugin versions
      await db.insert(pluginVersions).values([
        {
          pluginId: testPlugin.id,
          version: '1.1.0',
          code: 'v1.1.0 code',
          entryPoint: 'TestPlugin',
          isLatest: false,
        },
        {
          pluginId: testPlugin.id,
          version: '1.2.0',
          code: 'v1.2.0 code',
          entryPoint: 'TestPlugin',
          isLatest: true,
        },
      ]);

      const pluginWithVersions = await db
        .select()
        .from(plugins)
        .leftJoin(pluginVersions, eq(plugins.id, pluginVersions.pluginId))
        .where(eq(plugins.id, testPlugin.id));

      expect(pluginWithVersions).toHaveLength(2); // 2 versions
      expect(pluginWithVersions[0].plugins.id).toBe(testPlugin.id);
      expect(pluginWithVersions[0].plugin_versions?.version).toBeDefined();
    });

    it('should query user plugin installations with analytics', async () => {
      // Create installation
      const [installation] = await db.insert(pluginInstallations).values({
        userId: testUser.id,
        pluginId: testPlugin.id,
        installedVersion: '1.0.0',
        usageCount: 10,
      }).returning();

      // Create execution logs
      await db.insert(pluginExecutionLogs).values([
        {
          pluginId: testPlugin.id,
          userId: testUser.id,
          installationId: installation.id,
          executionContext: 'test-generation',
          startTime: new Date(),
          status: 'success',
        },
        {
          pluginId: testPlugin.id,
          userId: testUser.id,
          installationId: installation.id,
          executionContext: 'validation',
          startTime: new Date(),
          status: 'success',
        },
      ]);

      const userPlugins = await db
        .select()
        .from(pluginInstallations)
        .leftJoin(plugins, eq(pluginInstallations.pluginId, plugins.id))
        .leftJoin(pluginExecutionLogs, eq(pluginInstallations.id, pluginExecutionLogs.installationId))
        .where(eq(pluginInstallations.userId, testUser.id));

      expect(userPlugins.length).toBeGreaterThan(0);
      expect(userPlugins[0].plugin_installations.userId).toBe(testUser.id);
      expect(userPlugins[0].plugins?.name).toBe('Test Plugin');
    });
  });
});