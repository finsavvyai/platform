/**
 * Team Routes
 * Endpoints for team management and member operations
 */

import { Router, Request, Response } from 'express';
import { authenticateUser } from '../../middleware/auth.js';
import { teamService } from './TeamService.js';
import { logger } from '../../utils/logger.js';
import { requirePermission } from '../rbac/RBACMiddleware.js';

const router = Router();

/**
 * POST /api/teams
 * Create a new team
 */
router.post(
  '/',
  authenticateUser,
  requirePermission('team:manage'),
  async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { name, description, orgId } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Team name required' });
      }

      const team = await teamService.createTeam(
        orgId || req.user.userId,
        name,
        req.user.userId,
        description,
      );

      return res.status(201).json(team);
    } catch (error) {
      logger.error('Create team error:', error);
      return res.status(500).json({ error: 'Failed to create team' });
    }
  },
);

/**
 * GET /api/teams
 * Get user's teams
 */
router.get('/', authenticateUser, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userTeams = await teamService.getUserTeams(req.user.userId);
    return res.json(userTeams);
  } catch (error) {
    logger.error('Get user teams error:', error);
    return res.status(500).json({ error: 'Failed to get teams' });
  }
});

/**
 * GET /api/teams/:id
 * Get team details
 */
router.get('/:id', authenticateUser, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;
    const team = await teamService.getTeam(id);

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Check if user is team member
    const isMember = await teamService.isTeamMember(id, req.user.userId);
    if (!isMember && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Team access denied' });
    }

    return res.json(team);
  } catch (error) {
    logger.error('Get team error:', error);
    return res.status(500).json({ error: 'Failed to get team' });
  }
});

/**
 * PUT /api/teams/:id
 * Update team
 */
router.put(
  '/:id',
  authenticateUser,
  requirePermission('team:manage'),
  async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id } = req.params;
      const team = await teamService.getTeam(id);

      if (!team) {
        return res.status(404).json({ error: 'Team not found' });
      }

      if (team.ownerId !== req.user.userId && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const updated = await teamService.updateTeam(id, req.body);
      return res.json(updated);
    } catch (error) {
      logger.error('Update team error:', error);
      return res.status(500).json({ error: 'Failed to update team' });
    }
  },
);

/**
 * DELETE /api/teams/:id
 * Delete team
 */
router.delete(
  '/:id',
  authenticateUser,
  async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id } = req.params;
      await teamService.deleteTeam(id, req.user.userId);

      return res.json({ message: 'Team deleted' });
    } catch (error) {
      logger.error('Delete team error:', error);
      const message = (error as Error).message;
      const statusCode = message.includes('not found') ? 404 : 403;
      return res.status(statusCode).json({ error: message });
    }
  },
);

/**
 * GET /api/teams/:id/members
 * Get team members
 */
router.get(
  '/:id/members',
  authenticateUser,
  async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id } = req.params;
      const isMember = await teamService.isTeamMember(id, req.user.userId);

      if (!isMember && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Team access denied' });
      }

      const members = await teamService.getTeamMembers(id);
      return res.json(members);
    } catch (error) {
      logger.error('Get team members error:', error);
      return res.status(500).json({ error: 'Failed to get team members' });
    }
  },
);

/**
 * POST /api/teams/:id/members
 * Add team member
 */
router.post(
  '/:id/members',
  authenticateUser,
  requirePermission('team:invite'),
  async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id } = req.params;
      const { userId, role } = req.body;

      if (!userId) {
        return res.status(400).json({ error: 'User ID required' });
      }

      const team = await teamService.getTeam(id);
      if (!team) {
        return res.status(404).json({ error: 'Team not found' });
      }

      if (team.ownerId !== req.user.userId && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      await teamService.addMember(id, userId, role || 'member', req.user.userId);
      return res.status(201).json({ message: 'Member added' });
    } catch (error) {
      logger.error('Add team member error:', error);
      const message = (error as Error).message;
      const statusCode = message.includes('limit') ? 409 : 400;
      return res.status(statusCode).json({ error: message });
    }
  },
);

/**
 * DELETE /api/teams/:id/members/:userId
 * Remove team member
 */
router.delete(
  '/:id/members/:userId',
  authenticateUser,
  requirePermission('team:remove'),
  async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id, userId } = req.params;
      const team = await teamService.getTeam(id);

      if (!team) {
        return res.status(404).json({ error: 'Team not found' });
      }

      if (team.ownerId !== req.user.userId && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      await teamService.removeMember(id, userId);
      return res.json({ message: 'Member removed' });
    } catch (error) {
      logger.error('Remove team member error:', error);
      const message = (error as Error).message;
      const statusCode = message.includes('not found') ? 404 : 400;
      return res.status(statusCode).json({ error: message });
    }
  },
);

/**
 * PUT /api/teams/:id/members/:userId/role
 * Update member role
 */
router.put(
  '/:id/members/:userId/role',
  authenticateUser,
  requirePermission('team:manage'),
  async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id, userId } = req.params;
      const { role } = req.body;

      if (!role) {
        return res.status(400).json({ error: 'Role required' });
      }

      const team = await teamService.getTeam(id);
      if (!team) {
        return res.status(404).json({ error: 'Team not found' });
      }

      if (team.ownerId !== req.user.userId && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      await teamService.updateMemberRole(id, userId, role);
      return res.json({ message: 'Member role updated' });
    } catch (error) {
      logger.error('Update member role error:', error);
      const message = (error as Error).message;
      const statusCode = message.includes('not found') ? 404 : 400;
      return res.status(statusCode).json({ error: message });
    }
  },
);

export default router;
