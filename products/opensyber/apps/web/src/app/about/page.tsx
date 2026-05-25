'use client';

import { Link } from '@/i18n/navigation';
import { SiteHeader } from '@/components/SiteHeader';
import {
  ShieldCheck, Users, Globe, ArrowRight,
  Github, Linkedin, Mail,
} from 'lucide-react';

const values = [
  {
    icon: ShieldCheck,
    title: 'Security First',
    desc: 'Every decision starts with "what could go wrong." We build the security tooling we wished existed when we were the ones on call.',
  },
  {
    icon: Users,
    title: 'Transparency',
    desc: 'No fake testimonials. No inflated numbers. We ship what we can prove and publish what we learn.',
  },
  {
    icon: Globe,
    title: 'Open Research',
    desc: 'Our threat intel, attack analysis, and security guides are public. Better-informed teams make the ecosystem safer for everyone.',
  },
];

const milestones = [
  { date: 'Jan 2026', event: 'Founded. First commit.' },
  { date: 'Feb 2026', event: 'Agent runtime + credential vault shipped.' },
  { date: 'Mar 2026', event: 'Marketplace, TokenForge SDK, and CSPM live.' },
  { date: 'Q2 2026', event: 'Product Hunt launch. SOC2 Type I audit begins.' },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-void text-text-primary">
      <SiteHeader />
      <div className="mx-auto max-w-5xl px-6 pt-28 pb-20">
        {/* Hero */}
        <div className="text-center mb-20">
          <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.2em] text-signal mb-4">
            About Us
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-3xl sm:text-5xl uppercase tracking-wide mb-4">
            Built by Security Engineers
          </h1>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto">
            We watched AI agents leak credentials, exfiltrate data, and install
            malicious packages — with no guardrails. So we built the guardrails.
          </p>
        </div>

        {/* Story */}
        <div className="mb-20">
          <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.2em] text-signal mb-3">
            Our Story
          </p>
          <h2 className="font-[family-name:var(--font-display)] text-3xl uppercase tracking-wide mb-6">
            Why OpenSyber Exists
          </h2>
          <div className="brand-card rounded p-8 space-y-4 text-text-secondary leading-relaxed">
            <p>
              In early 2026, the Trivy GitHub Action was compromised — a single
              force-pushed commit exfiltrated CI secrets from 45 organizations
              in under 12 hours. The attack was silent, transitive, and
              completely undetected by existing security tooling.
            </p>
            <p>
              We had been watching the AI agent ecosystem grow without any
              security layer. Agents were running arbitrary code, accessing
              credentials, and calling external APIs — all with zero visibility
              or control. The Trivy attack was the proof point: the same
              supply chain vectors that hit CI/CD pipelines now apply to every
              AI agent running in production.
            </p>
            <p>
              OpenSyber is the containment layer that was missing. We provide
              runtime security, credential isolation, skill verification, and
              compliance tooling — purpose-built for the AI agent era.
            </p>
          </div>
        </div>

        {/* Values */}
        <div className="mb-20">
          <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.2em] text-signal mb-3">
            Principles
          </p>
          <h2 className="font-[family-name:var(--font-display)] text-3xl uppercase tracking-wide mb-8">
            What We Stand For
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            {values.map((v) => {
              const Icon = v.icon;
              return (
                <div key={v.title} className="brand-card rounded p-6">
                  <Icon className="h-6 w-6 text-signal mb-3" aria-hidden="true" />
                  <h3 className="font-[family-name:var(--font-mono)] text-sm uppercase tracking-wider mb-2">
                    {v.title}
                  </h3>
                  <p className="text-sm text-text-secondary">{v.desc}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Timeline */}
        <div className="mb-20">
          <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.2em] text-signal mb-3">
            Timeline
          </p>
          <h2 className="font-[family-name:var(--font-display)] text-3xl uppercase tracking-wide mb-8">
            Our Journey
          </h2>
          <div className="space-y-4">
            {milestones.map((m) => (
              <div key={m.date} className="flex gap-6 items-baseline">
                <span className="font-[family-name:var(--font-mono)] text-xs text-signal w-20 shrink-0">
                  {m.date}
                </span>
                <span className="text-sm text-text-secondary">{m.event}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Contact */}
        <div className="mb-20">
          <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.2em] text-signal mb-3">
            Get In Touch
          </p>
          <h2 className="font-[family-name:var(--font-display)] text-3xl uppercase tracking-wide mb-6">
            Talk To Us
          </h2>
          <div className="flex flex-wrap gap-4">
            <a
              href="https://github.com/opensyber"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="OpenSyber on GitHub (opens in new tab)"
              className="brand-card rounded px-6 py-4 flex items-center gap-3 hover:border-signal/30 transition"
            >
              <Github className="h-5 w-5 text-signal" aria-hidden="true" />
              <span className="text-sm">GitHub</span>
            </a>
            <a
              href="mailto:hello@opensyber.cloud"
              className="brand-card rounded px-6 py-4 flex items-center gap-3 hover:border-signal/30 transition"
            >
              <Mail className="h-5 w-5 text-signal" aria-hidden="true" />
              <span className="text-sm">hello@opensyber.cloud</span>
            </a>
            <a
              href="https://linkedin.com/company/opensyber"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="OpenSyber on LinkedIn (opens in new tab)"
              className="brand-card rounded px-6 py-4 flex items-center gap-3 hover:border-signal/30 transition"
            >
              <Linkedin className="h-5 w-5 text-signal" aria-hidden="true" />
              <span className="text-sm">LinkedIn</span>
            </a>
          </div>
        </div>

        {/* CTA */}
        <div className="flex items-center justify-center gap-4">
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 rounded bg-signal px-8 py-3.5 font-[family-name:var(--font-mono)] text-sm uppercase tracking-wider text-void hover:bg-signal-hover transition"
          >
            Start Free <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/enterprise"
            className="inline-flex items-center gap-2 rounded border border-signal px-8 py-3.5 font-[family-name:var(--font-mono)] text-sm uppercase tracking-wider text-signal hover:bg-signal/10 transition"
          >
            Enterprise
          </Link>
        </div>
      </div>
    </div>
  );
}
