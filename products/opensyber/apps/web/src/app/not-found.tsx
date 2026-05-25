import Link from 'next/link';
import { Crosshair, ArrowLeft, Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-void flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <div className="flex justify-center mb-8">
          <div className="flex h-16 w-16 items-center justify-center rounded bg-signal/10">
            <Crosshair className="h-8 w-8 text-signal" />
          </div>
        </div>
        <h1 className="font-[family-name:var(--font-display)] text-5xl sm:text-7xl text-text-primary mb-4">404</h1>
        <p className="text-lg text-text-secondary mb-8">
          Target not found. This page may have been moved or the URL is incorrect.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded bg-signal px-5 py-3 font-[family-name:var(--font-mono)] text-sm font-bold uppercase tracking-wider text-void hover:bg-signal-hover transition min-h-[44px]"
          >
            <Home className="h-4 w-4" />
            Home
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 rounded border border-border px-5 py-3 font-[family-name:var(--font-mono)] text-sm font-bold uppercase tracking-wider text-text-secondary hover:border-signal hover:text-signal transition min-h-[44px]"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
