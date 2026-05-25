'use client';

import { motion } from 'framer-motion';
import { FadeIn } from '@/components/motion/FadeIn';
import { StaggerChildren, StaggerItem } from '@/components/motion/StaggerChildren';
import { CountUp } from '@/components/motion/CountUp';
import { comparisonRows, earlyAccessFeatures } from './home-data';

export function ComparisonSection() {
  return (
    <section className="py-24 md:py-32 border-t border-border/50">
      <div className="mx-auto max-w-7xl px-6">
        <FadeIn className="text-center mb-16">
          <h2 className="font-[family-name:var(--font-display)] text-4xl md:text-5xl tracking-wide mb-5">THE UNCOMFORTABLE TRUTH</h2>
          <p className="text-text-secondary text-lg max-w-2xl mx-auto">You could keep doing what you&apos;re doing. Let&apos;s just... look at what that means.</p>
        </FadeIn>
        <FadeIn>
          <div className="gradient-border overflow-hidden">
            <div className="rounded-2xl bg-panel overflow-x-auto">
              <table className="w-full font-[family-name:var(--font-mono)] text-[12px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-6 py-5 text-left text-text-dim uppercase tracking-wider">Capability</th>
                    <th className="px-6 py-5 text-center text-alert uppercase tracking-wider">Your current plan</th>
                    <th className="px-6 py-5 text-center text-signal uppercase tracking-wider">OpenSyber</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {comparisonRows.map(([feature, stock, opensyber], i) => (
                    <motion.tr key={feature} initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }} transition={{ delay: i * 0.04, duration: 0.3 }} className="hover:bg-surface/30 transition">
                      <td className="px-6 py-4 text-text-primary">{feature}</td>
                      <td className="px-6 py-4 text-center text-alert/70">{stock}</td>
                      <td className="px-6 py-4 text-center text-signal">{opensyber}</td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

export function StatsSection() {
  return (
    <section className="py-20 border-t border-border/50">
      <div className="mx-auto max-w-7xl px-6">
        <StaggerChildren className="grid gap-8 sm:grid-cols-4 text-center" staggerDelay={0.15}>
          {[
            { end: 847, suffix: '+', label: 'IOCs In Threat Feed', prefix: '' },
            { end: 8, suffix: '', label: 'Score Categories', prefix: '' },
            { end: 6, suffix: '', label: 'Alert Channels', prefix: '' },
            { end: 60, suffix: 's', label: 'Deploy Time', prefix: '<' },
          ].map((stat) => (
            <StaggerItem key={stat.label}>
              <p className="font-[family-name:var(--font-display)] text-3xl sm:text-5xl text-gradient">
                {stat.prefix}
                <CountUp end={stat.end} suffix={stat.suffix} decimals={0} duration={2} />
              </p>
              <p className="font-[family-name:var(--font-mono)] text-[11px] text-text-dim uppercase tracking-wider mt-2">
                {stat.label}
              </p>
            </StaggerItem>
          ))}
        </StaggerChildren>
      </div>
    </section>
  );
}

export function WhySection() {
  return (
    <section className="py-24 md:py-32 border-t border-border/50">
      <div className="mx-auto max-w-7xl px-6">
        <FadeIn className="text-center mb-16">
          <h2 className="font-[family-name:var(--font-display)] text-4xl md:text-5xl tracking-wide">LOOK, IT&apos;S OBVIOUS</h2>
        </FadeIn>
        <StaggerChildren className="grid gap-5 md:grid-cols-3" staggerDelay={0.15}>
          {earlyAccessFeatures.map((f) => {
            const Icon = f.icon;
            return (
              <StaggerItem key={f.title}>
                <div className="gradient-border card-hover h-full">
                  <div className="rounded-2xl bg-panel p-8 h-full">
                    <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-signal/10 border border-signal/20 mb-5">
                      <Icon className="h-5 w-5 text-signal" />
                    </div>
                    <h3 className="text-lg font-semibold mb-3">{f.title}</h3>
                    <p className="text-sm text-text-secondary leading-relaxed">{f.description}</p>
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
