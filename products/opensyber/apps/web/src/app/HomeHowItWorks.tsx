'use client';

import { Rocket, Terminal, Activity, ArrowRight, Copy } from 'lucide-react';
import { useState } from 'react';
import { FadeIn } from '@/components/motion/FadeIn';
import { StaggerChildren, StaggerItem } from '@/components/motion/StaggerChildren';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

type StepIcon = typeof Rocket;

interface HowStep {
  icon: StepIcon;
  step: string;
  title: string;
  desc: string;
}

/** How it works -- deploy, connect, see events */
export function HowItWorksSection() {
  const t = useTranslations('howItWorks');

  const steps: HowStep[] = [
    { icon: Rocket, step: '01', title: t('step1Title'), desc: t('step1Desc') },
    { icon: Terminal, step: '02', title: t('step2Title'), desc: t('step2Desc') },
    { icon: Activity, step: '03', title: t('step3Title'), desc: t('step3Desc') },
  ];

  return (
    <section className="py-24 md:py-32 border-t border-border/50">
      <div className="mx-auto max-w-7xl px-6">
        <FadeIn className="text-center mb-16">
          <p className="font-[family-name:var(--font-mono)] text-[11px] text-signal uppercase tracking-[0.2em] mb-5">
            {t('sectionLabel')}
          </p>
          <h2 className="font-[family-name:var(--font-display)] text-4xl md:text-6xl tracking-wide mb-5">{t('heading')}</h2>
          <p className="text-text-secondary max-w-2xl mx-auto text-lg leading-relaxed">{t('description')}</p>
        </FadeIn>

        <StaggerChildren className="relative grid gap-8 md:grid-cols-3 max-w-5xl mx-auto mb-14" staggerDelay={0.2}>
          {/* Connecting line (desktop only) */}
          <div className="hidden md:block absolute top-[52px] left-[16.67%] right-[16.67%] h-px bg-gradient-to-r from-signal/30 via-signal/10 to-signal/30" />

          {steps.map((item) => {
            const Icon = item.icon;
            return (
              <StaggerItem key={item.step}>
                <div className="text-center relative">
                  <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-surface border border-border relative z-10">
                    <Icon className="h-7 w-7 text-signal" />
                  </div>
                  <p className="font-[family-name:var(--font-mono)] text-[11px] text-signal tracking-wider mb-2">
                    STEP {item.step}
                  </p>
                  <h3 className="font-[family-name:var(--font-display)] text-xl tracking-wider mb-3">{item.title}</h3>
                  <p className="text-sm text-text-secondary leading-relaxed">{item.desc}</p>
                </div>
              </StaggerItem>
            );
          })}
        </StaggerChildren>

        <FadeIn delay={0.2}>
          <InstallTerminal command={t('installCommand')} />
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/docs/connect-agent"
              className="rounded-lg border border-border bg-panel/50 backdrop-blur-sm px-6 py-3 font-[family-name:var(--font-mono)] text-[12px] font-bold uppercase tracking-wider text-text-primary hover:border-signal/30 hover:bg-signal/5 transition-all duration-300 inline-flex items-center gap-2"
            >
              {t('ctaText')} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

interface InstallTerminalProps {
  command: string;
}

function InstallTerminal({ command }: InstallTerminalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (): void => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    void navigator.clipboard.writeText(command).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="gradient-border glow-signal-sm">
        <div className="rounded-2xl bg-void/90 overflow-hidden">
          {/* Terminal chrome */}
          <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
            <span className="h-2.5 w-2.5 rounded-full bg-alert/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-warn/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-signal/70" />
            <span className="ml-3 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-text-dim">
              ~/your-project — zsh
            </span>
          </div>
          {/* Command line */}
          <div className="flex items-start gap-3 px-5 py-5">
            <span className="font-[family-name:var(--font-mono)] text-[13px] text-signal select-none">$</span>
            <code className="flex-1 font-[family-name:var(--font-mono)] text-[13px] text-text-primary break-all">
              {command}
            </code>
            <button
              type="button"
              onClick={handleCopy}
              aria-label="Copy install command"
              className="shrink-0 rounded-md border border-border bg-surface/60 px-2 py-1 text-text-dim hover:text-signal hover:border-signal/30 transition"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
          {copied && (
            <p className="px-5 pb-3 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-wider text-signal">
              Copied
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
