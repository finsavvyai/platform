import { Code, Package, Webhook, Layers } from 'lucide-react'

const methods = [
  { icon: Code, title: 'REST API', desc: 'OpenAPI 3.1 spec with versioned endpoints and rate limiting.' },
  { icon: Package, title: 'SDKs', desc: 'Official libraries for Python, Node.js, Go, and Java.' },
  { icon: Webhook, title: 'Webhooks', desc: 'Real-time notifications for batch completions and alert updates.' },
  { icon: Layers, title: 'Batch API', desc: 'Upload CSV or JSON files for high-volume bulk screening.' },
]

export default function IntegrationSection() {
  return (
    <section className="py-16 sm:py-24 px-4 bg-token-bg-2">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-semibold text-token-fg mb-4">
          Integrate in Minutes
        </h2>
        <p className="text-base text-token-fg-muted mb-10 max-w-2xl">
          Four integration paths to fit your architecture and volume.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {methods.map(m => (
            <div key={m.title} className="bg-token-surface border border-token-line rounded-lg p-6">
              <m.icon className="w-5 h-5 text-token-gold mb-3" />
              <h3 className="text-sm font-semibold text-token-fg mb-1">{m.title}</h3>
              <p className="text-sm text-token-fg-muted leading-relaxed">{m.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
