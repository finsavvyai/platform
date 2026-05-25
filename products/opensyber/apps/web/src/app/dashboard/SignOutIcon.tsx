'use client';

import { signOut } from 'next-auth/react';
import { LogOut } from 'lucide-react';
import { purgeAllActiveOrgIds } from '@/lib/org-context';

export function SignOutIcon() {
  return (
    <button
      onClick={() => {
        purgeAllActiveOrgIds();
        signOut({ callbackUrl: '/' });
      }}
      className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-border transition-colors"
      aria-label="Sign out"
      title="Sign out"
    >
      <LogOut className="h-3.5 w-3.5 text-text-dim" />
    </button>
  );
}
