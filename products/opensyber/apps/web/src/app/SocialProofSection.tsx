'use client';

import { FadeIn } from '@/components/motion/FadeIn';
import { StaggerChildren, StaggerItem } from '@/components/motion/StaggerChildren';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

const attacks = [
  {
    date: 'March 19, 2026',
    severity: 'CRITICAL' as const,
    titleKey: 'Trivy Supply Chain Attack',
    description:
      '45 organizations. 12 hours. Every CI/CD secret exfiltrated. Nobody noticed until after. The ones with monitoring? They knew in 340ms.',
    stops: 'CI/CD Guardian detects unauthorized secret access. IOC feed blocks exfil domains. You find out from a dashboard, not a journalist.',
    href: '/blog/trivy-attack-inevitable' as const,
  },
  {
    date: 'February 9, 2026',
    severity: 'HIGH' as const,
    titleKey: 'Clinejection',
    description:
      'Someone put a prompt injection in a code comment. Your AI agent read it, trusted it, and ran arbitrary shell commands. Because why would a code comment lie?',
    stops: 'AI Prompt Guard inspects every payload and blocks injection patterns. Because code comments can, in fact, lie.',
    href: '/blog/ai-agents-attacking-ai-agents' as const,
  },
  {
    date: 'March 22, 2026',
    severity: 'CRITICAL' as const,
    titleKey: 'CanisterWorm',
    description:
      'Worm spread through npm postinstall scripts. Compromised build pipelines. Injected backdoors into production. All because someone ran npm install. Normal Tuesday.',
    stops: 'Supply Chain Guard scans every install, blocks malicious packages, enforces lockfile integrity. npm install stops being an act of faith.',
    href: '/blog/trivy-attack-inevitable' as const,
  },
];

const severityStyles = {
  CRITICAL: 'bg-alert-vivid/10 text-alert-vivid border-alert-vivid/20',
  HIGH: 'bg-warn-muted/10 text-warn-muted border-warn-muted/20',
};

/** Attack cards — real incidents */
export function SocialProofSection() {
  const t = useTranslations('socialProof');

  return (
    <section className="py-24 md:py-32 border-t border-border/50 relative overflow-hidden">
      <div className="orb bottom-0 left-[20%] h-[400px] w-[400px] bg-alert/[0.02]" style={{ animationDelay: '-10s' }} />

      <div className="relative mx-auto max-w-7xl px-6">
        <FadeIn className="text-center mb-16">
          <div className="inline-flex items-center gap-2 rounded-full bg-alert-vivid/[0.06] border border-alert-vivid/20 px-3.5 py-1.5 mb-6">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-alert-vivid opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-alert-vivid" />
            </span>
            <span className="font-[family-name:var(--font-mono)] text-[11px] text-alert-vivid uppercase tracking-wider">
              {t('sectionLabel')}
            </span>
          </div>
          <h2 className="font-[family-name:var(--font-display)] text-4xl md:text-6xl tracking-wide mb-5">
            {t('heading')}
          </h2>
          <p className="text-text-secondary max-w-2xl mx-auto text-lg">
            {t('description')}
          </p>
        </FadeIn>
        <StaggerChildren className="grid gap-5 md:grid-cols-3" staggerDelay={0.15}>
          {attacks.map((attack) => (
            <StaggerItem key={attack.titleKey}>
              <AttackCard attack={attack} />
            </StaggerItem>
          ))}
        </StaggerChildren>
      </div>
    </section>
  );
}

function AttackCard({ attack }: { attack: (typeof attacks)[number] }) {
  const t = useTranslations('socialProof');

  return (
    <Link
      href={attack.href}
      className="block gradient-border card-hover h-full group"
    >
      <div className="rounded-2xl bg-panel p-7 h-full">
        <div className="flex items-center justify-between mb-5">
          <span className="font-[family-name:var(--font-mono)] text-[11px] text-text-dim">
            {attack.date}
          </span>
          <span
            className={`rounded-md px-2.5 py-0.5 font-[family-name:var(--font-mono)] text-[9px] font-bold tracking-wider border ${severityStyles[attack.severity]}`}
          >
            {attack.severity}
          </span>
        </div>
        <h3 className="text-lg font-semibold mb-3 group-hover:text-signal transition">{attack.titleKey}</h3>
        <p className="text-sm text-text-secondary mb-5 leading-relaxed">{attack.description}</p>
        <div className="rounded-xl bg-signal/[0.04] border border-signal/15 px-4 py-3">
          <p className="font-[family-name:var(--font-mono)] text-[9px] text-signal uppercase tracking-wider mb-1.5">
            {t('opensyberStops')}
          </p>
          <p className="text-xs text-text-secondary leading-relaxed">{attack.stops}</p>
        </div>
      </div>
    </Link>
  );
}
