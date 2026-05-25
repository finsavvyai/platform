/**
 * Organization Routes
 * Endpoints for organization management and settings
 */

import { Router, Request, Response } from 'express';
import { authenticateUser } from '../../middleware/auth.js';
import { organizationService } from './OrganizationService.js';
import { logger } from '../../utils/logger.js';
import { requirePermission, requireMinimumRole } from '../rbac/RBACMiddleware.js';

const router = Router();

/**
 * POST /api/organizations
 * Create new organization
 */
router.post(
  '/',
  authenticateUser,
  async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { name } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Organization name required' });
      }

      const org = await organizationService.createOrganization(name, req.user.userId);
      return res.status(201).json(org);
    } catch (error) {
      logger.error('Create organization error:', error);
      return res.status(500).json({ error: 'Failed to create organization' });
    }
  },
);

/**
 * GET /api/organizations/:id
 * Get organization details
 */
router.get(
  '/:id',
  authenticateUser,
  async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id } = req.params;
      const org = await organizationService.getOrganization(id);

      if (!org) {
        return res.status(404).json({ error: 'Organization not found' });
      }

      // Check if user is org member or admin
      const isAdmin = await organizationService.isOrgAdmin(id, req.user.userId);
      if (!isAdmin && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Organization access denied' });
      }

      return res.json(org);
    } catch (error) {
      logger.error('Get organization error:', error);
      return res.status(500).json({ error: 'Failed to get organization' });
    }
  },
);

/**
 * PUT /api/organizations/:id
 * Update organization
 */
router.put(
  '/:id',
  authenticateUser,
  requireMinimumRole('team_lead'),
  async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id } = req.params;
      const org = await organizationService.getOrganization(id);

      if (!org) {
        return res.status(404).json({ error: 'Organization not found' });
      }

      if (org.ownerId !== req.user.userId && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const updated = await organizationService.updateOrganization(id, req.body);
      return res.json(updated);
    } catch (error) {
      logger.error('Update organization error:', error);
      return res.status(500).json({ error: 'Failed to update organization' });
    }
  },
);

/**
 * GET /api/organizations/:id/members
 * Get organization members
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
      const org = await organizationService.getOrganization(id);

      if (!org) {
        return res.status(404).json({ error: 'Organization not found' });
      }

      const isAdmin = await organizationService.isOrgAdmin(id, req.user.userId);
      if (!isAdmin && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Organization access denied' });
      }

      const members = await organizationService.getOrgMembers(id);
      return res.json(members);
    } catch (error) {
      logger.error('Get organization members error:', error);
      return res.status(500).json({ error: 'Failed to get members' });
    }
  },
);

/**
 * POST /api/organizations/:id/invite
 * Invite user to organization
 */
router.post(
  '/:id/invite',
  authenticateUser,
  requirePermission('team:invite'),
  async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id } = req.params;
      const { email, role } = req.body;

      if (!email) {
        return res.status(400).json({ error: 'Email required' });
      }

      const org = await organizationService.getOrganization(id);
      if (!org) {
        return res.status(404).json({ error: 'Organization not found' });
      }

      if (org.ownerId !== req.user.userId && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const invitation = await organizationService.inviteUser(
        id,
        email,
        role || 'member',
      );

      return res.status(201).json({
        message: 'User invited',
        invitation,
      });
    } catch (error) {
      logger.error('Invite user error:', error);
      const message = (error as Error).message;
      const statusCode = message.includes('not found') ? 404 : 400;
      return res.status(statusCode).json({ error: message });
    }
  },
);

/**
 * DELETE /api/organizations/:id/members/:userId
 * Remove user from organization
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
      const org = await organizationService.getOrganization(id);

      if (!org) {
        return res.status(404).json({ error: 'Organization not found' });
      }

      if (org.ownerId !== req.user.userId && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      await organizationService.removeUser(id, userId);
      return res.json({ message: 'User removed' });
    } catch (error) {
      logger.error('Remove user error:', error);
      const message = (error as Error).message;
      const statusCode = message.includes('not found') ? 404 : 400;
      return res.status(statusCode).json({ error: message });
    }
  },
);

/**
 * GET /api/organizations/:id/stats
 * Get organization statistics
 */
router.get(
  '/:id/stats',
  authenticateUser,
  async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id } = req.params;
      const org = await organizationService.getOrganization(id);

      if (!org) {
        return res.status(404).json({ error: 'Organization not found' });
      }

      const isAdmin = await organizationService.isOrgAdmin(id, req.user.userId);
      if (!isAdmin && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Organization access denied' });
      }

      const stats = await organizationService.getOrgStats(id);
      return res.json(stats);
    } catch (error) {
      logger.error('Get organization stats error:', error);
      return res.status(500).json({ error: 'Failed to get stats' });
    }
  },
);

/**
 * PUT /api/organizations/:id/plan
 * Update organization plan
 */
router.put(
  '/:id/plan',
  authenticateUser,
  requirePermission('billing:manage'),
  async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id } = req.params;
      const { plan, maxMembers } = req.body;

      if (!plan || !maxMembers) {
        return res.status(400).json({
          error: 'Plan and maxMembers required',
        });
      }

      const org = await organizationService.getOrganization(id);
      if (!org) {
        return res.status(404).json({ error: 'Organization not found' });
      }

      if (org.ownerId !== req.user.userId && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const updated = await organizationService.updatePlan(id, plan, maxMembers);
      return res.json(updated);
    } catch (error) {
      logger.error('Update organization plan error:', error);
      return res.status(500).json({ error: 'Failed to update plan' });
    }
  },
);

export default router;
