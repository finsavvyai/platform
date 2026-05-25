import { AlertTriangle, CheckCircle } from 'lucide-react'

interface Match {
  entity_name: string; list_id: string; confidence: number;
  layers: { layer: string; score: number }[];
}

interface Result {
  total_matches: number; processing_time_ms: number; matches: Match[];
}

export function SearchResultHeader({ result }: { result: Result }) {
  return (
    <div className="px-4 py-2 border-b border-token-gold/10 flex items-center justify-between">
      <span className="text-[10px] text-token-gold/60 uppercase tracking-widest">AMLIQ Live</span>
      <span className="text-[10px] text-slate-600 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 bg-token-surface rounded-full" />
        {result.processing_time_ms}ms - {result.total_matches} matches
      </span>
    </div>
  )
}

export function SearchMatch({ top, total }: { top: Match; total: number }) {
  return (
    <>
      <div className="px-4 pt-3 flex items-center justify-between">
        <div>
          <p className="text-slate-900 font-semibold text-sm">{top.entity_name}</p>
          <p className="text-token-gold/50 text-xs mt-0.5">{top.list_id}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-token-gold">{Math.round(top.confidence * 100)}%</p>
          <p className="text-[10px] text-slate-600">confidence</p>
        </div>
      </div>
      <div className="px-4 pt-3 grid grid-cols-4 gap-1.5">
        {(top.layers ?? []).slice(0, 4).map(l => (
          <div key={l.layer} className="text-center">
            <div className="h-1 rounded-full bg-white/10 mb-1 overflow-hidden">
              <div className="h-full rounded-full"
                style={{ width: `${l.score * 100}%`, background: 'linear-gradient(90deg, #C9A96E, #4F46E5)' }} />
            </div>
            <p className="text-[9px] text-slate-600">{l.layer}</p>
          </div>
        ))}
      </div>
      <div className="px-4 py-3 flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-500/10 border border-red-500/20 rounded text-xs font-semibold text-[#EF4444]">
          <AlertTriangle size={12} /> HIGH RISK
        </span>
        <span className="text-[10px] text-token-gold/40">{total} total matches</span>
      </div>
    </>
  )
}

export function SearchClear() {
  return (
    <div className="px-4 py-6 text-center">
      <CheckCircle size={24} className="text-token-gold mx-auto mb-2" />
      <p className="text-token-gold text-sm font-semibold">No Matches</p>
      <p className="text-[10px] text-slate-600 mt-1">Entity cleared against all lists</p>
    </div>
  )
}
