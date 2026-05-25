'use client';

import Link from 'next/link';
import { ShieldCheck, ArrowRight, Code2 } from 'lucide-react';
import { useApiKey } from '@/lib/use-api';

export function EmptyState(): React.ReactElement {
  const apiKey = useApiKey();

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/50 bg-panel/20 p-12 text-center">
      {apiKey ? (
        <>
          <ShieldCheck className="h-10 w-10 text-ok mb-4" />
          <h2 className="mb-2 text-lg font-semibold">You&apos;re set up! Waiting for data...</h2>
          <p className="mb-4 max-w-md text-sm text-text-secondary">
            Add the script tag to your app. Stats will appear here as soon as the first request is verified.
          </p>
          <Link href="/dashboard/docs" className="flex items-center gap-2 rounded-lg border border-border/50 px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface transition">
            View Integration Guide
          </Link>
        </>
      ) : (
        <>
          <Code2 className="h-10 w-10 text-info mb-4" />
          <h2 className="mb-2 text-lg font-semibold">Welcome to TokenForge</h2>
          <p className="mb-4 max-w-md text-sm text-text-secondary">
            Generate your API key to get started.
          </p>
          <Link href="/dashboard/onboarding" className="flex items-center gap-2 rounded-lg bg-info text-void px-4 py-2 text-sm font-medium hover:brightness-110 transition">
            Get Started <ArrowRight className="h-4 w-4" />
          </Link>
        </>
      )}
    </div>
  );
}
