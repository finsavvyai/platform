/**
 * Plugin Marketplace Routes - RESTful endpoints
 */

import { Router, Request, Response, NextFunction } from 'express';
import { PluginRegistry } from '../PluginRegistry.js';
import { PluginInstaller } from '../PluginInstaller.js';
import { PluginSandbox } from '../PluginSandbox.js';
import { PluginReviewService } from '../PluginReviewService.js';
import { PluginManifest, PluginSearchQuery, PluginCategory } from '../types.js';

export function createMarketplaceRouter(
  registry: PluginRegistry,
  installer: PluginInstaller,
  sandbox: PluginSandbox,
  reviews: PluginReviewService
): Router {
  const router = Router();

  router.use((req, res, next) => {
    (req as any).userId = (req.user as any)?.id || 'anonymous';
    (req as any).projectId = req.query.projectId as string || '';
    next();
  });

  router.get('/plugins', async (req, res) => {
    try {
      const results = await registry.searchPlugins({
        query: req.query.q as string | undefined,
        category: req.query.category as PluginCategory | undefined,
        tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
        verified: req.query.verified ? req.query.verified === 'true' : undefined,
        featured: req.query.featured ? req.query.featured === 'true' : undefined,
        sortBy: (req.query.sortBy as any) || 'downloads',
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
      });
      res.json(results);
    } catch (e) {
      res.status(400).json({ error: e instanceof Error ? e.message : 'Search failed' });
    }
  });

  router.get('/plugins/:id', async (req, res) => {
    try {
      const plugin = await registry.getPlugin(req.params.id);
      if (!plugin) {
        res.status(404).json({ error: 'Plugin not found' });
        return;
      }
      const stats = await reviews.getReviewStats(plugin.id);
      res.json({ ...plugin, reviewStats: stats });
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : 'Failed' });
    }
  });

  router.post('/plugins', async (req, res) => {
    try {
      if (!(req as any).userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const plugin = await registry.registerPlugin(req.body as PluginManifest, (req as any).userId);
      res.status(201).json(plugin);
    } catch (e) {
      res.status(400).json({ error: e instanceof Error ? e.message : 'Registration failed' });
    }
  });

  router.post('/plugins/:id/install', async (req, res) => {
    try {
      if (!(req as any).projectId) {
        res.status(400).json({ error: 'Project ID required' });
        return;
      }
      const inst = await installer.installPlugin((req as any).projectId, req.params.id, req.body.version);
      res.status(201).json(inst);
    } catch (e) {
      res.status(400).json({ error: e instanceof Error ? e.message : 'Install failed' });
    }
  });

  router.delete('/plugins/:id/install', async (req, res) => {
    try {
      if (!(req as any).projectId) {
        res.status(400).json({ error: 'Project ID required' });
        return;
      }
      await installer.uninstallPlugin((req as any).projectId, req.params.id);
      res.status(204).send();
    } catch (e) {
      res.status(400).json({ error: e instanceof Error ? e.message : 'Uninstall failed' });
    }
  });

  router.put('/plugins/:id/install', async (req, res) => {
    try {
      if (!(req as any).projectId) {
        res.status(400).json({ error: 'Project ID required' });
        return;
      }
      const inst = await installer.updatePlugin((req as any).projectId, req.params.id);
      res.json(inst);
    } catch (e) {
      res.status(400).json({ error: e instanceof Error ? e.message : 'Update failed' });
    }
  });

  router.get('/plugins/installed', async (req, res) => {
    try {
      if (!(req as any).projectId) {
        res.status(400).json({ error: 'Project ID required' });
        return;
      }
      const insts = await installer.getInstalledPlugins((req as any).projectId);
      res.json(insts);
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : 'Failed' });
    }
  });

  router.post('/plugins/:id/reviews', async (req, res) => {
    try {
      if (!(req as any).userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const { rating, comment, userName } = req.body;
      const review = await reviews.addReview(req.params.id, (req as any).userId, rating, comment, userName || 'Anonymous');
      res.status(201).json(review);
    } catch (e) {
      res.status(400).json({ error: e instanceof Error ? e.message : 'Review failed' });
    }
  });

  router.get('/plugins/:id/reviews', async (req, res) => {
    try {
      const pluginReviews = await reviews.getReviews(req.params.id);
      const stats = await reviews.getReviewStats(req.params.id);
      res.json({ reviews: pluginReviews, stats });
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : 'Failed' });
    }
  });

  router.post('/plugins/:id/report', async (req, res) => {
    try {
      await reviews.reportPlugin(req.params.id, req.body.reason);
      res.status(204).send();
    } catch (e) {
      res.status(400).json({ error: e instanceof Error ? e.message : 'Report failed' });
    }
  });

  router.get('/featured', async (req, res) => {
    try {
      const featured = await registry.getFeaturedPlugins();
      res.json(featured);
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : 'Failed' });
    }
  });

  router.get('/popular', async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const popular = await registry.getPopularPlugins(limit);
      res.json(popular);
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : 'Failed' });
    }
  });

  router.get('/categories', async (req, res) => {
    try {
      const cats: PluginCategory[] = ['runner', 'reporter', 'generator', 'healer', 'integration', 'assertion', 'utility'];
      const data = await Promise.all(cats.map(async (cat) => ({ name: cat, plugins: await registry.getCategoryPlugins(cat) })));
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : 'Failed' });
    }
  });

  router.get('/categories/:category', async (req, res) => {
    try {
      const plugins = await registry.getCategoryPlugins(req.params.category as PluginCategory);
      res.json(plugins);
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : 'Failed' });
    }
  });

  return router;
}

// Default export with default instances
const defaultRegistry = new PluginRegistry();
const defaultRouter = createMarketplaceRouter(
  defaultRegistry,
  new PluginInstaller(defaultRegistry),
  new PluginSandbox(),
  new PluginReviewService()
);
export default defaultRouter;
