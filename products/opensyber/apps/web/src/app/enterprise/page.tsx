'use client';

import { Suspense } from 'react';
import { SiteHeader } from '@/components/SiteHeader';
import { EnterprisePageContent } from './EnterprisePageContent';

export default function EnterprisePage() {
  return (
    <Suspense fallback={<EnterprisePageFallback />}>
      <EnterprisePageContent />
    </Suspense>
  );
}

function EnterprisePageFallback() {
  return (
    <div className="min-h-screen bg-void text-text-primary">
      <SiteHeader />
      <div className="mx-auto max-w-5xl px-6 pt-36 pb-20">
        <div className="mb-20 text-center">
          <h1 className="font-[family-name:var(--font-display)] text-4xl md:text-6xl uppercase tracking-wide mb-5">
            Enterprise Security for AI Agents
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-text-secondary">
            Everything your team needs to deploy, manage, and secure AI agents at scale.
          </p>
        </div>
        <div className="mx-auto flex max-w-xl items-center justify-center gradient-border">
          <div className="rounded-2xl bg-panel p-10 w-full flex justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-wire border-t-signal" />
          </div>
        </div>
      </div>
    </div>
  );
}
