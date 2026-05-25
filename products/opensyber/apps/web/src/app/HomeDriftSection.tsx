'use client';

import Link from 'next/link';
import { ArrowRight, Clock, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { FadeIn } from '@/components/motion/FadeIn';

/**
 * Cross-session MCP drift wedge. Three scans across a week; the third one fires.
 * Mirrors the actual demo output from `packages/mcp-drift`.
 */
export function DriftSection() {
  const t = useTranslations('mcpDrift');

  const scans = [
    {
      key: 'scan1',
      icon: Clock,
      tone: 'info' as const,
      label: t('scan1Label'),
      verdict: t('scan1Verdict'),
      body: t('scan1Body'),
    },
    {
      key: 'scan2',
      icon: ShieldCheck,
      tone: 'signal' as const,
      label: t('scan2Label'),
      verdict: t('scan2Verdict'),
      body: t('scan2Body'),
    },
    {
      key: 'scan3',
      icon: ShieldAlert,
      tone: 'alert' as const,
      label: t('scan3Label'),
      verdict: t('scan3Verdict'),
      body: t('scan3Body'),
    },
  ];

  return (
    <section className="py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <FadeIn className="text-center mb-16">
          <p className="font-[family-name:var(--font-mono)] text-[11px] text-signal uppercase tracking-[0.2em] mb-5">
            {t('sectionLabel')}
          </p>
          <h2 className="font-[family-name:var(--font-display)] text-4xl md:text-6xl tracking-wide mb-6">
            {t('heading')}
          </h2>
          <p className="text-text-secondary max-w-3xl mx-auto text-lg leading-relaxed">
            {t('description')}
          </p>
        </FadeIn>

        <FadeIn>
          <div className="grid md:grid-cols-3 gap-5 max-w-5xl mx-auto mb-10">
            {scans.map(({ key, ...scan }) => (
              <ScanCard key={key} {...scan} />
            ))}
          </div>
        </FadeIn>

        <FadeIn className="text-center">
          <p className="font-[family-name:var(--font-mono)] text-sm text-text-dim italic max-w-2xl mx-auto mb-6">
            “{t('tagline')}”
          </p>
          <Link
            href="https://github.com/finsavvyai/opensyber/tree/main/packages/mcp-drift"
            className="inline-flex items-center gap-2 rounded-lg border border-signal/30 bg-signal/5 px-5 py-2.5 text-sm font-medium text-signal hover:bg-signal/10 hover:border-signal/50 transition"
          >
            {t('cta')}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </FadeIn>
      </div>
    </section>
  );
}

interface ScanCardProps {
  icon: typeof Clock;
  tone: 'info' | 'signal' | 'alert';
  label: string;
  verdict: string;
  body: string;
}

const TONE_STYLES: Record<ScanCardProps['tone'], { border: string; text: string; pill: string }> = {
  info: {
    border: 'border-info/20',
    text: 'text-info',
    pill: 'bg-info/10 text-info border-info/20',
  },
  signal: {
    border: 'border-signal/20',
    text: 'text-signal',
    pill: 'bg-signal/10 text-signal border-signal/20',
  },
  alert: {
    border: 'border-alert/30',
    text: 'text-alert',
    pill: 'bg-alert/10 text-alert border-alert/30',
  },
};

function ScanCard({ icon: Icon, tone, label, verdict, body }: ScanCardProps) {
  const styles = TONE_STYLES[tone];
  return (
    <div className={`rounded-2xl border ${styles.border} bg-panel/40 p-6 transition hover:bg-panel/60`}>
      <div className="flex items-center gap-2 mb-4">
        <Icon className={`h-4 w-4 ${styles.text}`} aria-hidden="true" />
        <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-text-dim">
          {label}
        </p>
      </div>
      <span
        className={`inline-block rounded-md border px-2.5 py-1 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-wider mb-4 ${styles.pill}`}
      >
        {verdict}
      </span>
      <p className="font-[family-name:var(--font-mono)] text-[12px] text-text-secondary leading-relaxed">
        {body}
      </p>
    </div>
  );
}
