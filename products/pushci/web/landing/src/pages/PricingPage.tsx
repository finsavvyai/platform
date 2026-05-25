import { Link } from 'react-router-dom'
import { Navbar } from '../components/Navbar'
import { Footer } from '../components/Footer'
import { PricingCard } from '../components/PricingCard'
import { plans } from '../components/pricingData'
import { useDocumentMeta } from '../components/useDocumentMeta'

const faqs = [
  {
    q: 'Why is the free tier actually free?',
    a: 'You run PushCI on your own machine. We don\'t pay for your compute, so you don\'t pay us for compute.',
  },
  {
    q: 'What counts as a cloud minute?',
    a: 'Cloud minutes are used when you dispatch jobs to PushCI-managed runners. Local runs (your machine) are always free and unlimited.',
  },
  {
    q: 'Can I self-host everything?',
    a: 'Yes. The CLI is free forever. Cloud dashboard and managed runners are the paid layer.',
  },
  {
    q: 'What happens when I hit the AI diagnosis limit?',
    a: 'Diagnose falls back to pattern-based analysis — still useful, just not AI-powered. Upgrade to Pro for 100 AI diagnoses/month.',
  },
  {
    q: 'How does the Team plan billing work?',
    a: 'Per seat, billed monthly or annually (annual saves 20%). Add/remove seats anytime.',
  },
]

export default function PricingPage() {
  useDocumentMeta({
    title: 'PushCI Pricing — Simple, honest pricing',
    description: 'Start free. No credit card. No YAML. No compute charges. Upgrade when you need cloud runners, AI diagnosis, or team features.',
    canonical: 'https://pushci.dev/pricing',
  })

  return (
    <div className="min-h-screen bg-root">
      <Navbar />

      {/* Hero */}
      <section className="pt-28 sm:pt-36 pb-16 px-4 sm:px-6">
        <div className="mx-auto max-w-[1080px]">
          <p className="text-caption font-medium text-accent uppercase tracking-wider">Pricing</p>
          <h1 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-t1 max-w-2xl leading-tight">
            Simple, honest pricing
          </h1>
          <p className="mt-5 text-lg text-t2 max-w-xl leading-relaxed">
            Start free. No credit card. No YAML. No compute charges.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-[1080px] px-4 sm:px-6 pb-20">
        {/* Promo */}
        <div className="mb-8 rounded-lg border border-accent/20 bg-accent/[0.04] px-4 py-3 text-sm text-t2">
          Use code <span className="font-semibold text-accent">AMISRAEL2026</span> at checkout for 5% off Pro and Team plans
        </div>

        {/* Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {plans.map((p) => (
            <PricingCard key={p.name} {...p} />
          ))}
        </div>

        <p className="mt-6 text-sm text-t3">
          Not sure how much you're spending?{' '}
          <Link to="/tools/cost-calculator" className="text-t1 hover:text-accent transition-colors duration-200 underline underline-offset-4 decoration-border-base">
            Calculate your CI costs
          </Link>
        </p>

        {/* FAQ */}
        <section className="mt-20">
          <p className="text-caption font-medium text-accent uppercase tracking-wider mb-2">FAQ</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-t1 mb-6">Frequently asked</h2>
          <div className="divide-y divide-border-base rounded-xl border border-border-base overflow-hidden">
            {faqs.map((f) => (
              <details key={f.q} className="group bg-surface">
                <summary className="flex cursor-pointer items-center justify-between p-5 text-t1 font-medium text-sm">
                  {f.q}
                  <span className="text-t3 group-open:rotate-45 transition-transform text-lg">+</span>
                </summary>
                <div className="px-5 pb-5 text-sm text-t2 leading-relaxed">{f.a}</div>
              </details>
            ))}
          </div>
        </section>
      </div>

      <Footer />
    </div>
  )
}
