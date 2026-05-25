/**
 * Team Management — settings tab content
 */

import { useTheme } from '../contexts/ThemeContext';
import type { Team } from '../hooks/teamTypes';

interface TeamSettingsTabProps {
  team: Team;
}

export function TeamSettingsTab({ team }: TeamSettingsTabProps) {
  const { theme } = useTheme();

  return (
    <div className="space-y-4">
      <div>
        <h4 className="mb-2 text-sm font-semibold" style={{ color: theme.colors.text }}>Team Settings</h4>
        <div className="rounded-lg border p-4" style={{ borderColor: theme.colors.border }}>
          <div className="mb-4">
            <label className="mb-2 block text-sm" style={{ color: theme.colors.text }}>
              Maximum Members: {team.settings.maxMembers}
            </label>
            <input type="range" min="1" max="100" value={team.settings.maxMembers} disabled className="w-full" />
          </div>
          <div className="mb-4">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={team.settings.sharingEnabled} disabled className="rounded" />
              <span className="text-sm" style={{ color: theme.colors.text }}>Enable Resource Sharing</span>
            </label>
          </div>
          <div>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={team.settings.requireApproval} disabled className="rounded" />
              <span className="text-sm" style={{ color: theme.colors.text }}>Require Approval for New Members</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
