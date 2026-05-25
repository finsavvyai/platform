import { useEffect, useState } from 'react'
import { Shield, Search, Fingerprint, Volume2, Hash, Sparkles, Network, Check } from 'lucide-react'

const LAYERS = [
  { icon: Search, label: 'Exact Match', desc: 'Unicode normalized comparison' },
  { icon: Fingerprint, label: 'Fuzzy Match', desc: 'Jaro-Winkler similarity' },
  { icon: Volume2, label: 'Phonetic', desc: 'Soundex + Double Metaphone' },
  { icon: Hash, label: 'Token Match', desc: 'Jaccard coefficient' },
  { icon: Sparkles, label: 'AI Embeddings', desc: 'pgvector semantic search' },
  { icon: Network, label: 'Graph', desc: 'Relationship traversal' },
] as const

interface Props {
  query: string
}

export function ScreeningProgress({ query }: Props) {
  const [activeLayer, setActiveLayer] = useState(0)
  const [completed, setCompleted] = useState<Set<number>>(new Set())

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveLayer(prev => {
        const next = prev + 1
        if (next >= LAYERS.length) {
          return 0
        }
        setCompleted(c => new Set([...c, prev]))
        return next
      })
    }, 120)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-xl">
        <div className="relative inline-flex items-center justify-center w-20 h-20 mb-md">
          <div className="absolute inset-0 rounded-full bg-[#C9A96E]/20 blur-2xl animate-pulse" />
          <div className="absolute inset-0 rounded-full border-2 border-[#C9A96E]/30 animate-ping" />
          <Shield className="relative w-10 h-10 text-[#C9A96E]" />
        </div>
        <h3 className="sf-headline mb-xs" style={{ color: 'var(--dash-text)' }}>Screening in Progress</h3>
        <p className="sf-caption text-apple-label-secondary">
          Analyzing <span className="text-[#C9A96E] font-medium">{query}</span> across 2.17M entities
        </p>
      </div>

      <div className="space-y-sm">
        {LAYERS.map((layer, i) => {
          const isActive = i === activeLayer
          const isDone = completed.has(i)
          const Icon = layer.icon
          return (
            <div key={i}
              className={`flex items-center gap-md p-md rounded-apple-md transition-all duration-300
                ${isActive ? 'bg-[#C9A96E]/10 border border-[#C9A96E]/30 scale-[1.02]' : ''}
                ${isDone && !isActive ? 'bg-[var(--dash-surface)] border border-[var(--dash-border)]' : ''}
                ${!isActive && !isDone ? 'border border-[var(--dash-border)]' : ''}
              `}>
              <div className={`flex items-center justify-center w-9 h-9 rounded-apple-md transition-all
                ${isActive ? 'bg-[#1A1814] text-white' : ''}
                ${isDone && !isActive ? 'bg-apple-green/15 text-apple-green' : ''}
                ${!isActive && !isDone ? 'bg-[var(--dash-surface)] text-apple-label-tertiary' : ''}
              `}>
                {isDone && !isActive ? <Check className="w-4 h-4" /> : <Icon className={`w-4 h-4 ${isActive ? 'animate-pulse' : ''}`} />}
              </div>
              <div className="flex-1">
                <p className={`text-sm font-medium transition-colors
                  ${isActive ? '' : 'text-apple-label-secondary'}`} style={isActive ? { color: 'var(--dash-text)' } : undefined}>
                  {layer.label}
                </p>
                <p className="text-xs text-apple-label-tertiary">{layer.desc}</p>
              </div>
              {isActive && (
                <div className="flex gap-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#1A1814] animate-pulse" />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#1A1814] animate-pulse" style={{ animationDelay: '0.2s' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#1A1814] animate-pulse" style={{ animationDelay: '0.4s' }} />
                </div>
              )}
              {isDone && !isActive && (
                <span className="text-xs text-apple-green font-medium">Done</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
