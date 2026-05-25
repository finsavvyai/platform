/**
 * Team Management Hook
 *
 * Provides team creation, member management, and collaboration features
 */

import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '../lib/enhanced-api-client';
import { useTeamMemberOps } from './useTeamMemberOps';
import type {
  Team,
  TeamMember,
  TeamActivity,
  TeamInvitation,
  CreateTeamRequest,
  UpdateTeamRequest,
  UseTeamManagementReturn,
} from './teamTypes';

export type {
  Team, TeamSettings, TeamMember, TeamRole, MemberStatus,
  TeamInvitation, TeamActivity, CreateTeamRequest, UpdateTeamRequest,
  InviteMembersRequest, UpdateMemberRoleRequest, UseTeamManagementReturn,
} from './teamTypes';
export { TEAM_ROLES } from './teamTypes';
export {
  getRoleInfo, canPerformAction, getRoleColor, formatMemberCount,
  isTeamAtCapacity, getAvailableRoles, sortMembers, filterMembersByStatus, getMemberInitials,
} from './teamUtils';

// ============================================================================
// Hook Implementation
// ============================================================================

export function useTeamManagement(teamId?: string): UseTeamManagementReturn {
  const queryClient = useQueryClient();
  const [error, setError] = useState<Error | null>(null);

  // Fetch teams
  const { data: teams = [], isLoading: isLoadingTeams } = useQuery({
    queryKey: ['teams'],
    queryFn: async () => {
      const response = await apiClient.request<Team[]>('GET', '/api/v1/teams');
      return response;
    },
  });

  // Fetch current team
  const { data: currentTeam = null } = useQuery({
    queryKey: ['team', teamId],
    queryFn: async () => {
      if (!teamId) return null;
      const response = await apiClient.request<Team>(`GET`, `/api/v1/teams/${teamId}`);
      return response;
    },
    enabled: !!teamId,
  });

  // Fetch members
  const { data: members = [] } = useQuery({
    queryKey: ['team-members', teamId],
    queryFn: async () => {
      if (!teamId) return [];
      const response = await apiClient.request<TeamMember[]>('GET', `/api/v1/teams/${teamId}/members`);
      return response;
    },
    enabled: !!teamId,
  });

  // Fetch activity
  const { data: activity = [] } = useQuery({
    queryKey: ['team-activity', teamId],
    queryFn: async () => {
      if (!teamId) return [];
      const response = await apiClient.request<TeamActivity[]>('GET', `/api/v1/teams/${teamId}/activity?limit=50`);
      return response;
    },
    enabled: !!teamId,
  });

  // Fetch invitations
  const { data: invitations = [] } = useQuery({
    queryKey: ['team-invitations', teamId],
    queryFn: async () => {
      if (!teamId) return [];
      const response = await apiClient.request<TeamInvitation[]>('GET', `/api/v1/teams/${teamId}/invitations`);
      return response;
    },
    enabled: !!teamId,
  });

  // Create team mutation
  const createMutation = useMutation({
    mutationFn: async (request: CreateTeamRequest) => {
      const response = await apiClient.request<Team>('POST', '/api/v1/teams', request);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    },
    onError: (err) => {
      setError(err instanceof Error ? err : new Error('Failed to create team'));
    },
  });

  // Update team mutation
  const updateMutation = useMutation({
    mutationFn: async ({ teamId, request }: { teamId: string; request: UpdateTeamRequest }) => {
      const response = await apiClient.request<Team>('PUT', `/api/v1/teams/${teamId}`, request);
      return response;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['team', variables.teamId] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    },
    onError: (err) => {
      setError(err instanceof Error ? err : new Error('Failed to update team'));
    },
  });

  // Delete team mutation
  const deleteMutation = useMutation({
    mutationFn: async (tid: string) => {
      await apiClient.request<void>('DELETE', `/api/v1/teams/${tid}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    },
    onError: (err) => {
      setError(err instanceof Error ? err : new Error('Failed to delete team'));
    },
  });

  // Team operations
  const createTeam = useCallback((request: CreateTeamRequest): Promise<Team> => {
    return createMutation.mutateAsync(request);
  }, [createMutation]);

  const updateTeam = useCallback((tid: string, request: UpdateTeamRequest): Promise<Team> => {
    return updateMutation.mutateAsync({ teamId: tid, request });
  }, [updateMutation]);

  const deleteTeam = useCallback((tid: string): Promise<void> => {
    return deleteMutation.mutateAsync(tid);
  }, [deleteMutation]);

  const getTeam = useCallback(async (tid: string): Promise<Team> => {
    return apiClient.request<Team>('GET', `/api/v1/teams/${tid}`);
  }, []);

  const memberOps = useTeamMemberOps((err, fallback) => {
    setError(err instanceof Error ? err : new Error(fallback));
  });

  return {
    // Team operations
    createTeam,
    updateTeam,
    deleteTeam,
    getTeam,

    // Member operations
    ...memberOps,

    // Queries
    teams,
    currentTeam,
    members,
    activity,
    invitations,

    // State
    isLoading: isLoadingTeams,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    error,
  };
}
