export default function RefundPage() {
  return (
    <div className="min-h-screen bg-root px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold text-t1 mb-2">Refund Policy</h1>
        <p className="text-t3 text-sm mb-10">Last updated: April 22, 2026</p>

        <div className="space-y-8 text-t2 text-sm leading-relaxed">
          <section>
            <h2 className="text-t1 font-semibold text-lg mb-3">14-Day Money-Back Guarantee</h2>
            <p>If you are not satisfied with PushCI Pro or Team within <strong className="text-t1">14 days of your first payment</strong>, contact us at <a href="mailto:billing@pushci.dev" className="text-accent hover:underline">billing@pushci.dev</a> and we will issue a full refund — no questions asked.</p>
          </section>

          <section>
            <h2 className="text-t1 font-semibold text-lg mb-3">Renewals</h2>
            <p>Subscription renewals are <strong className="text-t1">non-refundable</strong> once processed. To avoid a renewal charge, cancel at least 24 hours before your next billing date via the billing portal in the dashboard.</p>
          </section>

          <section>
            <h2 className="text-t1 font-semibold text-lg mb-3">Annual Plans</h2>
            <p>Annual subscriptions are eligible for a prorated refund within the first 30 days. After 30 days, annual fees are non-refundable but your access continues until the end of the paid period.</p>
          </section>

          <section>
            <h2 className="text-t1 font-semibold text-lg mb-3">Enterprise</h2>
            <p>Enterprise contracts follow the refund terms negotiated in your service agreement.</p>
          </section>

          <section>
            <h2 className="text-t1 font-semibold text-lg mb-3">How to Request a Refund</h2>
            <ol className="list-decimal pl-5 space-y-2">
              <li>Email <a href="mailto:billing@pushci.dev" className="text-accent hover:underline">billing@pushci.dev</a> with subject "Refund Request"</li>
              <li>Include your account email and the reason (optional)</li>
              <li>We will process the refund within 5 business days</li>
              <li>Funds appear in your account within 5–10 business days depending on your bank</li>
            </ol>
          </section>

          <section>
            <h2 className="text-t1 font-semibold text-lg mb-3">Exceptions</h2>
            <p>Refunds will not be issued for accounts terminated due to violations of our Terms of Service.</p>
          </section>

          <section>
            <h2 className="text-t1 font-semibold text-lg mb-3">Payment Processor</h2>
            <p>All payments are processed by <strong className="text-t1">Paddle.com</strong> as Merchant of Record. If you have a dispute, you may also contact Paddle directly at <a href="https://paddle.com/legal/buyer-terms" className="text-accent hover:underline" target="_blank" rel="noopener noreferrer">paddle.com</a>.</p>
          </section>
        </div>
      </div>
    </div>
  )
}
