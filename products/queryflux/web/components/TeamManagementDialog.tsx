/**
 * Team Management Dialog Component
 *
 * UI for creating and managing teams
 */

import { useState } from 'react';
import { Users, UserPlus, X } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useTeamManagement, formatMemberCount } from '../hooks/useTeamManagement';
import type { TeamRole } from '../hooks/useTeamManagement';
import { CreateTeamForm } from './CreateTeamForm';
import { InviteMembersForm } from './InviteMembersForm';
import { TeamMembersTab } from './TeamMembersTab';
import { TeamOverviewTab } from './TeamOverviewTab';
import { TeamSettingsTab } from './TeamSettingsTab';

interface TeamManagementDialogProps {
  isOpen: boolean;
  onClose: () => void;
  teamId?: string;
}

type ActiveTab = 'overview' | 'members' | 'invite' | 'settings';

const TABS: { key: ActiveTab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'members', label: 'Members' },
  { key: 'invite', label: 'Invite' },
  { key: 'settings', label: 'Settings' },
];

export function TeamManagementDialog({ isOpen, onClose, teamId }: TeamManagementDialogProps) {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [showCreateForm, setShowCreateForm] = useState(false);

  const { teams, currentTeam, members, activity, invitations, createTeam, inviteMembers, isCreating } = useTeamManagement(teamId);

  if (!isOpen) return null;

  const handleCreateTeam = async (name: string, description: string) => {
    await createTeam({ name, description });
    setShowCreateForm(false);
  };

  const handleInvite = async (emails: string[], role: TeamRole) => {
    if (!teamId) return;
    await inviteMembers({ teamId, emails, role });
    setActiveTab('members');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="h-[80vh] w-full max-w-4xl overflow-hidden rounded-lg shadow-xl"
        style={{ backgroundColor: theme.colors.sidebar, border: `1px solid ${theme.colors.border}` }}>
        <div className="flex items-center justify-between border-b p-4" style={{ borderColor: theme.colors.border }}>
          <div className="flex items-center gap-3">
            <Users size={24} style={{ color: theme.colors.accent }} />
            <div>
              <h3 className="text-lg font-semibold" style={{ color: theme.colors.text }}>{currentTeam?.name || 'Team Management'}</h3>
              {currentTeam && <p className="text-sm" style={{ color: theme.colors.textSecondary }}>{formatMemberCount(members.length, currentTeam.settings.maxMembers)}</p>}
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-gray-700" style={{ color: theme.colors.text }}><X size={20} /></button>
        </div>

        <div className="flex h-[calc(100%-80px)]">
          <div className="w-64 overflow-y-auto border-r p-4" style={{ borderColor: theme.colors.border }}>
            <button onClick={() => setShowCreateForm(true)}
              className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-2 transition-all hover:border-solid hover:scale-105"
              style={{ borderColor: theme.colors.accent, color: theme.colors.accent }}>
              <UserPlus size={18} />Create New Team
            </button>
            <div className="space-y-2">
              {teams.map((team) => (
                <button key={team.id} onClick={() => {}}
                  className={`w-full rounded-lg border p-3 text-left transition-all ${currentTeam?.id === team.id ? 'border-opacity-100' : 'border-opacity-20'}`}
                  style={{ backgroundColor: currentTeam?.id === team.id ? `${theme.colors.accent}20` : 'transparent', borderColor: theme.colors.accent, color: theme.colors.text }}>
                  <p className="text-sm font-medium">{team.name}</p>
                  <p className="text-xs" style={{ color: theme.colors.textSecondary }}>{team.slug}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="flex border-b" style={{ borderColor: theme.colors.border }}>
              {TABS.map((tab) => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-3 text-sm font-medium transition-all ${activeTab === tab.key ? 'border-b-2' : ''}`}
                  style={{ borderColor: activeTab === tab.key ? theme.colors.accent : 'transparent', color: activeTab === tab.key ? theme.colors.accent : theme.colors.textSecondary }}>
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="p-4">
              {showCreateForm ? (
                <CreateTeamForm onCreate={handleCreateTeam} isCreating={isCreating} />
              ) : (
                <>
                  {activeTab === 'overview' && currentTeam && <TeamOverviewTab team={currentTeam} members={members} activity={activity} invitations={invitations} />}
                  {activeTab === 'members' && <TeamMembersTab members={members} />}
                  {activeTab === 'invite' && currentTeam && <InviteMembersForm teamId={currentTeam.id} onInvite={handleInvite} isInviting={false} memberCount={members.length} maxMembers={currentTeam.settings.maxMembers} />}
                  {activeTab === 'settings' && currentTeam && <TeamSettingsTab team={currentTeam} />}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
