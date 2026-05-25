import { useEffect, useState } from 'react'
import { Navbar } from '../components/Navbar'
import { Footer } from '../components/Footer'
import { useDocumentMeta } from '../components/useDocumentMeta'

type Probe = 'checking' | 'ok' | 'down'

interface Service {
  name: string
  url: string
  description: string
}

const services: Service[] = [
  { name: 'API', url: 'https://api.pushci.dev/health', description: 'CF Workers API — webhooks, auth, runs, billing' },
  { name: 'Landing', url: 'https://pushci.dev', description: 'Marketing site, docs, pricing' },
  { name: 'Dashboard', url: 'https://app.pushci.dev', description: 'Project overview, billing, audit log' },
]

const indicator: Record<Probe, { label: string; cls: string; dot: string }> = {
  checking: { label: 'Checking…', cls: 'text-t3', dot: 'bg-t3 animate-pulse' },
  ok: { label: 'Operational', cls: 'text-emerald-400', dot: 'bg-emerald-400' },
  down: { label: 'Degraded', cls: 'text-rose-400', dot: 'bg-rose-400' },
}

export default function StatusPage() {
  useDocumentMeta({
    title: 'Status — PushCI',
    description: 'Real-time status of PushCI API, landing, and dashboard.',
    canonical: 'https://pushci.dev/status',
  })

  const [probes, setProbes] = useState<Record<string, Probe>>(
    Object.fromEntries(services.map(s => [s.name, 'checking'])),
  )

  useEffect(() => {
    services.forEach(async (s) => {
      try {
        const res = await fetch(s.url, { mode: 'no-cors', cache: 'no-store' })
        setProbes(p => ({ ...p, [s.name]: res.type === 'opaque' || res.ok ? 'ok' : 'down' }))
      } catch {
        setProbes(p => ({ ...p, [s.name]: 'down' }))
      }
    })
  }, [])

  const allOk = Object.values(probes).every(p => p === 'ok')
  const anyDown = Object.values(probes).some(p => p === 'down')

  return (
    <div className="min-h-screen bg-root">
      <Navbar />
      <div className="mx-auto max-w-3xl px-6 py-20">
        <h1 className="text-3xl font-bold text-t1 mb-2">Status</h1>
        <p className="text-t3 text-sm mb-10">Live probes from your browser — updated on page load.</p>

        <section className="mb-10 rounded-xl border border-border-base bg-surface p-6">
          <div className="flex items-center gap-3">
            <span className={`inline-block w-3 h-3 rounded-full ${allOk ? 'bg-emerald-400' : anyDown ? 'bg-rose-400' : 'bg-t3 animate-pulse'}`} />
            <span className="text-t1 font-semibold">
              {allOk ? 'All systems operational' : anyDown ? 'Some systems degraded' : 'Checking systems…'}
            </span>
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold text-t1 mb-4">Services</h2>
          <div className="space-y-3">
            {services.map(s => {
              const i = indicator[probes[s.name]]
              return (
                <div key={s.name} className="rounded-xl border border-border-base bg-surface p-5 flex items-start justify-between gap-4">
                  <div>
                    <div className="text-t1 font-semibold">{s.name}</div>
                    <div className="text-t3 text-sm">{s.description}</div>
                    <a href={s.url} target="_blank" rel="noreferrer" className="text-accent text-xs font-mono underline mt-1 inline-block">
                      {s.url}
                    </a>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`inline-block w-2 h-2 rounded-full ${i.dot}`} />
                    <span className={`text-sm font-medium ${i.cls}`}>{i.label}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-t1 mb-3">SLA</h2>
          <p className="text-t2 text-sm leading-relaxed">
            PushCI Cloud SaaS targets <strong>99.9%</strong> monthly uptime. Dedicated and self-hosted
            deployments have contract-defined SLAs. For incident notifications, subscribe via{' '}
            <a href="mailto:status@pushci.dev" className="text-accent underline">status@pushci.dev</a>.
          </p>
        </section>
      </div>
      <Footer />
    </div>
  )
}
