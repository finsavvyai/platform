import type { Role } from '@opensyber/shared';
import { ROLE_LABELS } from '@opensyber/shared';

const ROLE_COLORS: Record<Role, string> = {
  owner: 'bg-amber-500/10 text-amber-400',
  admin: 'bg-signal/10 text-signal',
  security: 'bg-purple-500/10 text-purple-400',
  developer: 'bg-green-500/10 text-green-400',
  viewer: 'bg-neutral-500/10 text-text-secondary',
};

interface RoleBadgeProps {
  role: Role;
}

export function RoleBadge({ role }: RoleBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[role]}`}
    >
      {ROLE_LABELS[role]}
    </span>
  );
}
