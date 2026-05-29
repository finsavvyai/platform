/**
 * Team Management — members tab content
 */

import { Crown, Shield, Code, Eye, Ghost } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { getRoleInfo, getRoleColor, getMemberInitials, sortMembers } from '../hooks/teamUtils';
import type { TeamMember } from '../hooks/teamTypes';

const ROLE_ICONS = { owner: Crown, admin: Shield, developer: Code, viewer: Eye, guest: Ghost };

interface TeamMembersTabProps {
  members: TeamMember[];
}

export function TeamMembersTab({ members }: TeamMembersTabProps) {
  const { theme } = useTheme();
  const sorted = sortMembers(members);

  return (
    <div className="space-y-3">
      {sorted.map((member) => {
        const RoleIcon = ROLE_ICONS[member.role];
        const roleInfo = getRoleInfo(member.role);
        return (
          <div key={member.userId} className="flex items-center justify-between rounded-lg border p-3" style={{ borderColor: theme.colors.border }}>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full font-semibold"
                style={{ backgroundColor: `${getRoleColor(member.role)}20`, color: getRoleColor(member.role) }}>
                {getMemberInitials(member.user?.name, member.user?.email)}
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: theme.colors.text }}>{member.user?.name || member.user?.email}</p>
                <p className="text-xs" style={{ color: theme.colors.textSecondary }}>{roleInfo.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <RoleIcon size={16} style={{ color: getRoleColor(member.role) }} />
              <span className="text-xs" style={{ color: theme.colors.textSecondary }}>{new Date(member.joinedAt).toLocaleDateString()}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
