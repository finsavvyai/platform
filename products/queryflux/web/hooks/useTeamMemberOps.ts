/**
 * Team Member Operations Hook
 *
 * Invite, accept, update-role, remove member mutations
 */

import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../lib/enhanced-api-client';
import type {
  Team,
  TeamInvitation,
  InviteMembersRequest,
  UpdateMemberRoleRequest,
} from './teamTypes';

export function useTeamMemberOps(onError: (err: unknown, fallback: string) => void) {
  const queryClient = useQueryClient();

  const inviteMutation = useMutation({
    mutationFn: async (request: InviteMembersRequest) => {
      return apiClient.request<TeamInvitation[]>('POST', `/api/v1/teams/${request.teamId}/invitations`, request);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['team-invitations', variables.teamId] });
    },
    onError: (err) => onError(err, 'Failed to invite members'),
  });

  const acceptMutation = useMutation({
    mutationFn: async (token: string) => {
      return apiClient.request<Team>('POST', '/api/v1/teams/accept-invitation', { token });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    },
    onError: (err) => onError(err, 'Failed to accept invitation'),
  });

  const updateRoleMutation = useMutation({
    mutationFn: async (request: UpdateMemberRoleRequest) => {
      await apiClient.request<void>('PUT', `/api/v1/teams/${request.teamId}/members/${request.userId}/role`, { role: request.role });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['team-members', variables.teamId] });
    },
    onError: (err) => onError(err, 'Failed to update member role'),
  });

  const removeMutation = useMutation({
    mutationFn: async ({ tid, uid }: { tid: string; uid: string }) => {
      await apiClient.request<void>('DELETE', `/api/v1/teams/${tid}/members/${uid}`);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['team-members', variables.tid] });
    },
    onError: (err) => onError(err, 'Failed to remove member'),
  });

  const inviteMembers = useCallback(
    (request: InviteMembersRequest) => inviteMutation.mutateAsync(request),
    [inviteMutation]
  );
  const acceptInvitation = useCallback(
    (token: string) => acceptMutation.mutateAsync(token),
    [acceptMutation]
  );
  const updateMemberRole = useCallback(
    (request: UpdateMemberRoleRequest) => updateRoleMutation.mutateAsync(request),
    [updateRoleMutation]
  );
  const removeMember = useCallback(
    (tid: string, uid: string) => removeMutation.mutateAsync({ tid, uid }),
    [removeMutation]
  );

  return { inviteMembers, acceptInvitation, updateMemberRole, removeMember };
}
