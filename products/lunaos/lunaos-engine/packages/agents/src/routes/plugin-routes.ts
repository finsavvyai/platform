import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { PluginManager } from '../plugin/manager';
import { PluginStatus } from '../plugin/interfaces';
import { logger } from '../utils/logger';

const router = Router();

// Middleware to validate request
const validateRequest = (req: any, res: any, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

/**
 * GET /api/plugins
 * List all plugins with optional filtering
 */
router.get('/',
  query('category').optional().isString(),
  query('status').optional().isIn(Object.values(PluginStatus)),
  query('tags').optional().isString(),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 }),
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { category, status, tags, limit, offset } = req.query;
      const pluginManager: PluginManager = req.app.get('pluginManager');

      const filter: any = {};
      if (category) filter.category = category;
      if (status) filter.status = status;
      if (tags) filter.tags = tags.split(',').map((tag: string) => tag.trim());

      let plugins = await pluginManager.listPlugins(filter);

      // Apply pagination
      const startIndex = offset ? parseInt(offset) : 0;
      const endIndex = limit ? startIndex + parseInt(limit) : plugins.length;
      plugins = plugins.slice(startIndex, endIndex);

      // Transform for response
      const pluginList = plugins.map(plugin => ({
        name: plugin.name,
        version: plugin.version,
        description: plugin.manifest.description,
        author: plugin.manifest.author,
        category: plugin.manifest.category,
        tags: plugin.manifest.tags,
        status: plugin.status,
        lastError: plugin.lastError?.message,
        autoStart: plugin.manifest.autoStart !== false,
        permissions: plugin.manifest.permissions,
        dependencies: plugin.manifest.dependencies,
        engines: plugin.manifest.engines
      }));

      res.json({
        plugins: pluginList,
        pagination: {
          total: plugins.length,
          limit: limit ? parseInt(limit) : null,
          offset: offset ? parseInt(offset) : 0
        }
      });

    } catch (error) {
      logger.error('Failed to list plugins:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to list plugins'
      });
    }
  }
);

/**
 * GET /api/plugins/:name
 * Get detailed information about a specific plugin
 */
router.get('/:name',
  param('name').isString().isLength({ min: 1, max: 100 }),
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { name } = req.params;
      const pluginManager: PluginManager = req.app.get('pluginManager');

      const plugin = await pluginManager.getPlugin(name);
      if (!plugin) {
        return res.status(404).json({
          error: 'Plugin not found',
          message: `Plugin "${name}" not found`
        });
      }

      const config = await pluginManager.getPluginConfig(name);

      res.json({
        name: plugin.name,
        version: plugin.version,
        description: plugin.manifest.description,
        author: plugin.manifest.author,
        license: plugin.manifest.license,
        homepage: plugin.manifest.homepage,
        repository: plugin.manifest.repository,
        bugs: plugin.manifest.bugs,
        keywords: plugin.manifest.keywords,
        category: plugin.manifest.category,
        tags: plugin.manifest.tags,
        status: plugin.status,
        lastError: plugin.lastError?.message,
        autoStart: plugin.manifest.autoStart !== false,
        permissions: plugin.manifest.permissions,
        dependencies: plugin.manifest.dependencies,
        engines: plugin.manifest.engines,
        workingDirectory: plugin.workingDirectory,
        config: config,
        manifest: plugin.manifest
      });

    } catch (error) {
      logger.error(`Failed to get plugin ${req.params.name}:`, error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to get plugin details'
      });
    }
  }
);

/**
 * POST /api/plugins/install
 * Install a new plugin from a source
 */
