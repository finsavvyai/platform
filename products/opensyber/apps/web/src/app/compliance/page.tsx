import Link from 'next/link';
import { SiteHeader } from '@/components/SiteHeader';
import {
  ClipboardList, ShieldCheck, FileSearch, FileBarChart,
  Gauge, Globe, ArrowRight,
} from 'lucide-react';

type FrameworkStatus = 'Supported' | 'In Progress' | 'Roadmap';

const frameworks: { name: string; status: FrameworkStatus; desc: string }[] = [
  { name: 'SOC 2 Type I', status: 'In Progress', desc: 'Expected Q3 2026 — automated evidence collection for trust service criteria.' },
  { name: 'ISO 27001', status: 'In Progress', desc: 'Information security management system alignment.' },
  { name: 'NIST AI RMF', status: 'Supported', desc: 'Risk management framework mapping for AI agent deployments.' },
  { name: 'GDPR', status: 'Supported', desc: 'Data subject rights, residency controls, and processing records.' },
  { name: 'EU AI Act', status: 'Roadmap', desc: 'High-risk AI classification and transparency obligations.' },
];

const statusColor: Record<FrameworkStatus, string> = {
  'Supported': 'text-ok',
  'In Progress': 'text-warn',
  'Roadmap': 'text-info',
};

const capabilities = [
  { icon: ClipboardList, title: 'Agent Inventory & Registry', desc: 'Catalog every deployed agent, its skills, data access, and owner.' },
  { icon: ShieldCheck, title: 'Policy Enforcement Engine', desc: 'Define and enforce security policies across all agent instances.' },
  { icon: FileSearch, title: 'Automated Evidence Collection', desc: 'Continuous capture of logs, configs, and attestations for auditors.' },
  { icon: FileBarChart, title: 'Audit-Ready Reports', desc: 'Generate compliance reports mapped to framework controls on demand.' },
  { icon: Gauge, title: 'Risk Scoring Methodology', desc: 'Quantified risk scores per agent based on permissions and behavior.' },
  { icon: Globe, title: 'Data Residency Controls', desc: 'Pin agent compute and data storage to specific geographic regions.' },
];

export default function CompliancePage() {
  return (
    <div className="min-h-screen bg-void text-text-primary">
      <SiteHeader />
      <div className="mx-auto max-w-5xl px-6 pt-36 pb-20">
        {/* Hero */}
        <div className="text-center mb-20">
          <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.2em] text-signal mb-5">
            Compliance Toolkit
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-4xl md:text-6xl uppercase tracking-wide mb-5">
            AI Agent Compliance
          </h1>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto">
            Map your AI agent deployments to governance frameworks.
            Automate evidence, enforce policy, and stay audit-ready.
          </p>
        </div>

        {/* Frameworks */}
        <div className="mb-20">
          <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.2em] text-signal mb-5">
            Framework Support
          </p>
          <h2 className="font-[family-name:var(--font-display)] text-3xl md:text-4xl uppercase tracking-wide mb-8">
            Standards Coverage
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            {frameworks.map((fw) => (
              <div key={fw.name} className="gradient-border card-hover">
                <div className="rounded-2xl bg-panel p-7">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-[family-name:var(--font-mono)] text-sm uppercase tracking-wider">
                      {fw.name}
                    </h3>
                    <span className={`font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-wider ${statusColor[fw.status]}`}>
                      {fw.status}
                    </span>
                  </div>
                  <p className="text-sm text-text-secondary">{fw.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Capabilities */}
        <div className="mb-20">
          <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.2em] text-signal mb-5">
            Capabilities
          </p>
          <h2 className="font-[family-name:var(--font-display)] text-3xl md:text-4xl uppercase tracking-wide mb-8">
            What You Get
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {capabilities.map((c) => {
              const Icon = c.icon;
              return (
                <div key={c.title} className="gradient-border card-hover">
                  <div className="rounded-2xl bg-panel p-7">
                    <div className="h-11 w-11 rounded-xl bg-signal/10 border border-signal/20 flex items-center justify-center mb-4">
                      <Icon className="h-5 w-5 text-signal" />
                    </div>
                    <h3 className="font-[family-name:var(--font-mono)] text-sm uppercase tracking-wider mb-1">
                      {c.title}
                    </h3>
                    <p className="text-sm text-text-secondary">{c.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* CTA */}
        <div className="flex items-center justify-center gap-4">
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 rounded-lg bg-signal px-8 py-4 font-[family-name:var(--font-mono)] text-sm font-bold uppercase tracking-wider text-void hover:bg-signal-hover glow-signal-sm hover:glow-signal transition-all duration-300"
          >
            Start Your Assessment <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/enterprise"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-panel/50 backdrop-blur-sm px-8 py-4 font-[family-name:var(--font-mono)] text-sm font-bold uppercase tracking-wider text-signal hover:border-signal/30 hover:bg-signal/5 transition-all duration-300"
          >
            Contact Sales
          </Link>
        </div>
      </div>
    </div>
  );
}
