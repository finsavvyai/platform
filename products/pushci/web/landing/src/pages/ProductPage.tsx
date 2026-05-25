import { Navbar } from '../components/Navbar'
import { Footer } from '../components/Footer'
import { useDocumentMeta } from '../components/useDocumentMeta'
import { btnGesturePrimary, btnGesture } from '../styles/gestures'

const features = [
  {
    title: 'AI pipeline optimization',
    body: 'Reorders slow tests, skips unchanged artifacts, and predicts which stages you can parallelize safely. Builds get faster every week without config changes.',
    metric: '-34% avg build time',
  },
  {
    title: 'Failure prediction',
    body: 'Risk score per commit — schema drift, dep churn, bundle delta, flaky-test correlation. Red-flag commits auto-route to canary before prod.',
    metric: '94% precision on real incidents',
  },
  {
    title: 'Auto-rollback',
    body: 'Error-rate and latency thresholds per env. Breaches trigger rollback in <30s using the last green artifact — no human in the loop.',
    metric: '<30s mean rollback',
  },
  {
    title: 'Build caching + acceleration',
    body: 'Content-addressed cache across branches and runners. Node modules, Docker layers, Go build graph, Rust target/ — all shared, all verified.',
    metric: '87% cache hit rate',
  },
  {
    title: 'Deployment orchestration',
    body: 'One graph across dev/staging/prod. Canary, blue-green, and per-region rollout patterns as one-line config. Promotion gates tie to real metrics, not timers.',
    metric: '22 deploy targets',
  },
  {
    title: 'Observability built in',
    body: 'Logs, traces, and deploy events streamed to the dashboard. Link any build to the commit, the PR, the error, and the rollback — one click.',
    metric: 'Zero-config traces',
  },
  {
    title: 'Preview environments',
    body: 'Every PR gets its own env — real database snapshot, real services, real URL. TTL-bounded. Auto-torn-down on merge or close.',
    metric: '<2 min to live',
  },
  {
    title: 'Multi-environment',
    body: 'dev, staging, prod, and any custom slot. Secrets scoped per env. Promotion requires explicit approval or an AI green light.',
    metric: 'Unlimited envs',
  },
]

export default function ProductPage() {
  useDocumentMeta({
    title: 'Product — PushCI',
    description: 'AI-powered CI/CD: pipeline optimization, failure prediction, auto-rollback, multi-env deploys.',
    canonical: 'https://pushci.dev/product',
  })

  return (
    <div className="min-h-screen bg-root">
      <Navbar />
      <section className="pt-28 sm:pt-36 pb-20 px-6">
        <div className="mx-auto max-w-[1080px]">
          <p className="text-body font-medium text-accent tracking-wide uppercase">Product</p>
          <h1 className="mt-3 text-4xl sm:text-6xl font-extrabold tracking-tight text-t1 max-w-3xl">
            Every CI primitive. <span className="gradient-text">Built for AI-native teams.</span>
          </h1>
          <p className="mt-6 text-lg text-t2 max-w-2xl leading-relaxed">
            PushCI replaces your pipeline config, your runner fleet, and your rollback
            runbook with a single product that gets smarter every week.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <a href="https://app.pushci.dev" className={`rounded-lg bg-t1 px-6 py-3 text-sm font-semibold text-root hover:bg-white focus-glow ${btnGesturePrimary}`}>
              Start building
            </a>
            <a href="/developers" className={`rounded-lg bg-surface border border-border-base px-6 py-3 text-sm font-semibold text-t1 hover:border-border-em focus-glow ${btnGesture}`}>
              Developer docs
            </a>
          </div>
        </div>
      </section>

      <section className="pb-28 px-6">
        <div className="mx-auto max-w-[1080px]">
          <div className="grid gap-5 md:grid-cols-2">
            {features.map(f => (
              <div key={f.title} className="rounded-xl border border-border-base bg-surface/40 p-7 card-hover">
                <h3 className="text-xl font-bold text-t1">{f.title}</h3>
                <p className="mt-3 text-t2 text-sm leading-relaxed">{f.body}</p>
                <div className="mt-5 text-xs text-accent font-mono uppercase tracking-wider">{f.metric}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
