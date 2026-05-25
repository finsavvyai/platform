'use client';

import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { KeyRound, Shield, Zap, Lock } from 'lucide-react';
import { PROVIDER_BUTTONS } from '@opensyber/auth';

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-void flex hero-gradient">
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center px-16 border-r border-border/50">
        <Link href="/" className="flex items-center gap-2 mb-12">
          <KeyRound className="h-5 w-5 text-info" />
          <span className="text-lg font-bold">TokenForge</span>
        </Link>
        <h1 className="font-bold text-3xl sm:text-5xl tracking-tight mb-4">Create your account</h1>
        <p className="text-text-secondary mb-8 max-w-md">
          Free forever. Your API key is generated automatically.
        </p>
        <div className="space-y-4">
          {[
            { icon: Shield, text: 'Stolen cookies stopped cold' },
            { icon: Zap, text: 'Know instantly when sessions are hijacked' },
            { icon: Lock, text: 'Works with any auth provider in 4 lines of code' },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3">
              <Icon className="h-4 w-4 text-info shrink-0" />
              <span className="text-sm text-text-secondary">{text}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10">
        <Link href="/" className="flex items-center gap-2 mb-8 lg:hidden">
          <KeyRound className="h-5 w-5 text-info" />
          <span className="text-lg font-bold">TokenForge</span>
        </Link>

        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-bold mb-2 text-center">Create account</h2>
          <p className="text-sm text-text-secondary mb-8 text-center">
            Sign up with your preferred account
          </p>
          <div className="space-y-3">
            {PROVIDER_BUTTONS.map((p) => (
              <button
                key={p.id}
                onClick={() => signIn(p.id, { callbackUrl: '/dashboard/onboarding' })}
                className={`w-full flex items-center justify-center gap-3 rounded-lg border ${p.border} ${p.bg} ${p.text} ${p.hover} px-4 py-3 text-sm font-medium transition`}
                aria-label={`Sign up with ${p.name}`}
              >
                <span className="h-5 w-5" dangerouslySetInnerHTML={{ __html: p.icon }} />
                Continue with {p.name}
              </button>
            ))}
          </div>
        </div>

        <p className="mt-8 text-sm text-text-muted">
          Already have an account?{' '}
          <Link href="/sign-in" className="text-info hover:text-signal-hover">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

