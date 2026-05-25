'use client';

import { useEffect, useMemo, useState } from 'react';
import { Sparkles, Loader2, CheckCircle2, Settings2 } from 'lucide-react';
import {
  getSuggestionsForPersona,
  type OnboardingSignals,
  type RegionId,
} from '@opensyber/shared';
import { detectPersona } from '@/lib/onboarding/persona';
import { inferRegion } from '@/lib/onboarding/region';

type Phase = 'idle' | 'starting' | 'provisioning' | 'installing_skills' | 'done' | 'error';

interface Props {
  onNext: () => void;
  onCustomize: () => void;
  /** Server-side signals passed down by parent. Optional — client signals work alone. */
  serverSignals?: Partial<OnboardingSignals>;
}

/**
 * Adaptive auto-setup step.
 *
 * On mount we harvest client signals (locale, timezone, referrer, UTM) and
 * combine them with anything the server already knows (email domain, OAuth
 * provider). `detectPersona` decides what to recommend; user confirms with
 * a single click or escapes to the manual flow via Customize.
 */
export function StepAutoSetup({ onNext, onCustomize, serverSignals }: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState('');
  const [progressLabel, setProgressLabel] = useState('');

  const signals = useMemo<OnboardingSignals>(() => harvestSignals(serverSignals), [serverSignals]);
  const detection = useMemo(() => detectPersona(signals), [signals]);
  const region: RegionId = useMemo(
    () => inferRegion({ timezone: signals.timezone, locale: signals.locale }),
    [signals.timezone, signals.locale],
  );
  const suggestion = useMemo(() => getSuggestionsForPersona(detection.persona), [detection.persona]);

  async function handleStart() {
    setPhase('starting');
    setError('');
    setProgressLabel('Spinning up your agent…');
    try {
      const res = await fetch('/api/proxy/onboarding/auto-deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          region,
          persona: detection.persona,
          skill_ids: suggestion.skills,
          signals,
        }),
      });
      const data = await res.json().catch(() => ({})) as {
        ok?: boolean;
        message?: string;
        upgradeUrl?: string;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.message ?? `Auto setup failed (${res.status})`);
      }
      setPhase('installing_skills');
      setProgressLabel(`Installing ${suggestion.skills.length} skill(s)…`);
      // Skill install is async on the backend; in v1 we trust the orchestrator
      // and move on after the VM is up. A future iteration streams real events.
      setTimeout(() => {
        setPhase('done');
        setProgressLabel('Ready — opening your dashboard.');
        setTimeout(onNext, 900);
      }, 1200);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
      setPhase('error');
    }
  }

  const busy = phase === 'starting' || phase === 'provisioning' || phase === 'installing_skills';

  return (
    <div className="flex flex-col items-center text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-signal/10 text-signal mb-4">
        {phase === 'done'
          ? <CheckCircle2 className="h-6 w-6 text-green-400" />
          : <Sparkles className="h-6 w-6" />}
      </div>

      <h3 className="text-lg font-medium text-white">
        {phase === 'done' ? 'You\'re Ready' : 'Auto Setup'}
      </h3>
      <p className="text-sm text-neutral-400 mt-1 mb-6 max-w-sm">{suggestion.welcome_summary}</p>

      <div className="w-full max-w-sm space-y-3 text-left">
        <SummaryRow label="Region" value={region} />
        <SummaryRow label="Pre-installed skills" value={suggestion.skills.join(', ')} />
        <SummaryRow
          label="Detected as"
          value={
            detection.persona === 'unknown'
              ? 'Generic (we\'ll learn more as you click around)'
              : detection.persona.replace('_', ' ')
          }
        />
      </div>

      {error && <p className="text-xs text-red-400 mt-4">{error}</p>}
      {busy && progressLabel && (
        <p className="text-xs text-neutral-400 mt-4 inline-flex items-center gap-1.5">
          <Loader2 className="h-3 w-3 animate-spin" />
          {progressLabel}
        </p>
      )}

      <div className="mt-6 w-full max-w-sm space-y-2">
        <button
          onClick={handleStart}
          disabled={busy || phase === 'done'}
          className="w-full rounded-lg bg-signal px-6 py-3 text-sm font-semibold text-void hover:bg-signal/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-2"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {phase === 'idle' && 'Start auto setup'}
          {phase === 'starting' && 'Starting…'}
          {phase === 'provisioning' && 'Provisioning…'}
          {phase === 'installing_skills' && 'Installing skills…'}
          {phase === 'done' && 'Done ✓'}
          {phase === 'error' && 'Try again'}
        </button>

        <button
          onClick={onCustomize}
          disabled={busy}
          className="w-full text-xs text-neutral-500 hover:text-neutral-300 mt-2 transition-colors inline-flex items-center justify-center gap-1.5"
        >
          <Settings2 className="h-3 w-3" />
          Customize instead
        </button>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-neutral-500">{label}</span>
      <span className="text-neutral-300 font-mono">{value}</span>
    </div>
  );
}

/**
 * Combine server-passed signals (from the user session) with what we can
 * read from the browser. Server signals take precedence — they're more
 * trustworthy than locale headers.
 */
function harvestSignals(server: Partial<OnboardingSignals> | undefined): OnboardingSignals {
  if (typeof window === 'undefined') {
    return { ...server } as OnboardingSignals;
  }
  const params = new URLSearchParams(window.location.search);
  const referrer = (() => {
    try {
      return document.referrer ? new URL(document.referrer).pathname : undefined;
    } catch {
      return undefined;
    }
  })();
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return {
    locale: navigator.language,
    timezone: tz,
    referrer_path: referrer,
    utm_campaign: params.get('utm_campaign') ?? undefined,
    utm_source: params.get('utm_source') ?? undefined,
    ...server,
  };
}
