import { useState } from 'react'
import { useReveal } from './useReveal'

const faqs = [
  {
    q: 'Is PushCI production-ready?',
    a: '465+ tests, security audited, used by teams shipping to production daily. The CLI is Go-compiled, the API runs on Cloudflare Workers with 99.9% uptime. We dog-food it on every push to this repo.',
  },
  {
    q: 'How does it handle secrets?',
    a: 'AES-256-GCM encryption with machine-bound keys. Secrets never leave your machine. For team plans, secrets are encrypted at rest in Cloudflare KV with per-project isolation.',
  },
  {
    q: 'Can I migrate from GitHub Actions?',
    a: 'Yes. Run pushci migrate and it converts your .github/workflows/ into pushci.yml automatically. Most repos migrate in under 60 seconds.',
  },
  {
    q: 'What if I need cloud runners?',
    a: 'PushCI supports both local and cloud runners. Use pushci agent to register a self-hosted runner on any machine. For teams, connect via Tailscale for encrypted mesh networking.',
  },
  {
    q: 'Is it really free?',
    a: 'Free forever for local runs. The Pro plan ($9/mo) adds cloud API, AI features, and unlimited repos. Team plan ($29/mo) adds SSO, organizations, and SLA guarantees.',
  },
  {
    q: 'How does the AI work?',
    a: 'PushCI uses Claude Haiku for diagnostics, auto-fix, code review, and pipeline generation. You can also use --local flag with llamafile for completely offline AI at zero cost.',
  },
]

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-border-base/50">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-5 text-left group">
        <span className="text-sm font-medium text-t1 group-hover:text-accent transition-colors">{q}</span>
        <span className={`text-t3 text-lg transition-transform duration-200 ${open ? 'rotate-45' : ''}`}>+</span>
      </button>
      {open && (
        <div className="pb-5 -mt-1">
          <p className="text-sm text-t2 leading-relaxed max-w-2xl">{a}</p>
        </div>
      )}
    </div>
  )
}

export function HomeFAQ() {
  const ref = useReveal()
  return (
    <section ref={ref} className="reveal py-20 sm:py-28 px-4 sm:px-6 section-border" id="faq">
      <div className="mx-auto max-w-[1080px]">
        <div className="grid lg:grid-cols-[1fr_2fr] gap-12">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-t1">
              Frequently asked
            </h2>
            <p className="mt-3 text-sm text-t3 leading-relaxed">
              Questions we get before people realize they've been overpaying for CI for years.
            </p>
          </div>
          <div>
            {faqs.map(f => <FAQItem key={f.q} q={f.q} a={f.a} />)}
          </div>
        </div>
      </div>

      {/* Schema.org FAQ markup */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqs.map(f => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      })}} />
    </section>
  )
}
