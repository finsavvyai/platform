import { useState } from 'react'
import { Search } from 'lucide-react'
import { SearchResultHeader, SearchMatch, SearchClear } from './HeroSearchResult'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080'

interface Match {
  entity_name: string; list_id: string; confidence: number;
  layers: { layer: string; score: number }[];
}
interface Result {
  total_matches: number; processing_time_ms: number; matches: Match[];
}

export default function HeroSearch() {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const [loading, setLoading] = useState(false)

  const search = async () => {
    if (!query.trim()) return
    setLoading(true)
    try {
      const resp = await fetch(`${API_BASE}/api/v1/screen/public-demo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: query.trim() }),
      })
      const json = await resp.json()
      setResult(json.data ?? json)
    } catch { setResult(null) }
    finally { setLoading(false) }
  }

  const handleKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter') search() }
  const top = result?.matches?.[0]

  return (
    <div className="max-w-2xl mx-auto mt-14 font-mono">
      <div className="relative">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'color-mix(in srgb, var(--accent-gold) 60%, transparent)' }} />
        <input type="text" value={query}
          onChange={e => setQuery(e.target.value)} onKeyDown={handleKey}
          placeholder="Try it: Vladimir Putin, HAMAS, Sberbank..."
          className="w-full bg-white/[0.03] border rounded-lg pl-11 pr-24 py-3 text-sm focus:outline-none min-h-[44px]"
          style={{ borderColor: 'color-mix(in srgb, var(--accent-gold) 20%, transparent)', color: 'color-mix(in srgb, var(--text) 85%, transparent)', boxShadow: '0 0 10px rgba(245,158,11,0.05)' }} />
        <button onClick={search} disabled={loading || !query.trim()}
          className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 text-xs font-semibold rounded-md disabled:opacity-40 cursor-pointer min-h-[44px]"
          style={{ background: 'var(--accent-gold)', color: '#1A1814' }}>
          {loading ? '...' : 'Screen'}
        </button>
      </div>
      {result && (
        <div className="mt-3 rounded-lg border overflow-hidden bg-white/[0.02]" style={{ borderColor: 'color-mix(in srgb, var(--accent-gold) 15%, transparent)' }}>
          <SearchResultHeader result={result} />
          {top ? <SearchMatch top={top} total={result.total_matches} /> : <SearchClear />}
        </div>
      )}
    </div>
  )
}
