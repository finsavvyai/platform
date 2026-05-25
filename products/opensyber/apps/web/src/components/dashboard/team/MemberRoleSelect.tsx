'use client';

import { useState } from 'react';
import type { Role } from '@opensyber/shared';
import { ASSIGNABLE_ROLES, ROLE_LABELS, ROLE_HIERARCHY } from '@opensyber/shared';

interface MemberRoleSelectProps {
  orgId: string;
  memberId: string;
  currentRole: Role;
  currentUserRole: Role;
  isOwner: boolean;
}

export function MemberRoleSelect({ orgId, memberId, currentRole, currentUserRole, isOwner }: MemberRoleSelectProps) {
  const [role, setRole] = useState<Role>(currentRole);
  const [updating, setUpdating] = useState(false);

  if (isOwner) {
    return <span className="text-sm text-text-secondary">{ROLE_LABELS[currentRole]}</span>;
  }

  const allowedRoles = ASSIGNABLE_ROLES.filter(
    (r) => ROLE_HIERARCHY[r] <= ROLE_HIERARCHY[currentUserRole],
  );

  async function handleChange(newRole: Role) {
    const previousRole = role;
    setRole(newRole);
    setUpdating(true);

    try {
      const res = await fetch(`/api/proxy/organizations/${orgId}/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });

      if (!res.ok) {
        setRole(previousRole);
        console.error('Failed to update role');
      }
    } catch {
      setRole(previousRole);
    } finally {
      setUpdating(false);
    }
  }

  return (
    <select
      value={role}
      onChange={(e) => handleChange(e.target.value as Role)}
      disabled={updating}
      className="rounded-md border border-wire bg-surface px-2 py-1 text-xs text-white focus:border-signal focus:outline-none disabled:opacity-50"
    >
      {allowedRoles.map((r) => (
        <option key={r} value={r}>{ROLE_LABELS[r]}</option>
      ))}
    </select>
  );
}
