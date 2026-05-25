/**
 * Team Service
 * Manages team creation, membership, and role management
 */

import { db } from '../../lib/db.js';
import { teams, teamMembers, users } from '../../schema/index.js';
import { eq, and } from 'drizzle-orm';
import { logger } from '../../utils/logger.js';

export interface Team {
  id: string;
  name: string;
  ownerId: string;
  description?: string;
  plan: string;
  maxMembers: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  role: string;
  joinedAt: Date;
  invitedBy?: string;
  user?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
}

export class TeamService {
  /**
   * Create a new team
   */
  async createTeam(
    orgId: string,
    name: string,
    ownerId: string,
    description?: string,
  ): Promise<Team> {
    try {
      const [team] = await db
        .insert(teams)
        .values({
          name,
          ownerId,
          description,
          plan: 'free',
          maxMembers: 5,
        })
        .returning();

      if (!team) {
        throw new Error('Failed to create team');
      }

      // Add owner as team member
      await db.insert(teamMembers).values({
        teamId: team.id,
        userId: ownerId,
        role: 'owner',
      });

      logger.info(`Team ${team.id} created by user ${ownerId}`);
      return team as Team;
    } catch (error) {
      logger.error('Create team error:', error);
      throw error;
    }
  }

  /**
   * Get team by ID
   */
  async getTeam(teamId: string): Promise<Team | null> {
    try {
      const [team] = await db
        .select()
        .from(teams)
        .where(eq(teams.id, teamId))
        .limit(1);

      return (team as Team) || null;
    } catch (error) {
      logger.error('Get team error:', error);
      throw error;
    }
  }

  /**
   * Update team information
   */
  async updateTeam(
    teamId: string,
    data: Partial<Team>,
  ): Promise<Team> {
    try {
      const [updated] = await db
        .update(teams)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(teams.id, teamId))
        .returning();

      if (!updated) {
        throw new Error('Team not found');
      }

      logger.info(`Team ${teamId} updated`);
      return updated as Team;
    } catch (error) {
      logger.error('Update team error:', error);
      throw error;
    }
  }

  /**
   * Delete a team (owner only)
   */
  async deleteTeam(teamId: string, userId: string): Promise<void> {
    try {
      const team = await this.getTeam(teamId);
      if (!team) {
        throw new Error('Team not found');
      }

      if (team.ownerId !== userId) {
        throw new Error('Only team owner can delete team');
      }

      await db.delete(teamMembers).where(eq(teamMembers.teamId, teamId));
      await db.delete(teams).where(eq(teams.id, teamId));

      logger.info(`Team ${teamId} deleted by user ${userId}`);
    } catch (error) {
      logger.error('Delete team error:', error);
      throw error;
    }
  }

  /**
   * Add member to team
   */
  async addMember(
    teamId: string,
    userId: string,
    role: string = 'member',
    invitedBy?: string,
  ): Promise<void> {
    try {
      // Check if user is already a member
      const [existing] = await db
        .select()
        .from(teamMembers)
        .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
        .limit(1);

      if (existing) {
        throw new Error('User is already a team member');
      }

      // Check team member limit
      const [team] = await db
        .select({ maxMembers: teams.maxMembers })
        .from(teams)
        .where(eq(teams.id, teamId))
        .limit(1);

      if (!team) {
        throw new Error('Team not found');
      }

      const memberCount = await db
        .select()
        .from(teamMembers)
        .where(eq(teamMembers.teamId, teamId));

      if (memberCount.length >= team.maxMembers) {
        throw new Error('Team member limit reached');
      }

      await db.insert(teamMembers).values({
        teamId,
        userId,
        role,
        invitedBy,
      });

      logger.info(`User ${userId} added to team ${teamId} with role ${role}`);
    } catch (error) {
      logger.error('Add team member error:', error);
      throw error;
    }
  }

  /**
   * Remove member from team
   */
  async removeMember(teamId: string, userId: string): Promise<void> {
    try {
      const [member] = await db
        .select()
        .from(teamMembers)
        .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
        .limit(1);

      if (!member) {
        throw new Error('Team member not found');
      }

      if (member.role === 'owner') {
        throw new Error('Cannot remove team owner');
      }

      await db
        .delete(teamMembers)
        .where(
          and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)),
        );

      logger.info(`User ${userId} removed from team ${teamId}`);
    } catch (error) {
      logger.error('Remove team member error:', error);
      throw error;
    }
  }

  /**
   * Get team members with user details
   */
  async getTeamMembers(teamId: string): Promise<TeamMember[]> {
    try {
      const result = await db
        .select({
          id: teamMembers.id,
          teamId: teamMembers.teamId,
          userId: teamMembers.userId,
          role: teamMembers.role,
          joinedAt: teamMembers.joinedAt,
          invitedBy: teamMembers.invitedBy,
          userEmail: users.email,
          userFirstName: users.firstName,
          userLastName: users.lastName,
        })
        .from(teamMembers)
        .leftJoin(users, eq(teamMembers.userId, users.id))
        .where(eq(teamMembers.teamId, teamId));

      return result.map((row) => ({
        id: row.id,
        teamId: row.teamId,
        userId: row.userId,
        role: row.role,
        joinedAt: row.joinedAt,
        invitedBy: row.invitedBy || undefined,
        user: {
          id: row.userId,
          email: row.userEmail || '',
          firstName: row.userFirstName || undefined,
          lastName: row.userLastName || undefined,
        },
      })) as TeamMember[];
    } catch (error) {
      logger.error('Get team members error:', error);
      throw error;
    }
  }

  /**
   * Update member role
   */
  async updateMemberRole(
    teamId: string,
    userId: string,
    newRole: string,
  ): Promise<void> {
    try {
      const [member] = await db
        .select()
        .from(teamMembers)
        .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
        .limit(1);

      if (!member) {
        throw new Error('Team member not found');
      }

      if (member.role === 'owner' && newRole !== 'owner') {
        throw new Error('Cannot change owner role');
      }

      await db
        .update(teamMembers)
        .set({ role: newRole })
        .where(
          and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)),
        );

      logger.info(`User ${userId} role in team ${teamId} updated to ${newRole}`);
    } catch (error) {
      logger.error('Update member role error:', error);
      throw error;
    }
  }

  /**
   * Get user's teams
   */
  async getUserTeams(userId: string): Promise<Team[]> {
    try {
      const result = await db
        .select({
          team: teams,
          role: teamMembers.role,
        })
        .from(teams)
        .innerJoin(teamMembers, eq(teams.id, teamMembers.teamId))
        .where(eq(teamMembers.userId, userId));

      return result.map((r) => r.team as Team);
    } catch (error) {
      logger.error('Get user teams error:', error);
      throw error;
    }
  }

  /**
   * Check if user is team member
   */
  async isTeamMember(teamId: string, userId: string): Promise<boolean> {
    try {
      const [member] = await db
        .select()
        .from(teamMembers)
        .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
        .limit(1);

      return !!member;
    } catch (error) {
      logger.error('Check team membership error:', error);
      return false;
    }
  }

  /**
   * Get member role in team
   */
  async getMemberRole(teamId: string, userId: string): Promise<string | null> {
    try {
      const [member] = await db
        .select({ role: teamMembers.role })
        .from(teamMembers)
        .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
        .limit(1);

      return member?.role || null;
    } catch (error) {
      logger.error('Get member role error:', error);
      return null;
    }
  }
}

export const teamService = new TeamService();
