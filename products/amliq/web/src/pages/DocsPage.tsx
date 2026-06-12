import { Link } from 'react-router-dom'
import { Book, Code, Key, Webhook, Package, Terminal, Zap, Shield } from 'lucide-react'

const sections = [
  { icon: Terminal, title: 'Quick start', desc: 'First screening call in under 10 minutes.', href: '#quickstart' },
  { icon: Code, title: 'API reference', desc: 'Full endpoint docs with request and response schemas.', href: '#api' },
  { icon: Key, title: 'Authentication', desc: 'API keys, scopes, rotation, and rate limits.', href: '#auth' },
  { icon: Package, title: 'SDKs', desc: 'Official libraries for Node.js, Python, Go, and Java.', href: '#sdks' },
  { icon: Webhook, title: 'Webhooks', desc: 'Signed events for list updates and case transitions.', href: '#webhooks' },
  { icon: Book, title: 'Guides', desc: 'Batch, streaming, and wallet screening workflows.', href: '#guides' },
]

const curl = `curl -X POST https://api.amliq.finance/v1/screen \\
  -H "Authorization: Bearer $AMLIQ_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "entity": {
      "name": "Hassan Ali Mohammad",
      "type": "individual",
      "country": "SY",
      "date_of_birth": "1974-02-11"
    },
    "lists": ["OFAC", "UN", "EU", "HMT"],
    "mode": "realtime"
  }'`

const response = `{
  "screening_id": "scr_01HZ8Y2W7M3A1Q9K",
  "decision": "review",
  "risk_score": 0.83,
  "latency_ms": 38,
  "matches": [
    {
      "list": "OFAC SDN",
      "entry_id": "OFAC-24601",
      "name": "HASSAN ALI MOHAMMAD",
      "match_type": "exact+phonetic",
      "confidence": 0.94,
      "explanation": [
        "full name exact match",
        "country of birth matches",
        "date of birth within tolerance (±2y)"
      ]
    }
  ],
  "policy_version": "2026-04-10.v7",
  "audit_url": "/v1/audit/scr_01HZ8Y2W7M3A1Q9K"
}`

const sdks = [
  { lang: 'Node.js', install: 'npm install @amliq/node', repo: 'github.com/amliq/amliq-node' },
  { lang: 'Python', install: 'pip install amliq', repo: 'github.com/amliq/amliq-python' },
  { lang: 'Go', install: 'go get github.com/amliq/amliq-go', repo: 'github.com/amliq/amliq-go' },
  { lang: 'Java', install: 'implementation "finance.amliq:amliq:1.4.0"', repo: 'github.com/amliq/amliq-java' },
]

const latencyClaims = [
  { label: 'P99 decision target', value: '<50ms' },
  { label: 'Cold starts', value: 'Zero' },
  { label: 'List sources', value: '26+' },
  { label: 'Uptime target', value: '99.9%' },
]

const codeBlock = {
  background: '#0A0908',
  color: '#F0EDE7',
  border: '1px solid var(--separator)',
} as const

