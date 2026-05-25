'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Crosshair, Server, Lock, Globe, CheckCircle2, Loader2 } from 'lucide-react';
import { SiteHeader } from '@/components/SiteHeader';
import { TrustFunnelNotice } from '@/components/trust/TrustFunnelNotice';
import {
  buildTrustReferralNote,
  buildTrustTrackPayload,
  readTrustQueryContext,
} from '../trust/[id]/trust-attribution';

const features = [
  { icon: Crosshair, title: 'Enterprise SSO', desc: 'SAML 2.0 and OIDC with auto-provisioning for your identity provider' },
  { icon: Server, title: 'Unlimited Instances', desc: 'Deploy as many AI agents as your team needs with dedicated compute' },
  { icon: Lock, title: 'SLA Monitoring', desc: '99.9%+ uptime targets with real-time breach alerts and detailed reporting' },
  { icon: Globe, title: 'Data Residency', desc: 'Control where data is stored and agents run — EU, US, or Asia Pacific' },
];

const included = [
  'SAML 2.0 & OIDC SSO', 'Role-based access control', 'Compliance exports (SOC 2, ISO 27001, HIPAA)',
  'SLA monitoring & uptime tracking', 'Data residency controls', 'Priority support with SLA',
  'Custom instance limits', 'Admin panel & audit logs', 'All notification integrations',
];

async function sendTrustEvent(payload: ReturnType<typeof buildTrustTrackPayload>) {
  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    navigator.sendBeacon('/api/trust/track', blob);
    return;
  }
  await fetch('/api/trust/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  });
}

export function EnterprisePageContent() {
  const searchParams = useSearchParams();
  const [form, setForm] = useState({ name: '', email: '', company: '', message: '' });
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trustContext = readTrustQueryContext(new URLSearchParams(searchParams.toString()));
  const isDemoIntent = searchParams.get('intent') === 'demo';

  const handleSubmit = async () => {
    if (!form.name || !form.email || !form.company || !form.message) {
      setError('All fields are required'); return;
    }
    setLoading(true); setError(null);
    const message = trustContext
      ? `${form.message}\n\n${buildTrustReferralNote(trustContext)}`
      : form.message;
    try {
      const res = await fetch('/api/proxy/enterprise/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, message }),
      });
      if (res.ok) {
        setSent(true);
        if (trustContext && typeof window !== 'undefined') {
          void sendTrustEvent(buildTrustTrackPayload({
            event: 'trust_enterprise_submit',
            instanceId: trustContext.instanceId,
            path: `${window.location.pathname}${window.location.search}`,
            attribution: trustContext.attribution,
          }));
        }
      } else {
        const data = await res.json().catch(() => ({}));
        setError((data as { message?: string }).message || 'Failed to send');
      }
    } catch { setError('Network error'); }
    finally { setLoading(false); }
  };

  const inputCls = 'w-full bg-surface border border-border/50 rounded-lg px-4 py-3.5 text-sm text-text-primary';

  return (
    <div className="min-h-screen bg-void text-text-primary">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-6 pt-36 pb-20">
        <div className="text-center mb-20">
          <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.2em] text-signal mb-5">
            Enterprise
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-4xl md:text-6xl tracking-wide mb-5">
            Enterprise Security for AI Agents
          </h1>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto">
            Everything your team needs to deploy, manage, and secure AI agents at scale — with compliance, SSO, and dedicated support.
          </p>
        </div>

        <TrustFunnelNotice
          context={trustContext} event="trust_enterprise_view"
          title={isDemoIntent ? 'Trust-page visitor booking a guided demo' : 'Trust-page visitor in sales flow'}
          description={isDemoIntent
            ? 'You arrived here from a live OpenSyber trust page. Tell the team what you want covered and they can tailor the walkthrough.'
            : 'You arrived here from a live OpenSyber trust page. Sales will receive that context with your request.'}
        />

        <div className="grid md:grid-cols-2 gap-6 mb-20">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="gradient-border card-hover">
                <div className="rounded-2xl bg-panel p-8">
                  <div className="h-11 w-11 rounded-xl bg-signal/10 border border-signal/20 flex items-center justify-center mb-4">
                    <Icon className="h-5 w-5 text-signal" />
                  </div>
                  <h3 className="font-[family-name:var(--font-mono)] text-sm uppercase tracking-wider mb-1">{f.title}</h3>
                  <p className="text-sm text-text-secondary">{f.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mb-20">
          <h2 className="font-[family-name:var(--font-display)] text-3xl md:text-4xl uppercase tracking-wide text-center mb-8">
            Everything Included
          </h2>
          <div className="gradient-border">
            <div className="rounded-2xl bg-panel p-8">
              <div className="grid md:grid-cols-3 gap-3">
                {included.map((item) => (
                  <div key={item} className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-ok flex-shrink-0" />
                    <span className="text-sm text-text-primary">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="gradient-border max-w-xl mx-auto">
          <div className="rounded-2xl bg-panel p-10">
            <h2 className="font-[family-name:var(--font-display)] text-2xl uppercase tracking-wide mb-2 text-center">
              Contact Sales
            </h2>
            <p className="text-sm text-text-secondary text-center mb-6">
              {isDemoIntent ? 'Book a guided walkthrough tailored to your AI agent stack' : 'Custom pricing for your organization'}
            </p>
            {sent ? (
              <div className="text-center py-8">
                <CheckCircle2 className="h-12 w-12 text-ok mx-auto mb-3" />
                <p className="text-lg font-medium">Received.</p>
                <p className="text-sm text-text-secondary mt-1">Our team will reach out shortly.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Your name" className={inputCls} />
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="Work email" className={inputCls} />
                <input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })}
                  placeholder="Company name" className={inputCls} />
                <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })}
                  placeholder={isDemoIntent ? 'Tell us what you want covered in the demo...' : 'Tell us about your needs...'} rows={3} className={inputCls} />
                {error && <p className="text-sm text-alert">{error}</p>}
                <button onClick={handleSubmit} disabled={loading}
                  className="w-full rounded-lg bg-signal py-4 font-[family-name:var(--font-mono)] text-sm uppercase tracking-wider text-void hover:bg-signal-hover glow-signal-sm hover:glow-signal transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2">
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Get in Touch
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
