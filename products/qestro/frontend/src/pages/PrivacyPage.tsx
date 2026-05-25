import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPage() {
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
          Privacy Policy
        </h1>
        <p className="mb-10" style={{ color: 'var(--text-muted)' }}>
          Last updated: April 2026
        </p>

        <div className="space-y-8 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          <section>
            <h2 className="text-xl font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
              1. Information We Collect
            </h2>
            <p>
              When you create an account, we collect your name, email address, and authentication
              credentials. During use of the platform, we collect test configurations, execution
              logs, and usage analytics to improve our service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
              2. How We Use Your Data
            </h2>
            <p>
              We use your data to provide and improve the Qestro testing platform, including AI-powered
              test generation, self-healing assertions, and analytics. We do not sell your data to
              third parties.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
              3. Data Storage &amp; Security
            </h2>
            <p>
              Your data is encrypted at rest and in transit. Test artifacts and execution results are
              stored securely in cloud infrastructure. You can request data deletion at any time by
              contacting support.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
              4. Third-Party Services
            </h2>
            <p>
              Qestro integrates with third-party services (GitHub, GitLab, CI/CD providers) only when
              you explicitly authorize those connections. We share only the minimum data required for
              each integration to function.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
              5. Your Rights
            </h2>
            <p>
              You may access, update, or delete your personal data at any time through Settings.
              For data export or account deletion requests, contact privacy@qestro.io.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
              6. Contact
            </h2>
            <p>Questions about this policy? Reach us at privacy@qestro.io.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
