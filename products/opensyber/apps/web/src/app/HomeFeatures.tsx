'use client';

import {
  Shield, Package, MonitorDot, ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { FadeIn } from '@/components/motion/FadeIn';
import { StaggerChildren, StaggerItem } from '@/components/motion/StaggerChildren';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

export { ComparisonSection, StatsSection, WhySection } from './HomeFeaturesExtra';
export { HowItWorksSection } from './HomeHowItWorks';

/** Three pillars -- bento grid with gradient borders */
export function PillarsSection() {
  const t = useTranslations('pillars');

  const pillars = [
    {
      icon: Shield, title: t('infrastructure.title'), color: 'signal',
      desc: t('infrastructure.desc'),
      features: [t('infrastructure.f1'), t('infrastructure.f2'), t('infrastructure.f3')],
    },
    {
      icon: Package, title: t('marketplace.title'), color: 'info', href: '/marketplace' as const,
      desc: t('marketplace.desc'),
      features: [t('marketplace.f1'), t('marketplace.f2'), t('marketplace.f3')],
    },
    {
      icon: MonitorDot, title: t('monitoring.title'), color: 'ok', href: '/demo' as const,
      desc: t('monitoring.desc'),
      features: [t('monitoring.f1'), t('monitoring.f2'), t('monitoring.f3')],
    },
  ];

  const cm: Record<string, { accent: string; bg: string; glow: string }> = {
    signal: { accent: '#00E5C3', bg: 'rgba(0,229,195,0.06)', glow: 'rgba(0,229,195,0.08)' },
    info: { accent: '#4D9EFF', bg: 'rgba(77,158,255,0.06)', glow: 'rgba(77,158,255,0.08)' },
    ok: { accent: '#2ECC7B', bg: 'rgba(46,204,123,0.06)', glow: 'rgba(46,204,123,0.08)' },
  };
  const tc = useTranslations('common');

  return (
    <section className="py-24 md:py-32 border-t border-border/50">
      <div className="mx-auto max-w-7xl px-6">
        <FadeIn className="text-center mb-16">
          <p className="font-[family-name:var(--font-mono)] text-[11px] text-signal uppercase tracking-[0.2em] mb-5">
            {t('sectionLabel')}
          </p>
          <h2 className="font-[family-name:var(--font-display)] text-4xl md:text-6xl tracking-wide">{t('heading')}</h2>
        </FadeIn>
        <StaggerChildren className="grid gap-5 lg:grid-cols-3" staggerDelay={0.15}>
          {pillars.map((p) => {
            const Icon = p.icon;
            const c = cm[p.color];
            return (
              <StaggerItem key={p.title}>
                <div className="gradient-border card-hover h-full">
                  <div className="rounded-2xl bg-panel p-8 h-full">
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl border" style={{ background: c.bg, borderColor: `${c.accent}22` }}>
                      <Icon className="h-6 w-6" style={{ color: c.accent }} />
                    </div>
                    <h3 className="font-[family-name:var(--font-display)] text-xl tracking-wider mt-6 mb-3">{p.title}</h3>
                    <p className="text-sm text-text-secondary mb-6 leading-relaxed">{p.desc}</p>
                    <ul className="space-y-2.5 text-sm text-text-primary">
                      {p.features.map((f) => (
                        <li key={f} className="flex items-center gap-2.5">
                          <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: c.accent }} />{f}
                        </li>
                      ))}
                    </ul>
                    {p.href && (
                      <Link href={p.href} className="mt-6 inline-flex items-center gap-1.5 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-wider hover:gap-2.5 transition-all" style={{ color: c.accent }}>
                        {tc('explore')} <ArrowRight className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                </div>
              </StaggerItem>
            );
          })}
        </StaggerChildren>
      </div>
    </section>
  );
}

/** Demo embed CTA -- elevated card */
export function DemoEmbedSection() {
  const t = useTranslations('demo');

  return (
    <section className="py-24 md:py-32 border-t border-border/50">
      <div className="mx-auto max-w-4xl px-6 text-center">
        <FadeIn>
          <div className="gradient-border shimmer">
            <div className="rounded-2xl bg-panel p-12 md:p-16">
              <h2 className="font-[family-name:var(--font-display)] text-3xl md:text-5xl tracking-wide mb-5">{t('heading')}</h2>
              <p className="text-text-secondary mb-10 max-w-lg mx-auto text-lg leading-relaxed">
                {t('description')}
              </p>
              <Link
                href="/demo"
                className="rounded-lg bg-signal text-void px-8 py-4 font-[family-name:var(--font-mono)] text-sm font-bold uppercase tracking-wider hover:bg-signal-hover glow-signal-sm hover:glow-signal transition-all duration-300 inline-flex items-center gap-2"
              >
                <ExternalLink className="h-4 w-4" /> {t('openDemo')}
              </Link>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

