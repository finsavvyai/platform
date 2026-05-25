/**
 * RBAC Routes
 * Endpoints for managing permissions and role information
 */

import { Router, Request, Response } from 'express';
import { authenticateUser } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/auth.js';
import { permissionEngine } from './PermissionEngine.js';
import type { Permission } from './types.js';
import { requirePermission, requireRole as requireRoleMiddleware } from './RBACMiddleware.js';
import { db } from '../../lib/db.js';
import { users } from '../../schema/index.js';
import { eq } from 'drizzle-orm';
import { logger } from '../../utils/logger.js';

const router = Router();

/**
 * GET /api/rbac/permissions
 * Get user's current permissions
 */
router.get(
  '/permissions',
  authenticateUser,
  async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const permissions = await permissionEngine.getUserPermissions(
        req.user.userId,
      );

      return res.json({
        userId: req.user.userId,
        role: req.user.role,
        permissions,
      });
    } catch (error) {
      logger.error('Get permissions error:', error);
      return res.status(500).json({ error: 'Failed to get permissions' });
    }
  },
);

/**
 * GET /api/rbac/roles
 * Get all available roles and their permissions
 */
router.get(
  '/roles',
  authenticateUser,
  async (req: Request, res: Response) => {
    try {
      const roles = permissionEngine.getAllRoles();
      const hierarchy = permissionEngine.getRoleHierarchy();

      return res.json({
        roles,
        hierarchy,
      });
    } catch (error) {
      logger.error('Get roles error:', error);
      return res.status(500).json({ error: 'Failed to get roles' });
    }
  },
);

/**
 * POST /api/rbac/permissions/check
 * Check if user has specific permission(s)
 */
router.post(
  '/permissions/check',
  authenticateUser,
  async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { permission, permissions: permissionList } = req.body;

      if (!permission && !permissionList) {
        return res.status(400).json({
          error: 'Permission or permissions array required',
        });
      }

      if (permission) {
        const result = await permissionEngine.checkPermission(
          req.user.userId,
          permission,
        );
        return res.json(result);
      }

      // Check multiple permissions
      const results = await Promise.all(
        permissionList.map((p: string) =>
          permissionEngine.checkPermission(req.user!.userId, p as Permission),
        ),
      );

      return res.json({
        checks: permissionList.map((p: string, idx: number) => ({
          permission: p,
          ...results[idx],
        })),
      });
    } catch (error) {
      logger.error('Permission check error:', error);
      return res.status(500).json({ error: 'Permission check failed' });
    }
  },
);

/**
 * PUT /api/rbac/users/:userId/role
 * Update user role (admin only)
 */
router.put(
  '/users/:userId/role',
  authenticateUser,
  requireRoleMiddleware('admin', 'owner'),
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { role } = req.body;

      if (!role) {
        return res.status(400).json({ error: 'Role required' });
      }

      const validRoles = ['viewer', 'tester', 'developer', 'team_lead', 'admin', 'owner'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }

      // Prevent downgrading owner role
      if (req.user?.role === 'owner' && role !== 'owner') {
        const [user] = await db
          .select({ role: users.role })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        if (user?.role === 'owner') {
          return res.status(403).json({
            error: 'Cannot downgrade owner role',
          });
        }
      }

      const [updated] = await db
        .update(users)
        .set({ role })
        .where(eq(users.id, userId))
        .returning({ id: users.id, email: users.email, role: users.role });

      if (!updated) {
        return res.status(404).json({ error: 'User not found' });
      }

      logger.info(`User ${userId} role updated to ${role} by ${req.user?.userId}`);

      return res.json({
        message: 'User role updated',
        user: updated,
      });
    } catch (error) {
      logger.error('Update user role error:', error);
      return res.status(500).json({ error: 'Failed to update user role' });
    }
  },
);

/**
 * GET /api/rbac/users/:userId/role
 * Get user's current role and permissions
 */
router.get(
  '/users/:userId/role',
  authenticateUser,
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;

      // Users can only check their own role unless they're admin
      if (userId !== req.user?.userId && req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const [user] = await db
        .select({
          id: users.id,
          email: users.email,
          role: users.role,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const permissions = permissionEngine.getRolePermissions(
        user.role as any,
      );

      return res.json({
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
        permissions,
      });
    } catch (error) {
      logger.error('Get user role error:', error);
      return res.status(500).json({ error: 'Failed to get user role' });
    }
  },
);

export default router;
