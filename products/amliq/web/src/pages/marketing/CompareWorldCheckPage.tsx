import { motion } from 'framer-motion'
import { Check, X, ArrowRight, Zap, DollarSign, Code, Shield, Globe } from 'lucide-react'
import { HeroBg } from '../../components/marketing/HeroBg'
import MarketingNav from './MarketingNav'
import FooterSection from './FooterSection'

const matrix = [
  { capability: 'Pricing transparency', wc: 'Contact sales (~$30k–$100k/yr)', us: 'Public — Free / $99 / $499 / $2k tiers' },
  { capability: 'Time to first screen', wc: '4–6 week procurement', us: '5 minutes (sign up → key → screen)' },
  { capability: 'Data delivery', wc: 'CSV/XML over SFTP, twice daily', us: 'REST + WebSocket, sub-50 ms decisions' },
  { capability: 'False-positive rate', wc: 'Industry-noisy, manual triage', us: 'Multi-layer matching — reproducible head-to-head benchmark at /benchmarks' },
  { capability: 'Free tier', wc: 'No', us: 'Yes — 100 screens / month' },
  { capability: 'Country specialization', wc: 'Generic global', us: 'IL deep coverage (NBCTF, MoF, Knesset, judiciary, mayors)' },
  { capability: 'Self-serve API keys', wc: 'No — sales-led', us: 'Yes — dashboard issues + revokes' },
  { capability: 'SDKs', wc: 'None first-party', us: 'TypeScript, Python, Go (open source)' },
  { capability: 'Sandbox before contract', wc: 'No', us: 'Yes — full API on free tier' },
  { capability: 'Migration tooling', wc: '—', us: 'WC CSV importer ships your existing data in 1 hour' },
  { capability: 'Update cadence', wc: 'Twice daily file drops', us: 'Hourly per-list, near-real-time for OFAC/UN/EU' },
  { capability: 'Source-available matching engine', wc: 'No', us: 'On the roadmap for design-partner customers under a source-available license' },
]

const tiers = [
  { name: 'Free', price: '$0/mo', screens: '100/mo', for: 'evaluators, devs' },
  { name: 'Starter', price: '$99/mo', screens: '5 k/mo', for: 'fintech MVPs' },
  { name: 'Pro', price: '$499/mo', screens: '50 k/mo', for: 'growing PSPs' },
  { name: 'Enterprise', price: '$2 k/mo+', screens: '1 M+/mo, dedicated DB', for: 'banks, EMIs' },
]

const reasons = [
  { icon: DollarSign, title: 'Engineer-friendly pricing', body: 'Transparent self-serve plans. Money you keep buys engineering hours, not procurement cycles.' },
  { icon: Zap, title: 'Real-time API', body: 'In-memory engine on the request path instead of batch data files. Screen at transaction time, not overnight.' },
  { icon: Code, title: 'Built for engineers', body: 'REST + WebSocket + SDKs. Your team integrates in an afternoon, not a quarter.' },
  { icon: Shield, title: '26+ official sources + BYO data', body: 'OFAC, UN, EU, UK OFSI, FATF and more, plus PEPs and adverse media - and import your licensed World-Check feed to keep its coverage.' },
  { icon: Globe, title: 'Specialized country depth', body: 'Israel coverage (NBCTF, MoF, Knesset, judiciary, mayors) that World-Check generally generic-passes through OpenSanctions.' },
]

