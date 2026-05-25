import { useState, useEffect, useCallback } from 'react'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { ScreeningQuotaBanner } from '../components/screening/ScreeningQuotaBanner'
import { LimitReachedBanner } from '../components/screening/LimitReachedBanner'
import { CryptoResultCard } from '../components/screening/CryptoResultCard'
import { api, ApiError } from '../api/client'
import { screeningApi, ScreeningQuota } from '../api/screening'

interface CryptoResult {
  decision: string
  wallet_address: string
  chain: string
  hits: Array<{
    address: string; chain: string; entity_id: string;
    list_id: string; source: string
  }>
  risk_flags: string[]
  processing_us: number
}

const ADDRESS_PATTERNS: Record<string, RegExp> = {
  ETH: /^0x[a-fA-F0-9]{40}$/,
  BTC: /^(bc1[a-z0-9]{25,87}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/,
  TRX: /^T[a-zA-Z0-9]{33}$/,
}

function validateAddress(addr: string, chain: string): string | null {
  const a = addr.trim()
  if (!a) return 'Wallet address required'
  const re = ADDRESS_PATTERNS[chain]
  if (re && !re.test(a)) return `Invalid ${chain} wallet address format`
  return null
}

export function CryptoScreening() {
  const [address, setAddress] = useState('')
  const [chain, setChain] = useState('ETH')
  const [result, setResult] = useState<CryptoResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [quota, setQuota] = useState<ScreeningQuota | null>(null)
  const [quotaKey, setQuotaKey] = useState(0)

  const isLimitError = error instanceof ApiError && error.status === 402
  const quotaExhausted =
    quota != null && quota.limit >= 0 && quota.remaining <= 0

  const refreshQuota = useCallback(() => {
    screeningApi.getQuota().then(setQuota).catch(() => setQuota(null))
  }, [])
  useEffect(() => { refreshQuota() }, [refreshQuota, quotaKey])

  const screen = async () => {
    const validation = validateAddress(address, chain)
    if (validation) { setError(new Error(validation)); return }
    if (quotaExhausted) {
      setError(new ApiError('FREE_TIER_EXHAUSTED',
        'Quota exhausted for this period.', 402))
      return
    }
    setLoading(true); setError(null); setResult(null)
    try {
      const d = await api.post<CryptoResult>('/crypto/screen', {
        wallet_address: address.trim(), chain,
      })
      setResult(d)
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setLoading(false)
      setQuotaKey(k => k + 1)
    }
  }

  return (
    <div>
      <PageHeader
        title="Crypto Screening"
        description="Screen wallet addresses against 13K+ sanctioned wallets"
      />
      <div className="mb-lg">
        <ScreeningQuotaBanner refreshKey={quotaKey} />
      </div>
      <Card className="mb-lg">
        <div className="flex flex-col sm:flex-row gap-md mb-lg">
          <input
            value={address}
            onChange={e => setAddress(e.target.value)}
            placeholder="0x7d84d78bb9b6044a45fa08b7fe109f2c8648ab4e"
            aria-label="Wallet address"
            className="input-field flex-1 font-mono text-sm"
            disabled={loading || quotaExhausted}
          />
          <select
            value={chain}
            onChange={e => setChain(e.target.value)}
            aria-label="Chain"
            className="input-field w-24"
            disabled={loading || quotaExhausted}
          >
            <option value="ETH">ETH</option>
            <option value="BTC">BTC</option>
            <option value="TRX">TRX</option>
          </select>
        </div>
        <Button
          onClick={screen}
          disabled={loading || !address.trim() || quotaExhausted}
          className="w-full"
        >
          {quotaExhausted ? 'Quota exhausted — upgrade to continue'
            : loading ? 'Scanning…' : 'Screen Wallet'}
        </Button>
      </Card>
      {quotaExhausted && !error && (
        <LimitReachedBanner
          error={new ApiError('FREE_TIER_EXHAUSTED', 'Quota exhausted', 402)}
        />
      )}
      {error && isLimitError && <LimitReachedBanner error={error} />}
      {error && !isLimitError && (
        <Card className="mb-lg">
          <p role="alert" className="text-red-500 sf-body">{error.message}</p>
        </Card>
      )}
      {loading && <LoadingSpinner />}
      {result && <CryptoResultCard result={result} />}
    </div>
  )
}

export default CryptoScreening
