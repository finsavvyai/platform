import React, { useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  ChevronLeft,
  FileText,
  Home,
  Inbox,
  KeyRound,
  LayoutGrid,
  ListChecks,
  Menu,
  Search,
  Settings,
  ShieldCheck,
  X,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react'
import { Badge, Button, Card, Dot, MetricCard, cx, tok } from './ui'

type Decision = 'APPROVE' | 'REVIEW' | 'BLOCK'
type Row = {
  t: string
  id: string
  name: string
  country: string
  amount: string
  risk: number
  status: Decision
  analyst: 'new' | 'in review' | 'escalated' | 'resolved'
  list?: string
}

const ROWS: Row[] = [
  { t: '14:22:01', id: 'txn_9f2a83', name: 'Nikolai Petrov', country: 'RU', amount: '$48,200.00', risk: 87, status: 'REVIEW', analyst: 'in review', list: 'OFAC SDN' },
  { t: '14:21:57', id: 'txn_9f2a79', name: 'Acme Ltd', country: 'GB', amount: '$2,400.00', risk: 12, status: 'APPROVE', analyst: 'resolved' },
  { t: '14:21:49', id: 'txn_9f2a6d', name: 'Ying Chen', country: 'SG', amount: '$88,110.00', risk: 34, status: 'APPROVE', analyst: 'resolved' },
  { t: '14:21:42', id: 'txn_9f2a5c', name: 'Orbit FZE', country: 'AE', amount: '$152,900.00', risk: 71, status: 'REVIEW', analyst: 'new', list: 'EU Consolidated' },
  { t: '14:21:30', id: 'txn_9f2a48', name: 'Joao Silva', country: 'BR', amount: '$640.00', risk: 96, status: 'BLOCK', analyst: 'escalated', list: 'UN Sanctions' },
  { t: '14:21:15', id: 'txn_9f2a31', name: 'Hana Park', country: 'KR', amount: '$12,420.00', risk: 22, status: 'APPROVE', analyst: 'resolved' },
  { t: '14:21:02', id: 'txn_9f2a22', name: 'M. Rossi', country: 'IT', amount: '$4,890.00', risk: 45, status: 'REVIEW', analyst: 'in review', list: 'HMT OFSI' },
  { t: '14:20:51', id: 'txn_9f2a10', name: 'Astra Capital', country: 'US', amount: '$210,000.00', risk: 62, status: 'REVIEW', analyst: 'new', list: 'PEP Tier 1' },
]

const NAV = [
  { key: 'overview', label: 'Overview', icon: Home },
  { key: 'screenings', label: 'Screenings', icon: ListChecks },
  { key: 'cases', label: 'Cases', icon: Inbox },
  { key: 'analytics', label: 'Analytics', icon: BarChart3 },
  { key: 'audit', label: 'Audit Log', icon: FileText },
  { key: 'integrations', label: 'Integrations', icon: KeyRound },
  { key: 'settings', label: 'Settings', icon: Settings },
] as const

type NavKey = (typeof NAV)[number]['key']

export default function DashboardV2() {
  const [active, setActive] = useState<NavKey>('overview')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const selectedRow = useMemo(() => ROWS.find((r) => r.id === selectedId) ?? null, [selectedId])

  return (
    <div className="min-h-screen" style={{ background: tok.bg, color: tok.text }}>
      {/* Top bar */}
      <TopBar onMobileNav={() => setMobileNavOpen(true)} />

      <div className="flex">
        {/* Sidebar desktop */}
        <aside
          className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-60 shrink-0 lg:block"
          style={{ borderRight: `1px solid ${tok.borderMuted}`, background: tok.bg }}
        >
          <Sidebar active={active} onChange={setActive} />
        </aside>

        {/* Sidebar mobile */}
        {mobileNavOpen && (
          <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setMobileNavOpen(false)}>
            <div className="absolute inset-0 bg-black/60" />
            <div
              className="absolute left-0 top-0 h-full w-72"
              style={{ background: tok.bg, borderRight: `1px solid ${tok.borderMuted}` }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="flex h-14 items-center justify-between px-4"
                style={{ borderBottom: `1px solid ${tok.borderMuted}` }}
              >
                <span className="text-sm font-semibold">AMLIQ</span>
                <button onClick={() => setMobileNavOpen(false)} aria-label="Close">
                  <X className="h-5 w-5" style={{ color: tok.textMuted }} />
                </button>
              </div>
              <Sidebar
                active={active}
                onChange={(k) => {
                  setActive(k)
                  setMobileNavOpen(false)
                }}
              />
            </div>
          </div>
        )}

        {/* Main */}
        <main className="min-w-0 flex-1">
          {active === 'overview' && <OverviewView />}
          {active === 'screenings' && (
            <ScreeningsView selectedId={selectedId} onSelect={setSelectedId} />
          )}
          {active === 'cases' && <CasesView />}
          {active === 'analytics' && <AnalyticsView />}
          {active === 'audit' && <AuditView />}
          {active === 'integrations' && <SettingsView section="integrations" />}
          {active === 'settings' && <SettingsView section="settings" />}
        </main>

        {/* Details slide-over for screenings on desktop; slide-over everywhere on mobile */}
        {active === 'screenings' && selectedRow && (
          <CaseDetailsPanel row={selectedRow} onClose={() => setSelectedId(null)} />
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Top bar
// ---------------------------------------------------------------------------
function TopBar({ onMobileNav }: { onMobileNav: () => void }) {
  return (
    <header
      className="sticky top-0 z-40 flex h-14 items-center gap-3 px-4 sm:px-6"
      style={{ background: 'rgba(5,11,24,0.9)', backdropFilter: 'blur(8px)', borderBottom: `1px solid ${tok.borderMuted}` }}
    >
      <button
        className="lg:hidden"
        onClick={onMobileNav}
        aria-label="Menu"
        style={{ color: tok.textSec }}
      >
        <Menu className="h-5 w-5" />
      </button>
      <div className="flex items-center gap-2.5">
        <span
          className="flex h-7 w-7 items-center justify-center rounded-md text-[13px] font-bold"
          style={{ background: tok.gold, color: tok.bg }}
        >
          A
        </span>
        <span className="text-[14px] font-semibold tracking-tight text-white">AMLIQ</span>
        <Badge tone="gold" className="ml-1">
          Production
        </Badge>
      </div>

      <div className="mx-4 hidden max-w-md flex-1 sm:block">
        <div
          className="flex items-center gap-2 rounded-md px-3 py-2"
          style={{ background: tok.card, border: `1px solid ${tok.border}` }}
        >
          <Search className="h-4 w-4" style={{ color: tok.textMuted }} />
          <input
            placeholder="Search transaction, customer, case…"
            className="w-full bg-transparent text-sm outline-none"
            style={{ color: tok.text }}
          />
          <span className="font-mono text-[11px]" style={{ color: tok.textMuted }}>
            ⌘K
          </span>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button
          className="relative flex h-9 w-9 items-center justify-center rounded-md"
          style={{ border: `1px solid ${tok.border}`, color: tok.textSec }}
          aria-label="Alerts"
        >
          <Bell className="h-4 w-4" />
          <span
            className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full"
            style={{ background: tok.critical }}
          />
        </button>
        <Button variant="secondary">Export</Button>
        <Button variant="primary">
          New rule <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </header>
  )
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------
function Sidebar({ active, onChange }: { active: NavKey; onChange: (k: NavKey) => void }) {
  return (
    <nav className="flex h-full flex-col py-4">
      <div className="px-3">
        <div
          className="px-2 text-[11px] font-semibold uppercase tracking-[0.18em]"
          style={{ color: tok.textMuted }}
        >
          Workspace
        </div>
      </div>
      <ul className="mt-2 flex flex-col gap-0.5 px-3">
        {NAV.map((n) => {
          const isActive = n.key === active
          return (
            <li key={n.key}>
              <button
                onClick={() => onChange(n.key)}
                className={cx(
                  'flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                )}
                style={{
                  color: isActive ? tok.text : tok.textSec,
                  background: isActive ? 'rgba(198,168,90,0.08)' : 'transparent',
                  borderLeft: isActive ? `2px solid ${tok.gold}` : '2px solid transparent',
                }}
              >
                <n.icon className="h-4 w-4" />
                {n.label}
              </button>
            </li>
          )
        })}
      </ul>
      <div className="mt-auto px-3">
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <Dot color={tok.success} />
            <span className="text-xs font-medium" style={{ color: tok.text }}>
              All systems operational
            </span>
          </div>
          <div className="mt-1 text-[11px]" style={{ color: tok.textMuted }}>
            API · Webhooks · Lists
          </div>
        </Card>
      </div>
    </nav>
  )
}

// ---------------------------------------------------------------------------
// Overview view
// ---------------------------------------------------------------------------
function OverviewView() {
  return (
    <div className="p-5 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl" style={{ color: tok.text }}>
            Overview
          </h1>
          <p className="mt-1 text-sm" style={{ color: tok.textMuted }}>
            Operational snapshot · last 24h
          </p>
        </div>
        <div className="hidden items-center gap-2 sm:flex">
          <Badge tone="neutral">Env: Production</Badge>
          <Badge tone="success">
            <Dot color={tok.success} /> Healthy
          </Badge>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Screenings today" value="142,308" sub="+8.2% vs yesterday" />
        <MetricCard label="Flagged cases" value="1,284" sub="0.9% of total" />
        <MetricCard label="Approval rate" value="94.6%" sub="Rolling 24h" accent />
        <MetricCard label="Median latency" value="42ms" sub="P95 · 84ms" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold" style={{ color: tok.text }}>
              Screening volume
            </div>
            <Badge tone="neutral">Last 24h</Badge>
          </div>
          <MiniBarChart />
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold" style={{ color: tok.text }}>
              Recent alerts
            </div>
            <Badge tone="warning">4 open</Badge>
          </div>
          <ul className="mt-4 space-y-3">
            {[
              { i: AlertTriangle, c: tok.warning, t: 'High-risk transaction · txn_9f2a83', sub: '2m ago · OFAC SDN match' },
              { i: ShieldCheck, c: tok.success, t: 'Rule update applied', sub: '14m ago · sdn_threshold → 0.85' },
              { i: Activity, c: tok.info, t: 'Webhook latency elevated', sub: '22m ago · p95 620ms' },
              { i: CheckCircle2, c: tok.success, t: 'Daily screening batch complete', sub: '1h ago · 12.4M records' },
            ].map((a, i) => (
              <li key={i} className="flex items-start gap-3">
                <div
                  className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-md"
                  style={{ background: `${a.c}1a` }}
                >
                  <a.i className="h-3.5 w-3.5" style={{ color: a.c }} />
                </div>
                <div className="min-w-0">
                  <div className="text-sm" style={{ color: tok.text }}>
                    {a.t}
                  </div>
                  <div className="text-[11px]" style={{ color: tok.textMuted }}>
                    {a.sub}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: tok.textMuted }}>
            System health
          </div>
          <ul className="mt-4 space-y-2.5 text-sm">
            {[
              { k: 'API', v: 'Operational', c: tok.success },
              { k: 'Webhooks', v: 'Operational', c: tok.success },
              { k: 'Watchlist updates', v: 'Degraded · EU', c: tok.warning },
              { k: 'Batch processor', v: 'Operational', c: tok.success },
            ].map((r) => (
              <li key={r.k} className="flex items-center justify-between">
                <span style={{ color: tok.textSec }}>{r.k}</span>
                <span className="inline-flex items-center gap-2 text-xs" style={{ color: tok.text }}>
                  <Dot color={r.c} /> {r.v}
                </span>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-5 lg:col-span-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: tok.textMuted }}>
            Decision distribution · last 24h
          </div>
          <DecisionBars />
        </Card>
      </div>
    </div>
  )
}

function MiniBarChart() {
  const bars = [12, 18, 22, 15, 28, 34, 30, 26, 33, 40, 46, 42, 38, 44, 50, 47, 44, 52, 58, 60, 55, 48, 44, 41]
  const max = Math.max(...bars)
  return (
    <div className="mt-5 flex h-36 items-end gap-1.5">
      {bars.map((b, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1">
          <div
            className="w-full rounded-sm"
            style={{
              height: `${(b / max) * 100}%`,
              background:
                i === bars.length - 3
                  ? tok.gold
                  : 'rgba(198,168,90,0.22)',
            }}
          />
        </div>
      ))}
    </div>
  )
}

function DecisionBars() {
  const segs = [
    { k: 'Approve', v: 94.6, c: tok.success },
    { k: 'Review', v: 4.5, c: tok.warning },
    { k: 'Block', v: 0.9, c: tok.critical },
  ]
  return (
    <div className="mt-5">
      <div
        className="flex h-3 overflow-hidden rounded-full"
        style={{ background: 'rgba(255,255,255,0.04)' }}
      >
        {segs.map((s) => (
          <div key={s.k} style={{ width: `${s.v}%`, background: s.c }} />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-4">
        {segs.map((s) => (
          <div key={s.k}>
            <div className="flex items-center gap-2 text-xs" style={{ color: tok.textSec }}>
              <Dot color={s.c} /> {s.k}
            </div>
            <div className="mt-1 text-lg font-semibold tabular-nums" style={{ color: tok.text }}>
              {s.v}%
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Screenings view
// ---------------------------------------------------------------------------
function ScreeningsView({
  selectedId,
  onSelect,
}: {
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const [filter, setFilter] = useState<'all' | Decision>('all')
  const rows = filter === 'all' ? ROWS : ROWS.filter((r) => r.status === filter)
  return (
    <div className="p-5 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl" style={{ color: tok.text }}>
            Screenings
          </h1>
          <p className="mt-1 text-sm" style={{ color: tok.textMuted }}>
            Realtime screening events · click a row to review
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(['all', 'APPROVE', 'REVIEW', 'BLOCK'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="rounded-md px-3 py-1.5 text-xs font-medium"
              style={{
                color: filter === f ? tok.text : tok.textSec,
                background: filter === f ? 'rgba(198,168,90,0.08)' : 'transparent',
                border: `1px solid ${filter === f ? 'rgba(198,168,90,0.28)' : tok.border}`,
              }}
            >
              {f === 'all' ? 'All' : f}
            </button>
          ))}
        </div>
      </div>

      <Card className="mt-6 overflow-hidden">
        {/* Desktop table */}
        <div className="hidden md:block">
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr
                className="text-left text-[11px] font-semibold uppercase tracking-[0.14em]"
                style={{ color: tok.textMuted, background: 'rgba(255,255,255,0.02)' }}
              >
                <Th>Time</Th>
                <Th>Transaction</Th>
                <Th>Customer</Th>
                <Th>Country</Th>
                <Th className="text-right">Amount</Th>
                <Th className="text-right">Risk</Th>
                <Th>Match</Th>
                <Th>Decision</Th>
                <Th>Analyst</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const sel = r.id === selectedId
                return (
                  <tr
                    key={r.id}
                    onClick={() => onSelect(r.id)}
                    className="cursor-pointer hover:bg-white/[0.02]"
                    style={{
                      borderTop: `1px solid ${tok.borderMuted}`,
                      background: sel ? 'rgba(198,168,90,0.06)' : 'transparent',
                    }}
                  >
                    <Td mono muted>
                      {r.t}
                    </Td>
                    <Td>
                      <div className="font-mono text-xs" style={{ color: tok.text }}>
                        {r.id}
                      </div>
                    </Td>
                    <Td>{r.name}</Td>
                    <Td muted>{r.country}</Td>
                    <Td className="text-right">{r.amount}</Td>
                    <Td className="text-right">
                      <RiskInline score={r.risk} />
                    </Td>
                    <Td>{r.list ? <Badge tone="neutral">{r.list}</Badge> : <span style={{ color: tok.textMuted }}>—</span>}</Td>
                    <Td>
                      <DecisionPill s={r.status} />
                    </Td>
                    <Td>
                      <AnalystPill s={r.analyst} />
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile card rows */}
        <ul className="divide-y md:hidden" style={{ borderColor: tok.borderMuted }}>
          {rows.map((r) => (
            <li
              key={r.id}
              onClick={() => onSelect(r.id)}
              className="flex cursor-pointer flex-col gap-2 p-4"
              style={{ borderColor: tok.borderMuted }}
            >
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold" style={{ color: tok.text }}>
                  {r.name}
                </div>
                <DecisionPill s={r.status} />
              </div>
              <div className="flex items-center justify-between text-xs" style={{ color: tok.textSec }}>
                <span className="font-mono">{r.id}</span>
                <span>{r.amount}</span>
              </div>
              <div className="flex items-center justify-between text-xs" style={{ color: tok.textMuted }}>
                <span className="font-mono">{r.t}</span>
                <RiskInline score={r.risk} />
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={cx('px-4 py-3', className)}>{children}</th>
}
function Td({
  children,
  className = '',
  mono,
  muted,
}: {
  children: React.ReactNode
  className?: string
  mono?: boolean
  muted?: boolean
}) {
  return (
    <td
      className={cx('px-4 py-3 align-middle', mono && 'font-mono text-xs', className)}
      style={{ color: muted ? tok.textMuted : tok.text }}
    >
      {children}
    </td>
  )
}

function RiskInline({ score }: { score: number }) {
  const color = score >= 75 ? tok.critical : score >= 40 ? tok.warning : tok.success
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-1.5 w-12 overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <span className="block h-full" style={{ width: `${score}%`, background: color }} />
      </span>
      <span className="font-mono text-xs" style={{ color: tok.text }}>
        {score}
      </span>
    </span>
  )
}

function DecisionPill({ s }: { s: Decision }) {
  if (s === 'APPROVE') return <Badge tone="success">APPROVE</Badge>
  if (s === 'REVIEW') return <Badge tone="warning">REVIEW</Badge>
  return <Badge tone="critical">BLOCK</Badge>
}

function AnalystPill({ s }: { s: Row['analyst'] }) {
  const map: Record<Row['analyst'], React.ReactNode> = {
    new: <Badge tone="info">New</Badge>,
    'in review': <Badge tone="neutral">In review</Badge>,
    escalated: <Badge tone="critical">Escalated</Badge>,
    resolved: <Badge tone="success">Resolved</Badge>,
  }
  return map[s]
}

// ---------------------------------------------------------------------------
// Case details panel (slide-over)
// ---------------------------------------------------------------------------
function CaseDetailsPanel({ row, onClose }: { row: Row; onClose: () => void }) {
  return (
    <>
      {/* Desktop fixed panel */}
      <aside
        className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-[420px] shrink-0 overflow-y-auto xl:block"
        style={{
          borderLeft: `1px solid ${tok.borderMuted}`,
          background: tok.bg,
        }}
      >
        <CaseDetails row={row} onClose={onClose} />
      </aside>

      {/* Mobile/tablet slide-over */}
      <div className="fixed inset-0 z-40 xl:hidden" onClick={onClose}>
        <div className="absolute inset-0 bg-black/60" />
        <aside
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto"
          style={{ background: tok.bg, borderLeft: `1px solid ${tok.borderMuted}` }}
        >
          <CaseDetails row={row} onClose={onClose} />
        </aside>
      </div>
    </>
  )
}

function CaseDetails({ row, onClose }: { row: Row; onClose: () => void }) {
  return (
    <div>
      <div
        className="sticky top-0 z-10 flex items-center justify-between px-5 py-3"
        style={{ background: tok.bg, borderBottom: `1px solid ${tok.borderMuted}` }}
      >
        <div className="flex items-center gap-2">
          <button onClick={onClose} aria-label="Close" style={{ color: tok.textSec }}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="font-mono text-xs" style={{ color: tok.text }}>
            {row.id}
          </div>
        </div>
        <DecisionPill s={row.status} />
      </div>

      <div className="space-y-6 p-5">
        <section>
          <SectionTitle>Summary</SectionTitle>
          <div className="mt-3 grid gap-2.5 text-sm">
            <KV k="Customer" v={row.name} />
            <KV k="Country" v={row.country} />
            <KV k="Amount" v={row.amount} />
            <KV k="Time" v={row.t} />
            <KV k="Risk" v={String(row.risk)} mono />
          </div>
        </section>

        <section>
          <SectionTitle>Match evidence</SectionTitle>
          <Card className="mt-3 p-4">
            <div className="flex items-center justify-between">
              <Badge tone="gold">{row.list ?? 'Internal rule'}</Badge>
              <span className="font-mono text-xs" style={{ color: tok.textMuted }}>
                conf 0.87
              </span>
            </div>
            <ul className="mt-3 space-y-2 text-xs" style={{ color: tok.textSec }}>
              <EvLine field="Name" value={row.name} />
              <EvLine field="DOB" value="1972-04-12" />
              <EvLine field="Nationality" value={row.country} />
              <EvLine field="ID document" value="PP-78A12···3" />
            </ul>
          </Card>
        </section>

        <section>
          <SectionTitle>Transaction metadata</SectionTitle>
          <div className="mt-3 grid gap-2.5 text-sm">
            <KV k="Corridor" v="DE → AE" />
            <KV k="Method" v="SWIFT MT103" />
            <KV k="Correlation" v="crl_7x9a2" mono />
          </div>
        </section>

        <section>
          <SectionTitle>Notes</SectionTitle>
          <textarea
            placeholder="Add a note for the next reviewer…"
            rows={3}
            className="mt-3 w-full rounded-md p-3 text-sm outline-none"
            style={{
              background: tok.card,
              border: `1px solid ${tok.border}`,
              color: tok.text,
            }}
          />
        </section>

        <section>
          <SectionTitle>Disposition</SectionTitle>
          <div className="mt-3 flex gap-2">
            <Button size="md" variant="secondary" className="flex-1">
              Clear
            </Button>
            <Button size="md" variant="secondary" className="flex-1">
              Escalate
            </Button>
            <Button size="md" variant="primary" className="flex-1">
              Block
            </Button>
          </div>
          <p className="mt-2 text-[11px]" style={{ color: tok.textMuted }}>
            All actions are signed and written to the immutable audit log.
          </p>
        </section>
      </div>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="text-[11px] font-semibold uppercase tracking-[0.14em]"
      style={{ color: tok.textMuted }}
    >
      {children}
    </div>
  )
}
function KV({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span style={{ color: tok.textMuted }}>{k}</span>
      <span className={cx(mono && 'font-mono text-xs', 'tabular-nums')} style={{ color: tok.text }}>
        {v}
      </span>
    </div>
  )
}
function EvLine({ field, value }: { field: string; value: string }) {
  return (
    <li className="flex items-center justify-between">
      <span style={{ color: tok.textMuted }}>{field}</span>
      <span className="tabular-nums" style={{ color: tok.text }}>
        {value}
      </span>
    </li>
  )
}

// ---------------------------------------------------------------------------
// Cases view (kanban-lite list)
// ---------------------------------------------------------------------------
function CasesView() {
  const groups: { key: Row['analyst']; label: string }[] = [
    { key: 'new', label: 'New' },
    { key: 'in review', label: 'In review' },
    { key: 'escalated', label: 'Escalated' },
    { key: 'resolved', label: 'Resolved' },
  ]
  return (
    <div className="p-5 sm:p-6 lg:p-8">
      <h1 className="text-xl font-semibold tracking-tight sm:text-2xl" style={{ color: tok.text }}>
        Cases
      </h1>
      <p className="mt-1 text-sm" style={{ color: tok.textMuted }}>
        Analyst queue · SLA timers and disposition
      </p>

      <div className="mt-6 grid gap-4 lg:grid-cols-4">
        {groups.map((g) => {
          const items = ROWS.filter((r) => r.analyst === g.key)
          return (
            <Card key={g.key} className="overflow-hidden">
              <div
                className="flex items-center justify-between px-4 py-3"
                style={{ borderBottom: `1px solid ${tok.borderMuted}` }}
              >
                <div className="text-sm font-semibold" style={{ color: tok.text }}>
                  {g.label}
                </div>
                <Badge tone="neutral">{items.length}</Badge>
              </div>
              <ul className="divide-y" style={{ borderColor: tok.borderMuted }}>
                {items.map((r) => (
                  <li key={r.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium" style={{ color: tok.text }}>
                        {r.name}
                      </span>
                      <DecisionPill s={r.status} />
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[11px]" style={{ color: tok.textMuted }}>
                      <span className="font-mono">{r.id}</span>
                      <span>{r.amount}</span>
                    </div>
                  </li>
                ))}
                {items.length === 0 && (
                  <li className="p-4 text-xs" style={{ color: tok.textMuted }}>
                    No items
                  </li>
                )}
              </ul>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Analytics view
// ---------------------------------------------------------------------------
function AnalyticsView() {
  return (
    <div className="p-5 sm:p-6 lg:p-8">
      <h1 className="text-xl font-semibold tracking-tight sm:text-2xl" style={{ color: tok.text }}>
        Risk analytics
      </h1>
      <p className="mt-1 text-sm" style={{ color: tok.textMuted }}>
        Trends · latency · geographic distribution
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Flagged volume · 24h" value="1,284" sub="+6.1%" />
        <MetricCard label="False positive trend" value="−3.8%" sub="Rolling 7d" accent />
        <MetricCard label="Screening latency p95" value="84ms" sub="SLO · 100ms" />
        <MetricCard label="Active watchlists" value="47" sub="Last sync 2m ago" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="text-sm font-semibold" style={{ color: tok.text }}>
            Geographic risk
          </div>
          <ul className="mt-4 space-y-3 text-sm">
            {[
              { c: 'Russia', pct: 82 },
              { c: 'UAE', pct: 61 },
              { c: 'Iran', pct: 74 },
              { c: 'Cyprus', pct: 52 },
              { c: 'Panama', pct: 48 },
            ].map((g) => (
              <li key={g.c} className="flex items-center gap-3">
                <span className="w-24" style={{ color: tok.textSec }}>
                  {g.c}
                </span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <span className="block h-full" style={{ width: `${g.pct}%`, background: tok.gold }} />
                </span>
                <span className="w-10 text-right font-mono text-xs" style={{ color: tok.text }}>
                  {g.pct}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5">
          <div className="text-sm font-semibold" style={{ color: tok.text }}>
            List hit categories
          </div>
          <ul className="mt-4 grid grid-cols-2 gap-3">
            {[
              { k: 'OFAC SDN', v: '512' },
              { k: 'UN Sanctions', v: '214' },
              { k: 'EU Consolidated', v: '186' },
              { k: 'HMT OFSI', v: '92' },
              { k: 'PEP Tier 1', v: '148' },
              { k: 'Internal rules', v: '132' },
            ].map((x) => (
              <li
                key={x.k}
                className="flex items-center justify-between rounded-md px-3 py-2"
                style={{ background: tok.card, border: `1px solid ${tok.border}` }}
              >
                <span className="text-sm" style={{ color: tok.textSec }}>
                  {x.k}
                </span>
                <span className="font-mono text-xs" style={{ color: tok.text }}>
                  {x.v}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Audit log view
// ---------------------------------------------------------------------------
function AuditView() {
  const events = [
    { t: '14:22:01.461', actor: 'engine.v3.2', action: 'escalated', target: 'txn_9f2a83' },
    { t: '14:22:01.448', actor: 'engine.v3.2', action: 'matched', target: 'txn_9f2a83' },
    { t: '14:22:01.412', actor: 'api.analyst@amliq', action: 'screened', target: 'txn_9f2a83' },
    { t: '14:20:12.001', actor: 'admin@amliq', action: 'rule_updated', target: 'sdn_threshold' },
    { t: '14:18:55.233', actor: 'api.partner@orbitpay', action: 'screened', target: 'txn_9f2a22' },
    { t: '14:15:02.100', actor: 'engine.v3.2', action: 'cleared', target: 'txn_9f2a79' },
    { t: '14:11:47.820', actor: 'analyst@amliq', action: 'reviewed', target: 'txn_9f2a5c' },
    { t: '14:09:33.512', actor: 'engine.v3.2', action: 'blocked', target: 'txn_9f2a48' },
  ]
  const color: Record<string, string> = {
    screened: tok.info,
    matched: tok.warning,
    escalated: tok.critical,
    reviewed: tok.info,
    cleared: tok.success,
    blocked: tok.critical,
    rule_updated: tok.gold,
  }
  return (
    <div className="p-5 sm:p-6 lg:p-8">
      <h1 className="text-xl font-semibold tracking-tight sm:text-2xl" style={{ color: tok.text }}>
        Audit log
      </h1>
      <p className="mt-1 text-sm" style={{ color: tok.textMuted }}>
        Immutable event history · export gated by role
      </p>

      <Card className="mt-6 overflow-hidden">
        <ul>
          {events.map((e, i) => (
            <li
              key={i}
              className="grid grid-cols-[130px_1fr_auto] items-center gap-3 px-4 py-3 sm:grid-cols-[170px_140px_1fr_auto]"
              style={{ borderTop: i === 0 ? 'none' : `1px solid ${tok.borderMuted}` }}
            >
              <span className="font-mono text-xs" style={{ color: tok.textMuted }}>
                {e.t}
              </span>
              <span className="hidden font-mono text-xs sm:block" style={{ color: tok.textSec }}>
                {e.actor}
              </span>
              <span className="inline-flex items-center gap-2 text-sm" style={{ color: tok.text }}>
                <Dot color={color[e.action] ?? tok.textMuted} />
                <span className="font-mono text-xs uppercase tracking-wider" style={{ color: tok.textSec }}>
                  {e.action}
                </span>
                <span className="font-mono text-xs" style={{ color: tok.text }}>
                  {e.target}
                </span>
              </span>
              <button
                className="text-xs hover:text-white"
                style={{ color: tok.textMuted }}
              >
                view payload
              </button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Settings + Integrations
// ---------------------------------------------------------------------------
function SettingsView({ section }: { section: 'integrations' | 'settings' }) {
  return (
    <div className="p-5 sm:p-6 lg:p-8">
      <h1 className="text-xl font-semibold tracking-tight sm:text-2xl" style={{ color: tok.text }}>
        {section === 'integrations' ? 'Integrations' : 'Settings'}
      </h1>
      <p className="mt-1 text-sm" style={{ color: tok.textMuted }}>
        {section === 'integrations'
          ? 'API keys, webhooks, and downstream systems'
          : 'Team, roles, notifications and rules'}
      </p>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold" style={{ color: tok.text }}>
              API keys
            </div>
            <Button variant="secondary" size="md">
              Create key
            </Button>
          </div>
          <ul className="mt-4 divide-y" style={{ borderColor: tok.borderMuted }}>
            {[
              { name: 'sk_live_prod_primary', used: '12s ago', env: 'Production' },
              { name: 'sk_live_prod_backup', used: '4h ago', env: 'Production' },
              { name: 'sk_test_sandbox', used: '2d ago', env: 'Sandbox' },
            ].map((k) => (
              <li key={k.name} className="flex items-center justify-between py-3" style={{ borderColor: tok.borderMuted }}>
                <div>
                  <div className="font-mono text-xs" style={{ color: tok.text }}>
                    {k.name}
                  </div>
                  <div className="text-[11px]" style={{ color: tok.textMuted }}>
                    Last used {k.used}
                  </div>
                </div>
                <Badge tone={k.env === 'Production' ? 'gold' : 'neutral'}>{k.env}</Badge>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold" style={{ color: tok.text }}>
              Webhooks
            </div>
            <Button variant="secondary" size="md">
              Add endpoint
            </Button>
          </div>
          <ul className="mt-4 divide-y" style={{ borderColor: tok.borderMuted }}>
            {[
              { url: 'https://api.orbitpay.io/amliq/events', status: 'active', c: tok.success },
              { url: 'https://hooks.northbank.com/compliance', status: 'degraded', c: tok.warning },
            ].map((w) => (
              <li key={w.url} className="flex items-center justify-between py-3" style={{ borderColor: tok.borderMuted }}>
                <div className="min-w-0">
                  <div className="truncate font-mono text-xs" style={{ color: tok.text }}>
                    {w.url}
                  </div>
                  <div className="text-[11px]" style={{ color: tok.textMuted }}>
                    screening.decisioned · screening.matched
                  </div>
                </div>
                <span className="inline-flex items-center gap-2 text-xs" style={{ color: tok.text }}>
                  <Dot color={w.c} /> {w.status}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <div className="text-sm font-semibold" style={{ color: tok.text }}>
            Team roles
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="text-left text-[11px] font-semibold uppercase tracking-[0.14em]"
                  style={{ color: tok.textMuted }}
                >
                  <th className="py-2">Member</th>
                  <th className="py-2">Role</th>
                  <th className="py-2">Last active</th>
                  <th className="py-2 text-right">MFA</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { n: 'lena@amliq.com', r: 'Admin', a: '2m ago', mfa: true },
                  { n: 'markus@amliq.com', r: 'Approver', a: '14m ago', mfa: true },
                  { n: 'yui@amliq.com', r: 'Analyst', a: '1h ago', mfa: true },
                  { n: 'devops@amliq.com', r: 'Engineer', a: '3h ago', mfa: false },
                ].map((m) => (
                  <tr key={m.n} style={{ borderTop: `1px solid ${tok.borderMuted}` }}>
                    <td className="py-3" style={{ color: tok.text }}>
                      {m.n}
                    </td>
                    <td className="py-3">
                      <Badge tone={m.r === 'Admin' ? 'gold' : 'neutral'}>{m.r}</Badge>
                    </td>
                    <td className="py-3 font-mono text-xs" style={{ color: tok.textMuted }}>
                      {m.a}
                    </td>
                    <td className="py-3 text-right">
                      {m.mfa ? <Badge tone="success">On</Badge> : <Badge tone="critical">Off</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  )
}

// Unused imports guard (in case of tree shaking)
export const _icons = { LayoutGrid }
