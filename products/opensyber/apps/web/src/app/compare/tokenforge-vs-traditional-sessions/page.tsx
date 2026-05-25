import { SiteHeader } from '@/components/SiteHeader';
import { ArrowRight } from 'lucide-react';
import { ComparePageViewTracker, TrackedCompareLink } from '../CompareAnalytics';
import { buildCompareMetadata, getComparePage } from '../compare-pages';

const pageMeta = getComparePage('/compare/tokenforge-vs-traditional-sessions');
export const metadata = buildCompareMetadata(pageMeta);

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'TokenForge vs Traditional Session Security (JWT + IP Binding)',
  author: { '@type': 'Organization', name: 'OpenSyber' },
  datePublished: '2026-04-01',
  publisher: { '@type': 'Organization', name: 'OpenSyber' },
  description: pageMeta.metaDescription,
};

const rows = [
  { feature: 'Device proof', tokenforge: 'ECDSA P-256 signature per request (non-extractable key)', traditional: 'None — any device with the token is trusted' },
  { feature: 'Stolen token impact', tokenforge: 'Useless — signature verification fails on different device', traditional: 'Full account access until token expires' },
  { feature: 'Trust evaluation', tokenforge: '7-signal trust score (device, behavior, geo, velocity)', traditional: 'Binary valid/invalid check' },
  { feature: 'Adaptive security', tokenforge: 'Step-up auth triggered on anomaly detection', traditional: 'No adaptive response — same auth for all contexts' },
  { feature: 'Integration time', tokenforge: '5 minutes (SDK + 3 lines of code)', traditional: 'Custom implementation (days to weeks)' },
  { feature: 'VPN / mobile support', tokenforge: 'Works regardless of IP changes', traditional: 'IP binding breaks on VPN, mobile, or carrier NAT' },
  { feature: 'Session replay attacks', tokenforge: 'Blocked — each request has a unique device signature', traditional: 'Possible until token rotation or expiry' },
  { feature: 'Key storage', tokenforge: 'Web Crypto API (non-extractable, hardware-backed)', traditional: 'localStorage / cookies (extractable via XSS)' },
];

const attacks = [
  { name: 'XSS Token Theft', traditional: 'Attacker steals JWT from localStorage and replays it from any device. Full access until expiry.', tokenforge: 'Token is useless without the non-extractable private key bound to the original device.' },
  { name: 'Session Hijacking via Proxy', traditional: 'MITM captures session cookie. IP binding fails if attacker routes through same network.', tokenforge: 'Every request requires a device-bound ECDSA signature that the proxy cannot forge.' },
  { name: 'Credential Stuffing', traditional: 'Automated login with stolen credentials. Short-lived tokens only limit the window.', tokenforge: 'Trust score drops on unknown device fingerprint, triggering step-up authentication.' },
  { name: 'Mobile IP Rotation', traditional: 'Legitimate users get locked out when carrier rotates IP. Support tickets spike.', tokenforge: 'Device binding is IP-independent. Users stay authenticated across network changes.' },
];

