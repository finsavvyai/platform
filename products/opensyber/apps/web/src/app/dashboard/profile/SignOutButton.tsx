'use client';

import { signOut } from 'next-auth/react';
import { LogOut } from 'lucide-react';
import { purgeAllActiveOrgIds } from '@/lib/org-context';

export function SignOutButton() {
  return (
    <button
      onClick={() => {
        purgeAllActiveOrgIds();
        signOut({ callbackUrl: '/' });
      }}
      className="flex items-center gap-2 rounded border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/20 transition"
    >
      <LogOut className="h-4 w-4" />
      Sign Out
    </button>
  );
}
