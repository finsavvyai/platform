'use client';

import { motion } from 'framer-motion';
import { ShieldX, ShieldCheck } from 'lucide-react';

const ease = [0.25, 0.1, 0.25, 1] as const;

interface Step {
  text: string;
  icon: string;
}

const withoutSteps: Step[] = [
  { text: 'User logs in with MFA', icon: '\u2713' },
  { text: 'Attacker runs AiTM proxy', icon: '\u26a0' },
  { text: 'Session cookie captured', icon: '\u26a0' },
  { text: 'Cookie used from attacker\u2019s machine', icon: '\u26a0' },
  { text: 'Valid session \u2014 system can\u2019t tell', icon: '\u2713' },
  { text: 'BREACHED \u2014 MFA irrelevant', icon: '\u2717' },
];

const withSteps: Step[] = [
  { text: 'User logs in with MFA', icon: '\u2713' },
  { text: 'Attacker runs AiTM proxy', icon: '\u26a0' },
  { text: 'Session cookie captured', icon: '\u26a0' },
  { text: 'Cookie used from attacker\u2019s machine', icon: '\u26a0' },
  { text: 'No device signature \u2014 check fails', icon: '\u2717' },
  { text: 'Score: 0/100 \u2014 REVOKED', icon: '\ud83d\udee1' },
];

function StepList(
  { steps, variant }: { steps: Step[]; variant: 'without' | 'with' },
): React.ReactElement {
  const isWithout = variant === 'without';

  return (
    <div className={`gradient-border card-hover ${isWithout ? '' : ''}`}>
      <div className="rounded-2xl bg-panel p-8">
        <div className="flex items-center gap-3 mb-5">
          {isWithout ? (
            <ShieldX className="h-5 w-5 text-alert" />
          ) : (
            <ShieldCheck className="h-5 w-5 text-ok" />
          )}
          <h3 className="text-lg font-semibold">
            {isWithout ? 'Without TokenForge' : 'With TokenForge'}
          </h3>
        </div>
        <ol className="space-y-3">
          {steps.map((step, i) => {
            const isLast = i === steps.length - 1;
            return (
              <motion.li
                key={step.text}
                initial={{ opacity: 0, x: isWithout ? -12 : 12 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.35, ease }}
                className="flex items-start gap-3"
              >
                <span className="text-sm mt-0.5 shrink-0 w-5 text-center">{step.icon}</span>
                <span
                  className={`text-sm leading-relaxed ${
                    isLast
                      ? isWithout
                        ? 'text-alert font-semibold'
                        : 'text-ok font-semibold'
                      : 'text-text-secondary'
                  }`}
                >
                  {step.text}
                </span>
              </motion.li>
            );
          })}
        </ol>
        {isWithout ? (
          <div className="mt-4 rounded-lg bg-alert/10 border border-alert/30 px-3 py-2 text-xs font-semibold text-alert text-center">
            BREACHED
          </div>
        ) : (
          <div className="mt-4 rounded-lg bg-ok/10 border border-ok/30 px-3 py-2 text-xs font-semibold text-ok text-center">
            PROTECTED
          </div>
        )}
      </div>
    </div>
  );
}

export function AttackComparison(): React.ReactElement {
  return (
    <section className="py-24 md:py-32 border-t border-border/50">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5, ease }}
          className="text-center mb-14"
        >
          <span className="font-[family-name:var(--font-mono)] text-[11px] text-info uppercase tracking-[0.2em] mb-5 block">
            Attack Simulation
          </span>
          <h2 className="font-bold text-3xl sm:text-5xl md:text-7xl tracking-tight mb-4">
            What happens when your session cookie is stolen?
          </h2>
          <p className="text-text-secondary max-w-xl mx-auto text-lg">
            AiTM phishing captures session cookies after MFA. See the difference.
          </p>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-2 max-w-4xl mx-auto">
          <StepList steps={withoutSteps} variant="without" />
          <StepList steps={withSteps} variant="with" />
        </div>
      </div>
    </section>
  );
}
