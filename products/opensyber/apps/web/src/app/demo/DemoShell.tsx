'use client';

import Link from 'next/link';
import { ArrowRight, Eye, Activity, Network, Bell, Clock, RefreshCw } from 'lucide-react';
import type { DemoTab } from './demo-constants';

export function DemoBanner({ notifCount, onClearNotifs }: { notifCount: number; onClearNotifs: () => void }) {
  return (
    <div className="fixed top-14 z-40 w-full border-b border-signal/20 bg-signal/5 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-2">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ok opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-ok" />
          </span>
          <p className="font-[family-name:var(--font-mono)] text-[11px] text-signal">Live demo — simulated real-time data. Sign up to monitor your own agents.</p>
        </div>
        <div className="hidden sm:flex items-center gap-3">
          <button className="relative p-1.5 rounded hover:bg-signal/10 transition" onClick={onClearNotifs}>
            <Bell className="h-4 w-4 text-signal" />
            {notifCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] rounded-full bg-alert text-[10px] font-bold flex items-center justify-center px-1">
                {notifCount}
              </span>
            )}
          </button>
          <Link href="/sign-up" className="font-[family-name:var(--font-mono)] text-[11px] text-signal font-bold uppercase tracking-wider hover:text-signal-hover flex items-center gap-1">
            Sign up free <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}

export function DemoHeader({ upDays, upHours, upMin, lastScanned, scanText }: {
  upDays: number; upHours: number; upMin: number; lastScanned: number; scanText: string;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl md:text-4xl tracking-wide mb-1">SECURITY DASHBOARD</h1>
        <div className="flex items-center gap-2 font-[family-name:var(--font-mono)] text-[11px] text-text-secondary">
          <span className="h-2 w-2 rounded-full bg-ok" />
          <span>demo-agent-01</span>
          <span className="text-text-dim">&middot;</span>
          <span>EU Central (Frankfurt)</span>
          <span className="text-text-dim">&middot;</span>
          <Clock className="h-3 w-3" />
          <span>Up {upDays}d {upHours}h {upMin}m</span>
        </div>
      </div>
      <div className="mt-4 sm:mt-0 flex items-center gap-2">
        <div className="flex items-center gap-1.5 font-[family-name:var(--font-mono)] text-[10px] text-text-dim bg-panel rounded px-3 py-1.5 border border-border">
          <RefreshCw className={`h-3 w-3 ${lastScanned < 5 ? 'animate-spin text-signal' : ''}`} />
          {scanText}
        </div>
      </div>
    </div>
  );
}

export function DemoTabs({ tab, setTab, notifCount }: { tab: DemoTab; setTab: (t: DemoTab) => void; notifCount: number }) {
  return (
    <div className="flex gap-1 mb-6 bg-panel rounded p-1 w-fit border border-border">
      {([
        { id: 'overview' as const, label: 'Overview', icon: Eye },
        { id: 'events' as const, label: 'Events', icon: Activity },
        { id: 'network' as const, label: 'Network', icon: Network },
      ]).map((t) => {
        const Icon = t.icon;
        const active = tab === t.id;
        return (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-wider font-bold transition-all ${
              active ? 'bg-surface text-signal shadow-sm' : 'text-text-dim hover:text-text-primary'
            }`}>
            <Icon className="h-4 w-4" />
            {t.label}
            {t.id === 'events' && notifCount > 0 && (
              <span className="ml-1 h-4 min-w-[16px] rounded-full bg-alert/20 text-alert text-[10px] font-bold flex items-center justify-center px-1">
                {notifCount}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function DemoCTA() {
  return (
    <div className="mt-12 text-center brand-card rounded p-10">
      <h2 className="font-[family-name:var(--font-display)] text-2xl tracking-wide mb-3">READY TO SECURE YOUR AGENTS</h2>
      <p className="text-text-secondary mb-6 max-w-lg mx-auto">
        Deploy hardened, monitored agents with real-time security scoring, automatic patching, and threat detection.
      </p>
      <div className="flex items-center justify-center gap-4">
        <Link href="/sign-up"
          className="inline-flex items-center gap-2 rounded bg-signal px-8 py-3 font-[family-name:var(--font-mono)] text-sm font-bold uppercase tracking-wider text-void hover:bg-signal-hover hover:shadow-[0_0_20px_rgba(0,229,195,0.3)] transition">
          Get Started Free <ArrowRight className="h-4 w-4" />
        </Link>
        <Link href="/pricing"
          className="inline-flex items-center gap-2 rounded border border-wire px-6 py-3 font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-wider text-text-secondary hover:border-signal hover:text-signal transition">
          View Pricing
        </Link>
      </div>
    </div>
  );
}
