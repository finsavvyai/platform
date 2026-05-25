import type { Metadata } from 'next';
import { SiteHeader } from '@/components/SiteHeader';
import { Footer } from '@/app/HomeFooter';

export const metadata: Metadata = {
  title: 'Terms of Service | OpenSyber',
  description: 'OpenSyber terms of service — rules and conditions for using our platform.',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-void">
      <SiteHeader />
      <main className="text-neutral-200">
        <div className="mx-auto max-w-3xl px-6 pt-36 pb-20">
        <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.2em] text-signal mb-5">
          Legal
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-4xl md:text-6xl tracking-wide text-white mb-2">Terms of Service</h1>
        <p className="text-sm text-text-secondary mb-12">Last updated: February 2026</p>

        <section className="space-y-8 text-sm leading-relaxed">
          <div>
            <h2 className="text-lg font-semibold text-white mb-3">1. Acceptance of Terms</h2>
            <p>
              By accessing or using OpenSyber (&quot;the Service&quot;), you agree to be
              bound by these Terms of Service. If you do not agree to these terms,
              do not use the Service.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-3">2. Description of Service</h2>
            <p>
              OpenSyber provides a managed platform for deploying, monitoring, and
              securing AI agents. The Service includes agent hosting, a skill
              marketplace, security monitoring, credential vault, and compliance
              reporting features.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-3">3. Account Responsibilities</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>You must provide accurate account information</li>
              <li>You are responsible for maintaining the security of your account</li>
              <li>You must not share your account credentials</li>
              <li>You must notify us immediately of any unauthorized access</li>
              <li>You are responsible for all activity under your account</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-3">4. Acceptable Use</h2>
            <p>You agree not to use the Service to:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Violate any applicable laws or regulations</li>
              <li>Deploy agents that perform malicious activities</li>
              <li>Attempt to gain unauthorized access to other users&apos; resources</li>
              <li>Interfere with the operation of the Service</li>
              <li>Circumvent security controls or rate limits</li>
              <li>Store or transmit illegal content</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-3">5. Subscription & Billing</h2>
            <p>
              Paid plans are billed monthly via LemonSqueezy. You may cancel at any
              time. Upon cancellation, your subscription remains active until the end
              of the current billing period. After expiry, excess resources are
              suspended (not deleted) and can be restored by re-subscribing.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-3">6. Plan Limits</h2>
            <p>Each plan has resource limits (instances, skills). Exceeding plan
              limits is not permitted. If you downgrade, excess resources will be
              suspended. Upgrading restores access to suspended resources.</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-3">7. Service Availability</h2>
            <p>
              We strive to maintain high availability but do not guarantee
              uninterrupted service. We may perform maintenance with reasonable
              notice. We are not liable for downtime caused by factors outside our
              control.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-3">8. Intellectual Property</h2>
            <p>
              You retain ownership of your data and agent configurations. OpenSyber
              retains ownership of the platform, documentation, and proprietary
              features. The open-source core is licensed under its respective license.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-3">9. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, OpenSyber shall not be liable
              for indirect, incidental, or consequential damages arising from your
              use of the Service. Our total liability shall not exceed the amount
              you paid in the 12 months preceding the claim.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-3">10. Termination</h2>
            <p>
              We may suspend or terminate your account for violation of these terms.
              You may delete your account at any time. Upon termination, your data
              will be handled according to our Privacy Policy.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-3">11. Changes to Terms</h2>
            <p>
              We may update these terms from time to time. Significant changes will
              be communicated via email. Continued use of the Service after changes
              constitutes acceptance of the updated terms.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-3">12. Contact</h2>
            <p>
              For questions about these terms, contact us at{' '}
              <a href="mailto:legal@opensyber.cloud" className="text-signal hover:text-signal-hover">
                legal@opensyber.cloud
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
