/**
 * Dashboard Data API Routes
 * Provides real user data, stats, and analytics
 */

import { Hono } from 'hono';
import { requireAuth, type User } from './auth-secure';
import { type Env } from './types';

const dashboardApiRoutes = new Hono<{ Bindings: Env }>();

/**
 * GET /api/v1/dashboard/stats
 * Get user's dashboard statistics
 */
dashboardApiRoutes.get('/stats', requireAuth, async (c) => {
  try {
    const user = c.get('user') as User;

    // Get API key count
    const apiKeyCount = await c.env.DASHBOARD_DB.prepare(`
      SELECT COUNT(*) as count FROM dashboard_api_keys
      WHERE user_id = ? AND is_active = 1
    `).bind(user.id).first();

    // Get session count
    const sessionCount = await c.env.DASHBOARD_DB.prepare(`
      SELECT COUNT(*) as count FROM dashboard_sessions
      WHERE user_id = ? AND expires_at > datetime('now')
    `).bind(user.id).first();

    // Get recent activity (last 7 days)
    const recentActivity = await c.env.DASHBOARD_DB.prepare(`
      SELECT
        DATE(created_at) as date,
        action,
        COUNT(*) as count
      FROM dashboard_audit_logs
      WHERE user_id = ? AND created_at > datetime('now', '-7 days')
      GROUP BY DATE(created_at), action
      ORDER BY created_at DESC
      LIMIT 50
    `).bind(user.id).all();

    // Get API key usage stats
    const apiKeyUsage = await c.env.DASHBOARD_DB.prepare(`
      SELECT
        name,
        key_prefix,
        last_used_at,
        is_active
      FROM dashboard_api_keys
      WHERE user_id = ?
      ORDER BY last_used_at DESC NULLS LAST
      LIMIT 10
    `).bind(user.id).all();

    return c.json({
      stats: {
        apiKeys: {
          active: (apiKeyCount as any)?.count || 0,
        },
        sessions: {
          active: (sessionCount as any)?.count || 0,
        },
        user: {
          emailVerified: user.email_verified === 1,
          role: user.role,
          createdAt: user.createdAt,
        },
      },
      recentActivity: recentActivity.results || [],
      apiKeyUsage: apiKeyUsage.results || [],
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return c.json({
      error: 'Failed to fetch dashboard stats',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * GET /api/v1/dashboard/activity
 * Get detailed activity logs
 */
dashboardApiRoutes.get('/activity', requireAuth, async (c) => {
  try {
    const user = c.get('user') as User;
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');

    const result = await c.env.DASHBOARD_DB.prepare(`
      SELECT
        id, action, resource_type, resource_id, status, details,
        ip_address, user_agent, created_at
      FROM dashboard_audit_logs
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).bind(user.id, limit, offset).all();

    const totalCount = await c.env.DASHBOARD_DB.prepare(`
      SELECT COUNT(*) as count FROM dashboard_audit_logs WHERE user_id = ?
    `).bind(user.id).first();

    return c.json({
      activities: result.results || [],
      pagination: {
        limit,
        offset,
        total: (totalCount as any)?.count || 0,
      },
    });
  } catch (error) {
    console.error('Activity logs error:', error);
    return c.json({
      error: 'Failed to fetch activity logs',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * GET /api/v1/dashboard/sessions
 * Get active sessions
 */
dashboardApiRoutes.get('/sessions', requireAuth, async (c) => {
  try {
    const user = c.get('user') as User;

    const result = await c.env.DASHBOARD_DB.prepare(`
      SELECT
        id, ip_address, user_agent, created_at, last_activity_at, expires_at
      FROM dashboard_sessions
      WHERE user_id = ? AND expires_at > datetime('now')
      ORDER BY last_activity_at DESC
    `).bind(user.id).all();

    return c.json({
      sessions: result.results || [],
      total: result.results?.length || 0,
    });
  } catch (error) {
    console.error('Sessions list error:', error);
    return c.json({
      error: 'Failed to fetch sessions',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * DELETE /api/v1/dashboard/sessions/:id
 * Revoke a session
 */
dashboardApiRoutes.delete('/sessions/:id', requireAuth, async (c) => {
  try {
    const user = c.get('user') as User;
    const sessionId = c.req.param('id');

    // Verify ownership
    const session = await c.env.DASHBOARD_DB.prepare(`
      SELECT id FROM dashboard_sessions WHERE id = ? AND user_id = ?
    `).bind(sessionId, user.id).first();

    if (!session) {
      return c.json({
        error: 'Not found',
        message: 'Session not found',
      }, 404);
    }

    // Delete session
    await c.env.DASHBOARD_DB.prepare(`
      DELETE FROM dashboard_sessions WHERE id = ?
    `).bind(sessionId).run();

    return c.json({
      success: true,
      message: 'Session revoked successfully',
    });
  } catch (error) {
    console.error('Session revocation error:', error);
    return c.json({
      error: 'Failed to revoke session',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * GET /api/v1/dashboard/organization
 * Get organization details (if user belongs to one)
 */
dashboardApiRoutes.get('/organization', requireAuth, async (c) => {
  try {
    const user = c.get('user') as User;

    if (!user.organizationId) {
      return c.json({
        organization: null,
        message: 'User does not belong to an organization',
      });
    }

    const org = await c.env.DASHBOARD_DB.prepare(`
      SELECT
        id, name, slug, description, subscription_plan, subscription_status,
        trial_ends_at, is_active, created_at, updated_at
      FROM dashboard_organizations
      WHERE id = ?
    `).bind(user.organizationId).first();

    if (!org) {
      return c.json({
        organization: null,
        message: 'Organization not found',
      }, 404);
    }

    // Get member count
    const memberCount = await c.env.DASHBOARD_DB.prepare(`
      SELECT COUNT(*) as count FROM dashboard_users WHERE organization_id = ?
    `).bind(user.organizationId).first();

    return c.json({
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        description: org.description,
        subscriptionPlan: org.subscription_plan,
        subscriptionStatus: org.subscription_status,
        trialEndsAt: org.trial_ends_at,
        isActive: org.is_active === 1,
        memberCount: (memberCount as any)?.count || 0,
        createdAt: org.created_at,
        updatedAt: org.updated_at,
      },
    });
  } catch (error) {
    console.error('Organization fetch error:', error);
    return c.json({
      error: 'Failed to fetch organization',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

export default dashboardApiRoutes;
