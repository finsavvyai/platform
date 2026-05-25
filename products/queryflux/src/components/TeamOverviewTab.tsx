/**
 * Team Management — overview tab content
 */

import { useTheme } from '../contexts/ThemeContext';
import type { Team, TeamMember, TeamActivity, TeamInvitation } from '../hooks/teamTypes';

interface TeamOverviewTabProps {
  team: Team;
  members: TeamMember[];
  activity: TeamActivity[];
  invitations: TeamInvitation[];
}

export function TeamOverviewTab({ team, members, activity, invitations }: TeamOverviewTabProps) {
  const { theme } = useTheme();

  return (
    <div className="space-y-4">
      <div>
        <h4 className="mb-2 text-sm font-semibold" style={{ color: theme.colors.text }}>Team Information</h4>
        <div className="rounded-lg border p-4" style={{ borderColor: theme.colors.border }}>
          <p className="text-sm" style={{ color: theme.colors.text }}>{team.description || 'No description'}</p>
          <p className="mt-2 text-xs" style={{ color: theme.colors.textSecondary }}>
            Created {new Date(team.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>
      <div>
        <h4 className="mb-2 text-sm font-semibold" style={{ color: theme.colors.text }}>Statistics</h4>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Members', value: members.length },
            { label: 'Activities', value: activity.length },
            { label: 'Pending', value: invitations.length },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg border p-3 text-center" style={{ borderColor: theme.colors.border }}>
              <p className="text-2xl font-bold" style={{ color: theme.colors.accent }}>{value}</p>
              <p className="text-xs" style={{ color: theme.colors.textSecondary }}>{label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
