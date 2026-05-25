'use client';

import { useEffect, useState } from 'react';
import { Shield } from 'lucide-react';
import { CategoryBreakdown } from '@/components/score/CategoryBreakdown';
import type { ScorecardData } from './trust-helpers';
import {
  buildTrackedHref,
  buildTrustTrackPayload,
  createTrustAttribution,
  TRUST_ATTRIBUTION_STORAGE_KEY,
  type TrustAttribution,
  type TrustTrackEventName,
} from './trust-attribution';
import { HeroBanner, StatsRow, ShareSection, BadgeSection, CtaSection } from './TrustSections';

export default function TrustPageClient({ instanceId }: { instanceId: string }) {
  const [data, setData] = useState<ScorecardData | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attribution, setAttribution] = useState<TrustAttribution | null>(null);

  useEffect(() => {
    async function fetchScore() {
      try {
        const res = await fetch(`/api/proxy/score/${instanceId}`);
        if (!res.ok) { setError(true); return; }
        setData(await res.json());
      } catch { setError(true); } finally { setLoading(false); }
    }
    fetchScore();
  }, [instanceId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const existing = window.localStorage.getItem(TRUST_ATTRIBUTION_STORAGE_KEY);
    const attributionState = createTrustAttribution({
      searchParams: new URLSearchParams(window.location.search),
      pathname: window.location.pathname,
      referrer: document.referrer,
      existing: existing ? JSON.parse(existing) as Partial<TrustAttribution> : null,
      sessionId: typeof crypto !== 'undefined' ? crypto.randomUUID() : undefined,
    });

    window.localStorage.setItem(TRUST_ATTRIBUTION_STORAGE_KEY, JSON.stringify(attributionState));
    setAttribution(attributionState);
  }, []);

  useEffect(() => {
    if (!data || !attribution || typeof window === 'undefined') return;
    void sendTrustEvent(
      buildTrustTrackPayload({
        event: 'trust_page_view',
        instanceId,
        instanceName: data.instanceName,
        score: data.overall,
        grade: data.grade,
        path: window.location.pathname,
        attribution,
      }),
    );
  }, [attribution, data, instanceId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-wire border-t-info" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded bg-surface">
          <Shield className="h-6 w-6 text-text-secondary" />
        </div>
        <h3 className="mb-1 text-base font-semibold">Trust Page Not Found</h3>
        <p className="max-w-sm text-sm text-text-secondary">This trust page is not available or the instance has no score history yet.</p>
      </div>
    );
  }

  const trustUrl = `/trust/${instanceId}`;
  const scoreUrl = attribution
    ? buildTrackedHref('/score/' + instanceId, 'trust_open_scorecard', instanceId, attribution)
    : `/score/${instanceId}`;
  const trialUrl = attribution
    ? buildTrackedHref('/pricing', 'trust_start_trial', instanceId, attribution)
    : '/pricing';
  const demoUrl = attribution
    ? buildTrackedHref('/enterprise?intent=demo', 'trust_book_demo', instanceId, attribution)
    : '/enterprise?intent=demo';
  const strongestCategory = Object.entries(data.categories).sort((a, b) => b[1] - a[1])[0];
  const weakestCategory = Object.entries(data.categories).sort((a, b) => a[1] - b[1])[0];
  const handleTrack = (event: TrustTrackEventName) => {
    if (!attribution || typeof window === 'undefined') return;
    void sendTrustEvent(
      buildTrustTrackPayload({
        event,
        instanceId,
        instanceName: data.instanceName,
        score: data.overall,
        grade: data.grade,
        path: window.location.pathname,
        attribution,
      }),
    );
  };

  return (
    <div className="space-y-8">
      <HeroBanner data={data} scoreUrl={scoreUrl} trialUrl={trialUrl} onTrack={handleTrack} />
      <StatsRow data={data} strongestCategory={strongestCategory} weakestCategory={weakestCategory} />
      <ShareSection trustUrl={trustUrl} data={data} onTrack={handleTrack} />
      <CategoryBreakdown categories={data.categories} />
      <BadgeSection instanceId={instanceId} />
      <CtaSection trialUrl={trialUrl} demoUrl={demoUrl} onTrack={handleTrack} />
    </div>
  );
}

async function sendTrustEvent(payload: ReturnType<typeof buildTrustTrackPayload>) {
  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    navigator.sendBeacon('/api/trust/track', blob);
    return;
  }

  await fetch('/api/trust/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  });
}
