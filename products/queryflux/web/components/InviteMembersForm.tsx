/**
 * Team Management — invite members form sub-component
 */

import { useState } from 'react';
import { Mail } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { isTeamAtCapacity } from '../hooks/teamUtils';
import type { TeamRole } from '../hooks/teamTypes';

interface InviteMembersFormProps {
  teamId: string;
  onInvite: (emails: string[], role: TeamRole) => void;
  isInviting: boolean;
  memberCount: number;
  maxMembers: number;
}

export function InviteMembersForm({ teamId: _teamId, onInvite, isInviting, memberCount, maxMembers }: InviteMembersFormProps) {
  const { theme } = useTheme();
  const [emails, setEmails] = useState('');
  const [role, setRole] = useState<TeamRole>('developer');
  const atCapacity = isTeamAtCapacity(memberCount, maxMembers);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onInvite(emails.split(',').map(e => e.trim()).filter(Boolean), role);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-2 block text-sm font-medium" style={{ color: theme.colors.text }}>Email Addresses</label>
        <textarea value={emails} onChange={(e) => setEmails(e.target.value)}
          placeholder="user1@example.com, user2@example.com" disabled={isInviting} rows={3} required
          className="w-full rounded-lg border px-3 py-2"
          style={{ backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }} />
        <p className="mt-1 text-xs" style={{ color: theme.colors.textSecondary }}>Separate multiple emails with commas</p>
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium" style={{ color: theme.colors.text }}>Role</label>
        <select value={role} onChange={(e) => setRole(e.target.value as TeamRole)} disabled={isInviting}
          className="w-full rounded-lg border px-3 py-2"
          style={{ backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }}>
          <option value="developer">Developer</option>
          <option value="viewer">Viewer</option>
          <option value="guest">Guest</option>
        </select>
      </div>
      {atCapacity && (
        <div className="rounded-lg border border-yellow-500 bg-yellow-500 bg-opacity-10 p-3">
          <p className="text-sm text-yellow-600">Team is at maximum capacity ({maxMembers} members). Upgrade to invite more members.</p>
        </div>
      )}
      <button type="submit" disabled={isInviting || atCapacity || !emails.trim()}
        className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 font-medium text-white transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
        style={{ backgroundColor: theme.colors.accent }}>
        <Mail size={18} />{isInviting ? 'Sending Invitations...' : 'Send Invitations'}
      </button>
    </form>
  );
}
