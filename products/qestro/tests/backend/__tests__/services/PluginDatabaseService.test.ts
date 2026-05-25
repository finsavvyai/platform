// @ts-nocheck - Skip TypeScript checking for test type issues
import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { PluginDatabaseService } from '../../../../backend/src/services/PluginDatabaseService';
import {
  plugins,
  pluginInstallations,
  pluginReviews,
  pluginCategories,
  pluginTags,
  pluginTagAssociations,
  users
} from '../../../../backend/src/schema';

describe('PluginDatabaseService', () => {
  let db: any;
  let client: any;
  let service: PluginDatabaseService;
  let testUser: any;
  let testPlugin: any;

  beforeAll(async () => {
    const connectionString = process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/qestro_test';
    client = postgres(connectionString);
    db = drizzle(client);
    service = new PluginDatabaseService(db);
  });

  afterAll(async () => {
    await client.end();
  });

  beforeEach(async () => {
    // Clean up test data
    await db.delete(pluginTagAssociations);
    await db.delete(pluginInstallations);
    await db.delete(pluginReviews);
    await db.delete(plugins);
    await db.delete(pluginCategories);
    await db.delete(pluginTags);
    await db.delete(users);

    // Create test user
    const [user] = await db.insert(users).values({
      email: 'test@example.com',
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
      isApproved: true,
      status: 'published',
      downloads: 100,
      rating: '4.5',
      reviewCount: 10,
    }).returning();
    testPlugin = plugin;
  });

  describe('searchPlugins', () => {
    beforeEach(async () => {
      // Create additional test plugins
      await db.insert(plugins).values([
        {
          name: 'Cypress Generator',
          slug: 'cypress-generator',
          version: '1.0.0',
          authorId: testUser.id,
          type: 'test-generator',
          category: 'Test Generators',
          description: 'Generate Cypress tests',
          code: 'export default class CypressGenerator {}',
          entryPoint: 'CypressGenerator',
          isPublic: true,
          isApproved: true,
          status: 'published',
          downloads: 200,
          rating: '4.8',
          reviewCount: 15,
        },
        {
          name: 'API Validator',
          slug: 'api-validator',
          version: '1.0.0',
          authorId: testUser.id,
          type: 'validator',
          category: 'Validators',
          description: 'Validate API responses',
          code: 'export default class APIValidator {}',
          entryPoint: 'APIValidator',
          isPublic: true,
          isApproved: true,
          status: 'published',
          downloads: 50,
          rating: '4.2',
          reviewCount: 8,
        },
      ]);
    });

    it('should search plugins by name', async () => {
      const result = await service.searchPlugins('Cypress');

      expect(result.plugins).toHaveLength(1);
      expect(result.plugins[0].plugin.name).toBe('Cypress Generator');
      expect(result.total).toBe(1);
    });

    it('should search plugins by description', async () => {
      const result = await service.searchPlugins('API');

      expect(result.plugins).toHaveLength(1);
      expect(result.plugins[0].plugin.name).toBe('API Validator');
    });

    it('should filter plugins by category', async () => {
      const result = await service.searchPlugins(undefined, {
        category: 'Test Generators',
      });

      expect(result.plugins).toHaveLength(2);
      expect(result.plugins.every(p => p.plugin.category === 'Test Generators')).toBe(true);
    });

    it('should filter plugins by type', async () => {
      const result = await service.searchPlugins(undefined, {
        type: 'validator',
      });

      expect(result.plugins).toHaveLength(1);
      expect(result.plugins[0].plugin.type).toBe('validator');
    });

    it('should filter plugins by rating', async () => {
      const result = await service.searchPlugins(undefined, {
        rating: 4.5,
      });

      expect(result.plugins).toHaveLength(2);
      expect(result.plugins.every(p => parseFloat(p.plugin.rating) >= 4.5)).toBe(true);
    });

    it('should sort plugins by downloads', async () => {
      const result = await service.searchPlugins(undefined, {
        sortBy: 'downloads',
        sortOrder: 'desc',
      });

      expect(result.plugins).toHaveLength(3);
      expect(result.plugins[0].plugin.downloads).toBeGreaterThanOrEqual(result.plugins[1].plugin.downloads);
      expect(result.plugins[1].plugin.downloads).toBeGreaterThanOrEqual(result.plugins[2].plugin.downloads);
    });

    it('should sort plugins by rating', async () => {
      const result = await service.searchPlugins(undefined, {
        sortBy: 'rating',
        sortOrder: 'desc',
      });

      expect(result.plugins).toHaveLength(3);
      const ratings = result.plugins.map(p => parseFloat(p.plugin.rating));
      expect(ratings[0]).toBeGreaterThanOrEqual(ratings[1]);
      expect(ratings[1]).toBeGreaterThanOrEqual(ratings[2]);
    });

    it('should handle pagination', async () => {
      const result = await service.searchPlugins(undefined, {
        limit: 2,
        offset: 0,
      });

      expect(result.plugins).toHaveLength(2);
      expect(result.total).toBe(3);
      expect(result.limit).toBe(2);
      expect(result.offset).toBe(0);

      const result2 = await service.searchPlugins(undefined, {
        limit: 2,
        offset: 2,
      });

      expect(result2.plugins).toHaveLength(1);
      expect(result2.total).toBe(3);
    });

    it('should filter by tags', async () => {
      // Create tags
      const [webTag] = await db.insert(pluginTags).values({
        name: 'web',
        slug: 'web',
      }).returning();

      const [e2eTag] = await db.insert(pluginTags).values({
        name: 'e2e',
        slug: 'e2e',
      }).returning();

      // Associate tags with plugin
      await db.insert(pluginTagAssociations).values([
        { pluginId: testPlugin.id, tagId: webTag.id },
        { pluginId: testPlugin.id, tagId: e2eTag.id },
      ]);

      const result = await service.searchPlugins(undefined, {
        tags: ['web', 'e2e'],
      });

      expect(result.plugins).toHaveLength(1);
      expect(result.plugins[0].plugin.id).toBe(testPlugin.id);
      expect(result.plugins[0].tags).toHaveLength(2);
    });
  });

  describe('getPluginRecommendations', () => {
    let otherUser: any;
    let popularPlugin: any;

    beforeEach(async () => {
      // Create another user
      const [user] = await db.insert(users).values({
        email: 'other@example.com',
        password: 'hashedpassword',
        firstName: 'Other',
        lastName: 'User',
        role: 'user',
        isEmailVerified: true,
      }).returning();
      otherUser = user;

      // Create a popular plugin
      const [plugin] = await db.insert(plugins).values({
        name: 'Popular Plugin',
        slug: 'popular-plugin',
        version: '1.0.0',
        authorId: otherUser.id,
        type: 'test-generator',
        category: 'Test Generators',
        description: 'A very popular plugin',
        code: 'export default class PopularPlugin {}',
        entryPoint: 'PopularPlugin',
        isPublic: true,
        isApproved: true,
        status: 'published',
        downloads: 1000,
        rating: '4.9',
        reviewCount: 50,
      }).returning();
      popularPlugin = plugin;

      // Create installations to simulate collaborative filtering
      await db.insert(pluginInstallations).values([
        { userId: testUser.id, pluginId: testPlugin.id, installedVersion: '1.0.0' },
        { userId: otherUser.id, pluginId: testPlugin.id, installedVersion: '1.0.0' },
        { userId: otherUser.id, pluginId: popularPlugin.id, installedVersion: '1.0.0' },
      ]);
    });

    it('should provide collaborative filtering recommendations', async () => {
      const recommendations = await service.getPluginRecommendations({
        userId: testUser.id,
        installedPlugins: [testPlugin.id],
      });

      expect(recommendations).toHaveLength(1);
      expect(recommendations[0].id).toBe(popularPlugin.id);
      expect(recommendations[0].recommendationType).toBe('collaborative');
    });

    it('should provide content-based recommendations', async () => {
      const recommendations = await service.getPluginRecommendations({
        userId: testUser.id,
        recentlyUsedTypes: ['test-generator'],
        installedPlugins: [testPlugin.id],
      });

      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations.some(r => r.recommendationType === 'content-based')).toBe(true);
    });

    it('should provide popular recommendations', async () => {
      const recommendations = await service.getPluginRecommendations({
        userId: testUser.id,
        installedPlugins: [],
      });

      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations.some(r => r.recommendationType === 'popular')).toBe(true);
    });

    it('should exclude already installed plugins', async () => {
      const recommendations = await service.getPluginRecommendations({
        userId: testUser.id,
        installedPlugins: [testPlugin.id, popularPlugin.id],
      });

      const installedIds = [testPlugin.id, popularPlugin.id];
      expect(recommendations.every(r => !installedIds.includes(r.id))).toBe(true);
    });
  });

  describe('getPluginReviews', () => {
    beforeEach(async () => {
      // Create test reviews
      await db.insert(pluginReviews).values([
        {
          pluginId: testPlugin.id,
          userId: testUser.id,
          rating: 5,
          title: 'Excellent plugin!',
          content: 'Works perfectly',
          version: '1.0.0',
          isApproved: true,
        },
        {
          pluginId: testPlugin.id,
          userId: testUser.id, // This would normally be a different user
          rating: 4,
          title: 'Good plugin',
          content: 'Pretty good overall',
          version: '1.0.0',
          isApproved: true,
        },
        {
          pluginId: testPlugin.id,
          userId: testUser.id, // This would normally be a different user
          rating: 3,
          title: 'Average plugin',
          content: 'Could be better',
          version: '1.0.0',
          isApproved: false, // Not approved
        },
      ]);
    });

    it('should get approved plugin reviews', async () => {
      const result = await service.getPluginReviews(testPlugin.id);

      expect(result.reviews).toHaveLength(2); // Only approved reviews
      expect(result.total).toBe(2);
      expect(result.reviews.every(r => r.review.isApproved)).toBe(true);
    });

    it('should filter reviews by rating', async () => {
      const result = await service.getPluginReviews(testPlugin.id, { rating: 5 });

      expect(result.reviews).toHaveLength(1);
      expect(result.reviews[0].review.rating).toBe(5);
    });

    it('should provide rating distribution', async () => {
      const result = await service.getPluginReviews(testPlugin.id);

      expect(result.ratingDistribution).toHaveLength(2); // 5-star and 4-star
      expect(result.ratingDistribution.some(r => r.rating === 5 && r.count === 1)).toBe(true);
      expect(result.ratingDistribution.some(r => r.rating === 4 && r.count === 1)).toBe(true);
    });

    it('should handle pagination', async () => {
      const result = await service.getPluginReviews(testPlugin.id, { limit: 1, offset: 0 });

      expect(result.reviews).toHaveLength(1);
      expect(result.total).toBe(2);
      expect(result.limit).toBe(1);
      expect(result.offset).toBe(0);
    });
  });

  describe('getPluginAnalytics', () => {
    it('should return empty analytics for plugin with no data', async () => {
      const result = await service.getPluginAnalytics(testPlugin.id);

      expect(result.analytics).toHaveLength(0);
      expect(result.totals.totalExecutions).toBe(0);
      expect(result.successRate).toBe(0);
      expect(result.errorRate).toBe(0);
    });
  });
});