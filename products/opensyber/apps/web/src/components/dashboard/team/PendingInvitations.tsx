import type { Role } from '@opensyber/shared';
import { RoleBadge } from './RoleBadge';
import { CancelInvitationButton } from './CancelInvitationButton';

interface Invitation {
  id: string;
  email: string;
  role: Role;
  expiresAt: string;
  status: string;
}

interface PendingInvitationsProps {
  orgId: string;
  invitations: Invitation[];
  canManage: boolean;
}

export function PendingInvitations({ orgId, invitations, canManage }: PendingInvitationsProps) {
  const pending = invitations.filter((i) => i.status === 'pending');

  if (pending.length === 0) return null;

  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-text-dim">
        Pending Invitations
      </h3>
      <div className="overflow-x-auto rounded border border-border">
        <table className="w-full divide-y divide-neutral-800 text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-text-dim">
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Expires</th>
              {canManage && <th className="px-4 py-3 font-medium">Cancel</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800/50">
            {pending.map((inv) => (
              <tr key={inv.id} className="hover:bg-surface/30">
                <td className="px-4 py-3 text-text-primary">{inv.email}</td>
                <td className="px-4 py-3"><RoleBadge role={inv.role} /></td>
                <td className="px-4 py-3 text-text-secondary">
                  {new Date(inv.expiresAt).toLocaleDateString()}
                </td>
                {canManage && (
                  <td className="px-4 py-3">
                    <CancelInvitationButton orgId={orgId} invitationId={inv.id} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