export default function DocsPage() {
  return (
    <div className="py-20 sm:py-28 px-4 bg-token-bg">
      <div className="max-w-4xl mx-auto">
        <p className="text-xs font-semibold tracking-widest uppercase mb-4 text-token-gold">
          Developers
        </p>
        <h1 className="text-3xl sm:text-4xl font-semibold text-token-fg mb-4">
          Build compliance into your payment flow
        </h1>
        <p className="text-token-fg-muted mb-10 max-w-2xl">
          One REST endpoint returns a sanctions, PEP, and adverse-media decision with a calibrated
          risk score and a signed audit trail. Integrate in minutes, operate for years.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-14">
          {latencyClaims.map(({ label, value }) => (
            <div key={label} className="p-4 rounded-xl border border-token-line bg-token-bg-2">
              <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-token-fg-faint mb-1.5">
                <Zap className="w-3 h-3 text-token-gold" />
                {label}
              </div>
              <p className="text-xl font-bold text-token-fg">{value}</p>
            </div>
          ))}
        </div>

        <CodeSection id="quickstart" title="1. Make your first screening call" headLabel="POST /v1/screen" body={curl}>
          <p className="text-sm text-token-fg-muted mb-5">
            Replace{' '}
            <code className="px-1.5 py-0.5 rounded bg-token-bg-2 text-token-fg font-mono text-xs border border-token-line">
              $AMLIQ_API_KEY
            </code>{' '}
            with the key from your dashboard.
          </p>
        </CodeSection>

        <CodeSection id="api" title="2. Handle the response" headLabel="200 OK · 38ms" body={response}>
          <p className="text-sm text-token-fg-muted mb-5">
            Every response includes a decision, a calibrated risk score, explainable match evidence, the
            policy version, and an audit URL you can retain for regulators.
          </p>
        </CodeSection>

        <div id="sdks" className="mb-14">
          <h2 className="text-xl font-semibold text-token-fg mb-5">SDKs</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {sdks.map(sdk => (
              <div key={sdk.lang} className="p-4 rounded-xl border border-token-line bg-token-surface">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-token-fg">{sdk.lang}</h3>
                  <span className="text-[10px] font-mono text-token-fg-faint">{sdk.repo}</span>
                </div>
                <code
                  className="block text-xs font-mono rounded-md px-2.5 py-2 force-ltr"
                  style={codeBlock}
                >
                  {sdk.install}
                </code>
              </div>
            ))}
          </div>
        </div>

        <div id="auth" className="mb-14 p-5 rounded-xl border border-token-line bg-token-bg-2">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-4 h-4 text-token-gold" />
            <h2 className="text-base font-semibold text-token-fg">Authentication & security</h2>
          </div>
          <p className="text-sm text-token-fg-muted leading-relaxed">
            Bearer tokens scoped per environment, per-key rate limits, IP allowlisting, and signed
            webhooks. All traffic TLS 1.3; payloads encrypted at rest. Our security program is built
            against the SOC 2 Trust Services Criteria — formal Type II attestation is in progress.
            See <a href="/security" className="underline">our security page</a> for details.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-16">
          {sections.map(({ icon: Icon, title, desc, href }) => (
            <a
              key={title}
              href={href}
              className="p-5 rounded-xl border border-token-line bg-token-surface hover:shadow-sm transition-all group"
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center mb-3"
                style={{ background: 'var(--accent-gold-light)' }}
              >
                <Icon className="w-4 h-4 text-token-gold" />
              </div>
              <h3 className="text-sm font-semibold text-token-fg mb-1">{title}</h3>
              <p className="text-xs text-token-fg-faint leading-relaxed">{desc}</p>
            </a>
          ))}
        </div>

        <div className="text-center border-t border-token-line pt-10">
          <p className="text-sm text-token-fg-faint mb-4">
            Need help integrating? Our engineering team can walk you through the setup.
          </p>
          <Link
            to="/contact"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-[10px] transition-all duration-200 hover:-translate-y-px"
            style={{ background: 'var(--accent-gold)', color: '#0A0908' }}
          >
            Contact engineering
          </Link>
        </div>
      </div>
    </div>
  )
}

interface CodeSectionProps {
  id: string
  title: string
  headLabel: string
  body: string
  children?: React.ReactNode
}

function CodeSection({ id, title, headLabel, body, children }: CodeSectionProps) {
  return (
    <div id={id} className="mb-12">
      <h2 className="text-xl font-semibold text-token-fg mb-2">{title}</h2>
      {children}
      <div className="rounded-xl overflow-hidden" style={codeBlock}>
        <div className="flex items-center gap-2 px-4 py-2.5 border-b" style={{ borderColor: 'rgba(240,237,231,0.08)' }}>
          <span className="text-[11px] font-mono uppercase tracking-wider" style={{ color: 'rgba(240,237,231,0.5)' }}>
            {headLabel}
          </span>
        </div>
        <pre className="p-5 text-xs sm:text-sm font-mono leading-relaxed overflow-x-auto force-ltr">{body}</pre>
      </div>
    </div>
  )
}
