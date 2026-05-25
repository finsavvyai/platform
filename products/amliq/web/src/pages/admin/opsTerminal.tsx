import { ChevronRight, Terminal } from 'lucide-react'

export type LogLine = {
  ts: string
  text: string
  type: 'cmd' | 'out' | 'err' | 'ok'
}

export function TerminalBar() {
  return (
    <div className="flex items-center gap-sm px-md py-sm border-b border-white/10"
      style={{ background: '#161B22' }}>
      <div className="flex gap-[6px]">
        <span className="w-3 h-3 rounded-full bg-[#FF5F56]" />
        <span className="w-3 h-3 rounded-full bg-[#2563EB]" />
        <span className="w-3 h-3 rounded-full bg-[#10B981]" />
      </div>
      <div className="flex items-center gap-xs ml-md">
        <Terminal className="w-3.5 h-3.5 text-white/40" />
        <span className="text-xs text-white/40 font-mono">amliq-admin</span>
      </div>
    </div>
  )
}

export function TermLine({ line }: { line: LogLine }) {
  const colors: Record<LogLine['type'], string> = {
    cmd: '#2563EB', out: '#C9D1D9', err: '#F85149', ok: '#10B981',
  }
  return (
    <div className="flex gap-sm items-start">
      <span className="text-white/20 text-[11px] shrink-0 select-none w-[52px] text-right">
        {line.ts}
      </span>
      {line.type === 'cmd' && (
        <ChevronRight className="w-3.5 h-3.5 shrink-0 mt-[2px]"
          style={{ color: '#10B981' }} />
      )}
      <span style={{ color: colors[line.type] }}
        className={line.type === 'cmd' ? 'font-semibold' : ''}>
        {line.text}
      </span>
    </div>
  )
}

export function BlinkingCursor() {
  return (
    <div className="flex gap-sm items-center mt-xs">
      <span className="text-white/20 text-[11px] w-[52px] text-right select-none">
        {now()}
      </span>
      <ChevronRight className="w-3.5 h-3.5 text-[#10B981]" />
      <span className="w-2 h-4 bg-[#2563EB] animate-pulse rounded-sm" />
    </div>
  )
}

export function now() {
  return new Date().toLocaleTimeString('en-US', {
    hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}
