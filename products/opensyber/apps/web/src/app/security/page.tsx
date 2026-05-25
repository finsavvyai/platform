import type { Metadata } from 'next';
import { SiteHeader } from '@/components/SiteHeader';
import { Footer } from '@/app/HomeFooter';

export const metadata: Metadata = {
  title: 'Security Policy | OpenSyber',
  description: 'OpenSyber security policy — how we protect your data, infrastructure, and AI agents.',
};

export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-void">
      <SiteHeader />
      <main className="text-neutral-200">
        <div className="mx-auto max-w-3xl px-6 pt-36 pb-20">
        <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.2em] text-signal mb-5">
          Security
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-4xl md:text-6xl tracking-wide text-white mb-2">Security Policy</h1>
        <p className="text-sm text-text-secondary mb-12">Last updated: March 2026</p>

        <section className="space-y-8 text-sm leading-relaxed">
          <div>
            <h2 className="text-lg font-semibold text-white mb-3">1. Overview</h2>
            <p>
              Security is foundational to OpenSyber. As a platform that secures AI agent
              infrastructure, we hold ourselves to the highest standards. This policy
              describes our security practices, vulnerability reporting process, and the
              controls we apply to protect your data and workloads.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-3">2. Vulnerability Reporting</h2>
            <p>
              If you discover a security vulnerability, please report it responsibly:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>
                Email{' '}
                <a href="mailto:security@opensyber.cloud" className="text-signal hover:text-signal-hover">
                  security@opensyber.cloud
                </a>{' '}
                with a detailed description
              </li>
              <li>Include steps to reproduce, impact assessment, and any proof-of-concept</li>
              <li>We acknowledge reports within 24 hours and aim to resolve critical issues within 72 hours</li>
              <li>We do not pursue legal action against good-faith security researchers</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-3">3. Encryption &amp; Data Protection</h2>
            <p>We apply encryption at every layer:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong>In transit</strong> — TLS 1.3 enforced on all connections; HSTS enabled</li>
              <li><strong>At rest</strong> — AES-256-GCM for credentials, secrets, and sensitive configuration</li>
              <li><strong>Session binding</strong> — TokenForge ECDSA P-256 device-bound sessions with non-extractable keys</li>
              <li><strong>API tokens</strong> — SHA-256 hashed; raw tokens never stored</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-3">4. Data Handling</h2>
            <p>
              Agent telemetry, security events, and audit logs are processed on
              Cloudflare&apos;s global network and stored in D1 (SQLite) and R2 object
              storage. We apply strict data minimization — we collect only what is
              necessary to operate the platform and deliver security insights.
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Secrets and API keys are never logged or stored in plaintext</li>
              <li>Security event logs are retained for 90 days (configurable on Enterprise)</li>
              <li>Data export and deletion available on request (GDPR Article 17)</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-3">5. Infrastructure Security</h2>
            <p>Our infrastructure is designed for defense in depth:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong>Compute isolation</strong> — agent containers run on dedicated Hetzner VMs with seccomp profiles and read-only root filesystems</li>
              <li><strong>Network segmentation</strong> — agent-to-API communication uses gateway tokens with per-instance KV validation</li>
              <li><strong>Edge security</strong> — Cloudflare WAF, DDoS protection, and rate limiting on all endpoints</li>
              <li><strong>Dependency scanning</strong> — automated SAST, SCA, and secret scanning on every commit</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-3">6. Compliance</h2>
            <p>
              OpenSyber is designed to support compliance with major security frameworks:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong>SOC 2 Type I</strong> — expected Q3 2026; automated evidence collection and continuous control monitoring in progress</li>
              <li><strong>ISO 27001</strong> — information security management alignment</li>
              <li><strong>EU AI Act</strong> — Section 6 transparency and governance reporting</li>
              <li><strong>GDPR</strong> — data minimization, right to erasure, data portability</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-3">7. Current Security Posture</h2>
            <p>Our current security posture includes:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong>TLS 1.3</strong> on all endpoints with HSTS and Cloudflare edge protection</li>
              <li><strong>AES-256-GCM</strong> encryption for all secrets and credentials at rest</li>
              <li><strong>ECDSA P-256</strong> device-bound sessions via TokenForge</li>
              <li><strong>Automated SAST, SCA, and secret scanning</strong> on every commit</li>
              <li><strong>Dependency vulnerability monitoring</strong> with same-day CVE patching</li>
              <li><strong>Seccomp-profiled containers</strong> with read-only root filesystems</li>
              <li><strong>SOC 2 Type I audit</strong> — targeted for Q3 2026, with automated evidence collection already active</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-3">8. Incident Response</h2>
            <p>
              We maintain a documented incident response plan with defined severity levels:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong>P0 (Critical)</strong> — active exploitation or data breach; response within 1 hour, customer notification within 24 hours</li>
              <li><strong>P1 (High)</strong> — exploitable vulnerability; patched within 72 hours</li>
              <li><strong>P2 (Medium)</strong> — non-exploitable risk; addressed in next release cycle</li>
              <li>Post-incident reviews are conducted for all P0/P1 events with published root cause analysis</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-3">9. Contact</h2>
            <p>
              For security-related questions or to report a vulnerability, contact us at{' '}
              <a href="mailto:security@opensyber.cloud" className="text-signal hover:text-signal-hover">
                security@opensyber.cloud
              </a>.
            </p>
          </div>
        </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
