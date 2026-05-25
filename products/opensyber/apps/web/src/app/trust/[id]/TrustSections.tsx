'use client';

import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';
import { ShareButtons } from '@/components/ShareButtons';
import { BadgeEmbed } from '@/components/dashboard/BadgeEmbed';
import { ScoreGauge } from '@/components/score/ScoreGauge';
import { GradeDisplay } from '@/components/score/GradeDisplay';
import type { ScorecardData } from './trust-helpers';
import { buildShareText } from './trust-helpers';
import type { TrustTrackEventName } from './trust-attribution';

export function HeroBanner({ data, scoreUrl, trialUrl, onTrack }: {
  data: ScorecardData; scoreUrl: string; trialUrl: string; onTrack: (event: TrustTrackEventName) => void;
}) {
  return (
    <div className="rounded-[28px] border border-cyan-500/15 bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.18),_transparent_45%),linear-gradient(180deg,_rgba(10,10,10,0.95),_rgba(10,10,10,0.92))] p-8 md:p-10">
      <div className="mb-6 flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-[0.22em] text-cyan-300">
        <Sparkles className="h-3.5 w-3.5" />Public Trust Page
      </div>
      <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-white md:text-5xl">Security proof for {data.instanceName}</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-text-primary md:text-lg">Share a live OpenSyber security posture snapshot with customers, teammates, and prospects. This page updates from the same scorecard powering the operational dashboard.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={scoreUrl} onClick={() => onTrack('trust_open_scorecard')} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white px-4 py-2 text-sm font-medium text-neutral-950 transition hover:bg-neutral-200">
              Open raw scorecard<ArrowRight className="h-4 w-4" />
            </Link>
            <Link href={trialUrl} onClick={() => onTrack('trust_start_trial')} className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/5">Start free trial</Link>
          </div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <ScoreGauge score={data.overall} />
            <GradeDisplay grade={data.grade} />
            <p className="text-sm text-text-secondary">Last updated {new Date(data.lastUpdated).toLocaleDateString()}</p>
            {data.recommendationCount > 0 && <p className="text-sm text-amber-400">{data.recommendationCount} active recommendation{data.recommendationCount > 1 ? 's' : ''}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

export function StatsRow({ data, strongestCategory, weakestCategory }: {
  data: ScorecardData; strongestCategory: [string, number] | undefined; weakestCategory: [string, number] | undefined;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="rounded border border-border bg-panel/40 p-5">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-text-dim">Overall score</p>
        <p className="mt-3 text-4xl font-bold text-white">{data.overall}</p>
        <p className="mt-2 text-sm text-text-secondary">Live score synced from the latest OpenSyber scan.</p>
      </div>
      <div className="rounded border border-border bg-panel/40 p-5">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-text-dim">Strongest area</p>
        <p className="mt-3 text-2xl font-semibold capitalize text-white">{strongestCategory?.[0]?.replace(/_/g, ' ') ?? 'N/A'}</p>
        <p className="mt-2 text-sm text-text-secondary">{strongestCategory ? `${strongestCategory[1]}/100` : 'No category data available.'}</p>
      </div>
      <div className="rounded border border-border bg-panel/40 p-5">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-text-dim">Needs attention</p>
        <p className="mt-3 text-2xl font-semibold capitalize text-white">{weakestCategory?.[0]?.replace(/_/g, ' ') ?? 'N/A'}</p>
        <p className="mt-2 text-sm text-text-secondary">{weakestCategory ? `${weakestCategory[1]}/100` : 'No category data available.'}</p>
      </div>
    </div>
  );
}

export function ShareSection({ trustUrl, data, onTrack }: {
  trustUrl: string; data: ScorecardData; onTrack: (event: TrustTrackEventName) => void;
}) {
  return (
    <div className="rounded border border-border bg-panel/30 p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Share This Page</h2>
          <p className="mt-1 text-sm text-text-secondary">Use this in launch posts, customer updates, or trust-center handoffs.</p>
        </div>
        <ShareButtons
          url={trustUrl}
          text={buildShareText(data.instanceName, data.overall, data.grade)}
          title="OpenSyber Trust Page"
          onAction={(action) => {
            if (action === 'copy') onTrack('trust_share_copy');
            if (action === 'x') onTrack('trust_share_x');
            if (action === 'linkedin') onTrack('trust_share_linkedin');
          }}
        />
      </div>
    </div>
  );
}

export function BadgeSection({ instanceId }: { instanceId: string }) {
  return (
    <div className="rounded border border-border bg-panel/30 p-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-white">Security Badge</h2>
        <p className="mt-1 text-sm text-text-secondary">Embed the badge in your README, docs, trust center, or customer-facing project pages.</p>
      </div>
      <BadgeEmbed instanceId={instanceId} />
    </div>
  );
}

export function CtaSection({ trialUrl, demoUrl, onTrack }: {
  trialUrl: string; demoUrl: string; onTrack: (event: TrustTrackEventName) => void;
}) {
  return (
    <div className="rounded border border-border bg-panel/30 p-6 text-center">
      <p className="text-sm uppercase tracking-[0.18em] text-text-dim">Powered by OpenSyber</p>
      <h2 className="mt-3 text-2xl font-semibold text-white">Security visibility for AI agents in production</h2>
      <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-text-secondary">Monitor agent behavior, enforce policies, export proof, and give buyers a live security signal instead of a static PDF.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href={trialUrl} onClick={() => onTrack('trust_start_trial')} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white px-4 py-2 text-sm font-medium text-neutral-950 transition hover:bg-neutral-200">Start free trial</Link>
        <Link href={demoUrl} onClick={() => onTrack('trust_book_demo')} className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/5">Book demo</Link>
      </div>
    </div>
  );
}
