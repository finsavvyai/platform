/**
 * Organization Service
 * Manages organization creation, settings, and member invitations
 */

import { db } from '../../lib/db.js';
import { teams, teamMembers, users } from '../../schema/index.js';
import { eq } from 'drizzle-orm';
import { logger } from '../../utils/logger.js';

export interface Organization {
  id: string;
  name: string;
  ownerId: string;
  plan: string;
  maxMembers: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Invitation {
  email: string;
  role: string;
  status: 'pending' | 'accepted';
  createdAt: Date;
  expiresAt: Date;
}

export interface OrgStats {
  teamCount: number;
  memberCount: number;
  totalProjects: number;
  totalTests: number;
  planLimit: number;
  membersUsed: number;
}

export class OrganizationService {
  /**
   * Create new organization
   */
  async createOrganization(
    name: string,
    ownerId: string,
  ): Promise<Organization> {
    try {
      // Create default team for organization
      const [team] = await db
        .insert(teams)
        .values({
          name: `${name} - Default Team`,
          ownerId,
          plan: 'free',
          maxMembers: 5,
        })
        .returning();

      if (!team) {
        throw new Error('Failed to create organization');
      }

      // Add owner as team member
      await db.insert(teamMembers).values({
        teamId: team.id,
        userId: ownerId,
        role: 'owner',
      });

      const org: Organization = {
        id: team.id,
        name,
        ownerId,
        plan: 'free',
        maxMembers: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      logger.info(`Organization ${org.id} created by user ${ownerId}`);
      return org;
    } catch (error) {
      logger.error('Create organization error:', error);
      throw error;
    }
  }

  /**
   * Get organization by ID
   */
  async getOrganization(orgId: string): Promise<Organization | null> {
    try {
      const [team] = await db
        .select()
        .from(teams)
        .where(eq(teams.id, orgId))
        .limit(1);

      if (!team) {
        return null;
      }

      return {
        id: team.id,
        name: team.name,
        ownerId: team.ownerId,
        plan: team.plan,
        maxMembers: team.maxMembers,
        createdAt: team.createdAt,
        updatedAt: team.updatedAt,
      } as Organization;
    } catch (error) {
      logger.error('Get organization error:', error);
      throw error;
    }
  }

  /**
   * Update organization
   */
  async updateOrganization(
    orgId: string,
    data: Partial<Organization>,
  ): Promise<Organization> {
    try {
      const [updated] = await db
        .update(teams)
        .set({
          name: data.name,
          plan: data.plan,
          maxMembers: data.maxMembers,
          updatedAt: new Date(),
        })
        .where(eq(teams.id, orgId))
        .returning();

      if (!updated) {
        throw new Error('Organization not found');
      }

      logger.info(`Organization ${orgId} updated`);
      return {
        id: updated.id,
        name: updated.name,
        ownerId: updated.ownerId,
        plan: updated.plan,
        maxMembers: updated.maxMembers,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      } as Organization;
    } catch (error) {
      logger.error('Update organization error:', error);
      throw error;
    }
  }

  /**
   * Invite user to organization
   */
  async inviteUser(
    orgId: string,
    email: string,
    role: string = 'member',
  ): Promise<Invitation> {
    try {
      // Check if user exists
      const [existingUser] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (!existingUser) {
        // Return invitation for registration
        return {
          email,
          role,
          status: 'pending',
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        };
      }

      // Add existing user to organization
      await db.insert(teamMembers).values({
        teamId: orgId,
        userId: existingUser.id,
        role,
      });

      logger.info(`User ${email} invited to organization ${orgId}`);

      return {
        email,
        role,
        status: 'accepted',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };
    } catch (error) {
      logger.error('Invite user error:', error);
      throw error;
    }
  }

  /**
   * Get organization statistics
   */
  async getOrgStats(orgId: string): Promise<OrgStats> {
    try {
      // Get team count (simplified - using team as org)
      const teamCount = 1;

      // Get member count
      const memberResults = await db
        .select()
        .from(teamMembers)
        .where(eq(teamMembers.teamId, orgId));

      const memberCount = memberResults.length;

      // Get plan info
      const [org] = await db
        .select({ maxMembers: teams.maxMembers, plan: teams.plan })
        .from(teams)
        .where(eq(teams.id, orgId))
        .limit(1);

      const stats: OrgStats = {
        teamCount,
        memberCount,
        totalProjects: 0, // Would need to count from projects table
        totalTests: 0, // Would need to count from test_cases table
        planLimit: org?.maxMembers || 5,
        membersUsed: memberCount,
      };

      logger.info(`Organization stats retrieved for ${orgId}`);
      return stats;
    } catch (error) {
      logger.error('Get organization stats error:', error);
      throw error;
    }
  }

  /**
   * Get organization members
   */
  async getOrgMembers(orgId: string): Promise<any[]> {
    try {
      const members = await db
        .select({
          id: teamMembers.id,
          userId: teamMembers.userId,
          role: teamMembers.role,
          joinedAt: teamMembers.joinedAt,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
        })
        .from(teamMembers)
        .leftJoin(users, eq(teamMembers.userId, users.id))
        .where(eq(teamMembers.teamId, orgId));

      return members;
    } catch (error) {
      logger.error('Get organization members error:', error);
      throw error;
    }
  }

  /**
   * Remove user from organization
   */
  async removeUser(orgId: string, userId: string): Promise<void> {
    try {
      const [member] = await db
        .select({ role: teamMembers.role })
        .from(teamMembers)
        .where(eq(teamMembers.teamId, orgId))
        .limit(1);

      if (member?.role === 'owner') {
        throw new Error('Cannot remove organization owner');
      }

      await db
        .delete(teamMembers)
        .where(eq(teamMembers.teamId, orgId));

      logger.info(`User ${userId} removed from organization ${orgId}`);
    } catch (error) {
      logger.error('Remove user from organization error:', error);
      throw error;
    }
  }

  /**
   * Update organization plan
   */
  async updatePlan(
    orgId: string,
    plan: string,
    maxMembers: number,
  ): Promise<Organization> {
    try {
      const [updated] = await db
        .update(teams)
        .set({
          plan,
          maxMembers,
          updatedAt: new Date(),
        })
        .where(eq(teams.id, orgId))
        .returning();

      if (!updated) {
        throw new Error('Organization not found');
      }

      logger.info(`Organization ${orgId} plan updated to ${plan}`);
      return {
        id: updated.id,
        name: updated.name,
        ownerId: updated.ownerId,
        plan: updated.plan,
        maxMembers: updated.maxMembers,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      } as Organization;
    } catch (error) {
      logger.error('Update plan error:', error);
      throw error;
    }
  }

  /**
   * Check if user is organization admin
   */
  async isOrgAdmin(orgId: string, userId: string): Promise<boolean> {
    try {
      const [member] = await db
        .select({ role: teamMembers.role })
        .from(teamMembers)
        .where(eq(teamMembers.teamId, orgId));

      if (!member) {
        return false;
      }

      return ['owner', 'admin'].includes(member.role);
    } catch (error) {
      logger.error('Check org admin error:', error);
      return false;
    }
  }
}

export const organizationService = new OrganizationService();
