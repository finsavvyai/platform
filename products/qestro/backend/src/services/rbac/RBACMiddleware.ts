/**
 * RBAC Middleware
 * Express middleware for permission and role-based access control
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../../utils/logger.js';
import { permissionEngine } from './PermissionEngine.js';
import { Permission, Role, AccessLevel } from './types.js';

/**
 * Require one or more permissions
 */
export const requirePermission =
  (...permissions: Permission[]) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const hasPermission = await permissionEngine.hasAnyPermission(
        req.user.userId,
        permissions,
      );

      if (!hasPermission) {
        logger.warn(
          `Permission denied for user ${req.user.userId}. Required: ${permissions.join(', ')}`,
        );
        return res.status(403).json({
          error: 'Insufficient permissions',
          required: permissions,
        });
      }

      next();
    } catch (error) {
      logger.error('Permission check error:', error);
      return res.status(500).json({ error: 'Permission check failed' });
    }
  };

/**
 * Require all of multiple permissions
 */
export const requireAllPermissions =
  (...permissions: Permission[]) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const hasAllPermissions = await permissionEngine.hasAllPermissions(
        req.user.userId,
        permissions,
      );

      if (!hasAllPermissions) {
        logger.warn(
          `All permissions required for user ${req.user.userId}. Required: ${permissions.join(', ')}`,
        );
        return res.status(403).json({
          error: 'Insufficient permissions',
          required: permissions,
        });
      }

      next();
    } catch (error) {
      logger.error('Permission check error:', error);
      return res.status(500).json({ error: 'Permission check failed' });
    }
  };

/**
 * Require specific role
 */
export const requireRole =
  (...roles: Role[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role as Role)) {
      logger.warn(
        `Role check failed for user ${req.user.userId}. Required: ${roles.join(', ')}, Got: ${req.user.role}`,
      );
      return res.status(403).json({
        error: 'Insufficient role',
        required: roles,
        current: req.user.role,
      });
    }

    next();
  };

/**
 * Require at least a minimum role
 */
export const requireMinimumRole =
  (minimumRole: Role) =>
  (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const roleHierarchy: Role[] = [
      'viewer',
      'tester',
      'developer',
      'team_lead',
      'admin',
      'owner',
    ];

    const userRoleIndex = roleHierarchy.indexOf(req.user.role as Role);
    const minimumRoleIndex = roleHierarchy.indexOf(minimumRole);

    if (userRoleIndex < minimumRoleIndex) {
      logger.warn(
        `Minimum role check failed for user ${req.user.userId}. Required: ${minimumRole}, Got: ${req.user.role}`,
      );
      return res.status(403).json({
        error: 'Insufficient role',
        required: minimumRole,
        current: req.user.role,
      });
    }

    next();
  };

/**
 * Require project access at specified level
 */
export const requireProjectAccess =
  (accessLevel: AccessLevel = 'read') =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const projectId = req.params.projectId || req.body?.projectId;
      if (!projectId) {
        return res.status(400).json({ error: 'Project ID required' });
      }

      // Check if user has appropriate access
      // For now, allow developers and above
      const minimumAccess: AccessLevel[] = ['read', 'write', 'admin', 'owner'];
      const requiredIndex = minimumAccess.indexOf(accessLevel);
      const canAccess = await permissionEngine.hasPermission(
        req.user.userId,
        'project:read',
        projectId,
      );

      if (!canAccess) {
        logger.warn(
          `Project access denied for user ${req.user.userId} on project ${projectId}`,
        );
        return res.status(403).json({
          error: 'Project access denied',
          projectId,
          required: accessLevel,
        });
      }

      next();
    } catch (error) {
      logger.error('Project access check error:', error);
      return res.status(500).json({ error: 'Access check failed' });
    }
  };

/**
 * Require team membership
 */
export const requireTeamMembership =
  (minimumRole: string = 'member') =>
  (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      if (!req.user.teamId) {
        return res.status(403).json({ error: 'Team membership required' });
      }

      next();
    } catch (error) {
      logger.error('Team membership check error:', error);
      return res.status(500).json({ error: 'Team check failed' });
    }
  };

/**
 * Optional permission check (doesn't fail, just sets metadata)
 */
export const checkPermissionOptional =
  (...permissions: Permission[]) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return next();
      }

      const hasPermission = await permissionEngine.hasAnyPermission(
        req.user.userId,
        permissions,
      );

      // Attach permission result to request
      (req as any).hasPermission = hasPermission;
      next();
    } catch (error) {
      logger.error('Optional permission check error:', error);
      (req as any).hasPermission = false;
      next();
    }
  };
