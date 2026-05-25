'use client';

import { motion } from 'framer-motion';
import { Code2, Server, ShieldCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const ease = [0.25, 0.1, 0.25, 1] as const;

interface Step {
  icon: LucideIcon;
  title: string;
  description: string;
  color: string;
  bgColor: string;
}

const steps: Step[] = [
  {
    icon: Code2,
    title: 'Add Script Tag',
    description:
      'One line in your HTML. The script auto-generates device keys, binds the session, and signs all fetch() requests.',
    color: 'text-info',
    bgColor: 'bg-info/10',
  },
  {
    icon: Server,
    title: 'Add Server Middleware',
    description:
      'One line of middleware verifies every request via the TokenForge API. Express, Next.js, Hono, or Fastify.',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
  },
  {
    icon: ShieldCheck,
    title: 'Monitor',
    description:
      'Dashboard shows trust scores, security events, and anomalies in real time. Get alerts on suspicious sessions.',
    color: 'text-ok',
    bgColor: 'bg-ok/10',
  },
];

export function HowItWorksSection(): React.ReactElement {
  return (
    <section className="py-24 md:py-32 border-t border-border/50">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5, ease }}
          className="text-center mb-16"
        >
          <span className="font-[family-name:var(--font-mono)] text-[11px] text-info uppercase tracking-[0.2em] mb-5 block">
            How It Works
          </span>
          <h2 className="font-bold text-3xl sm:text-5xl md:text-7xl tracking-tight mb-4">Three Steps to Protection</h2>
          <p className="text-text-secondary max-w-2xl mx-auto text-lg">
            One script tag on the client. One middleware on the server. Full visibility in the dashboard.
          </p>
        </motion.div>

        <div className="relative grid gap-8 md:grid-cols-3">
          {/* Connecting line (desktop only) */}
          <div className="hidden md:block absolute top-16 left-[20%] right-[20%] h-px bg-gradient-to-r from-info/40 via-purple-500/40 to-ok/40" />

          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ delay: i * 0.2, duration: 0.5, ease }}
                className="text-center relative z-10"
              >
                <motion.div
                  className={`mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl ${step.bgColor} border border-border/50`}
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  transition={{ type: 'spring', stiffness: 300 }}
                >
                  <Icon className={`h-6 w-6 ${step.color}`} />
                </motion.div>
                <div className="font-[family-name:var(--font-mono)] text-[11px] text-info uppercase tracking-[0.2em] mb-2">
                  Step {i + 1}
                </div>
                <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                <p className="text-sm text-text-secondary leading-relaxed max-w-xs mx-auto">
                  {step.description}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
