import DatabaseService from './database.js';

export class TeamController {
  constructor(env) {
    this.db = new DatabaseService(env);
  }

  /**
   * Create a new team
   */
  async createTeam(userId, teamData) {
    try {
      // Get user to verify they can create teams
      const user = await this.db.getUserByUserId(userId);
      if (!user) {
        return {
          success: false,
          error: 'User not found',
          error_code: 'user_not_found'
        };
      }

      // Check if user has Pro/Enterprise tier to create teams
      if (user.tier === 'free') {
        return {
          success: false,
          error: 'Team creation requires Pro or Enterprise subscription',
          error_code: 'subscription_required'
        };
      }

      // Validate team data
      if (!teamData.name || teamData.name.trim().length === 0) {
        return {
          success: false,
          error: 'Team name is required',
          error_code: 'missing_team_name'
        };
      }

      // Check user's existing teams (Pro users: 5 teams, Enterprise: unlimited)
      const existingTeams = await this.db.getUserTeams(userId);
      const maxTeams = user.tier === 'pro' ? 5 : 50;

      if (existingTeams.length >= maxTeams) {
        return {
          success: false,
          error: `Maximum team limit (${maxTeams}) reached`,
          error_code: 'team_limit_reached'
        };
      }

      // Create team
      const team = await this.db.createTeam({
        name: teamData.name.trim(),
        description: teamData.description?.trim() || null,
        owner_id: user.id,
        settings: teamData.settings || {}
      });

      return {
        success: true,
        data: {
          id: team.id,
          name: team.name,
          description: team.description,
          owner_id: team.owner_id,
          created_at: team.created_at,
          member_count: 1,
          role: 'owner'
        }
      };

    } catch (error) {
      console.error('Create team error:', error);
      return {
        success: false,
        error: 'Failed to create team',
        error_code: 'create_team_error'
      };
    }
  }

  /**
   * Get teams for a user
   */
  async getUserTeams(userId) {
    try {
      const teams = await this.db.getUserTeams(userId);

      // Get statistics for each team
      const teamsWithStats = await Promise.all(
        teams.map(async (team) => {
          const stats = await this.db.getTeamStatistics(team.id);
          return {
            id: team.id,
            name: team.name,
            description: team.description,
            role: team.role,
            member_count: stats.member_count,
            project_count: stats.project_count,
            recent_activity_count: stats.recent_activity_count,
            created_at: team.created_at,
            updated_at: team.updated_at
          };
        })
      );

      return {
        success: true,
        data: teamsWithStats
      };

    } catch (error) {
      console.error('Get user teams error:', error);
      return {
        success: false,
        error: 'Failed to get teams',
        error_code: 'get_teams_error'
      };
    }
  }

  /**
   * Get team details
   */
  async getTeamById(userId, teamId) {
    try {
      // Check if user is a member of the team
      const member = await this.db.getTeamMember(teamId, userId);
      if (!member || member.status !== 'joined') {
        return {
          success: false,
          error: 'Access denied or team not found',
          error_code: 'access_denied'
        };
      }

      // Get team details
      const team = await this.db.getTeamById(teamId);
      if (!team) {
        return {
          success: false,
          error: 'Team not found',
          error_code: 'team_not_found'
        };
      }

      // Get team members
      const members = await this.db.getTeamMembers(teamId);

      // Get team statistics
      const stats = await this.db.getTeamStatistics(teamId);

      return {
        success: true,
        data: {
          id: team.id,
          name: team.name,
          description: team.description,
          owner_id: team.owner_id,
          created_at: team.created_at,
          updated_at: team.updated_at,
          member_count: stats.member_count,
          project_count: stats.project_count,
          recent_activity_count: stats.recent_activity_count,
          members: members.map(m => ({
            id: m.id,
            user_id: m.user_id,
            email: m.email,
            user_id_display: m.user_id,
            role: m.role,
            joined_at: m.joined_at,
            invited_at: m.invited_at
          })),
          user_role: member.role
        }
      };

    } catch (error) {
      console.error('Get team error:', error);
      return {
        success: false,
        error: 'Failed to get team details',
        error_code: 'get_team_error'
      };
    }
  }

