'use client';

import { motion } from 'framer-motion';
import { Shield, Zap, Clock } from 'lucide-react';
import { AuthCTA } from '@/components/AuthNav';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { HeroDashboardMockup } from './HeroDashboardMockup';

export function HeroSection() {
  const t = useTranslations('hero');

  return (
    <section className="relative pt-36 pb-24 lg:pt-44 lg:pb-32 overflow-hidden">
      {/* Animated mesh gradient background */}
      <div className="hero-gradient absolute inset-0" />
      <div className="orb top-20 left-[10%] h-[500px] w-[500px] bg-signal/[0.04]" style={{ animationDelay: '0s' }} />
      <div className="orb top-40 right-[15%] h-[400px] w-[400px] bg-info/[0.03]" style={{ animationDelay: '-7s' }} />
      <div className="orb top-60 left-[50%] h-[300px] w-[300px] bg-purple-500/[0.02]" style={{ animationDelay: '-14s' }} />

      <div className="relative mx-auto max-w-6xl px-6">
        {/* Incident badge */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex justify-center mb-8"
        >
          <Link
            href="/blog/trivy-attack-inevitable"
            className="inline-flex items-center gap-3 rounded-full border border-alert-vivid/20 bg-alert-vivid/[0.06] px-4 py-2 text-[12px] font-[family-name:var(--font-mono)] hover:bg-alert-vivid/10 transition group"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-alert-vivid opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-alert-vivid" />
            </span>
            <span className="text-alert-vivid font-semibold">{t('trivyDate')}</span>
            <span className="hidden sm:inline text-text-secondary">{t('trivyOrgs')}</span>
            <span className="text-text-dim group-hover:text-signal transition">&rarr;</span>
          </Link>
        </motion.div>

        {/* Main headline -- centered, massive */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-center"
        >
          <h1 className="font-[family-name:var(--font-display)] text-5xl sm:text-7xl lg:text-8xl tracking-wide leading-[0.9]">
            {t('headlineTop')}<br />
            {t('headlineBottom')}<br />
            <span className="text-gradient">{t('headlineHighlight')}</span>
          </h1>
        </motion.div>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
          className="mt-8 text-lg lg:text-xl text-text-secondary leading-relaxed max-w-2xl mx-auto text-center"
        >
          {t('description')}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.32 }}
          className="mt-6 flex flex-wrap items-center justify-center gap-2"
        >
          {['Runtime', 'Security', 'Marketplace'].map((pillar) => (
            <span
              key={pillar}
              className="rounded-full border border-signal/30 bg-signal/10 px-3 py-1 text-xs font-[family-name:var(--font-mono)] uppercase tracking-wider text-signal"
            >
              {pillar}
            </span>
          ))}
        </motion.div>

        {/* CTA buttons */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <AuthCTA
            label={t('ctaPrimary')}
            className="rounded-lg bg-signal text-void px-8 py-4 text-sm font-bold uppercase tracking-wider font-[family-name:var(--font-mono)] hover:bg-signal-hover glow-signal-sm hover:glow-signal transition-all duration-300 flex items-center gap-2 justify-center"
          />
          <Link
            href="/demo"
            className="rounded-lg border border-border bg-panel/50 backdrop-blur-sm px-8 py-4 text-sm font-bold uppercase tracking-wider font-[family-name:var(--font-mono)] text-text-primary hover:border-signal/30 hover:bg-signal/5 transition-all duration-300 text-center"
          >
            {t('ctaSecondary')} &rarr;
          </Link>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.55 }}
          className="mt-5 text-center text-sm text-text-dim"
        >
          {t('freeForever')}
        </motion.p>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto"
        >
          {[
            { value: '340ms', label: 'Threat Detection', icon: Zap },
            { value: '22', label: 'Audited Skills', icon: Shield },
            { value: '<60s', label: 'Deploy Time', icon: Clock },
            { value: '96%', label: 'Test Coverage', icon: Shield },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="font-[family-name:var(--font-display)] text-3xl lg:text-4xl text-gradient">
                {stat.value}
              </p>
              <p className="font-[family-name:var(--font-mono)] text-[11px] text-text-dim uppercase tracking-wider mt-1">
                {stat.label}
              </p>
            </div>
          ))}
        </motion.div>

        {/* Product preview */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.7 }}
          className="mt-20"
        >
          <HeroDashboardMockup />
        </motion.div>
      </div>
    </section>
  );
}
