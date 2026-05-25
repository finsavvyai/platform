import { Link } from 'react-router-dom'

export default function ProductCTA() {
  return (
    <section className="py-16 sm:py-24 px-4 bg-token-bg">
      <div className="max-w-2xl mx-auto text-center">
        <div className="bg-token-bg-2 border border-token-line rounded-xl p-10 sm:p-16">
          <h2 className="text-2xl sm:text-3xl font-semibold text-token-fg mb-4">
            See it in action
          </h2>
          <p className="text-base text-token-fg-muted mb-8 max-w-md mx-auto">
            Schedule a walkthrough with our team or explore the API documentation.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/contact"
              className="px-6 py-3 text-base font-semibold rounded-lg transition-all duration-200 hover:-translate-y-px min-h-[44px] flex items-center justify-center"
              style={{ background: 'var(--accent-gold)', color: '#0A0908' }}
            >
              Book a Demo
            </Link>
            <a
              href="/docs"
              className="px-6 py-3 text-base font-semibold rounded-lg border border-token-line text-token-fg-muted hover:bg-token-bg-2 transition-colors min-h-[44px] flex items-center justify-center"
            >
              View API Docs
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