export default function TokenForgeVsTraditionalPage() {
  return (
    <div className="min-h-screen bg-void text-text-primary">
      <SiteHeader />
      <ComparePageViewTracker comparePage={pageMeta.href} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="mx-auto max-w-5xl px-6 pt-36 pb-20">
        {/* Hero */}
        <div className="text-center mb-20">
          <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.2em] text-signal mb-5">
            Comparison
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-4xl md:text-6xl uppercase tracking-wide mb-5">
            TokenForge vs Traditional Sessions
          </h1>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto">
            JWT + refresh tokens and IP binding were designed before AI agents and device-bound cryptography.
            See how TokenForge makes stolen sessions worthless.
          </p>
        </div>

        {/* Comparison Table */}
        <div className="mb-20 gradient-border">
          <div className="rounded-2xl bg-panel p-8 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-wider text-text-dim text-left py-3 pr-4">Feature</th>
                  <th className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-wider text-signal text-left py-3 pr-4">TokenForge</th>
                  <th className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-wider text-text-dim text-left py-3">Traditional</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.feature} className="border-b border-border/50 last:border-0">
                    <td className="py-3 pr-4 text-text-secondary font-medium">{r.feature}</td>
                    <td className="py-3 pr-4 text-white">{r.tokenforge}</td>
                    <td className="py-3 text-text-dim">{r.traditional}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Attack Scenarios */}
        <div className="mb-20">
          <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.2em] text-signal mb-5">
            Attack Scenarios
          </p>
          <h2 className="font-[family-name:var(--font-display)] text-3xl md:text-4xl uppercase tracking-wide mb-8">
            Where Traditional Sessions Fail
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {attacks.map((a) => (
              <div key={a.name} className="gradient-border card-hover">
                <div className="rounded-2xl bg-panel p-7">
                  <h3 className="font-[family-name:var(--font-mono)] text-sm uppercase tracking-wider mb-3">{a.name}</h3>
                  <p className="text-sm text-text-dim mb-2"><strong className="text-warn">Traditional:</strong> {a.traditional}</p>
                  <p className="text-sm text-text-secondary"><strong className="text-ok">TokenForge:</strong> {a.tokenforge}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* When to use sections */}
        <div className="grid md:grid-cols-2 gap-6 mb-20">
          <div className="gradient-border card-hover">
            <div className="rounded-2xl bg-panel p-8">
              <h2 className="font-[family-name:var(--font-display)] text-2xl uppercase tracking-wide mb-4">
                When to Use TokenForge
              </h2>
              <ul className="space-y-3 text-sm text-text-secondary">
                <li><strong className="text-white">Your app handles sensitive data</strong> and a stolen session token means a breach, not just an inconvenience.</li>
                <li><strong className="text-white">Your users are on VPNs or mobile</strong> and IP binding causes false lockouts and support burden.</li>
                <li><strong className="text-white">You need adaptive auth</strong> that responds to risk signals without forcing re-login on every request.</li>
                <li><strong className="text-white">You want fast integration</strong> with 5-minute setup instead of weeks of custom session hardening.</li>
              </ul>
            </div>
          </div>

          <div className="gradient-border card-hover">
            <div className="rounded-2xl bg-panel p-8">
              <h2 className="font-[family-name:var(--font-display)] text-2xl uppercase tracking-wide mb-4">
                When Traditional Works
              </h2>
              <ul className="space-y-3 text-sm text-text-secondary">
                <li><strong className="text-white">Low-risk internal tools</strong> where session theft has minimal impact and users are on stable networks.</li>
                <li><strong className="text-white">Browser support constraints</strong> where Web Crypto API is unavailable (rare as of 2026).</li>
                <li><strong className="text-white">Stateless microservices</strong> that only need JWT signature verification with no device context.</li>
              </ul>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="flex items-center justify-center gap-4">
          <TrackedCompareLink
            href="/sign-up"
            comparePage={pageMeta.href}
            ctaLabel="try-tokenforge-free"
            className="inline-flex items-center gap-2 rounded-lg bg-signal px-8 py-4 font-[family-name:var(--font-mono)] text-sm font-bold uppercase tracking-wider text-void hover:bg-signal-hover glow-signal-sm hover:glow-signal transition-all duration-300"
          >
            Try TokenForge Free <ArrowRight className="h-4 w-4" />
          </TrackedCompareLink>
          <TrackedCompareLink
            href="/docs/security"
            comparePage={pageMeta.href}
            ctaLabel="read-the-docs"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-panel/50 backdrop-blur-sm px-8 py-4 font-[family-name:var(--font-mono)] text-sm font-bold uppercase tracking-wider text-signal hover:border-signal/30 hover:bg-signal/5 transition-all duration-300"
          >
            Read the Docs
          </TrackedCompareLink>
        </div>
      </div>
    </div>
  );
}
