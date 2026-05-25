/**
 * Admin API Routes for AutoBoot Dashboard
 * Database inspection and management endpoints
 */

import { Hono } from 'hono';

interface Env {
  DASHBOARD_DB: D1Database;
  DASHBOARD_CACHE: KVNamespace;
}

const adminRoutes = new Hono<{ Bindings: Env }>();

/**
 * Get list of all tables in database
 */
adminRoutes.get('/database/tables', async (c) => {
  try {
    const result = await c.env.DASHBOARD_DB.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='table'
      ORDER BY name
    `).all();

    return c.json({
      tables: result.results?.map((row: Record<string, unknown>) => row.name) || []
    });
  } catch (error) {
    console.error('Error fetching tables:', error);
    return c.json({ error: 'Failed to fetch tables' }, 500);
  }
});

/**
 * Get schema for a specific table
 */
adminRoutes.get('/database/schema/:tableName', async (c) => {
  try {
    const tableName = c.req.param('tableName');

    // Get column information
    const result = await c.env.DASHBOARD_DB.prepare(`
      PRAGMA table_info(${tableName})
    `).all();

    if (!result.results || result.results.length === 0) {
      return c.json({ error: 'Table not found' }, 404);
    }

    return c.json({
      table: tableName,
      columns: result.results
    });
  } catch (error) {
    console.error('Error fetching schema:', error);
    return c.json({ error: 'Failed to fetch schema' }, 500);
  }
});

/**
 * Get indexes for a specific table
 */
adminRoutes.get('/database/indexes/:tableName', async (c) => {
  try {
    const tableName = c.req.param('tableName');

    // Get index information
    const result = await c.env.DASHBOARD_DB.prepare(`
      PRAGMA index_list(${tableName})
    `).all();

    return c.json({
      table: tableName,
      indexes: result.results || []
    });
  } catch (error) {
    console.error('Error fetching indexes:', error);
    return c.json({ error: 'Failed to fetch indexes' }, 500);
  }
});

/**
 * Get database statistics
 */
adminRoutes.get('/database/stats', async (c) => {
  try {
    // Get row counts for each table
    const tables = ['dashboard_users', 'dashboard_organizations', 'dashboard_sessions', 'dashboard_api_keys', 'dashboard_audit_logs'];
    const stats: Record<string, number> = {};

    for (const table of tables) {
      try {
        const result = await c.env.DASHBOARD_DB.prepare(`
          SELECT COUNT(*) as count FROM ${table}
        `).first();
        stats[table] = (result as { count?: number })?.count || 0;
      } catch (error) {
        stats[table] = 0;
      }
    }

    return c.json({
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return c.json({ error: 'Failed to fetch stats' }, 500);
  }
});

/**
 * Health check for database
 */
adminRoutes.get('/database/health', async (c) => {
  try {
    // Try a simple query
    await c.env.DASHBOARD_DB.prepare('SELECT 1').first();

    return c.json({
      status: 'healthy',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Database health check failed:', error);
    return c.json({
      status: 'unhealthy',
      error: 'Database query failed',
      timestamp: new Date().toISOString()
    }, 503);
  }
});

export default adminRoutes;
