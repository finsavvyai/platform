'use client';

import { useTranslations } from 'next-intl';
import { HeroDashboardEventFeed } from './HeroDashboardEventFeed';

export function HeroDashboardMockup() {
  const t = useTranslations('hero');

  return (
    <div className="gradient-border glow-signal-sm">
      <div className="rounded-2xl bg-panel overflow-hidden">
        {/* Browser chrome */}
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border bg-surface/50">
          <span className="h-3 w-3 rounded-full bg-[#FF5F57]" />
          <span className="h-3 w-3 rounded-full bg-[#FEBC2E]" />
          <span className="h-3 w-3 rounded-full bg-[#28C840]" />
          <div className="flex-1 flex justify-center">
            <span className="rounded-md bg-void/50 border border-border px-6 sm:px-16 py-1 text-xs text-text-dim font-[family-name:var(--font-mono)]">
              opensyber.cloud/dashboard
            </span>
          </div>
        </div>

        {/* Dashboard content */}
        <div className="p-6 lg:p-8">
          <div className="grid lg:grid-cols-[1fr_1.5fr] gap-6">
            {/* Left: Score + quick stats */}
            <div className="space-y-4">
              <div className="rounded-xl bg-surface/50 border border-border p-6 text-center">
                <div className="mx-auto flex items-center justify-center w-24 h-24 rounded-full border-[3px] border-signal/60 animate-[pulse-ring_3s_ease-out_infinite]">
                  <div>
                    <span className="font-[family-name:var(--font-display)] text-4xl text-signal">87</span>
                    <p className="font-[family-name:var(--font-mono)] text-[9px] text-text-dim -mt-1">{t('score')}</p>
                  </div>
                </div>
                <p className="font-[family-name:var(--font-mono)] text-[10px] text-text-dim mt-3 uppercase tracking-wider">Security Score</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { label: t('agents'), value: '3/5', color: 'signal' },
                  { label: t('threatsLabel'), value: '12', color: 'warn' },
                  { label: t('uptime'), value: '99.9%', color: 'ok' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="rounded-lg bg-surface/50 border border-border p-3 text-center">
                    <span className={`text-sm font-bold text-${color}`}>{value}</span>
                    <p className="text-[9px] text-text-dim mt-0.5 font-[family-name:var(--font-mono)]">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Event feed */}
            <HeroDashboardEventFeed />
          </div>
        </div>
      </div>
    </div>
  );
}
