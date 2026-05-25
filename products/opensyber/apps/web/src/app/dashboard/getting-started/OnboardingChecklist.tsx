'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Loader2 } from 'lucide-react';

interface OnboardingProgress {
  deployAgent: boolean;
  installSkill: boolean;
  setupAlertRule: boolean;
  storeSecret: boolean;
  reviewSecurity: boolean;
}

const STEPS = [
  { key: 'deployAgent', label: 'Deploy an agent instance', href: '/dashboard', desc: 'Launch your first security agent on Hetzner' },
  { key: 'installSkill', label: 'Install a security skill', href: '/dashboard/marketplace', desc: 'Browse the marketplace and add a skill to your agent' },
  { key: 'setupAlertRule', label: 'Set up an alert rule', href: '/dashboard/security/alert-rules', desc: 'Get notified when threats are detected' },
  { key: 'storeSecret', label: 'Store a credential', href: '/dashboard/settings', desc: 'Securely vault API keys and tokens' },
  { key: 'reviewSecurity', label: 'Review security dashboard', href: '/dashboard/security', desc: 'Check your overall security posture' },
] as const;

export default function OnboardingChecklist() {
  const [progress, setProgress] = useState<OnboardingProgress | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/proxy/user/onboarding')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => setProgress(data?.progress ?? null))
      .catch(() => setProgress(null))
      .finally(() => setLoading(false));
  }, []);

  const completed = progress
    ? STEPS.filter((s) => progress[s.key]).length
    : 0;
  const total = STEPS.length;
  const pct = Math.round((completed / total) * 100);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-text-secondary">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading your progress...
      </div>
    );
  }

  return (
    <div className="rounded border border-border bg-panel/30 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-text-primary">
          Onboarding Progress
        </h2>
        <span className="text-xs text-text-secondary font-mono">
          {completed}/{total} completed
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 w-full rounded-full bg-surface mb-6 overflow-hidden">
        <div
          className="h-full rounded-full bg-signal transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Steps */}
      <ol className="space-y-3">
        {STEPS.map((step, i) => {
          const done = progress?.[step.key] ?? false;
          return (
            <li key={step.key}>
              <Link
                href={step.href}
                className="flex items-start gap-3 group rounded-lg px-3 py-2.5 -mx-3 hover:bg-surface/60 transition"
              >
                {done ? (
                  <CheckCircle2 className="h-5 w-5 text-green-400 mt-0.5 flex-shrink-0" />
                ) : (
                  <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-text-muted text-[10px] font-bold text-text-secondary mt-0.5">
                    {i + 1}
                  </span>
                )}
                <div className="min-w-0">
                  <span className={`text-sm font-medium ${done ? 'line-through text-text-dim' : 'text-text-primary group-hover:text-signal'}`}>
                    {step.label}
                  </span>
                  <p className="text-xs text-text-dim mt-0.5">{step.desc}</p>
                </div>
              </Link>
            </li>
          );
        })}
      </ol>

      {completed === total && (
        <div className="mt-4 rounded-lg bg-green-500/10 border border-green-500/20 px-4 py-3 text-sm text-green-400 text-center">
          All steps complete — you are ready for production!
        </div>
      )}
    </div>
  );
}
