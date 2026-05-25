'use client';

import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { KeyRound, Shield, Zap, Lock, ChevronRight } from 'lucide-react';
import { PROVIDER_BUTTONS } from '@opensyber/auth';

const FEATURES = [
  { icon: Shield, text: 'Stolen cookies stopped cold' },
  { icon: Zap, text: 'Know instantly when sessions are hijacked' },
  { icon: Lock, text: 'Works with any auth provider in 4 lines of code' },
] as const;

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-void flex hero-gradient">
      {/* Brand panel — large screens only */}
      <aside className="hidden lg:flex lg:w-1/2 flex-col justify-center px-16 border-r border-border/50">
        <Link href="/" className="flex items-center gap-2 mb-12 group w-fit">
          <KeyRound className="h-5 w-5 text-info group-hover:text-signal transition-colors" />
          <span className="text-lg font-bold tracking-tight">TokenForge</span>
        </Link>
        <h1 className="font-bold text-3xl sm:text-5xl tracking-tight mb-4 leading-[1.05]">
          Welcome
          <span className="block text-signal">Back</span>
        </h1>
        <p className="text-text-secondary mb-10 max-w-md text-base leading-relaxed">
          Your sessions are protected. Your dashboard is waiting.
        </p>
        <ul className="space-y-4">
          {FEATURES.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-signal/10 ring-1 ring-signal/20">
                <Icon className="h-4 w-4 text-signal" />
              </span>
              <span className="text-sm text-text-secondary">{text}</span>
            </li>
          ))}
        </ul>
      </aside>

      {/* Sign-in panel */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-10">
        <Link href="/" className="flex items-center gap-2 mb-8 lg:hidden">
          <KeyRound className="h-5 w-5 text-info" />
          <span className="text-lg font-bold">TokenForge</span>
        </Link>

        <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-panel/70 backdrop-blur-sm shadow-[0_8px_30px_rgba(0,0,0,0.35)] p-8">
          <div className="mb-7 text-center">
            <h2 className="text-2xl font-bold tracking-tight">Sign in</h2>
            <p className="mt-1.5 text-sm text-text-secondary">
              Continue with your preferred account
            </p>
          </div>

          <div className="relative mb-5 flex items-center" aria-hidden="true">
            <span className="h-px flex-1 bg-border/60" />
            <span className="px-3 text-[11px] uppercase tracking-[0.18em] text-text-muted">
              Continue with
            </span>
            <span className="h-px flex-1 bg-border/60" />
          </div>

          <div className="space-y-2.5">
            {PROVIDER_BUTTONS.map((p) => (
              <button
                key={p.id}
                onClick={() =>
                  signIn(p.id, { callbackUrl: '/dashboard/onboarding' })
                }
                style={
                  p.id === 'google'
                    ? { color: '#080B0F', backgroundColor: '#ffffff' }
                    : undefined
                }
                className={`group w-full flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm font-medium transition-all duration-150 hover:-translate-y-px focus:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:ring-offset-2 focus-visible:ring-offset-panel ${p.border} ${p.bg} ${p.text} ${p.hover}`}
                aria-label={`Sign in with ${p.name}`}
              >
                <span className="flex items-center gap-3">
                  <span
                    className="h-5 w-5 shrink-0"
                    dangerouslySetInnerHTML={{ __html: p.icon }}
                  />
                  Continue with {p.name}
                </span>
                <ChevronRight className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-60" />
              </button>
            ))}
          </div>

          <p className="mt-7 text-center text-[12px] leading-relaxed text-text-muted">
            <Lock className="inline h-3 w-3 -mt-px mr-1 text-text-muted" />
            Encrypted in transit. We never see your password.
          </p>
        </div>

        <p className="mt-8 text-sm text-text-muted">
          New here?{' '}
          <Link
            href="/sign-up"
            className="text-info hover:text-signal-hover underline-offset-4 hover:underline"
          >
            Create an account
          </Link>
        </p>
      </main>
    </div>
  );
}
