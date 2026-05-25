import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function TermsPage() {
  const navigate = useNavigate();

  return (
    <div
      className="min-h-screen transition-colors duration-300"
      style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
    >
      <div className="max-w-3xl mx-auto px-6 py-16">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 mb-8 transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <h1 className="text-4xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
          Terms of Service
        </h1>
        <p className="mb-10" style={{ color: 'var(--text-muted)' }}>
          Last updated: April 2026
        </p>

        <div className="space-y-8 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          <section>
            <h2 className="text-xl font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
              1. Acceptance of Terms
            </h2>
            <p>
              By creating an account or using the Qestro platform, you agree to these Terms of
              Service. If you do not agree, please do not use the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
              2. Service Description
            </h2>
            <p>
              Qestro provides an AI-powered testing automation platform for browser, mobile, and API
              testing. Features include test generation, self-healing assertions, execution
              scheduling, and analytics.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
              3. Account Responsibilities
            </h2>
            <p>
              You are responsible for maintaining the security of your account credentials and for
              all activity under your account. Notify us immediately at support@qestro.io if you
              suspect unauthorized access.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
              4. Acceptable Use
            </h2>
            <p>
              You agree to use Qestro only for lawful testing of applications you own or have
              authorization to test. You must not use the platform to attack, scrape, or disrupt
              systems you do not control.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
              5. Subscription &amp; Billing
            </h2>
            <p>
              Free tier usage is available without a credit card. Paid plans are billed monthly.
              You may cancel at any time; access continues until the end of your billing period.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
              6. Limitation of Liability
            </h2>
            <p>
              Qestro is provided &ldquo;as is.&rdquo; We are not liable for damages arising from
              test failures, service interruptions, or third-party integrations. Our total liability
              is limited to the amount you paid in the preceding 12 months.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
              7. Changes to Terms
            </h2>
            <p>
              We may update these terms with 30 days notice via email. Continued use after changes
              take effect constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
              8. Contact
            </h2>
            <p>Questions about these terms? Reach us at legal@qestro.io.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
