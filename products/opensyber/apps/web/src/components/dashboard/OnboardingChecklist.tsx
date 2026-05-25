'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { CheckCircle, Circle, X, Rocket, Package, Shield, Bell, Users, Key, RefreshCw } from 'lucide-react';

interface OnboardingStep {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: typeof Rocket;
  teamOnly?: boolean;
  /** Steps tracked automatically by the backend (instances, skills, etc.) */
  autoDetected?: boolean;
}

const STEPS: OnboardingStep[] = [
  { id: 'deployAgent', label: 'Deploy your first agent', description: 'Launch a secure container for your AI agent', href: '/dashboard', icon: Rocket, autoDetected: true },
  { id: 'installSkill', label: 'Install a skill', description: 'Browse and install a verified skill from the marketplace', href: '/dashboard/marketplace', icon: Package, autoDetected: true },
  { id: 'setupAlertRule', label: 'Set up an alert rule', description: 'Get notified when security events occur', href: '/dashboard/security/alert-rules', icon: Bell, autoDetected: true },
  { id: 'storeSecret', label: 'Store your first secret', description: 'Inject environment variables securely into your agent', href: '/dashboard/settings', icon: Key, autoDetected: true },
  { id: 'reviewSecurity', label: 'Review your security score', description: "Check your agent's security posture", href: '/dashboard/security', icon: Shield },
  { id: 'inviteTeamMember', label: 'Invite a team member', description: 'Add team members to collaborate', href: '/dashboard/settings', icon: Users, teamOnly: true },
];

interface ApiResponse {
  progress: Record<string, boolean>;
  completedAt: string | null;
}

interface Props {
  plan: string;
}

export function OnboardingChecklist({ plan }: Props) {
  const [progressMap, setProgressMap] = useState<Record<string, boolean>>({});
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hidden, setHidden] = useState(false);

  const visibleSteps = STEPS.filter((step) => !step.teamOnly || plan === 'team');

  const fetchProgress = useCallback(async () => {
    try {
      const res = await fetch('/api/proxy/user/onboarding');
      if (res.ok) {
        const data: ApiResponse = await res.json();
        setProgressMap(data.progress ?? {});
        setCompletedAt(data.completedAt);
      }
    } catch {
      // Checklist is non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProgress(); }, [fetchProgress]);

  async function handleStepClick(stepId: string) {
    const stepDef = STEPS.find((s) => s.id === stepId);
    // Only PATCH for manual steps — auto-detected steps are verified by the backend
    if (progressMap[stepId] || stepDef?.autoDetected) return;

    try {
      const res = await fetch('/api/proxy/user/onboarding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: stepId }),
      });
      if (res.ok) {
        const data: ApiResponse = await res.json();
        setProgressMap((prev) => ({ ...prev, ...data.progress }));
        setCompletedAt(data.completedAt);
      }
    } catch {
      // Continue navigation
    }
  }

  async function handleDismiss() {
    setHidden(true);
    try {
      await fetch('/api/proxy/user/onboarding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dismiss: true }),
      });
    } catch {
      // Already hidden locally
    }
  }

  if (loading) {
    return (
      <div className="rounded border border-border bg-panel/30 p-6">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-600 border-t-info" />
          <span className="text-sm text-text-secondary">Loading onboarding progress...</span>
        </div>
      </div>
    );
  }

  if (completedAt || hidden) {
    return null;
  }

  const completedCount = visibleSteps.filter((s) => progressMap[s.id]).length;
  const totalCount = visibleSteps.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <div className="rounded border border-border bg-panel/30 p-6">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-neutral-100">Getting Started</h3>
          <p className="mt-1 text-sm text-text-secondary">
            {completedCount}/{totalCount} steps complete
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={fetchProgress}
            className="rounded-lg p-1 text-text-dim transition hover:bg-surface hover:text-text-primary"
            aria-label="Refresh progress"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={handleDismiss}
            className="rounded-lg p-1 text-text-dim transition hover:bg-surface hover:text-text-primary"
            aria-label="Dismiss onboarding checklist"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-5 h-2 w-full overflow-hidden rounded-full bg-surface">
        <div
          className="h-full rounded-full bg-info transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Step list */}
      <ul className="space-y-2">
        {visibleSteps.map((step) => {
          const completed = progressMap[step.id] === true;
          const StepIcon = step.icon;

          return (
            <li key={step.id}>
              <Link
                href={step.href}
                onClick={() => handleStepClick(step.id)}
                className={`flex items-center gap-4 rounded-lg px-3 py-3 transition ${
                  completed
                    ? 'opacity-60 hover:bg-surface/40'
                    : 'hover:bg-surface/60'
                }`}
              >
                {/* Step icon */}
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-surface">
                  <StepIcon className="h-4 w-4 text-text-primary" />
                </div>

                {/* Label and description */}
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm font-medium ${
                      completed ? 'text-text-dim line-through' : 'text-neutral-100'
                    }`}
                  >
                    {step.label}
                  </p>
                  <p className="text-xs text-text-dim">{step.description}</p>
                </div>

                {/* Status icon */}
                {completed ? (
                  <CheckCircle className="h-5 w-5 flex-shrink-0 text-signal" />
                ) : (
                  <Circle className="h-5 w-5 flex-shrink-0 text-text-dim" />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
