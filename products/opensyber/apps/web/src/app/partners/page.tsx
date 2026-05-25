import Link from 'next/link';
import { SiteHeader } from '@/components/SiteHeader';
import { Users, ShieldCheck, LayoutDashboard, Library, Coins, ArrowRight } from 'lucide-react';

const features = [
  { icon: Users, title: 'Multi-Tenant Management', desc: 'Provision and isolate client environments from a single operator console.' },
  { icon: ShieldCheck, title: 'Per-Client Security Scores', desc: 'Real-time posture scoring per tenant. Surface risk before clients ask.' },
  { icon: LayoutDashboard, title: 'White-Label Dashboards', desc: 'Brand the monitoring interface with your logo, colors, and domain.' },
  { icon: Library, title: 'Shared Skill Library', desc: 'Curate a skill catalog across clients. Push updates once, deploy everywhere.' },
  { icon: Coins, title: 'Revenue Sharing', desc: '70/30 marketplace split. Publish skills your clients use, earn on every install.' },
];

const steps = [
  { num: '01', title: 'Sign Up Team Plan', desc: 'Get multi-tenant access and partner tooling enabled on your account.' },
  { num: '02', title: 'Provision Client Instances', desc: 'Spin up isolated agent environments per client in seconds.' },
  { num: '03', title: 'Monitor From One Dashboard', desc: 'Unified view across all client agents, alerts, and security posture.' },
  { num: '04', title: 'Generate Client Reports', desc: 'Export compliance and performance reports branded to your organization.' },
];

export default function PartnersPage() {
  return (
    <div className="min-h-screen bg-void text-text-primary">
      <SiteHeader />
      <div className="mx-auto max-w-5xl px-6 pt-36 pb-20">
        {/* Hero */}
        <div className="text-center mb-20">
          <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.2em] text-signal mb-5">
            Partner Program
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-4xl md:text-6xl uppercase tracking-wide mb-5">
            Deploy and Manage AI Agents for Your Clients
          </h1>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto">
            Multi-tenancy, per-client security scoring, and white-label dashboards.
            Built for MSPs and agencies that need full control without the overhead.
          </p>
        </div>

        {/* Features */}
        <div className="mb-20">
          <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.2em] text-signal mb-5">
            Partner Capabilities
          </p>
          <h2 className="font-[family-name:var(--font-display)] text-3xl md:text-4xl uppercase tracking-wide mb-8">
            What You Get
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="gradient-border card-hover">
                  <div className="rounded-2xl bg-panel p-8">
                    <div className="h-11 w-11 rounded-xl bg-signal/10 border border-signal/20 flex items-center justify-center mb-4">
                      <Icon className="h-5 w-5 text-signal" />
                    </div>
                    <h3 className="font-[family-name:var(--font-mono)] text-sm uppercase tracking-wider mb-1">
                      {f.title}
                    </h3>
                    <p className="text-sm text-text-secondary">{f.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* How It Works */}
        <div className="mb-20">
          <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.2em] text-signal mb-5">
            Onboarding
          </p>
          <h2 className="font-[family-name:var(--font-display)] text-3xl md:text-4xl uppercase tracking-wide mb-8">
            How It Works
          </h2>
          <div className="grid md:grid-cols-4 gap-4">
            {steps.map((s) => (
              <div key={s.num} className="gradient-border card-hover">
                <div className="rounded-2xl bg-panel p-6">
                  <span className="font-[family-name:var(--font-mono)] text-signal text-xs">{s.num}</span>
                  <h3 className="font-[family-name:var(--font-mono)] text-sm uppercase tracking-wider mt-2 mb-1">
                    {s.title}
                  </h3>
                  <p className="text-xs text-text-secondary">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <Link
            href="/enterprise"
            className="inline-flex items-center gap-2 rounded-lg bg-signal px-8 py-4 font-[family-name:var(--font-mono)] text-sm font-bold uppercase tracking-wider text-void hover:bg-signal-hover glow-signal-sm hover:glow-signal transition-all duration-300"
          >
            Apply for Partner Access <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