  /**
   * Invite member to team
   */
  async inviteMember(userId, teamId, inviteData) {
    try {
      // Check if user has permission to invite members
      const hasPermission = await this.db.hasTeamPermission(userId, teamId, 'create');
      if (!hasPermission) {
        return {
          success: false,
          error: 'Insufficient permissions to invite members',
          error_code: 'insufficient_permissions'
        };
      }

      // Validate email
      const email = inviteData.email?.trim().toLowerCase();
      if (!email || !email.includes('@')) {
        return {
          success: false,
          error: 'Valid email is required',
          error_code: 'invalid_email'
        };
      }

      // Check team member limit
      const teamSettings = await this.db.getTeamSettings(teamId);
      const currentMembers = await this.db.getTeamMembers(teamId);

      if (currentMembers.length >= teamSettings.max_members) {
        return {
          success: false,
          error: `Team member limit (${teamSettings.max_members}) reached`,
          error_code: 'member_limit_reached'
        };
      }

      // Find user by email
      let targetUser = await this.db.getUserByEmail(email);

      if (!targetUser) {
        // For now, return error. In future, we can send invitation email
        return {
          success: false,
          error: 'User not found. They must have a Luna account to be invited.',
          error_code: 'user_not_found'
        };
      }

      // Check if user is already a member
      const existingMember = await this.db.getTeamMember(teamId, targetUser.id);
      if (existingMember && existingMember.status !== 'removed') {
        return {
          success: false,
          error: 'User is already a team member',
          error_code: 'already_member'
        };
      }

      // Add team member
      const member = await this.db.addTeamMember({
        team_id: teamId,
        user_id: targetUser.id,
        role: inviteData.role || 'member',
        status: 'invited',
        invited_by: userId
      });

      // TODO: Send invitation email

      return {
        success: true,
        data: {
          id: member.id,
          team_id: member.team_id,
          user_id: member.user_id,
          email: targetUser.email,
          role: member.role,
          status: member.status,
          invited_at: member.invited_at
        }
      };

    } catch (error) {
      console.error('Invite member error:', error);
      return {
        success: false,
        error: 'Failed to invite member',
        error_code: 'invite_error'
      };
    }
  }

  /**
   * Update team member role
   */
  async updateMemberRole(userId, teamId, memberId, newRole) {
    try {
      // Check if user has permission (only owners and admins can change roles)
      const hasPermission = await this.db.hasTeamPermission(userId, teamId, 'update');
      if (!hasPermission) {
        return {
          success: false,
          error: 'Insufficient permissions to update member roles',
          error_code: 'insufficient_permissions'
        };
      }

      // Get target member
      const targetMember = await this.db.getTeamMember(teamId, memberId);
      if (!targetMember) {
        return {
          success: false,
          error: 'Member not found',
          error_code: 'member_not_found'
        };
      }

      // Get requester's role
      const requesterMember = await this.db.getTeamMember(teamId, userId);

      // Prevent role changes for owners unless you're the owner
      if (targetMember.role === 'owner' && requesterMember.role !== 'owner') {
        return {
          success: false,
          error: 'Cannot change owner role',
          error_code: 'cannot_change_owner'
        };
      }

      // Prevent non-owners from assigning owner role
      if (newRole === 'owner' && requesterMember.role !== 'owner') {
        return {
          success: false,
          error: 'Only owners can assign owner role',
          error_code: 'cannot_assign_owner'
        };
      }

      // Validate role
      const validRoles = ['owner', 'admin', 'member', 'viewer'];
      if (!validRoles.includes(newRole)) {
        return {
          success: false,
          error: 'Invalid role',
          error_code: 'invalid_role'
        };
      }

      // Update member role
      const updatedMember = await this.db.updateTeamMemberRole(teamId, memberId, newRole, userId);

      return {
        success: true,
        data: {
          id: updatedMember.id,
          user_id: updatedMember.user_id,
          role: updatedMember.role
        }
      };

    } catch (error) {
      console.error('Update member role error:', error);
      return {
        success: false,
        error: 'Failed to update member role',
        error_code: 'update_role_error'
      };
    }
  }

