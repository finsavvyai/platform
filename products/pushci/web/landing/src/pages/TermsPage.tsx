export default function TermsPage() {
  return (
    <div className="min-h-screen bg-root px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold text-t1 mb-2">Terms of Service</h1>
        <p className="text-t3 text-sm mb-10">Last updated: April 22, 2026</p>

        <div className="prose prose-invert max-w-none space-y-8 text-t2 text-sm leading-relaxed">
          <section>
            <h2 className="text-t1 font-semibold text-lg mb-3">1. Acceptance of Terms</h2>
            <p>By accessing or using PushCI ("Service"), operated by Finsavvy AI Ltd ("Company", "we", "us"), you agree to be bound by these Terms of Service. If you disagree with any part, you may not use the Service.</p>
          </section>

          <section>
            <h2 className="text-t1 font-semibold text-lg mb-3">2. Service Description</h2>
            <p>PushCI is a CI/CD platform that enables developers to run, manage, and automate software pipelines locally and in the cloud. We provide a CLI, API, dashboard, and AI-powered diagnostics.</p>
          </section>

          <section>
            <h2 className="text-t1 font-semibold text-lg mb-3">3. Account Registration</h2>
            <p>You must provide accurate information when creating an account. You are responsible for maintaining the confidentiality of your credentials and for all activity under your account.</p>
          </section>

          <section>
            <h2 className="text-t1 font-semibold text-lg mb-3">4. Subscriptions and Billing</h2>
            <p>Paid plans are billed in advance on a monthly or annual basis. All fees are non-refundable except as set out in our Refund Policy. We reserve the right to change pricing with 30 days' notice. Payments are processed by Paddle.com as Merchant of Record.</p>
          </section>

          <section>
            <h2 className="text-t1 font-semibold text-lg mb-3">5. Free Tier</h2>
            <p>The Free tier is provided as-is with no SLA. We may change or discontinue free features at any time with reasonable notice.</p>
          </section>

          <section>
            <h2 className="text-t1 font-semibold text-lg mb-3">6. Acceptable Use</h2>
            <p>You agree not to use the Service to: (a) violate any laws; (b) infringe intellectual property rights; (c) distribute malware or harmful code; (d) attempt to gain unauthorized access to our systems; (e) abuse API rate limits or scrape data at scale.</p>
          </section>

          <section>
            <h2 className="text-t1 font-semibold text-lg mb-3">7. Data and Privacy</h2>
            <p>Your use of the Service is governed by our Privacy Policy. We process pipeline metadata, logs, and usage data to deliver the Service. We do not sell your data.</p>
          </section>

          <section>
            <h2 className="text-t1 font-semibold text-lg mb-3">8. Intellectual Property</h2>
            <p>PushCI and its original content remain the exclusive property of Finsavvy AI Ltd. Your code and pipelines remain yours. You grant us a limited license to process your data to deliver the Service.</p>
          </section>

          <section>
            <h2 className="text-t1 font-semibold text-lg mb-3">9. Limitation of Liability</h2>
            <p>To the maximum extent permitted by law, we shall not be liable for indirect, incidental, special, or consequential damages. Our total liability shall not exceed the fees you paid in the 12 months preceding the claim.</p>
          </section>

          <section>
            <h2 className="text-t1 font-semibold text-lg mb-3">10. Termination</h2>
            <p>We may terminate or suspend your account immediately for violations of these Terms. You may cancel your subscription at any time via the billing portal; access continues until the end of the paid period.</p>
          </section>

          <section>
            <h2 className="text-t1 font-semibold text-lg mb-3">11. Governing Law</h2>
            <p>These Terms shall be governed by the laws of Israel. Disputes shall be resolved in the courts of Tel Aviv.</p>
          </section>

          <section>
            <h2 className="text-t1 font-semibold text-lg mb-3">12. Contact</h2>
            <p>Questions? Email <a href="mailto:legal@pushci.dev" className="text-accent hover:underline">legal@pushci.dev</a></p>
          </section>
        </div>
      </div>
    </div>
  )
}