export default function CompareWorldCheckPage() {
  return (
    <div style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <MarketingNav />

      <section className="relative pt-28 pb-16 px-4 overflow-hidden">
        <HeroBg />
        <div className="relative max-w-5xl mx-auto">
          <motion.div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold mb-7"
            style={{ background: 'var(--accent-gold-light)', borderColor: 'color-mix(in srgb, var(--accent-gold) 22%, transparent)', color: 'var(--accent-gold)' }}
            initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}
          >
            World-Check alternative
          </motion.div>
          <h1 className="text-[2.6rem] sm:text-5xl lg:text-[3.4rem] font-bold leading-[1.06] mb-6"
            style={{ color: 'var(--text)', letterSpacing: '-0.03em' }}>
            The copilot layer above{' '}
            <span style={{
              background: 'linear-gradient(135deg, #C9A96E 0%, #E8D5A3 50%, #B8945A 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>your screening lists</span>
          </h1>
          <p className="text-lg leading-relaxed mb-8 max-w-[640px]" style={{ color: 'color-mix(in srgb, var(--text) 62%, transparent)' }}>
            Keep World-Check or bring our 26+ official sources. Real-time API instead of nightly file drops, an AI copilot for triage and investigations, and self-serve pricing
            instead of a six-week sales cycle. Migrate your existing World-Check data in under an hour.
          </p>
          <div className="flex flex-wrap gap-3">
            <a href="/signup" className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold rounded-[10px]"
              style={{ background: 'var(--accent-gold)', color: '#0A0908' }}>
              Start free <ArrowRight className="w-4 h-4" />
            </a>
            <a href="#migrate" className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold rounded-[10px]"
              style={{ background: 'color-mix(in srgb, var(--text) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--text) 10%, transparent)', color: 'color-mix(in srgb, var(--text) 85%, transparent)' }}>
              Migrate from World-Check
            </a>
          </div>
        </div>
      </section>

      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-semibold mb-8" style={{ letterSpacing: '-0.02em' }}>
            Side-by-side
          </h2>
          <div className="overflow-x-auto rounded-[14px]" style={{ border: '1px solid color-mix(in srgb, var(--text) 10%, transparent)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'color-mix(in srgb, var(--text) 3%, transparent)' }}>
                  <th className="text-left p-4 font-medium" style={{ color: 'color-mix(in srgb, var(--text) 60%, transparent)' }}>Capability</th>
                  <th className="text-left p-4 font-medium" style={{ color: 'color-mix(in srgb, var(--text) 60%, transparent)' }}>World-Check</th>
                  <th className="text-left p-4 font-medium" style={{ color: 'var(--accent-gold)' }}>AMLIQ</th>
                </tr>
              </thead>
              <tbody>
                {matrix.map((row) => (
                  <tr key={row.capability} style={{ borderTop: '1px solid color-mix(in srgb, var(--text) 6%, transparent)' }}>
                    <td className="p-4 font-medium" style={{ color: 'var(--text)' }}>{row.capability}</td>
                    <td className="p-4" style={{ color: 'color-mix(in srgb, var(--text) 62%, transparent)' }}>
                      <span className="inline-flex items-start gap-2">
                        <X className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'color-mix(in srgb, var(--text) 30%, transparent)' }} />
                        {row.wc}
                      </span>
                    </td>
                    <td className="p-4" style={{ color: 'var(--text)' }}>
                      <span className="inline-flex items-start gap-2">
                        <Check className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--accent-gold)' }} />
                        {row.us}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-semibold mb-8" style={{ letterSpacing: '-0.02em' }}>
            Why teams switch
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {reasons.map(({ icon: Icon, title, body }) => (
              <div key={title} className="p-6 rounded-[14px]"
                style={{ background: 'color-mix(in srgb, var(--text) 3%, transparent)', border: '1px solid color-mix(in srgb, var(--text) 8%, transparent)' }}>
                <div className="w-10 h-10 rounded-[10px] flex items-center justify-center mb-4"
                  style={{ background: 'var(--accent-gold-light)', border: '1px solid color-mix(in srgb, var(--accent-gold) 18%, transparent)' }}>
                  <Icon className="w-5 h-5" style={{ color: 'var(--accent-gold)' }} />
                </div>
                <h3 className="text-base font-semibold mb-2" style={{ color: 'var(--text)' }}>{title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'color-mix(in srgb, var(--text) 62%, transparent)' }}>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-semibold mb-2" style={{ letterSpacing: '-0.02em' }}>
            Pricing — published, not hidden
          </h2>
          <p className="text-sm mb-8" style={{ color: 'color-mix(in srgb, var(--text) 55%, transparent)' }}>
            World-Check makes you sign an NDA before quoting. Here&rsquo;s ours, every tier:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {tiers.map((t) => (
              <div key={t.name} className="p-6 rounded-[14px]"
                style={{ background: 'color-mix(in srgb, var(--text) 3%, transparent)', border: '1px solid color-mix(in srgb, var(--text) 10%, transparent)' }}>
                <p className="text-xs uppercase tracking-[0.18em] mb-2" style={{ color: 'var(--accent-gold)' }}>{t.name}</p>
                <p className="text-2xl font-semibold mb-1" style={{ color: 'var(--text)' }}>{t.price}</p>
                <p className="text-sm mb-3" style={{ color: 'color-mix(in srgb, var(--text) 85%, transparent)' }}>{t.screens}</p>
                <p className="text-xs" style={{ color: 'color-mix(in srgb, var(--text) 55%, transparent)' }}>{t.for}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="migrate" className="py-16 px-4">
        <div className="max-w-3xl mx-auto p-8 rounded-[14px]"
          style={{ background: 'color-mix(in srgb, var(--accent-gold) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-gold) 25%, transparent)' }}>
          <h2 className="text-2xl font-semibold mb-3" style={{ color: 'var(--text)', letterSpacing: '-0.02em' }}>
            Migrate from World-Check in 1 hour
          </h2>
          <p className="text-sm mb-6" style={{ color: 'color-mix(in srgb, var(--text) 62%, transparent)' }}>
            Drop your existing World-Check Data File CSV/XML export into our importer. We map every record
            into your AMLIQ tenant, dedupe against our global feeds, and keep your existing watchlist IDs
            intact so your downstream alert routing keeps working unchanged.
          </p>
          <ol className="space-y-3 mb-6 text-sm" style={{ color: 'color-mix(in srgb, var(--text) 85%, transparent)' }}>
            <li><span style={{ color: 'var(--accent-gold)' }}>1.</span> Sign up free → create a tenant.</li>
            <li><span style={{ color: 'var(--accent-gold)' }}>2.</span> Upload your latest WC export at <code className="px-1.5 py-0.5 rounded" style={{ background: 'color-mix(in srgb, var(--text) 6%, transparent)' }}>/import/world-check</code>.</li>
            <li><span style={{ color: 'var(--accent-gold)' }}>3.</span> Pin matching threshold + alert rules.</li>
            <li><span style={{ color: 'var(--accent-gold)' }}>4.</span> Switch your DNS record to <code className="px-1.5 py-0.5 rounded" style={{ background: 'color-mix(in srgb, var(--text) 6%, transparent)' }}>api.amliq.finance</code>.</li>
          </ol>
          <a href="/signup" className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold rounded-[10px]"
            style={{ background: 'var(--accent-gold)', color: '#0A0908' }}>
            Start migration <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </section>

      <FooterSection />
    </div>
  )
}
