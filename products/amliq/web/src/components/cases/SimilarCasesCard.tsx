import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

interface SimilarCase {
  id: string
  entityName: string
  riskLevel: string
  similarity: number
}

const MOCK_CASES: SimilarCase[] = [
  { id: 'case_sim_001', entityName: 'Axiom Trade LLC', riskLevel: 'High', similarity: 0.91 },
  { id: 'case_sim_002', entityName: 'Vortex Capital Partners', riskLevel: 'Medium', similarity: 0.78 },
  { id: 'case_sim_003', entityName: 'Northgate Holdings', riskLevel: 'High', similarity: 0.72 },
]

function riskBadgeClass(level: string): string {
  if (level === 'High') return 'bg-red-500/15 text-red-400'
  if (level === 'Medium') return 'bg-amber-500/15 text-amber-400'
  return 'bg-green-500/15 text-green-400'
}

function SkeletonRow() {
  return (
    <div className="flex items-center justify-between py-3 border-b animate-pulse"
      style={{ borderColor: 'var(--dash-border)' }}>
      <div className="flex flex-col gap-1.5">
        <div className="h-3 w-32 rounded bg-white/10" />
        <div className="h-2.5 w-16 rounded bg-white/10" />
      </div>
      <div className="h-3 w-12 rounded bg-white/10" />
    </div>
  )
}

export function SimilarCasesCard() {
  const [loading, setLoading] = useState(true)
  const [cases, setCases] = useState<SimilarCase[]>([])

  useEffect(() => {
    const timer = setTimeout(() => {
      setCases(MOCK_CASES)
      setLoading(false)
    }, 800)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="glass-card p-6 rounded-apple-lg mt-6">
      <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--dash-text)' }}>
        Similar Cases
      </h2>

      {loading ? (
        <>
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </>
      ) : cases.length === 0 ? (
        <p className="text-sm py-4 text-center" style={{ color: 'var(--dash-text-secondary)' }}>
          No similar cases found
        </p>
      ) : (
        <div>
          {cases.map(c => (
            <div key={c.id}
              className="flex items-center justify-between py-3 border-b last:border-b-0"
              style={{ borderColor: 'var(--dash-border)' }}>
              <div className="flex flex-col gap-1">
                <Link
                  to={`/compliance/cases/${c.id}`}
                  className="text-sm font-medium hover:underline"
                  style={{ color: 'var(--dash-text)' }}
                >
                  {c.entityName}
                </Link>
                <span className={`text-xs px-2 py-0.5 rounded self-start ${riskBadgeClass(c.riskLevel)}`}>
                  {c.riskLevel}
                </span>
              </div>
              <span className="text-sm font-mono font-semibold text-[#C9A96E]">
                {(c.similarity * 100).toFixed(0)}% match
              </span>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs mt-4" style={{ color: 'var(--dash-text-secondary)' }}>
        Powered by semantic search
      </p>
    </div>
  )
}