  /**
   * Remove team member
   */
  async removeMember(userId, teamId, memberId) {
    try {
      // Check if user has permission to remove members
      const hasPermission = await this.db.hasTeamPermission(userId, teamId, 'delete');
      if (!hasPermission) {
        return {
          success: false,
          error: 'Insufficient permissions to remove members',
          error_code: 'insufficient_permissions'
        };
      }

      // Get target member
      const targetMember = await this.db.getTeamMember(teamId, memberId);
      if (!targetMember) {
        return {
          success: false,
          error: 'Member not found',
          error_code: 'member_not_found'
        };
      }

      // Get requester's role
      const requesterMember = await this.db.getTeamMember(teamId, userId);

      // Prevent removal of owners unless you're the owner
      if (targetMember.role === 'owner' && requesterMember.role !== 'owner') {
        return {
          success: false,
          error: 'Cannot remove team owner',
          error_code: 'cannot_remove_owner'
        };
      }

      // Don't allow removing yourself
      if (memberId === userId) {
        return {
          success: false,
          error: 'Cannot remove yourself from team. Use leave team instead.',
          error_code: 'cannot_remove_self'
        };
      }

      // Remove member
      await this.db.removeTeamMember(teamId, memberId, userId);

      return {
        success: true,
        data: {
          id: memberId,
          removed_at: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error('Remove member error:', error);
      return {
        success: false,
        error: 'Failed to remove member',
        error_code: 'remove_member_error'
      };
    }
  }

  /**
   * Leave team
   */
  async leaveTeam(userId, teamId) {
    try {
      // Get member
      const member = await this.db.getTeamMember(teamId, userId);
      if (!member || member.status !== 'joined') {
        return {
          success: false,
          error: 'You are not a member of this team',
          error_code: 'not_member'
        };
      }

      // Owners cannot leave team (must transfer ownership first)
      if (member.role === 'owner') {
        return {
          success: false,
          error: 'Team owners cannot leave team. Transfer ownership first.',
          error_code: 'owner_cannot_leave'
        };
      }

      // Remove member
      await this.db.removeTeamMember(teamId, userId, userId);

      return {
        success: true,
        data: {
          message: 'Successfully left the team'
        }
      };

    } catch (error) {
      console.error('Leave team error:', error);
      return {
        success: false,
        error: 'Failed to leave team',
        error_code: 'leave_team_error'
      };
    }
  }

  /**
   * Update team settings
   */
  async updateTeamSettings(userId, teamId, settings) {
    try {
      // Check if user has permission (only owners and admins can update settings)
      const hasPermission = await this.db.hasTeamPermission(userId, teamId, 'update');
      if (!hasPermission) {
        return {
          success: false,
          error: 'Insufficient permissions to update team settings',
          error_code: 'insufficient_permissions'
        };
      }

      // Validate settings
      const validSettings = {
        rag_sharing: 'boolean',
        codebase_sharing: 'boolean',
        conversation_sharing: 'boolean',
        analytics_sharing: 'boolean',
        invitation_expiry_hours: 'number',
        max_members: 'number',
        storage_limit_mb: 'number'
      };

      const updates = {};
      for (const [key, value] of Object.entries(settings)) {
        if (key in validSettings) {
          const expectedType = validSettings[key];
          if (expectedType === 'boolean' && typeof value !== 'boolean') {
            return {
              success: false,
              error: `Setting ${key} must be a boolean`,
              error_code: 'invalid_setting_type'
            };
          }
          if (expectedType === 'number' && (typeof value !== 'number' || value < 0)) {
            return {
              success: false,
              error: `Setting ${key} must be a positive number`,
              error_code: 'invalid_setting_value'
            };
          }
          updates[key] = value;
        }
      }

      // Update team settings
      const updatedSettings = await this.db.updateTeamSettings(teamId, updates);

      return {
        success: true,
        data: updatedSettings
      };

    } catch (error) {
      console.error('Update team settings error:', error);
      return {
        success: false,
        error: 'Failed to update team settings',
        error_code: 'update_settings_error'
      };
    }
  }

  /**
   * Get team audit log
   */
  async getTeamAuditLog(userId, teamId, limit = 100, action = null) {
    try {
      // Check if user is a member of the team
      const member = await this.db.getTeamMember(teamId, userId);
      if (!member || member.status !== 'joined') {
        return {
          success: false,
          error: 'Access denied',
          error_code: 'access_denied'
        };
      }

      // Get audit log
      const auditLog = await this.db.getTeamAuditLog(teamId, limit, action);

      return {
        success: true,
        data: auditLog
      };

    } catch (error) {
      console.error('Get audit log error:', error);
      return {
        success: false,
        error: 'Failed to get audit log',
        error_code: 'get_audit_log_error'
      };
    }
  }
}