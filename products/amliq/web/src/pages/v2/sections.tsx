import React, { useState } from 'react'
import {
  ArrowRight,
  ShieldCheck,
  Zap,
  FileSearch,
  GitBranch,
  Database,
  Users,
  Layers,
  Globe,
  Lock,
  KeyRound,
  UserCog,
  ScrollText,
  Webhook,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  Send,
  ShieldAlert,
  ClipboardCheck,
} from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  Container,
  Dot,
  MetricCard,
  Section,
  SectionHeader,
  tok,
  cx,
} from './ui'

// -----------------------------------------------------------------------------
// 2. HERO
// -----------------------------------------------------------------------------
export function Hero() {
  return (
    <Section id="hero" className="relative overflow-hidden pt-10 sm:pt-14 lg:pt-20">
      {/* Background accent: subtle gradient, no neon */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-0"
        style={{
          background: `radial-gradient(1200px 500px at 20% -10%, ${tok.bg2} 0%, transparent 60%)`,
        }}
      />
      <Container className="relative">
        <div className="grid items-start gap-12 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
          <div>
            <div
              className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-medium"
              style={{
                background: 'rgba(198,168,90,0.08)',
                border: `1px solid rgba(198,168,90,0.22)`,
                color: tok.goldSoft,
              }}
            >
              <Dot color={tok.gold} />
              Compliance infrastructure for payments
            </div>

            <h1
              className="mt-6 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-[56px]"
              style={{ color: tok.text }}
            >
              Real-time sanctions screening for modern payment systems.
            </h1>

            <p
              className="mt-5 max-w-xl text-base leading-relaxed sm:text-lg"
              style={{ color: tok.textSec }}
            >
              Sub-50ms decisioning, explainable matches, and audit-ready outcomes for
              regulated transaction flows. Reduce false positives. Increase approvals. Stay
              audit-ready.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button as="a" href="/signup" variant="primary" size="lg">
                Start screening <ArrowRight className="h-4 w-4" />
              </Button>
              <Button as="a" href="/contact" variant="secondary" size="lg">
                Book a demo
              </Button>
            </div>

            <div className="mt-10 grid max-w-xl grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4">
              {[
                { k: 'SOC 2', v: 'aligned' },
                { k: '99.99%', v: 'uptime' },
                { k: '<50ms', v: 'median' },
                { k: 'Audit', v: 'grade trail' },
              ].map((t) => (
                <div key={t.k}>
                  <div
                    className="text-sm font-semibold tabular-nums"
                    style={{ color: tok.text }}
                  >
                    {t.k}
                  </div>
                  <div className="text-xs" style={{ color: tok.textMuted }}>
                    {t.v}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <HeroProductPanel />
        </div>
      </Container>
    </Section>
  )
}

function HeroProductPanel() {
  return (
    <Card elevated className="overflow-hidden">
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{ borderBottom: `1px solid ${tok.borderMuted}` }}
      >
        <div className="flex items-center gap-2">
          <Dot color={tok.warning} />
          <span className="text-xs font-medium" style={{ color: tok.textSec }}>
            Screening review · txn_9f2a83c1
          </span>
        </div>
        <Badge tone="warning">REVIEW</Badge>
      </div>
      <div className="grid gap-0 sm:grid-cols-2">
        <div className="p-5" style={{ borderRight: `1px solid ${tok.borderMuted}` }}>
          <div
            className="text-[11px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: tok.textMuted }}
          >
            Transaction
          </div>
          <div className="mt-3 space-y-2 text-sm">
            <Row k="Amount" v="$48,200.00 USD" />
            <Row k="Corridor" v="DE → AE" />
            <Row k="Method" v="SWIFT MT103" />
            <Row k="Counterparty" v="N. Petrov" />
          </div>
          <div
            className="mt-4 flex items-center justify-between rounded-lg px-3 py-2"
            style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.22)' }}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" style={{ color: tok.warning }} />
              <span className="text-xs" style={{ color: '#FCD34D' }}>
                Possible match on OFAC SDN
              </span>
            </div>
            <span className="text-xs tabular-nums" style={{ color: '#FCD34D' }}>
              0.87
            </span>
          </div>
        </div>
        <div className="p-5">
          <div
            className="text-[11px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: tok.textMuted }}
          >
            Evidence
          </div>
          <ul className="mt-3 space-y-2 text-xs" style={{ color: tok.textSec }}>
            <EvRow field="Name" match="Nikolai Petrov" src="OFAC SDN #23441" />
            <EvRow field="DOB" match="1972-04-12" src="Secondary sanctions EU" />
            <EvRow field="Nationality" match="RU" src="UN Consolidated" />
          </ul>
          <div
            className="mt-4 rounded-lg p-3"
            style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${tok.borderMuted}` }}
          >
            <div
              className="text-[10px] font-semibold uppercase tracking-[0.14em]"
              style={{ color: tok.textMuted }}
            >
              Audit trail
            </div>
            <ul className="mt-2 space-y-1 font-mono text-[11px]" style={{ color: tok.textSec }}>
              <li>14:22:01.412  screened   analyst@amliq</li>
              <li>14:22:01.448  matched    engine.v3.2</li>
              <li>14:22:01.461  escalated  rule:sdn_0_85</li>
            </ul>
          </div>
        </div>
      </div>
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{ borderTop: `1px solid ${tok.borderMuted}` }}
      >
        <span className="text-[11px]" style={{ color: tok.textMuted }}>
          Latency 42ms · correlation_id crl_7x…a2
        </span>
        <div className="flex items-center gap-2">
          <Button size="md" variant="secondary">
            Clear
          </Button>
          <Button size="md" variant="primary">
            Escalate
          </Button>
        </div>
      </div>
    </Card>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between">
      <span style={{ color: tok.textMuted }}>{k}</span>
      <span className="tabular-nums" style={{ color: tok.text }}>
        {v}
      </span>
    </div>
  )
}
function EvRow({ field, match, src }: { field: string; match: string; src: string }) {
  return (
    <li className="flex items-center justify-between gap-3">
      <span style={{ color: tok.textMuted }}>{field}</span>
      <span className="truncate tabular-nums" style={{ color: tok.text }}>
        {match}
      </span>
      <span className="shrink-0 text-[10px]" style={{ color: tok.textMuted }}>
        {src}
      </span>
    </li>
  )
}

// -----------------------------------------------------------------------------
// 3. TRUST / PROOF
// -----------------------------------------------------------------------------
export function TrustProof() {
  const logos = ['NORTHBANK', 'ORBITPAY', 'SENTINEL FX', 'LUMEN CAPITAL', 'VERDE BANK', 'AXIS PSP']
  return (
    <Section className="pt-0">
      <Container>
        <div
          className="rounded-2xl px-6 py-8 sm:px-10 sm:py-10"
          style={{ background: tok.surface, border: `1px solid ${tok.border}` }}
        >
          <div
            className="text-center text-[11px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: tok.textMuted }}
          >
            Built for regulated throughput
          </div>

          <div className="mt-6 grid grid-cols-2 items-center gap-y-6 sm:grid-cols-3 lg:grid-cols-6">
            {logos.map((l) => (
              <div
                key={l}
                className="text-center text-sm font-semibold tracking-[0.2em]"
                style={{ color: tok.textMuted }}
              >
                {l}
              </div>
            ))}
          </div>

          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Median latency" value="42ms" sub="P50 screening decisions" />
            <MetricCard label="Uptime target" value="99.99%" sub="Production SLA" />
            <MetricCard label="False positives" value="−28%" sub="Typical reduction" accent />
            <MetricCard label="Daily screenings" value="40M+" sub="Across deployed tenants" />
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs" style={{ color: tok.textMuted }}>
            {['Encryption at rest & in transit', 'RBAC + least privilege', 'Audit logs + retention', 'SAML SSO (coming soon)'].map(
              (t) => (
                <span key={t} className="inline-flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5" style={{ color: tok.gold }} />
                  {t}
                </span>
              ),
            )}
          </div>
        </div>
      </Container>
    </Section>
  )
}

// -----------------------------------------------------------------------------
// 4. CORE VALUE PILLARS
// -----------------------------------------------------------------------------
export function Pillars() {
  const pillars = [
    {
      icon: Zap,
      title: 'Instant screening',
      items: ['Real-time checks against global watchlists', 'Built for payment rails and on-chain flows'],
    },
    {
      icon: Cpu,
      title: 'Risk scoring',
      items: ['Transaction and customer-level scoring', 'Configurable thresholds and rules'],
    },
    {
      icon: FileSearch,
      title: 'Explainable decisions',
      items: ['Field-level match evidence', 'Confidence scores and match rationale'],
    },
    {
      icon: ScrollText,
      title: 'Audit-grade trail',
      items: ['Immutable event history', 'Role-based review and disposition'],
    },
  ]
  return (
    <Section>
      <Container>
        <SectionHeader
          eyebrow="What you get"
          title="Compliance decisioning you can audit."
          subtitle="Four pillars designed for regulated flows: speed, risk clarity, explainability, and a defensible trail."
        />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {pillars.map((p) => (
            <Card key={p.title} className="p-6">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-md"
                style={{ background: 'rgba(198,168,90,0.08)', border: `1px solid rgba(198,168,90,0.18)` }}
              >
                <p.icon className="h-4 w-4" style={{ color: tok.gold }} />
              </div>
              <div className="mt-4 text-base font-semibold" style={{ color: tok.text }}>
                {p.title}
              </div>
              <ul className="mt-3 space-y-1.5 text-sm" style={{ color: tok.textSec }}>
                {p.items.map((i) => (
                  <li key={i} className="flex gap-2">
                    <span style={{ color: tok.textMuted }}>—</span>
                    <span>{i}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </Container>
    </Section>
  )
}

// -----------------------------------------------------------------------------
// 5. FEATURE GRID
// -----------------------------------------------------------------------------
export function FeatureGrid() {
  const features = [
    { icon: ShieldCheck, title: 'Sanctions screening', desc: 'OFAC, UN, EU, HMT and custom lists.' },
    { icon: GitBranch, title: 'Fuzzy + phonetic matching', desc: 'Tunable thresholds with deterministic output.' },
    { icon: Cpu, title: 'Transaction risk scoring', desc: 'Customer and transaction-level signals.' },
    { icon: Database, title: 'Watchlist coverage', desc: 'Managed sources with update cadence visible.' },
    { icon: Layers, title: 'Batch + real-time', desc: 'Single endpoints for both throughput modes.' },
    { icon: Users, title: 'Case management', desc: 'Queues, assignments, and SLAs.' },
    { icon: ScrollText, title: 'Audit logs', desc: 'Immutable trail for every decision.' },
    { icon: Webhook, title: 'API-first integration', desc: 'Versioned, idempotent, webhook-ready.' },
  ]
  return (
    <Section>
      <Container>
        <SectionHeader
          eyebrow="Platform"
          title="Operational capabilities, not marketing checkmarks."
          subtitle="Everything required to run compliance at transaction speed — and defend every decision."
        />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <Card key={f.title} className="p-5">
              <f.icon className="h-4 w-4" style={{ color: tok.textSec }} />
              <div className="mt-3 text-[15px] font-semibold" style={{ color: tok.text }}>
                {f.title}
              </div>
              <div className="mt-1.5 text-sm" style={{ color: tok.textMuted }}>
                {f.desc}
              </div>
            </Card>
          ))}
        </div>
      </Container>
    </Section>
  )
}

// -----------------------------------------------------------------------------
// 6. HOW IT WORKS
// -----------------------------------------------------------------------------
export function HowItWorks() {
  const steps = [
    { icon: Send, title: 'Send context', desc: 'Post a customer or transaction payload.' },
    { icon: ShieldCheck, title: 'Screen', desc: 'Checked against configured watchlists.' },
    { icon: Cpu, title: 'Score + decide', desc: 'Risk score and decision with evidence.' },
    { icon: ClipboardCheck, title: 'Audit-ready', desc: 'Immutable response in milliseconds.' },
  ]
  return (
    <Section>
      <Container>
        <SectionHeader eyebrow="Flow" title="Four steps from request to defensible decision." />
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <Card key={s.title} className="relative p-6">
              <div
                className="text-[11px] font-semibold uppercase tracking-[0.14em]"
                style={{ color: tok.gold }}
              >
                Step {i + 1}
              </div>
              <div className="mt-2 text-[15px] font-semibold" style={{ color: tok.text }}>
                {s.title}
              </div>
              <div className="mt-1.5 text-sm" style={{ color: tok.textMuted }}>
                {s.desc}
              </div>
              <s.icon
                className="absolute right-5 top-5 h-4 w-4"
                style={{ color: tok.textMuted }}
              />
            </Card>
          ))}
        </div>
      </Container>
    </Section>
  )
}

// -----------------------------------------------------------------------------
// 7. PRODUCT PREVIEW
// -----------------------------------------------------------------------------
export function ProductPreview() {
  const rows = [
    { t: '14:22:01', id: 'txn_9f2a83', name: 'Nikolai P.', c: 'RU', amt: '$48,200', r: 87, s: 'REVIEW' as const },
    { t: '14:21:57', id: 'txn_9f2a79', name: 'Acme Ltd', c: 'GB', amt: '$2,400', r: 12, s: 'APPROVE' as const },
    { t: '14:21:49', id: 'txn_9f2a6d', name: 'Y. Chen', c: 'SG', amt: '$88,110', r: 34, s: 'APPROVE' as const },
    { t: '14:21:42', id: 'txn_9f2a5c', name: 'Orbit FZE', c: 'AE', amt: '$152,900', r: 71, s: 'REVIEW' as const },
    { t: '14:21:30', id: 'txn_9f2a48', name: 'J. Silva', c: 'BR', amt: '$640', r: 96, s: 'BLOCK' as const },
  ]
  const [selected, setSelected] = useState(0)
  const row = rows[selected]

  return (
    <Section>
      <Container>
        <SectionHeader
          eyebrow="Product"
          title="Operations UI for compliance teams."
          subtitle="Queue flagged transactions, inspect evidence, and disposition with full audit capture."
        />
        <div className="mt-10 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <Card elevated className="overflow-hidden">
            <div
              className="flex items-center justify-between px-5 py-3"
              style={{ borderBottom: `1px solid ${tok.borderMuted}` }}
            >
              <div className="text-sm font-semibold" style={{ color: tok.text }}>
                Flagged transactions
              </div>
              <Badge tone="neutral">Last 15m</Badge>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm tabular-nums">
                <thead>
                  <tr
                    className="text-left text-[11px] font-semibold uppercase tracking-[0.14em]"
                    style={{ color: tok.textMuted }}
                  >
                    <th className="px-5 py-3">Time</th>
                    <th className="px-5 py-3">Customer</th>
                    <th className="px-5 py-3 hidden sm:table-cell">Country</th>
                    <th className="px-5 py-3 text-right">Amount</th>
                    <th className="px-5 py-3 text-right">Risk</th>
                    <th className="px-5 py-3">Decision</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr
                      key={r.id}
                      onClick={() => setSelected(i)}
                      className={cx(
                        'cursor-pointer transition-colors',
                        i === selected ? '' : 'hover:bg-white/[0.02]',
                      )}
                      style={{
                        borderTop: `1px solid ${tok.borderMuted}`,
                        background: i === selected ? 'rgba(198,168,90,0.06)' : 'transparent',
                      }}
                    >
                      <td className="px-5 py-3 font-mono text-xs" style={{ color: tok.textMuted }}>
                        {r.t}
                      </td>
                      <td className="px-5 py-3" style={{ color: tok.text }}>
                        <div className="font-medium">{r.name}</div>
                        <div className="text-[11px]" style={{ color: tok.textMuted }}>
                          {r.id}
                        </div>
                      </td>
                      <td className="px-5 py-3 hidden sm:table-cell" style={{ color: tok.textSec }}>
                        {r.c}
                      </td>
                      <td className="px-5 py-3 text-right" style={{ color: tok.text }}>
                        {r.amt}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <RiskScore score={r.r} />
                      </td>
                      <td className="px-5 py-3">
                        <DecisionBadge s={r.s} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card elevated className="overflow-hidden">
            <div
              className="flex items-center justify-between px-5 py-3"
              style={{ borderBottom: `1px solid ${tok.borderMuted}` }}
            >
              <div className="text-sm font-semibold" style={{ color: tok.text }}>
                Case · {row.id}
              </div>
              <DecisionBadge s={row.s} />
            </div>
            <div className="space-y-4 p-5 text-sm">
              <Row k="Customer" v={row.name} />
              <Row k="Country" v={row.c} />
              <Row k="Amount" v={row.amt} />
              <div>
                <div
                  className="text-[11px] font-semibold uppercase tracking-[0.14em]"
                  style={{ color: tok.textMuted }}
                >
                  Match evidence
                </div>
                <ul className="mt-2 space-y-1.5 text-xs" style={{ color: tok.textSec }}>
                  <EvRow field="Name" match={row.name} src="OFAC SDN" />
                  <EvRow field="DOB" match="1972-04-12" src="EU Sanctions" />
                </ul>
              </div>
              <div className="flex gap-2 pt-2">
                <Button size="md" variant="secondary" className="flex-1">
                  Clear
                </Button>
                <Button size="md" variant="primary" className="flex-1">
                  Escalate
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </Container>
    </Section>
  )
}

function RiskScore({ score }: { score: number }) {
  const color = score >= 75 ? tok.critical : score >= 40 ? tok.warning : tok.success
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="h-1.5 w-10 overflow-hidden rounded-full"
        style={{ background: 'rgba(255,255,255,0.06)' }}
      >
        <span className="block h-full" style={{ width: `${score}%`, background: color }} />
      </span>
      <span className="font-mono text-xs" style={{ color: tok.text }}>
        {score}
      </span>
    </span>
  )
}

function DecisionBadge({ s }: { s: 'APPROVE' | 'REVIEW' | 'BLOCK' }) {
  if (s === 'APPROVE') return <Badge tone="success">APPROVE</Badge>
  if (s === 'REVIEW') return <Badge tone="warning">REVIEW</Badge>
  return <Badge tone="critical">BLOCK</Badge>
}

// -----------------------------------------------------------------------------
// 8. DEVELOPER / API
// -----------------------------------------------------------------------------
export function DeveloperApi() {
  const [tab, setTab] = useState<'req' | 'res'>('req')
  const req = `POST /v1/screenings/transaction
Authorization: Bearer sk_live_···
Idempotency-Key: crl_7x9a2

{
  "correlation_id": "crl_7x9a2",
  "customer": {
    "full_name": "Nikolai Petrov",
    "dob": "1972-04-12",
    "country": "RU"
  },
  "transaction": {
    "amount": 48200,
    "currency": "USD",
    "corridor": "DE-AE",
    "method": "swift"
  }
}`
  const res = `HTTP/1.1 200 OK
x-amliq-latency-ms: 42
x-amliq-version: 2025-04-01

{
  "decision": "review",
  "risk_score": 87,
  "matches": [
    {
      "list": "ofac_sdn",
      "entity_id": "sdn_23441",
      "confidence": 0.87,
      "fields": ["name", "dob", "nationality"]
    }
  ],
  "audit_ref": "aud_9fa·e12",
  "evidence_url": "https://api.amliq.com/v1/audit/aud_9fa"
}`
  return (
    <Section>
      <Container>
        <div className="grid items-start gap-12 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <SectionHeader
              eyebrow="Developers"
              title="API decisioning designed for production flows."
              subtitle="Deterministic responses, idempotency, versioned endpoints, and evidence you can store and replay."
            />
            <div className="mt-8 grid gap-3">
              {[
                { k: 'Median response', v: '42ms' },
                { k: 'Idempotency', v: 'supported' },
                { k: 'Endpoints', v: 'versioned' },
                { k: 'Webhooks', v: 'signed' },
              ].map((x) => (
                <div
                  key={x.k}
                  className="flex items-center justify-between rounded-lg px-4 py-3"
                  style={{ border: `1px solid ${tok.border}`, background: tok.card }}
                >
                  <span className="text-sm" style={{ color: tok.textSec }}>
                    {x.k}
                  </span>
                  <span className="text-sm font-semibold tabular-nums" style={{ color: tok.text }}>
                    {x.v}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button as="a" href="/docs" variant="secondary">
                Read the docs
              </Button>
              <Button as="a" href="/signup" variant="primary">
                Get API access <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Card elevated className="overflow-hidden">
            <div
              className="flex items-center justify-between px-4 py-2"
              style={{ borderBottom: `1px solid ${tok.borderMuted}` }}
            >
              <div className="flex items-center gap-1">
                {(['req', 'res'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={cx(
                      'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                    )}
                    style={{
                      color: tab === t ? tok.text : tok.textMuted,
                      background: tab === t ? 'rgba(255,255,255,0.04)' : 'transparent',
                    }}
                  >
                    {t === 'req' ? 'Request' : 'Response'}
                  </button>
                ))}
              </div>
              <span className="font-mono text-[11px]" style={{ color: tok.textMuted }}>
                curl · node · python · go
              </span>
            </div>
            <pre
              className="overflow-x-auto p-5 font-mono text-[12px] leading-relaxed"
              style={{ color: tok.textSec }}
            >
              {tab === 'req' ? req : res}
            </pre>
          </Card>
        </div>
      </Container>
    </Section>
  )
}

// -----------------------------------------------------------------------------
// 9. SECURITY & COMPLIANCE
// -----------------------------------------------------------------------------
export function Security() {
  const items = [
    { icon: UserCog, t: 'RBAC + role separation', d: 'Analyst vs approver permissions.' },
    { icon: KeyRound, t: 'SSO / SAML (coming soon)', d: 'Centralized access control.' },
    { icon: ScrollText, t: 'Audit logs', d: 'Complete decision traceability.' },
    { icon: Lock, t: 'Encryption', d: 'At rest and in transit.' },
    { icon: ShieldAlert, t: 'Key management', d: 'Rotatable API keys, scoped access.' },
    { icon: Webhook, t: 'Webhook signing', d: 'Secure downstream workflows.' },
  ]
  return (
    <Section>
      <Container>
        <SectionHeader
          eyebrow="Security"
          title="Controls aligned with enterprise security expectations."
          subtitle="Architected for regulated institutions — with the proof and controls they require."
        />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((i) => (
            <Card key={i.t} className="p-5">
              <i.icon className="h-4 w-4" style={{ color: tok.gold }} />
              <div className="mt-3 text-[15px] font-semibold" style={{ color: tok.text }}>
                {i.t}
              </div>
              <div className="mt-1.5 text-sm" style={{ color: tok.textMuted }}>
                {i.d}
              </div>
            </Card>
          ))}
        </div>
      </Container>
    </Section>
  )
}

// -----------------------------------------------------------------------------
// 10. PRICING
// -----------------------------------------------------------------------------
export function Pricing() {
  const tiers = [
    {
      name: 'Starter',
      price: '$0',
      suffix: '/mo sandbox',
      desc: 'For pilots and low-volume production.',
      items: ['Real-time API', 'Core watchlists', 'Standard support', 'Community docs'],
      cta: 'Start in sandbox',
      recommended: false,
    },
    {
      name: 'Growth',
      price: '$2,400',
      suffix: '/mo starting',
      desc: 'For scaling fintech throughput.',
      items: [
        'Advanced matching',
        'Case management',
        'Webhooks + retries',
        'Higher SLA',
        'Priority support',
      ],
      cta: 'Start Growth',
      recommended: true,
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      suffix: 'annual',
      desc: 'For regulated institutions.',
      items: [
        'SSO / SAML (coming soon)',
        'Custom retention',
        'Dedicated support',
        'Compliance reviews',
        'Private deployment options',
      ],
      cta: 'Contact sales',
      recommended: false,
    },
  ]
  return (
    <Section id="pricing">
      <Container>
        <SectionHeader
          eyebrow="Pricing"
          title="Transparent tiers. Usage-based at scale."
          subtitle="Start in sandbox. Promote to production when your controls are approved."
        />
        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {tiers.map((t) => (
            <Card
              key={t.name}
              elevated={t.recommended}
              className={cx('p-6', t.recommended && 'relative')}
            >
              {t.recommended && (
                <div
                  className="absolute -top-3 left-6 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em]"
                  style={{
                    background: tok.gold,
                    color: tok.bg,
                  }}
                >
                  Recommended
                </div>
              )}
              <div className="text-sm font-semibold" style={{ color: tok.text }}>
                {t.name}
              </div>
              <div className="mt-4 flex items-baseline gap-1.5">
                <span
                  className="text-3xl font-semibold tabular-nums"
                  style={{ color: t.recommended ? tok.gold : tok.text }}
                >
                  {t.price}
                </span>
                <span className="text-sm" style={{ color: tok.textMuted }}>
                  {t.suffix}
                </span>
              </div>
              <p className="mt-2 text-sm" style={{ color: tok.textMuted }}>
                {t.desc}
              </p>
              <ul className="mt-5 space-y-2 text-sm">
                {t.items.map((i) => (
                  <li key={i} className="flex items-start gap-2" style={{ color: tok.textSec }}>
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: tok.textMuted }} />
                    {i}
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                <Button
                  variant={t.recommended ? 'primary' : 'secondary'}
                  className="w-full"
                  size="lg"
                >
                  {t.cta}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </Container>
    </Section>
  )
}

// -----------------------------------------------------------------------------
// 11. FAQ
// -----------------------------------------------------------------------------
export function FAQ() {
  const faqs = [
    {
      q: 'How fast is integration?',
      a: 'Sandbox in minutes. Typical production rollout takes 1–2 weeks depending on controls, SSO, and webhook configuration.',
    },
    {
      q: 'What lists are covered?',
      a: 'OFAC, UN, EU, HMT, and a wide set of regional and PEP sources. You can manage coverage per tenant and see update cadence in the dashboard.',
    },
    {
      q: 'How are false positives reduced?',
      a: 'Tunable matching thresholds, phonetic + fuzzy components, and an evidence-first review loop that feeds disposition decisions back into rule tuning.',
    },
    {
      q: 'Do you support API and batch?',
      a: 'Yes. Real-time API for payment flows and batch endpoints for periodic customer re-screening and data migrations.',
    },
    {
      q: 'What security controls exist?',
      a: 'RBAC with role separation, audit logs, encryption in transit and at rest, rotatable scoped API keys, and signed webhooks. SAML SSO for Enterprise plans is in development.',
    },
  ]
  const [open, setOpen] = useState<number | null>(0)
  return (
    <Section>
      <Container>
        <SectionHeader eyebrow="FAQ" title="Answers for teams evaluating AMLIQ." />
        <div className="mt-10 grid gap-3">
          {faqs.map((f, i) => {
            const isOpen = open === i
            return (
              <Card key={f.q} className="overflow-hidden">
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                >
                  <span className="text-sm font-semibold" style={{ color: tok.text }}>
                    {f.q}
                  </span>
                  <ChevronDown
                    className={cx('h-4 w-4 transition-transform', isOpen && 'rotate-180')}
                    style={{ color: tok.textMuted }}
                  />
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 text-sm" style={{ color: tok.textSec }}>
                    {f.a}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      </Container>
    </Section>
  )
}

// -----------------------------------------------------------------------------
// 12. FINAL CTA
// -----------------------------------------------------------------------------
export function FinalCTA() {
  return (
    <Section>
      <Container>
        <div
          className="overflow-hidden rounded-2xl px-6 py-12 sm:px-12 sm:py-16"
          style={{
            background: `linear-gradient(180deg, ${tok.surface} 0%, ${tok.bg2} 100%)`,
            border: `1px solid ${tok.border}`,
          }}
        >
          <div className="max-w-2xl">
            <div
              className="text-[11px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: tok.gold }}
            >
              Start
            </div>
            <h3
              className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl lg:text-4xl"
              style={{ color: tok.text }}
            >
              Move compliance checks to transaction speed.
            </h3>
            <p className="mt-3 text-sm sm:text-base" style={{ color: tok.textSec }}>
              Start in sandbox. Promote to production when your controls are approved.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button as="a" href="/signup" variant="primary" size="lg">
                Start screening <ArrowRight className="h-4 w-4" />
              </Button>
              <Button as="a" href="/contact" variant="secondary" size="lg">
                Book demo
              </Button>
              <Button as="a" href="/docs" variant="ghost" size="lg">
                Get API access
              </Button>
            </div>
          </div>
        </div>
      </Container>
    </Section>
  )
}

// re-exports for convenience
export { default as V2Layout } from './Layout'
