import type { Metadata } from 'next';
import { SiteHeader } from '@/components/SiteHeader';
import { Footer } from '@/app/HomeFooter';

export const metadata: Metadata = {
  title: 'Privacy Policy | OpenSyber',
  description: 'OpenSyber privacy policy — how we collect, use, and protect your data.',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-void">
      <SiteHeader />
      <main className="text-neutral-200">
        <div className="mx-auto max-w-3xl px-6 pt-36 pb-20">
        <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.2em] text-signal mb-5">
          Legal
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-4xl md:text-6xl tracking-wide text-white mb-2">Privacy Policy</h1>
        <p className="text-sm text-text-secondary mb-12">Last updated: March 2026</p>

        <section className="space-y-8 text-sm leading-relaxed">
          <div>
            <h2 className="text-lg font-semibold text-white mb-3">1. Information We Collect</h2>
            <p>
              When you create an account, we collect your name, email address, and
              authentication credentials via Better Auth. When you deploy agents, we collect
              instance configuration, region preferences, and usage metrics necessary
              to operate the service.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-3">2. Lawful Basis for Processing</h2>
            <p>We process your personal data under the following legal bases:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong>Contract performance</strong> — to provide and operate the OpenSyber platform as described in our Terms of Service</li>
              <li><strong>Legitimate interest</strong> — to monitor platform security, prevent abuse, and improve our services</li>
              <li><strong>Legal obligation</strong> — to comply with applicable laws and respond to lawful requests</li>
              <li><strong>Consent</strong> — for optional communications such as product updates and marketing emails, which you can withdraw at any time</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-3">3. How We Use Your Information</h2>
            <p>We use your information to:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Provide, maintain, and improve the OpenSyber platform</li>
              <li>Process payments and manage subscriptions via LemonSqueezy</li>
              <li>Send security alerts and service notifications</li>
              <li>Monitor platform health and prevent abuse</li>
              <li>Respond to support requests</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-3">4. Data Storage & Security</h2>
            <p>
              Your data is stored on Cloudflare&apos;s global network (D1, KV, R2).
              Credentials and secrets are encrypted at rest using AES-GCM.
              Agent containers run in isolated environments on Hetzner Cloud.
              We never log secrets, tokens, or API keys.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-3">5. Third-Party Services</h2>
            <p>We integrate with the following third-party services:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong>Better Auth</strong> — authentication and session management</li>
              <li><strong>LemonSqueezy</strong> — payment processing</li>
              <li><strong>Resend</strong> — transactional email delivery</li>
              <li><strong>Hetzner Cloud</strong> — agent compute infrastructure</li>
              <li><strong>Cloudflare</strong> — hosting, CDN, and data storage</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-3">6. Data Retention</h2>
            <p>
              We retain your account data for as long as your account is active.
              Security event logs are retained for 90 days. When you delete your
              account, we remove your personal data within 30 days. Anonymized
              aggregate metrics may be retained indefinitely.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-3">7. Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Access your personal data</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your account and data</li>
              <li>Export your data in a portable format</li>
              <li>Withdraw consent for optional data processing</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-3">8. Cookies</h2>
            <p>
              We use essential cookies for authentication and session management.
              We do not use tracking cookies or third-party advertising cookies.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-3">9. Contact</h2>
            <p>
              For privacy-related questions, contact us at{' '}
              <a href="mailto:privacy@opensyber.cloud" className="text-signal hover:text-signal-hover">
                privacy@opensyber.cloud
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
