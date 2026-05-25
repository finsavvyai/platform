'use client';

import { Link } from '@/i18n/navigation';
import { SiteHeader } from '@/components/SiteHeader';
import {
  Scale, ShieldCheck, FileSearch, ScrollText,
  Users, Lock, ArrowRight,
} from 'lucide-react';

const pillars = [
  {
    icon: Scale,
    title: 'Policy Enforcement',
    desc: 'Define and enforce agent policies across deployments — permissions, data access, and execution boundaries.',
    href: '/dashboard/security/policies',
  },
  {
    icon: ShieldCheck,
    title: 'Compliance Frameworks',
    desc: 'Map agent operations to SOC 2, NIST AI RMF, GDPR, and EU AI Act requirements with automated evidence.',
    href: '/compliance',
  },
  {
    icon: FileSearch,
    title: 'Audit Trail',
    desc: 'Immutable logs of every agent action, skill execution, and configuration change for auditor review.',
    href: '/dashboard/logs',
  },
  {
    icon: ScrollText,
    title: 'Rule Engine',
    desc: 'Configurable rules that trigger alerts, block actions, or enforce remediation when agents violate policy.',
    href: '/dashboard/rule-engine',
  },
  {
    icon: Users,
    title: 'RBAC & Access Control',
    desc: 'Role-based permissions ensure only authorized team members can deploy, configure, or modify agents.',
    href: '/dashboard/team',
  },
  {
    icon: Lock,
    title: 'Data Residency',
    desc: 'Pin agent compute and data to specific regions to meet sovereignty and residency requirements.',
    href: '/dashboard/cloud',
  },
];

const stats = [
  { value: '103+', label: 'Policy controls' },
  { value: '5', label: 'Compliance frameworks' },
  { value: '<60s', label: 'Audit report generation' },
  { value: '24/7', label: 'Continuous monitoring' },
];

export default function GovernancePage() {
  return (
    <div className="min-h-screen bg-void text-text-primary">
      <SiteHeader />
      <div className="mx-auto max-w-5xl px-6 pt-28 pb-20">
        {/* Hero */}
        <div className="text-center mb-20">
          <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.2em] text-signal mb-4">
            Governance
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-3xl sm:text-5xl uppercase tracking-wide mb-4">
            AI Agent Governance
          </h1>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto">
            Full visibility and control over every AI agent in your organization.
            Enforce policy, maintain compliance, and prove it to auditors.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-20">
          {stats.map((s) => (
            <div key={s.label} className="brand-card rounded p-6 text-center">
              <p className="font-[family-name:var(--font-display)] text-3xl uppercase tracking-wide text-signal">
                {s.value}
              </p>
              <p className="text-sm text-text-secondary mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Pillars */}
        <div className="mb-20">
          <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.2em] text-signal mb-3">
            Governance Pillars
          </p>
          <h2 className="font-[family-name:var(--font-display)] text-3xl uppercase tracking-wide mb-8">
            Complete Control
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {pillars.map((p) => {
              const Icon = p.icon;
              return (
                <Link key={p.title} href={p.href} aria-label={p.title} className="brand-card rounded p-6 group transition hover:border-signal/30">
                  <Icon className="h-6 w-6 text-signal mb-3" aria-hidden="true" />
                  <h3 className="font-[family-name:var(--font-mono)] text-sm uppercase tracking-wider mb-2">
                    {p.title}
                  </h3>
                  <p className="text-sm text-text-secondary">{p.desc}</p>
                </Link>
              );
            })}
          </div>
        </div>

        {/* CTA */}
        <div className="flex items-center justify-center gap-4">
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 rounded bg-signal px-8 py-3.5 font-[family-name:var(--font-mono)] text-sm uppercase tracking-wider text-void hover:bg-signal-hover transition"
          >
            Start Governing <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/enterprise"
            className="inline-flex items-center gap-2 rounded border border-signal px-8 py-3.5 font-[family-name:var(--font-mono)] text-sm uppercase tracking-wider text-signal hover:bg-signal/10 transition"
          >
            Contact Sales
          </Link>
        </div>
      </div>
    </div>
  );
}
