import Link from 'next/link';
import { KeyRound, ArrowRight } from 'lucide-react';

export default function AuthCallbackPage() {
  return (
    <div className="min-h-screen bg-void flex items-center justify-center hero-gradient">
      <div className="text-center max-w-md px-6">
        <KeyRound className="h-10 w-10 text-info mx-auto mb-6" />
        <h1 className="text-2xl font-bold mb-3">You&apos;re signed in</h1>
        <p className="text-text-secondary mb-6">
          Your OpenSyber account works across all products including TokenForge.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-lg bg-info text-void px-8 py-4 text-sm font-medium glow-info hover:brightness-110 transition"
        >
          Go to TokenForge Dashboard <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
