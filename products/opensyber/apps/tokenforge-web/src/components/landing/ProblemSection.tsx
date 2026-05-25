'use client';

import { motion } from 'framer-motion';
import { Shield, Code, Wifi } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const ease = [0.25, 0.1, 0.25, 1] as const;

interface ThreatCard {
  icon: LucideIcon;
  title: string;
  description: string;
  color: string;
}

const threats: ThreatCard[] = [
  {
    icon: Shield,
    title: 'AiTM Phishing',
    description:
      'Adversary-in-the-middle attacks steal session cookies in real-time, bypassing MFA completely.',
    color: 'text-alert',
  },
  {
    icon: Code,
    title: 'XSS Token Theft',
    description:
      'Cross-site scripting extracts tokens from localStorage and cookies. One XSS and every session is compromised.',
    color: 'text-warn',
  },
  {
    icon: Wifi,
    title: 'Session Hijacking',
    description:
      'Stolen cookies work from any device, any location. There is no way to tell a legitimate user from an attacker.',
    color: 'text-warn-muted',
  },
];

export function ProblemSection(): React.ReactElement {
  return (
    <section className="py-24 md:py-32 border-t border-border/50 bg-panel/40">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5, ease }}
          className="text-center mb-16"
        >
          <span className="font-[family-name:var(--font-mono)] text-[11px] text-info uppercase tracking-[0.2em] mb-5 block">
            The Threat
          </span>
          <h2 className="font-bold text-3xl sm:text-5xl md:text-7xl tracking-tight mb-4">
            Your Sessions Are <span className="text-alert">Vulnerable</span>
          </h2>
          <p className="text-text-secondary max-w-2xl mx-auto text-lg">
            Authentication gets you in the door. But once inside, your session token is
            the only thing between an attacker and your data.
          </p>
        </motion.div>

        <div className="grid gap-8 md:grid-cols-3">
          {threats.map((threat, i) => {
            const Icon = threat.icon;
            return (
              <motion.div
                key={threat.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ delay: i * 0.12, duration: 0.5, ease }}
                className="gradient-border card-hover"
              >
                <div className="rounded-2xl bg-panel p-8">
                  <Icon className={`h-8 w-8 ${threat.color} mb-4`} />
                  <h3 className="text-lg font-semibold mb-2">{threat.title}</h3>
                  <p className="text-sm text-text-secondary leading-relaxed">{threat.description}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