router.post('/install',
  body('source').isString().isLength({ min: 1 }),
  body('force').optional().isBoolean(),
  body('autoStart').optional().isBoolean(),
  body('config').optional().isObject(),
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { source, force, autoStart, config } = req.body;
      const pluginManager: PluginManager = req.app.get('pluginManager');

      const plugin = await pluginManager.installPlugin(source, {
        force: force || false,
        autoStart: autoStart || false,
        config: config || {}
      });

      res.status(201).json({
        message: 'Plugin installed successfully',
        plugin: {
          name: plugin.name,
          version: plugin.version,
          description: plugin.manifest.description,
          category: plugin.manifest.category,
          status: plugin.status,
          autoStart: plugin.manifest.autoStart !== false
        }
      });

    } catch (error) {
      logger.error('Failed to install plugin:', error);
      res.status(400).json({
        error: 'Installation failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * DELETE /api/plugins/:name
 * Uninstall a plugin
 */
router.delete('/:name',
  param('name').isString().isLength({ min: 1, max: 100 }),
  body('force').optional().isBoolean(),
  body('removeConfig').optional().isBoolean(),
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { name } = req.params;
      const { force, removeConfig } = req.body;
      const pluginManager: PluginManager = req.app.get('pluginManager');

      await pluginManager.uninstallPlugin(name, {
        force: force || false,
        removeConfig: removeConfig || false
      });

      res.json({
        message: 'Plugin uninstalled successfully',
        plugin: { name }
      });

    } catch (error) {
      logger.error(`Failed to uninstall plugin ${req.params.name}:`, error);
      res.status(400).json({
        error: 'Uninstallation failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * POST /api/plugins/:name/enable
 * Enable a plugin
 */
router.post('/:name/enable',
  param('name').isString().isLength({ min: 1, max: 100 }),
  body('config').optional().isObject(),
  body('autoStart').optional().isBoolean(),
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { name } = req.params;
      const { config, autoStart } = req.body;
      const pluginManager: PluginManager = req.app.get('pluginManager');

      await pluginManager.enablePlugin(name, {
        config,
        autoStart: autoStart || false
      });

      res.json({
        message: 'Plugin enabled successfully',
        plugin: { name }
      });

    } catch (error) {
      logger.error(`Failed to enable plugin ${req.params.name}:`, error);
      res.status(400).json({
        error: 'Enable failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * POST /api/plugins/:name/disable
 * Disable a plugin
 */
router.post('/:name/disable',
  param('name').isString().isLength({ min: 1, max: 100 }),
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { name } = req.params;
      const pluginManager: PluginManager = req.app.get('pluginManager');

      await pluginManager.disablePlugin(name);

      res.json({
        message: 'Plugin disabled successfully',
        plugin: { name }
      });

    } catch (error) {
      logger.error(`Failed to disable plugin ${req.params.name}:`, error);
      res.status(400).json({
        error: 'Disable failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * POST /api/plugins/:name/start
 * Start a plugin
 */
router.post('/:name/start',
  param('name').isString().isLength({ min: 1, max: 100 }),
  body('config').optional().isObject(),
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { name } = req.params;
      const { config } = req.body;
      const pluginManager: PluginManager = req.app.get('pluginManager');

      await pluginManager.enablePlugin(name, {
        config,
        autoStart: true
      });

      res.json({
        message: 'Plugin started successfully',
        plugin: { name }
      });

    } catch (error) {
      logger.error(`Failed to start plugin ${req.params.name}:`, error);
      res.status(400).json({
        error: 'Start failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * POST /api/plugins/:name/stop
 * Stop a plugin
 */
router.post('/:name/stop',
  param('name').isString().isLength({ min: 1, max: 100 }),
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { name } = req.params;
      const pluginManager: PluginManager = req.app.get('pluginManager');

      await pluginManager.disablePlugin(name);

      res.json({
        message: 'Plugin stopped successfully',
        plugin: { name }
      });

    } catch (error) {
      logger.error(`Failed to stop plugin ${req.params.name}:`, error);
      res.status(400).json({
        error: 'Stop failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * POST /api/plugins/:name/reload
 * Reload a plugin
 */
router.post('/:name/reload',
  param('name').isString().isLength({ min: 1, max: 100 }),
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { name } = req.params;
      const pluginManager: PluginManager = req.app.get('pluginManager');

      await pluginManager.reloadPlugin(name);

      res.json({
        message: 'Plugin reloaded successfully',
        plugin: { name }
      });

    } catch (error) {
      logger.error(`Failed to reload plugin ${req.params.name}:`, error);
      res.status(400).json({
        error: 'Reload failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * POST /api/plugins/:name/update
 * Update a plugin
 */
router.post('/:name/update',
  param('name').isString().isLength({ min: 1, max: 100 }),
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { name } = req.params;
      const pluginManager: PluginManager = req.app.get('pluginManager');

      await pluginManager.updatePlugin(name);

      res.json({
        message: 'Plugin updated successfully',
        plugin: { name }
      });

    } catch (error) {
      logger.error(`Failed to update plugin ${req.params.name}:`, error);
      res.status(400).json({
        error: 'Update failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * POST /api/plugins/:name/execute
 * Execute a plugin
 */
router.post('/:name/execute',
  param('name').isString().isLength({ min: 1, max: 100 }),
  body('request').optional().isObject(),
  body('timeout').optional().isInt({ min: 1000, max: 300000 }),
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { name } = req.params;
      const { request, timeout } = req.body;
      const pluginManager: PluginManager = req.app.get('pluginManager');

      const result = await pluginManager.executePlugin(name, request || {});

      res.json({
        message: 'Plugin executed successfully',
        result: result,
        plugin: { name }
      });

    } catch (error) {
      logger.error(`Failed to execute plugin ${req.params.name}:`, error);
      res.status(400).json({
        error: 'Execution failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * GET /api/plugins/:name/config
 * Get plugin configuration
 */
router.get('/:name/config',
  param('name').isString().isLength({ min: 1, max: 100 }),
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { name } = req.params;
      const pluginManager: PluginManager = req.app.get('pluginManager');

      const config = await pluginManager.getPluginConfig(name);

      res.json({
        plugin: { name },
        config: config
      });

    } catch (error) {
      logger.error(`Failed to get plugin config ${req.params.name}:`, error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to get plugin configuration'
      });
    }
  }
);

/**
 * PUT /api/plugins/:name/config
 * Update plugin configuration
 */
router.put('/:name/config',
  param('name').isString().isLength({ min: 1, max: 100 }),
  body('config').isObject(),
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { name } = req.params;
      const { config } = req.body;
      const pluginManager: PluginManager = req.app.get('pluginManager');

      await pluginManager.setPluginConfig(name, config);

      res.json({
        message: 'Plugin configuration updated successfully',
        plugin: { name },
        config: config
      });

    } catch (error) {
      logger.error(`Failed to update plugin config ${req.params.name}:`, error);
      res.status(400).json({
        error: 'Configuration update failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * GET /api/plugins/categories
 * Get all plugin categories
 */
router.get('/categories',
  async (req: any, res: any) => {
    try {
      const pluginManager: PluginManager = req.app.get('pluginManager');
      const plugins = await pluginManager.listPlugins();

      const categories = new Set(
        plugins
          .map(p => p.manifest.category)
          .filter(Boolean)
      );

      res.json({
        categories: Array.from(categories)
      });

    } catch (error) {
      logger.error('Failed to get plugin categories:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to get plugin categories'
      });
    }
  }
);

/**
 * GET /api/plugins/dependencies
 * Get plugin dependency graph
 */
router.get('/dependencies',
  async (req: any, res: any) => {
    try {
      const pluginManager: PluginManager = req.app.get('pluginManager');
      const dependencyGraph = await pluginManager.getDependencyGraph();

      res.json({
        dependencyGraph: Object.fromEntries(dependencyGraph)
      });

    } catch (error) {
      logger.error('Failed to get dependency graph:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to get dependency graph'
      });
    }
  }
);

/**
 * GET /api/plugins/system/info
 * Get plugin system information
 */
router.get('/system/info',
  async (req: any, res: any) => {
    try {
      const pluginManager: PluginManager = req.app.get('pluginManager');
      const systemInfo = await pluginManager.getSystemInfo();

      res.json(systemInfo);

    } catch (error) {
      logger.error('Failed to get system info:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to get system information'
      });
    }
  }
);

/**
 * POST /api/plugins/system/start
 * Start the plugin system
 */
router.post('/system/start',
  async (req: any, res: any) => {
    try {
      const pluginManager: PluginManager = req.app.get('pluginManager');

      await pluginManager.start();

      res.json({
        message: 'Plugin system started successfully'
      });

    } catch (error) {
      logger.error('Failed to start plugin system:', error);
      res.status(500).json({
        error: 'System start failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * POST /api/plugins/system/stop
 * Stop the plugin system
 */
router.post('/system/stop',
  async (req: any, res: any) => {
    try {
      const pluginManager: PluginManager = req.app.get('pluginManager');

      await pluginManager.stop();

      res.json({
        message: 'Plugin system stopped successfully'
      });

    } catch (error) {
      logger.error('Failed to stop plugin system:', error);
      res.status(500).json({
        error: 'System stop failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * POST /api/plugins/discover
 * Discover plugins in a directory
 */
router.post('/discover',
  body('directory').isString().isLength({ min: 1 }),
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { directory } = req.body;
      const pluginManager: PluginManager = req.app.get('pluginManager');
      const discovery = (pluginManager as any).discovery;

      const manifests = await discovery.discoverPlugins(directory);

      const plugins = manifests.map(manifest => ({
        name: manifest.name,
        version: manifest.version,
        description: manifest.description,
        author: manifest.author,
        category: manifest.category,
        tags: manifest.tags,
        entryPoint: manifest.entryPoint,
        dependencies: manifest.dependencies,
        permissions: manifest.permissions
      }));

      res.json({
        directory: directory,
        plugins: plugins,
        count: plugins.length
      });

    } catch (error) {
      logger.error('Failed to discover plugins:', error);
      res.status(400).json({
        error: 'Discovery failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * POST /api/plugins/search
 * Search for plugins
 */
router.post('/search',
  body('query').isString().isLength({ min: 1, max: 100 }),
  body('category').optional().isString(),
  body('tags').optional().isArray(),
  body('limit').optional().isInt({ min: 1, max: 50 }),
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { query, category, tags, limit } = req.body;
      const pluginManager: PluginManager = req.app.get('pluginManager');
      const discovery = (pluginManager as any).discovery;

      const options: any = {};
      if (category) options.category = category;
      if (tags) options.tags = tags;
      if (limit) options.limit = limit;

      const manifests = await discovery.searchPlugins(query, options);

      const plugins = manifests.map(manifest => ({
        name: manifest.name,
        version: manifest.version,
        description: manifest.description,
        author: manifest.author,
        category: manifest.category,
        tags: manifest.tags,
        repository: manifest.repository,
        homepage: manifest.homepage
      }));

      res.json({
        query: query,
        plugins: plugins,
        count: plugins.length
      });

    } catch (error) {
      logger.error('Failed to search plugins:', error);
      res.status(400).json({
        error: 'Search failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

export default router;
