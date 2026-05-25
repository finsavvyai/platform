import Link from 'next/link';
import { Crosshair, Shield, Zap, Package } from 'lucide-react';
import { SignInButtons } from './SignInButtons';

export default async function SignInPage() {
  return (
    <div className="min-h-screen bg-void flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center px-16 border-r border-border/50 hero-gradient">
        <nav aria-label="Sign in navigation">
          <Link href="/" className="flex items-center gap-2 mb-12">
            <div className="h-11 w-11 rounded-xl bg-signal/10 border border-signal/20 flex items-center justify-center">
              <Crosshair className="h-5 w-5 text-signal" />
            </div>
            <span className="font-[family-name:var(--font-mono)] text-[13px] text-signal tracking-[0.08em]">
              OPEN<span className="text-text-dim">{'//'}</span>SYBER
            </span>
          </Link>
        </nav>
        <h1 className="font-[family-name:var(--font-display)] text-4xl md:text-5xl tracking-wide mb-5">
          WELCOME BACK
        </h1>
        <p className="text-text-secondary mb-10 max-w-md leading-relaxed">
          Your agents are running. Your dashboard is waiting.
        </p>
        <div className="space-y-5">
          {[
            { icon: Shield, text: 'Real-time security monitoring' },
            { icon: Zap, text: 'Live threat intelligence feed' },
            { icon: Package, text: 'Verified skill marketplace' },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-signal/10 border border-signal/20 flex items-center justify-center">
                <Icon className="h-4 w-4 text-signal shrink-0" />
              </div>
              <span className="text-sm text-text-primary">{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — OAuth buttons */}
      <main className="flex-1 flex flex-col items-center justify-center px-8 py-12">
        <Link href="/" className="flex items-center gap-2 mb-10 lg:hidden">
          <div className="h-11 w-11 rounded-xl bg-signal/10 border border-signal/20 flex items-center justify-center">
            <Crosshair className="h-5 w-5 text-signal" />
          </div>
          <span className="font-[family-name:var(--font-mono)] text-[13px] text-signal tracking-[0.08em]">
            OPEN<span className="text-text-dim">{'//'}</span>SYBER
          </span>
        </Link>

        <div className="w-full max-w-sm space-y-8">
          <div className="text-center">
            <h2 className="font-[family-name:var(--font-display)] text-2xl tracking-wide mb-2">Sign in to OpenSyber</h2>
            <p className="text-sm text-text-secondary">Choose your sign-in method</p>
          </div>
          <SignInButtons />
          <p className="text-center text-xs text-text-dim">
            No account? Sign in above — we&apos;ll create one automatically.
          </p>
        </div>

        <p className="mt-8 text-sm text-text-dim">
          Need help?{' '}
          <Link href="/docs/faq" className="text-signal hover:text-signal-hover transition">
            Read the FAQ
          </Link>
        </p>
      </main>
    </div>
  );
}
