import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Navbar } from '../components/Navbar'
import { Footer } from '../components/Footer'
import { useDocumentMeta } from '../components/useDocumentMeta'
import { ContactForm } from '../components/ContactForm'

type Topic = 'sales' | 'enterprise' | 'support' | 'security' | 'press' | 'other'

const topics: { id: Topic; label: string; email: string; blurb: string; icon: string }[] = [
  { id: 'sales', label: 'Sales', email: 'sales@pushci.dev', blurb: 'Pricing, demos, procurement.', icon: '◈' },
  { id: 'enterprise', label: 'Enterprise', email: 'sales@pushci.dev', blurb: 'SSO, audit, dedicated tenant, SLAs.', icon: '◉' },
  { id: 'support', label: 'Support', email: 'support@pushci.dev', blurb: 'CLI bugs, onboarding, integrations.', icon: '◎' },
  { id: 'security', label: 'Security', email: 'security@pushci.dev', blurb: 'Private vulnerability reports.', icon: '◇' },
  { id: 'press', label: 'Press', email: 'hello@pushci.dev', blurb: 'Media, co-marketing, partners.', icon: '◊' },
  { id: 'other', label: 'Other', email: 'hello@pushci.dev', blurb: 'We read every message.', icon: '◐' },
]

export default function ContactPage() {
  useDocumentMeta({
    title: 'Contact Sales — PushCI',
    description: 'Talk to sales, enterprise, support, or security. One business day response.',
    canonical: 'https://pushci.dev/contact',
  })

  const [params] = useSearchParams()
  const initial = (params.get('topic') || 'sales') as Topic
  const [topic, setTopic] = useState<Topic>(
    topics.some(t => t.id === initial) ? initial : 'sales',
  )
  useEffect(() => {
    const q = params.get('topic') as Topic | null
    if (q && topics.some(t => t.id === q)) setTopic(q)
  }, [params])

  return (
    <div className="min-h-screen bg-root relative overflow-hidden">
      {/* Ambient background */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[900px] h-[900px] rounded-full bg-[radial-gradient(circle,rgba(16,185,129,0.10),transparent_60%)]" />
        <div className="absolute top-[30%] left-[-10%] w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.08),transparent_60%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
      </div>

      <Navbar />
      <section className="relative pt-28 sm:pt-36 pb-24 px-6">
        <div className="mx-auto max-w-[1180px]">
          <div className="text-center max-w-2xl mx-auto">
            <p className="inline-flex items-center gap-2 rounded-full border border-border-base bg-surface/50 backdrop-blur px-3 py-1 text-xs font-medium text-accent tracking-wide">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" /> Live · replies within 1 business day
            </p>
            <h1 className="mt-6 text-4xl sm:text-6xl font-extrabold tracking-tight text-t1">
              Talk to <span className="gradient-text">PushCI</span>
            </h1>
            <p className="mt-5 text-lg text-t2 leading-relaxed">
              Tell us about your team, stack, and what you&rsquo;re trying to solve.
              We&rsquo;ll reply with a tailored answer — not a generic sales deck.
            </p>
          </div>

          <div className="mt-16 grid gap-8 lg:grid-cols-[320px_1fr] items-start">
            {/* Topic picker */}
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-wider text-t3 px-1 mb-3">I want to talk about</div>
              {topics.map(t => {
                const active = topic === t.id
                return (
                  <button
                    key={t.id}
                    onClick={() => setTopic(t.id)}
                    className={`group relative w-full text-left rounded-xl border p-4 transition-all overflow-hidden ${
                      active
                        ? 'border-accent/60 bg-accent/5 shadow-[0_0_0_1px_rgba(16,185,129,0.25),0_12px_30px_-10px_rgba(16,185,129,0.35)]'
                        : 'border-border-base bg-surface/30 hover:border-border-em hover:bg-surface/50'
                    }`}
                  >
                    {active && (
                      <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-gradient-to-b from-accent via-emerald-400 to-accent" />
                    )}
                    <div className="flex items-center gap-3">
                      <span className={`text-lg ${active ? 'text-accent' : 'text-t3 group-hover:text-t2'}`}>{t.icon}</span>
                      <span className="font-semibold text-t1">{t.label}</span>
                    </div>
                    <div className="text-xs text-t3 mt-1 ml-8">{t.blurb}</div>
                    <div className="text-[11px] text-accent font-mono mt-1.5 ml-8 opacity-70">{t.email}</div>
                  </button>
                )
              })}
              <div className="mt-6 pt-5 border-t border-border-base/50 text-xs text-t3 space-y-1.5 px-1">
                <div>Response: <span className="text-t2">&lt; 1 business day</span></div>
                <div>Demos: <span className="text-t2">30-min slot, async options</span></div>
                <div>EU data residency: <span className="text-t2">available</span></div>
              </div>
            </div>

            {/* Form */}
            <ContactForm topic={topic} />
          </div>
        </div>
      </section>
      <Footer />
    </div>
  )
}
