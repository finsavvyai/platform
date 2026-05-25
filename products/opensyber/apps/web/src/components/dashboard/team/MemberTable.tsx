import type { Role } from '@opensyber/shared';
import { RoleBadge } from './RoleBadge';
import { MemberRoleSelect } from './MemberRoleSelect';
import { RemoveMemberButton } from './RemoveMemberButton';

interface Member {
  userId: string;
  name: string | null;
  email: string;
  role: Role;
  acceptedAt: string | null;
}

interface MemberTableProps {
  orgId: string;
  ownerId: string;
  members: Member[];
  currentUserRole: Role;
  canManage: boolean;
}

export function MemberTable({ orgId, ownerId, members, currentUserRole, canManage }: MemberTableProps) {
  return (
    <div className="overflow-x-auto rounded border border-border">
      <table className="w-full divide-y divide-neutral-800 text-sm" aria-label="Organization members">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wider text-text-dim">
            <th className="px-4 py-3 font-medium" scope="col">Name</th>
            <th className="px-4 py-3 font-medium" scope="col">Email</th>
            <th className="px-4 py-3 font-medium" scope="col">Role</th>
            <th className="px-4 py-3 font-medium" scope="col">Joined</th>
            {canManage && <th className="px-4 py-3 font-medium" scope="col">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-800/50">
          {members.map((m) => {
            const isOwner = m.userId === ownerId;
            return (
              <tr key={m.userId} className="hover:bg-surface/30">
                <td className="px-4 py-3 font-medium text-white">
                  {m.name || 'Unknown'}
                </td>
                <td className="px-4 py-3 text-text-secondary">{m.email}</td>
                <td className="px-4 py-3">
                  {canManage ? (
                    <MemberRoleSelect
                      orgId={orgId}
                      memberId={m.userId}
                      currentRole={m.role}
                      currentUserRole={currentUserRole}
                      isOwner={isOwner}
                    />
                  ) : (
                    <RoleBadge role={m.role} />
                  )}
                </td>
                <td className="px-4 py-3 text-text-secondary">
                  {m.acceptedAt ? new Date(m.acceptedAt).toLocaleDateString() : 'Pending'}
                </td>
                {canManage && (
                  <td className="px-4 py-3">
                    <RemoveMemberButton
                      orgId={orgId}
                      memberId={m.userId}
                      memberName={m.name || m.email}
                      isOwner={isOwner}
                    />
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
