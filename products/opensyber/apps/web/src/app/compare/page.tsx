import type { Metadata } from 'next';
import { SiteHeader } from '@/components/SiteHeader';
import { ComparePageViewTracker, TrackedCompareLink } from './CompareAnalytics';
import { comparePages } from './compare-pages';

export const metadata: Metadata = {
  title: 'Compare OpenSyber — OpenSyber',
  description: 'Head-to-head comparisons: OpenSyber, TokenForge, Modal, Lasso, Protect AI, and DIY stacks.',
  alternates: { canonical: '/compare' },
  openGraph: {
    title: 'Compare OpenSyber — OpenSyber',
    description: 'Head-to-head comparisons: OpenSyber, TokenForge, Modal, Lasso, Protect AI, and DIY stacks.',
    url: 'https://opensyber.cloud/compare',
    type: 'website',
  },
};

export default function CompareIndexPage() {
  return (
    <div className="min-h-screen bg-void text-text-primary">
      <SiteHeader />
      <ComparePageViewTracker comparePage="/compare" />
      <div className="mx-auto max-w-5xl px-6 pb-20 pt-36">
        <div className="mb-12">
          <p className="mb-4 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.2em] text-signal">Compare</p>
          <h1 className="mb-4 font-[family-name:var(--font-display)] text-4xl uppercase tracking-wide md:text-6xl">How OpenSyber Stacks Up</h1>
          <p className="max-w-2xl text-text-secondary">
            Practical comparisons to help teams choose their runtime security and agent trust architecture.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {comparePages.map((page) => (
            <TrackedCompareLink
              key={page.href}
              href={page.href}
              comparePage="/compare"
              ctaLabel={`open:${page.title}`}
              className="rounded-2xl border border-border bg-panel/40 p-6 transition hover:border-signal/40 hover:bg-signal/5"
            >
              <h2 className="mb-2 font-semibold">{page.title}</h2>
              <p className="text-sm text-text-secondary">{page.cardDescription}</p>
            </TrackedCompareLink>
          ))}
        </div>
      </div>
    </div>
  );
}

