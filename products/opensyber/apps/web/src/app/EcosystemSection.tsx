'use client';

import { Shield, KeyRound, ArrowRight } from 'lucide-react';
import { FadeIn } from '@/components/motion/FadeIn';

export function EcosystemSection() {
  return (
    <section className="py-24 md:py-32 border-t border-border/50">
      <div className="mx-auto max-w-5xl px-6">
        <FadeIn className="text-center mb-16">
          <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.2em] text-signal mb-5">
            Two problems. Two products.
          </p>
          <h2 className="font-[family-name:var(--font-display)] text-4xl md:text-6xl tracking-wide mb-5">
            TWO PRODUCTS.<br />
            <span className="text-gradient">BECAUSE ONE WASN&apos;T ENOUGH.</span>
          </h2>
          <p className="text-text-secondary max-w-2xl mx-auto text-lg leading-relaxed">
            AI agents create two attack surfaces: what the agents do, and the sessions of the humans
            commanding them. We built a product for each. Because apparently nobody else was going to.
          </p>
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-12">
          <FadeIn delay={0.1}>
            <div className="gradient-border glow-signal-sm h-full">
              <div className="rounded-2xl bg-panel p-8 h-full relative">
                <span className="absolute top-6 right-6 rounded-full bg-signal/10 border border-signal/20 px-3 py-1 font-[family-name:var(--font-mono)] text-[10px] text-signal uppercase tracking-wider">
                  You are here
                </span>
                <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-signal/10 border border-signal/20 mb-5">
                  <Shield className="h-6 w-6 text-signal" />
                </div>
                <h3 className="font-[family-name:var(--font-display)] text-2xl tracking-wide mb-2">
                  OPENSYBER
                </h3>
                <p className="font-[family-name:var(--font-mono)] text-[11px] text-text-dim tracking-wider mb-5">
                  opensyber.cloud
                </p>
                <p className="text-text-secondary text-sm leading-relaxed mb-5">
                  Real-time monitoring, audited skills, and compliance for every AI agent.
                  The thing that should exist by default but doesn&apos;t.
                </p>
                <p className="font-[family-name:var(--font-mono)] text-[11px] text-signal tracking-wider">
                  Protects: AI agent actions
                </p>
              </div>
            </div>
          </FadeIn>
          <FadeIn delay={0.2}>
            <a
              href="https://tokenforge.opensyber.cloud"
              target="_blank"
              rel="noopener noreferrer"
              className="block gradient-border card-hover h-full group"
            >
              <div className="rounded-2xl bg-panel p-8 h-full">
                <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-info/10 border border-info/20 mb-5">
                  <KeyRound className="h-6 w-6 text-info" />
                </div>
                <h3 className="font-[family-name:var(--font-display)] text-2xl tracking-wide mb-2">
                  TOKENFORGE
                </h3>
                <p className="font-[family-name:var(--font-mono)] text-[11px] text-text-dim tracking-wider mb-5">
                  tokenforge.opensyber.cloud
                </p>
                <p className="text-text-secondary text-sm leading-relaxed mb-5">
                  Device-bound session security with ECDSA P-256 keys. Because a session
                  cookie in 2026 is not a security plan. It&apos;s a cry for help.
                </p>
                <p className="font-[family-name:var(--font-mono)] text-[11px] text-info tracking-wider mb-4">
                  Protects: Developer sessions
                </p>
                <span className="inline-flex items-center gap-1.5 font-[family-name:var(--font-mono)] text-[12px] text-text-dim group-hover:text-info group-hover:gap-2.5 transition-all tracking-wider">
                  Visit TokenForge <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            </a>
          </FadeIn>
        </div>

        <FadeIn className="text-center" delay={0.3}>
          <p className="font-[family-name:var(--font-mono)] text-[12px] text-text-muted tracking-wider max-w-xl mx-auto">
            From the moment your developer logs in to the last request their AI agent makes. Covered. Finally.
          </p>
        </FadeIn>
      </div>
    </section>
  );
}
