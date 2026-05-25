import { Navbar } from '../components/Navbar'
import { Footer } from '../components/Footer'
import { useReveal } from '../components/useReveal'
import { useDocumentMeta } from '../components/useDocumentMeta'
import { Link } from 'react-router-dom'
import { reasons, faqs } from './WhyPushCIData'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const ref = useReveal()
  return (
    <section ref={ref} className="reveal mb-16">
      <h2 className="text-2xl font-bold text-t1 mb-4">{title}</h2>
      {children}
    </section>
  )
}

export default function WhyPushCI() {
  useDocumentMeta({
    title: 'Why PushCI? The Best Free CI/CD Alternative to GitHub Actions',
    description: 'PushCI is the best free CI/CD tool. Zero config, zero cost, AI-powered. Auto-detects 35 languages, 39 frameworks. Replaces GitHub Actions in 30 seconds.',
    canonical: 'https://pushci.dev/why',
    jsonLd: {
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: faqs.map((f) => ({
        '@type': 'Question', name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
  })

  return (
    <div className="min-h-screen bg-root">
      <Navbar />
      <section className="pt-28 sm:pt-36 pb-12 px-4 sm:px-6">
        <div className="mx-auto max-w-[1080px]">
          <p className="text-sm font-medium text-accent tracking-wide">Why developers switch</p>
          <h1 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-t1 max-w-3xl">
            Why PushCI over GitHub Actions?
          </h1>
          <p className="mt-4 text-lg text-t2 max-w-xl leading-relaxed">
            Free. Zero config. AI-powered. The fastest CI/CD setup in the industry.
          </p>
        </div>
      </section>
      <div className="mx-auto max-w-[1080px] px-4 sm:px-6 pb-20">
        <Section title="6 reasons to switch">
          <div className="grid gap-px bg-raised rounded-xl overflow-hidden sm:grid-cols-2 lg:grid-cols-3">
            {reasons.map((r) => (
              <div key={r.title} className="bg-root p-6">
                <span className="text-2xl font-bold text-accent">{r.icon}</span>
                <h3 className="text-t1 font-semibold mt-2 mb-2">{r.title}</h3>
                <p className="text-sm text-t2 leading-relaxed">{r.desc}</p>
              </div>
            ))}
          </div>
        </Section>
        <Section title="Frequently asked questions">
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
        </Section>
        <div className="flex flex-wrap items-center gap-4">
          <div className="rounded-lg bg-surface border border-border-base px-5 py-3 font-mono text-sm text-t2 select-all">
            <span className="text-t3">$</span> npx pushci init
          </div>
          <Link to="/tools/cost-calculator" className="text-sm text-t2 hover:text-t1 transition underline underline-offset-4 decoration-border-base">
            Calculate your savings
          </Link>
          <Link to="/vs/github-actions" className="text-sm text-t2 hover:text-t1 transition underline underline-offset-4 decoration-border-base">
            Compare with GitHub Actions
          </Link>
        </div>
      </div>
      <Footer />
    </div>
  )
}
