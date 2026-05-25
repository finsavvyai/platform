'use client';

import { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { LogOut, ChevronDown } from 'lucide-react';

export function UserMenu(): React.ReactElement {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);

  if (!session?.user) {
    return <div className="h-10" />;
  }

  const { name, email, image } = session.user;
  const initials = name
    ? name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : email?.slice(0, 2).toUpperCase() ?? 'TF';

  return (
    <div className="border-t border-border p-4">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface transition"
      >
        {image ? (
          <img
            src={image}
            alt={name ?? 'User'}
            className="h-8 w-8 rounded-full"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-info/20 text-sm font-medium text-info">
            {initials}
          </div>
        )}
        <div className="min-w-0 flex-1 text-left">
          <p className="truncate text-sm font-medium">{name ?? 'User'}</p>
          <p className="truncate text-xs text-text-muted">{email}</p>
        </div>
        <ChevronDown className={`h-4 w-4 text-text-muted transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="mt-2 space-y-1">
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
