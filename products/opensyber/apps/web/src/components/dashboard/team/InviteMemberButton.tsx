'use client';

import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import type { Role } from '@opensyber/shared';
import { InviteMemberModal } from './InviteMemberModal';

interface InviteMemberButtonProps {
  orgId: string;
  currentUserRole: Role;
}

export function InviteMemberButton({ orgId, currentUserRole }: InviteMemberButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 rounded-lg bg-signal px-4 py-2 text-sm font-medium text-white hover:bg-signal-hover"
      >
        <UserPlus className="h-4 w-4" />
        Invite Member
      </button>
      <InviteMemberModal
        orgId={orgId}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        currentUserRole={currentUserRole}
      />
    </>
  );
}
