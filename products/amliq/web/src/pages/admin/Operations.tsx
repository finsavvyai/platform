import { useState, useRef, useEffect } from 'react'
import { Database, RefreshCw, Fingerprint, Globe, Wallet } from 'lucide-react'
import { PageHeader } from '../../components/layout/PageHeader'
import { TerminalBar, TermLine, BlinkingCursor, now } from './opsTerminal'
import { runTaskOp, runDirectOp } from './opsRunners'
import type { LogLine } from './opsTerminal'

const ops = [
  { id: 'migrate', name: 'migrate', label: 'Run Migrations',
    desc: 'Apply pending DB schema migrations', icon: Database,
    endpoint: '/admin/ops/migrate', color: '#2563EB', method: 'post' },
  { id: 'seed', name: 'seed_extra', label: 'Seed Extra',
    desc: 'Normalize & enrich entity metadata', icon: RefreshCw,
    endpoint: '/admin/ops/seed', color: '#10B981', method: 'post' },
  { id: 'sync-fp', name: 'sync_fingerprints', label: 'Sync Fingerprints',
    desc: 'Rebuild search fingerprint index', icon: Fingerprint,
    endpoint: '/admin/ops/sync-fingerprints', color: '#3B82F6', method: 'post' },
  { id: 'sync-crypto', name: 'sync_crypto', label: 'Sync Crypto Wallets',
    desc: 'Sync sanctioned wallet addresses (OFAC + NBCTF)', icon: Wallet,
    endpoint: '/admin/ops/sync-crypto', color: '#4F46E5', method: 'post' },
  { id: 'test-il', name: 'test_il_sources', label: 'Test IL Sources',
    desc: 'Test connectivity to Israeli gov sanctions sources', icon: Globe,
    endpoint: '/admin/ops/test-fetch', color: '#F472B6', method: 'get' },
] as const

export default function AdminOperations() {
  const [lines, setLines] = useState<LogLine[]>([
    { ts: now(), text: 'AMLIQ Admin Console v2.0 -- ready', type: 'out' },
  ])
  const [running, setRunning] = useState<string | null>(null)
  const termRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    termRef.current?.scrollTo(0, termRef.current.scrollHeight)
  }, [lines])

  const addLine = (text: string, type: LogLine['type'] = 'out') =>
    setLines(prev => [...prev, { ts: now(), text, type }])

  const runOp = async (op: typeof ops[number]) => {
    if (running) return
    setRunning(op.id)
    addLine(`$ amliq ${op.name}`, 'cmd')
    addLine(`Starting ${op.label}...`)
    try {
      if (op.method === 'get') await runDirectOp(op.endpoint, addLine)
      else await runTaskOp(op.endpoint, op.name, addLine)
    } catch (err) {
      addLine(err instanceof Error ? err.message : 'Request failed', 'err')
    } finally { setRunning(null) }
  }

  return (
    <div>
      <PageHeader title="Admin Operations"
        description="System maintenance console (admin only)" />
      <div className="flex flex-wrap gap-sm mb-lg">
        {ops.map(op => (
          <OpButton key={op.id} op={op} running={running} onClick={() => runOp(op)} />
        ))}
      </div>
      <div className="rounded-apple-lg overflow-hidden border"
        style={{ borderColor: 'var(--dash-border)', background: '#0D1117' }}>
        <TerminalBar />
        <div ref={termRef}
          className="p-md font-mono text-[13px] leading-relaxed overflow-y-auto
            max-h-[60vh] min-h-[300px] scroll-smooth"
          style={{ color: '#C9D1D9' }}>
          {lines.map((line, i) => <TermLine key={i} line={line} />)}
          {running && <BlinkingCursor />}
        </div>
      </div>
    </div>
  )
}

function OpButton({ op, running, onClick }: {
  op: typeof ops[number]; running: string | null; onClick: () => void
}) {
  const Icon = op.icon
  const active = running === op.id
  return (
    <button onClick={onClick} disabled={running !== null}
      className="flex items-center gap-sm px-lg py-sm rounded-apple-lg border
        hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed
        transition-all cursor-pointer min-h-[44px]"
      style={{ borderColor: active ? op.color : 'var(--dash-border)' }}>
      <Icon className="w-4 h-4" style={{ color: op.color }} />
      <span className="text-sm font-medium">{op.label}</span>
      {active && <span className="w-2 h-2 rounded-full animate-pulse"
        style={{ background: op.color }} />}
    </button>
  )
}
