'use client';

import { CheckCircle, Fingerprint, ShieldCheck, Lock, Cloud } from 'lucide-react';
import { FadeIn } from '@/components/motion/FadeIn';
import { StaggerChildren, StaggerItem } from '@/components/motion/StaggerChildren';
import { TypedTerminal } from './TypedTerminal';
import { solutionLayers } from './home-data';
import { useTranslations } from 'next-intl';

export { ProblemSection } from './HomeProblemSection';

/** Trust bar -- minimal, high-contrast badges */
export function TrustBar() {
  const t = useTranslations('trustBar');

  return (
    <section className="py-12 border-t border-border/50">
      <div className="mx-auto max-w-5xl px-6">
        <p className="text-center font-[family-name:var(--font-mono)] text-[10px] text-text-muted uppercase tracking-[0.2em] mb-6">
          Built on enterprise-grade infrastructure
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-5">
          {[
            { icon: ShieldCheck, label: t('zeroTrust') },
            { icon: Cloud, label: t('cloudflare') },
            { icon: ShieldCheck, label: t('soc2') },
            { icon: Lock, label: t('gdpr') },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2.5 font-[family-name:var(--font-mono)] text-[12px] text-text-dim tracking-wider">
              <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface border border-border">
                <Icon className="h-4 w-4 text-text-dim" />
              </div>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Solution layers */
export function SolutionSection() {
  const t = useTranslations('solution');

  return (
    <section className="py-24 md:py-32 border-t border-border/50">
      <div className="mx-auto max-w-7xl px-6">
        <FadeIn className="text-center mb-16">
          <p className="font-[family-name:var(--font-mono)] text-[11px] text-signal uppercase tracking-[0.2em] mb-5">
            {t('sectionLabel')}
          </p>
          <h2 className="font-[family-name:var(--font-display)] text-4xl md:text-6xl tracking-wide mb-5">{t('heading')}</h2>
          <p className="text-text-secondary max-w-2xl mx-auto text-lg">{t('description')}</p>
        </FadeIn>
        <StaggerChildren className="grid gap-5 lg:grid-cols-3" staggerDelay={0.15}>
          {solutionLayers.map((layer) => {
            const Icon = layer.icon;
            return (
              <StaggerItem key={layer.title}>
                <div className="gradient-border card-hover h-full">
                  <div className="rounded-2xl bg-panel p-8 h-full">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-signal/10 border border-signal/20">
                        <Icon className="h-5 w-5 text-signal" />
                      </div>
                      <h3 className="text-lg font-semibold">{layer.title}</h3>
                    </div>
                    <ul className="space-y-3 text-sm text-text-secondary">
                      {layer.features.map((item) => (
                        <li key={item} className="flex items-start gap-2.5">
                          <CheckCircle className="h-4 w-4 text-signal/60 mt-0.5 shrink-0" /><span>{item}</span>
                        </li>
                      ))}
                    </ul>
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

/** TokenForge section */
export function TokenForgeSection() {
  const t = useTranslations('tokenforge');

  return (
    <section className="py-24 md:py-32 border-t border-border/50 relative overflow-hidden">
      <div className="orb top-0 right-[10%] h-[400px] w-[400px] bg-info/[0.03]" style={{ animationDelay: '-5s' }} />
      <div className="relative mx-auto max-w-7xl px-6">
        <div className="grid gap-12 lg:grid-cols-2 items-center">
          <FadeIn direction="left">
            <div className="inline-flex items-center gap-2 rounded-full bg-info/[0.06] border border-info/20 px-3 py-1.5 mb-6">
              <Fingerprint className="h-3.5 w-3.5 text-info" />
              <span className="font-[family-name:var(--font-mono)] text-[11px] text-info uppercase tracking-wider">
                {t('sectionLabel')}
              </span>
            </div>
            <h2 className="font-[family-name:var(--font-display)] text-3xl md:text-5xl tracking-wide mb-5">{t('heading')}</h2>
            <p className="text-text-secondary mb-8 leading-relaxed text-lg">{t('description')}</p>
            <ul className="space-y-4 text-sm text-text-primary">
              {[t('f1'), t('f2'), t('f3'), t('f4')].map((item) => (
                <li key={item} className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-6 w-6 rounded-md bg-info/10 border border-info/20">
                    <Lock className="h-3 w-3 text-info" />
                  </div>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </FadeIn>
          <FadeIn direction="right" delay={0.2}>
            <div className="gradient-border glow-info">
              <div className="rounded-2xl bg-panel">
                <TypedTerminal />
              </div>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
