'use client';

import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { purgeAllActiveOrgIds } from '@/lib/org-context';

export function AuthNav() {
  const { data: session, status } = useSession();

  if (status === 'loading') return null;

  if (session?.user) {
    return (
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className="rounded bg-signal px-4 py-2 font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-wider text-void hover:bg-signal-hover transition"
        >
          Dashboard
        </Link>
        <button
          onClick={() => {
            purgeAllActiveOrgIds();
            signOut({ callbackUrl: '/' });
          }}
          className="rounded border border-wire px-3 py-2 text-xs text-text-secondary hover:bg-surface transition"
        >
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <Link
      href="/sign-in"
      className="rounded border border-signal px-4 py-2 font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-wider text-signal hover:bg-signal/10 transition"
    >
      Sign In
    </Link>
  );
}

export function AuthCTA({ className, label: customLabel }: { className?: string; label?: string }) {
  const { data: session, status } = useSession();
  const href = status !== 'loading' && session ? '/dashboard' : '/sign-up';
  const label = status !== 'loading' && session ? 'Go to Dashboard' : (customLabel ?? 'Start Free');

  return (
    <Link href={href} className={className}>
      {label}
    </Link>
  );
}
