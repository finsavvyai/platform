import { useState, useEffect, useCallback } from 'react'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { SearchField } from '../components/ui/SearchField'
import { ScreeningQuotaBanner } from '../components/screening/ScreeningQuotaBanner'
import { ScreenResults } from '../components/screening/ScreenResults'
import { LimitReachedBanner } from '../components/screening/LimitReachedBanner'
import { ScreeningProgress } from '../components/screening/ScreeningProgress'
import { api, ApiError } from '../api/client'
import { screeningApi, ScreeningQuota } from '../api/screening'
import { Badge } from '../components/ui/Badge'
import type { ScreenResponse } from '../types'

interface PEPResult {
  results: Array<{ entity_id: string; name?: string; position: string; country: string; tier: number }>
  total: number
}

export function PEPScreening() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ScreenResponse | null>(null)
  const [pepResults, setPepResults] = useState<PEPResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [quota, setQuota] = useState<ScreeningQuota | null>(null)
  const [quotaKey, setQuotaKey] = useState(0)
  const isLimitError = error instanceof ApiError && error.status === 402
  const quotaExhausted = quota != null && quota.limit >= 0 && quota.remaining <= 0

  const refreshQuota = useCallback(() => {
    screeningApi.getQuota().then(setQuota).catch(() => setQuota(null))
  }, [])

  useEffect(() => { refreshQuota() }, [refreshQuota, quotaKey])

  const handleScreen = async () => {
    if (!query.trim()) return
    if (quotaExhausted) {
      setError(new ApiError('FREE_TIER_EXHAUSTED', 'Quota exhausted for this month.', 402))
      return
    }
    setLoading(true); setError(null); setPepResults(null)
    try {
      const [screenData, pepData] = await Promise.allSettled([
        api.post<ScreenResponse>('/screen', { entity_name: query.trim() }),
        api.post<PEPResult>('/pep/screen', { name: query.trim() }),
      ])
      if (screenData.status === 'fulfilled') setResults(screenData.value)
      if (pepData.status === 'fulfilled') setPepResults(pepData.value)
      if (screenData.status === 'rejected') {
        const e = screenData.reason instanceof Error ? screenData.reason : new Error(String(screenData.reason))
        if (e instanceof ApiError && e.status === 402) setError(e)
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setLoading(false)
      setQuotaKey(k => k + 1)
    }
  }

  const pepList = pepResults?.results ?? []

  // Some results come back with only an opaque entity_id (e.g. "Q66092224",
  // "sg-gov-1a18...") and no name/position. Filter those out so we show
  // something useful and fall back gracefully.
  const displayName = (p: PEPResult['results'][number]) =>
    p.name?.trim() || p.position?.trim() || p.entity_id

  return (
    <div>
      <PageHeader title="PEP & Sanctions Screening"
        description="Screen against PEP databases and global sanctions lists" />
      <div className="mb-lg"><ScreeningQuotaBanner refreshKey={quotaKey} /></div>
      <Card className="mb-lg">
        <SearchField placeholder="Enter name (e.g. Benjamin Netanyahu, Vladimir Putin)"
          value={query} onChange={setQuery} onSubmit={handleScreen} />
        <Button onClick={handleScreen}
          disabled={loading || !query.trim() || quotaExhausted}
          className="w-full mt-lg">
          {quotaExhausted ? 'Quota exhausted — upgrade to continue'
            : loading ? 'Screening...' : 'Screen PEP & Sanctions'}
        </Button>
      </Card>
      {quotaExhausted && !error && (
        <LimitReachedBanner error={new ApiError('FREE_TIER_EXHAUSTED', 'Quota exhausted', 402)} />
      )}
      {error && isLimitError && <LimitReachedBanner error={error} />}
      {error && !isLimitError && (
        <Card className="mb-lg"><p role="alert" className="text-red-500 sf-body">{error.message}</p></Card>
      )}
      {loading && <div className="mt-xxl"><ScreeningProgress query={query} /></div>}
      {!loading && !quotaExhausted && pepList.length > 0 && (
        <Card className="mb-lg">
          <h3 className="sf-headline mb-md">PEP Results — {pepList.length} profile{pepList.length === 1 ? '' : 's'}</h3>
          <div className="space-y-sm">
            {pepList.map((p, i) => (
              <div key={i} className="flex items-center justify-between p-md rounded-apple-md"
                style={{ background: 'var(--dash-surface)' }}>
                <div className="min-w-0 flex-1">
                  <p className="sf-body font-medium truncate">{displayName(p)}</p>
                  <p className="sf-caption" style={{ color: 'var(--dash-text-tertiary)' }}>
                    {[p.position, p.country?.toUpperCase()].filter(Boolean).join(' · ') || 'Politically Exposed Person'}
                  </p>
                </div>
                <Badge color={p.tier <= 2 ? 'red' : 'orange'} size="sm">Tier {p.tier}</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}
      {!loading && !quotaExhausted && results && !isLimitError && <ScreenResults data={results} />}
    </div>
  )
}
