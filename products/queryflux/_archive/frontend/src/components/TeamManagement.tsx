import { useState, useEffect } from 'react';
import { X, Users, Plus, Trash2, Mail, Shield, Eye, CreditCard as Edit, FileText, Crown, UserPlus } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';

interface TeamManagementProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Team {
  id: string;
  name: string;
  slug: string;
  subscription_tier: string;
  sso_enabled: boolean;
  max_members: number;
  member_count?: number;
}

interface TeamMember {
  id: string;
  user_id: string;
  role: string;
  joined_at: string;
  email?: string;
}

const ROLES = [
  { value: 'owner', label: 'Owner', description: 'Full access to everything' },
  { value: 'admin', label: 'Admin', description: 'Manage team and projects' },
  { value: 'member', label: 'Member', description: 'Access assigned projects' },
  { value: 'viewer', label: 'Viewer', description: 'Read-only access' },
];

const ACCESS_LEVELS = {
  development: ['read', 'write'],
  uat: ['read', 'write'],
  production: ['none', 'read', 'write'],
};

export function TeamManagement({ isOpen, onClose }: TeamManagementProps) {
  const { theme } = useTheme();
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [showInviteMember, setShowInviteMember] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');

  useEffect(() => {
    if (isOpen) {
      loadTeams();
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedTeam) {
      loadTeamMembers(selectedTeam.id);
    }
  }, [selectedTeam]);

  const loadTeams = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('teams')
      .select('*, team_members(count)')
      .order('created_at', { ascending: false });

    if (data) {
      setTeams(data.map(team => ({
        ...team,
        member_count: team.team_members?.[0]?.count || 0,
      })));
      if (data.length > 0 && !selectedTeam) {
        setSelectedTeam(data[0]);
      }
    }
  };

  const loadTeamMembers = async (teamId: string) => {
    const { data } = await supabase
      .from('team_members')
      .select('*')
      .eq('team_id', teamId)
      .order('joined_at', { ascending: true });

    if (data) {
      setMembers(data);
    }
  };

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const slug = newTeamName.toLowerCase().replace(/\s+/g, '-');

    const { data, error } = await supabase
      .from('teams')
      .insert({
        name: newTeamName,
        slug,
        owner_id: user.id,
        subscription_tier: 'free',
      })
      .select()
      .single();

    if (!error && data) {
      setShowCreateTeam(false);
      setNewTeamName('');
      loadTeams();
    }
  };

  const handleInviteMember = async () => {
    if (!inviteEmail.trim() || !selectedTeam) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('team_invitations')
      .insert({
        team_id: selectedTeam.id,
        email: inviteEmail,
        role: inviteRole,
        invited_by: user.id,
      });

    if (!error) {
      setShowInviteMember(false);
      setInviteEmail('');
      setInviteRole('member');
      alert(`Invitation sent to ${inviteEmail}`);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Remove this member from the team?')) return;

    await supabase
      .from('team_members')
      .delete()
      .eq('id', memberId);

    if (selectedTeam) {
      loadTeamMembers(selectedTeam.id);
    }
  };

  const handleUpdateMemberRole = async (memberId: string, newRole: string) => {
    await supabase
      .from('team_members')
      .update({ role: newRole })
      .eq('id', memberId);

    if (selectedTeam) {
      loadTeamMembers(selectedTeam.id);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xl" style={{ backgroundColor: `${theme.colors.background}cc` }}>
      <div className="relative w-full max-w-6xl h-[85vh] glass-card rounded-3xl shadow-2xl flex flex-col" style={{ borderColor: theme.colors.border, backgroundColor: theme.colors.foreground }}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: theme.colors.border }}>
          <div className="flex items-center gap-3">
            <Users className="w-6 h-6" style={{ color: theme.colors.accent }} />
            <div>
              <h2 className="text-xl font-bold" style={{ color: theme.colors.text }}>
                Team Management
              </h2>
              <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
                Manage teams and collaboration
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full glass-morphism hover-3d transition-all"
          >
            <X className="w-5 h-5" style={{ color: theme.colors.textSecondary }} />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="w-80 border-r p-4 overflow-y-auto" style={{ borderColor: theme.colors.border, backgroundColor: theme.colors.sidebar }}>
            <button
              onClick={() => setShowCreateTeam(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 mb-4 text-white rounded-lg font-medium"
              style={{ background: `linear-gradient(135deg, ${theme.colors.accent}, ${theme.colors.accentHover})` }}
            >
              <Plus className="w-4 h-4" />
              Create Team
            </button>

            <div className="space-y-2">
              {teams.map((team) => (
                <button
                  key={team.id}
                  onClick={() => setSelectedTeam(team)}
                  className={`w-full p-4 rounded-lg text-left transition-all ${
                    selectedTeam?.id === team.id ? 'glass-morphism' : ''
                  }`}
                  style={{
                    borderColor: selectedTeam?.id === team.id ? theme.colors.accent : 'transparent',
                    border: selectedTeam?.id === team.id ? '1px solid' : 'none',
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-sm" style={{ color: theme.colors.text }}>
                      {team.name}
                    </h3>
                    {team.subscription_tier === 'enterprise' && (
                      <Crown className="w-4 h-4" style={{ color: '#f59e0b' }} />
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs" style={{ color: theme.colors.textSecondary }}>
                    <span>{team.member_count} members</span>
                    <span className="capitalize">{team.subscription_tier}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 p-6 overflow-y-auto">
            {selectedTeam ? (
              <>
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-2xl font-bold mb-1" style={{ color: theme.colors.text }}>
                        {selectedTeam.name}
                      </h3>
                      <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
                        {members.length} / {selectedTeam.max_members} members
                      </p>
                    </div>
                    <button
                      onClick={() => setShowInviteMember(true)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg glass-morphism font-medium"
                      style={{ color: theme.colors.accent }}
                    >
                      <UserPlus className="w-4 h-4" />
                      Invite Member
                    </button>
                  </div>

                  {selectedTeam.subscription_tier === 'enterprise' && (
                    <div className="p-4 rounded-lg glass-card border mb-4" style={{ borderColor: '#f59e0b' }}>
                      <div className="flex items-center gap-2 mb-2">
                        <Crown className="w-4 h-4" style={{ color: '#f59e0b' }} />
                        <span className="text-sm font-semibold" style={{ color: theme.colors.text }}>
                          Enterprise Features Enabled
                        </span>
                      </div>
                      <p className="text-xs" style={{ color: theme.colors.textSecondary }}>
                        SSO: {selectedTeam.sso_enabled ? 'Enabled' : 'Disabled'} • Audit Logs • Advanced Permissions
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-semibold mb-3" style={{ color: theme.colors.text }}>
                    Team Members
                  </h4>

                  {members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-4 rounded-lg glass-card"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: theme.colors.accent + '20' }}>
                          <Users className="w-5 h-5" style={{ color: theme.colors.accent }} />
                        </div>
                        <div>
                          <p className="text-sm font-medium" style={{ color: theme.colors.text }}>
                            {member.email || member.user_id.substring(0, 8)}
                          </p>
                          <p className="text-xs" style={{ color: theme.colors.textSecondary }}>
                            Joined {new Date(member.joined_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <select
                          value={member.role}
                          onChange={(e) => handleUpdateMemberRole(member.id, e.target.value)}
                          className="px-3 py-1.5 rounded-lg glass-card border outline-none text-sm"
                          style={{ borderColor: theme.colors.border, color: theme.colors.text }}
                          disabled={member.role === 'owner'}
                        >
                          {ROLES.map((role) => (
                            <option key={role.value} value={role.value}>
                              {role.label}
                            </option>
                          ))}
                        </select>

                        {member.role !== 'owner' && (
                          <button
                            onClick={() => handleRemoveMember(member.id)}
                            className="p-2 rounded-lg glass-morphism hover:opacity-80"
                          >
                            <Trash2 className="w-4 h-4" style={{ color: '#ef4444' }} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                <Users className="w-16 h-16 mx-auto mb-3 opacity-50" style={{ color: theme.colors.textSecondary }} />
                <p style={{ color: theme.colors.textSecondary }}>
                  Select a team to manage
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {showCreateTeam && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 backdrop-blur-xl" style={{ backgroundColor: `${theme.colors.background}cc` }}>
          <div className="relative w-full max-w-md glass-card rounded-2xl shadow-2xl p-6" style={{ borderColor: theme.colors.border, backgroundColor: theme.colors.foreground }}>
            <h3 className="text-lg font-bold mb-4" style={{ color: theme.colors.text }}>
              Create New Team
            </h3>

            <input
              type="text"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              placeholder="Team name"
              className="w-full px-3 py-2 rounded-lg glass-card border outline-none mb-4"
              style={{ borderColor: theme.colors.border, color: theme.colors.text }}
            />

            <div className="flex gap-2">
              <button
                onClick={() => setShowCreateTeam(false)}
                className="flex-1 px-4 py-2 rounded-lg font-medium"
                style={{ backgroundColor: theme.colors.background, color: theme.colors.text }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTeam}
                disabled={!newTeamName.trim()}
                className="flex-1 px-4 py-2 text-white rounded-lg font-medium disabled:opacity-50"
                style={{ background: `linear-gradient(135deg, ${theme.colors.accent}, ${theme.colors.accentHover})` }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {showInviteMember && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 backdrop-blur-xl" style={{ backgroundColor: `${theme.colors.background}cc` }}>
          <div className="relative w-full max-w-md glass-card rounded-2xl shadow-2xl p-6" style={{ borderColor: theme.colors.border, backgroundColor: theme.colors.foreground }}>
            <h3 className="text-lg font-bold mb-4" style={{ color: theme.colors.text }}>
              Invite Team Member
            </h3>

            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="Email address"
              className="w-full px-3 py-2 rounded-lg glass-card border outline-none mb-3"
              style={{ borderColor: theme.colors.border, color: theme.colors.text }}
            />

            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="w-full px-3 py-2 rounded-lg glass-card border outline-none mb-4"
              style={{ borderColor: theme.colors.border, color: theme.colors.text }}
            >
              {ROLES.filter(r => r.value !== 'owner').map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label} - {role.description}
                </option>
              ))}
            </select>

            <div className="flex gap-2">
              <button
                onClick={() => setShowInviteMember(false)}
                className="flex-1 px-4 py-2 rounded-lg font-medium"
                style={{ backgroundColor: theme.colors.background, color: theme.colors.text }}
              >
                Cancel
              </button>
              <button
                onClick={handleInviteMember}
                disabled={!inviteEmail.trim()}
                className="flex-1 px-4 py-2 text-white rounded-lg font-medium disabled:opacity-50"
                style={{ background: `linear-gradient(135deg, ${theme.colors.accent}, ${theme.colors.accentHover})` }}
              >
                Send Invite
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
