'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { ShieldCheck } from 'lucide-react';
import {
  buildTrustTrackPayload,
  type TrustQueryContext,
  type TrustTrackEventName,
} from '@/app/trust/[id]/trust-attribution';

interface TrustFunnelNoticeProps {
  context: TrustQueryContext | null;
  event: Extract<TrustTrackEventName, 'trust_pricing_view' | 'trust_enterprise_view' | 'trust_sign_up_view'>;
  title: string;
  description: string;
}

export function TrustFunnelNotice({ context, event, title, description }: TrustFunnelNoticeProps) {
  const trackingKey = context
    ? [
        event,
        context.instanceId ?? '',
        context.attribution.sessionId,
        context.attribution.source ?? '',
        context.attribution.campaign ?? '',
      ].join('|')
    : null;

  useEffect(() => {
    if (!context || !trackingKey || typeof window === 'undefined') return;

    void sendTrustEvent(
      buildTrustTrackPayload({
        event,
        instanceId: context.instanceId,
        path: `${window.location.pathname}${window.location.search}`,
        attribution: context.attribution,
      }),
    );
  }, [context, event, trackingKey]);

  if (!context) return null;

  return (
    <div className="mb-8 rounded border border-cyan-500/20 bg-cyan-500/10 p-4 text-left text-sm text-cyan-50">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded bg-cyan-500/15 p-2">
            <ShieldCheck className="h-4 w-4 text-cyan-300" />
          </div>
          <div>
            <p className="font-medium text-white">{title}</p>
            <p className="mt-1 max-w-2xl text-cyan-100/80">{description}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {context.instanceId && <span className="rounded-full border border-white/10 px-2 py-1 text-cyan-100/80">Instance {context.instanceId}</span>}
              {context.attribution.source && <span className="rounded-full border border-white/10 px-2 py-1 text-cyan-100/80">Source {context.attribution.source}</span>}
              {context.attribution.campaign && <span className="rounded-full border border-white/10 px-2 py-1 text-cyan-100/80">Campaign {context.attribution.campaign}</span>}
            </div>
          </div>
        </div>
        {context.instanceId && (
          <Link href={`/trust/${context.instanceId}`} className="inline-flex items-center rounded-full border border-white/10 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/5">
            View trust page
          </Link>
        )}
      </div>
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
