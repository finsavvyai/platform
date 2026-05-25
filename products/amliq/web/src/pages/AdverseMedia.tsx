import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import { MediaResultCard } from '../components/compliance/MediaResultCard'
import { PageHeader } from '../components/layout/PageHeader'

function titleize(raw: string): string {
  return raw.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

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
  detected_at: string
}

const CATEGORIES = [
  'fraud', 'money_laundering', 'terrorism', 'sanctions',
  'bribery', 'tax_evasion', 'cybercrime', 'human_trafficking',
  'drug_trafficking', 'corruption',
]

export function AdverseMedia() {
  const { t } = useTranslation('compliance')
  const [hits, setHits] = useState<MediaHit[]>([])
  const [searchName, setSearchName] = useState('')
  const [activeFilter, setActiveFilter] = useState<string | null>(null)

  useEffect(() => {
    api.get<{ hits: MediaHit[] }>('/media/unreviewed')
      .then(d => setHits(d?.hits ?? []))
      .catch(() => setHits([]))
  }, [])

  const handleScan = async () => {
    if (!searchName.trim()) return
    const d = await api.post<{ hits: MediaHit[] }>('/media/scan', { entity_name: searchName })
    setHits(d?.hits ?? [])
  }

  const handleReview = async (hitId: string, status: string) => {
    await api.put(`/media/results/${hitId}/review`, { status })
    setHits(prev => prev.filter(h => h.id !== hitId))
  }

  const filtered = activeFilter
    ? hits.filter(h => h.category === activeFilter || h.categories?.includes(activeFilter!))
    : hits

  return (
    <div className="px-md py-lg sm:p-8 max-w-6xl mx-auto">
      <PageHeader
        title={t('adverse_media.title')}
        description="Scan global news, regulatory filings, and court records for negative mentions of your customers and counterparties. Every hit is classified by risk category (fraud, money laundering, sanctions, corruption, etc.) and scored so your team can triage what needs a real review."
      />
      <div className="flex flex-col sm:flex-row gap-2 mb-6">
        <input value={searchName} onChange={e => setSearchName(e.target.value)}
          placeholder={t('adverse_media.search_entity')}
          className="input-field flex-1"
          onKeyDown={e => e.key === 'Enter' && handleScan()} />
        <button onClick={handleScan} aria-label={t('adverse_media.scan')}
          className="button-primary min-h-[44px] px-6 py-2 rounded-apple-md text-sm">
          {t('adverse_media.scan')}
        </button>
      </div>
      <div className="flex gap-2 mb-6 flex-wrap">
        {CATEGORIES.map(cat => (
          <button key={cat}
            onClick={() => setActiveFilter(activeFilter === cat ? null : cat)}
            className={`min-h-[44px] px-3 py-1 rounded-full text-xs cursor-pointer transition-colors ${
              activeFilter === cat
                ? ''
                : 'hover:opacity-80'
            }`}
            style={activeFilter !== cat
              ? { background: 'var(--dash-surface)', color: 'var(--dash-text-secondary)' }
              : { background: '#1A1814', color: '#FAFAF8' }}>
            {titleize(cat)}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        {filtered.map(h => (
          <MediaResultCard key={h.id} hit={h} onReview={handleReview} />
        ))}
        {filtered.length === 0 && (
          <p className="text-center py-8" style={{ color: 'var(--dash-text-secondary)' }}>
            {t('adverse_media.no_hits')}
          </p>
        )}
      </div>
    </div>
  )
}
