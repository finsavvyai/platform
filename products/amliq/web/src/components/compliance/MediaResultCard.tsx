import { useTranslation } from 'react-i18next'

interface MediaHit {
  id: string
  entity_name: string
  category: string
  categories: string[]
  title: string
  snippet: string
  url: string
  risk_score: number
  severity: number
  review_status: string
}

interface Props {
  hit: MediaHit
  onReview: (id: string, status: string) => void
}

const categoryColors: Record<string, string> = {
  financial_crime: 'bg-apple-red/20 text-apple-red',
  money_laundering: 'bg-apple-red/20 text-apple-red',
  terrorism: 'bg-apple-red/30 text-apple-red',
  fraud: 'bg-apple-orange/20 text-apple-orange',
  bribery_corruption: 'bg-apple-orange/20 text-apple-orange',
  bribery: 'bg-apple-orange/20 text-apple-orange',
  sanctions: 'bg-apple-red/20 text-apple-red',
  tax_evasion: 'bg-apple-yellow/20 text-apple-yellow',
  cybercrime: 'bg-apple-purple/20 text-apple-purple',
  regulatory_action: 'bg-[#C9A96E]/20 text-[#C9A96E]',
}

function riskColor(score: number): string {
  if (score >= 0.8) return 'text-apple-red'
  if (score >= 0.5) return 'text-apple-orange'
  return 'text-apple-green'
}

export function MediaResultCard({ hit, onReview }: Props) {
  const { t } = useTranslation('compliance')
  const cats = hit.categories ?? (hit.category ? [hit.category] : [])
  const score = hit.risk_score ?? (hit.severity / 10)

  return (
    <div className="card-vibrancy p-4">
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1">
          <a href={hit.url} target="_blank" rel="noopener noreferrer"
            aria-label={`${t('adverse_media.view_article')}: ${hit.title}`}
            className="font-medium text-[#C9A96E] hover:underline">
            {hit.title}
          </a>
          {hit.entity_name && (
            <span className="ml-2 text-xs text-apple-label-tertiary">{hit.entity_name}</span>
          )}
        </div>
        <span className={`text-sm font-medium ${riskColor(score)}`}>
          {(score * 100).toFixed(0)}%
        </span>
      </div>
      {hit.snippet && <p className="text-sm text-apple-label-secondary mb-2">{hit.snippet}</p>}
      <div className="flex gap-2 text-xs mb-3 flex-wrap">
        {cats.map(c => (
          <span key={c} className={`px-2 py-0.5 rounded ${
            categoryColors[c] || 'bg-apple-bg-tertiary text-apple-label-secondary'}`}>
            {c.replace(/_/g, ' ').replace(/\b\w/g, m => m.toUpperCase())}
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <button onClick={() => onReview(hit.id, 'relevant')}
          className="px-3 py-1 text-xs bg-apple-red/20 text-apple-red rounded cursor-pointer hover:opacity-80">
          {t('adverse_media.relevant')}
        </button>
        <button onClick={() => onReview(hit.id, 'irrelevant')}
          className="px-3 py-1 text-xs bg-apple-green/20 text-apple-green rounded cursor-pointer hover:opacity-80">
          {t('adverse_media.irrelevant')}
        </button>
        <button onClick={() => onReview(hit.id, 'escalated')}
          className="px-3 py-1 text-xs bg-apple-orange/20 text-apple-orange rounded cursor-pointer hover:opacity-80">
          {t('adverse_media.escalate')}
        </button>
      </div>
    </div>
  )
}
