import { Card } from '../ui/Card'

interface RiskResult {
  composite_score: number
  risk_level: string
  factors: string[]
  breakdown: Record<string, number>
}

const levelColor: Record<string, string> = {
  critical: 'text-red-500', high: 'text-amber-500',
  medium: 'text-[#C9A96E]', low: 'text-emerald-500',
}

export function RiskResultCard({ result, t }: {
  result: RiskResult
  t: (k: string) => string
}) {
  return (
    <Card>
      <div className="flex items-baseline gap-md mb-lg">
        <span className="text-4xl font-bold sf-title">
          {(result.composite_score * 100).toFixed(0)}
        </span>
        <span className={`text-lg font-medium ${levelColor[result.risk_level]}`}>
          {result.risk_level.toUpperCase()}
        </span>
      </div>
      {(result.factors ?? []).length > 0 && (
        <div className="mb-lg">
          <p className="sf-caption mb-sm" style={{ color: 'var(--dash-text-secondary)' }}>
            {t('risk.risk_factors')}
          </p>
          <div className="flex flex-wrap gap-sm">
            {result.factors.map(f => (
              <span key={f} className="px-2 py-0.5 bg-red-500/15 text-red-500 text-xs rounded">
                {f}
              </span>
            ))}
          </div>
        </div>
      )}
      <div>
        <p className="sf-caption mb-sm" style={{ color: 'var(--dash-text-secondary)' }}>
          {t('risk.score_breakdown')}
        </p>
        {Object.entries(result.breakdown).map(([k, v]) => (
          <div key={k} className="flex justify-between text-sm py-sm border-b"
            style={{ borderColor: 'var(--dash-border)' }}>
            <span className="capitalize">{k.replace(/_/g, ' ')}</span>
            <span>{(v * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </Card>
  )
}
