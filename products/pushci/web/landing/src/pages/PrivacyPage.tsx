export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-root px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold text-t1 mb-2">Privacy Policy</h1>
        <p className="text-t3 text-sm mb-10">Last updated: April 22, 2026</p>

        <div className="space-y-8 text-t2 text-sm leading-relaxed">
          <section>
            <h2 className="text-t1 font-semibold text-lg mb-3">1. Who We Are</h2>
            <p>PushCI is operated by Finsavvy AI Ltd, Israel. Contact: <a href="mailto:privacy@pushci.dev" className="text-accent hover:underline">privacy@pushci.dev</a></p>
          </section>

          <section>
            <h2 className="text-t1 font-semibold text-lg mb-3">2. Data We Collect</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-t1">Account data:</strong> Email, GitHub/GitLab username, OAuth tokens</li>
              <li><strong className="text-t1">Pipeline data:</strong> Repository names, build logs, run status, stage durations</li>
              <li><strong className="text-t1">Usage data:</strong> CLI commands invoked, AI diagnosis calls, feature usage</li>
              <li><strong className="text-t1">Billing data:</strong> Subscription plan, payment status (processed by Paddle — we never see card numbers)</li>
              <li><strong className="text-t1">Technical data:</strong> IP address, browser, operating system, crash reports</li>
            </ul>
          </section>

          <section>
            <h2 className="text-t1 font-semibold text-lg mb-3">3. How We Use Data</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Deliver and improve the Service</li>
              <li>Authenticate and authorize your account</li>
              <li>Power AI diagnosis and stack detection features</li>
              <li>Send transactional emails (plan changes, security alerts)</li>
              <li>Detect abuse and enforce rate limits</li>
            </ul>
          </section>

          <section>
            <h2 className="text-t1 font-semibold text-lg mb-3">4. Data Sharing</h2>
            <p>We do not sell your data. We share data with:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong className="text-t1">Paddle</strong> — payment processing (Merchant of Record)</li>
              <li><strong className="text-t1">Cloudflare</strong> — hosting, CDN, D1 database</li>
              <li><strong className="text-t1">Anthropic / Groq / DeepSeek</strong> — AI features (only if you invoke them; no code content sent, only error summaries)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-t1 font-semibold text-lg mb-3">5. Data Retention</h2>
            <p>Pipeline logs are retained for 90 days on Free, 1 year on Pro, and 7 years on Enterprise. Account data is retained until account deletion. You can request deletion at <a href="mailto:privacy@pushci.dev" className="text-accent hover:underline">privacy@pushci.dev</a>.</p>
          </section>

          <section>
            <h2 className="text-t1 font-semibold text-lg mb-3">6. Security</h2>
            <p>All data is encrypted in transit (TLS 1.3) and at rest (AES-256). Secrets are encrypted with machine-bound keys. We conduct regular security audits.</p>
          </section>

          <section>
            <h2 className="text-t1 font-semibold text-lg mb-3">7. Your Rights</h2>
            <p>You have the right to access, correct, export, or delete your personal data. Email <a href="mailto:privacy@pushci.dev" className="text-accent hover:underline">privacy@pushci.dev</a> and we will respond within 30 days.</p>
          </section>

          <section>
            <h2 className="text-t1 font-semibold text-lg mb-3">8. Cookies</h2>
            <p>We use session cookies for authentication only. We do not use advertising or tracking cookies.</p>
          </section>

          <section>
            <h2 className="text-t1 font-semibold text-lg mb-3">9. Changes</h2>
            <p>We will notify you of material changes via email or in-app notice 30 days before they take effect.</p>
          </section>
        </div>
      </div>
    </div>
  )
}
