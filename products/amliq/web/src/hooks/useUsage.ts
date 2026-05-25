import { useState, useEffect, useCallback } from 'react'
import * as billingApi from '../api/billing'
import type { UsageRecord } from '../types/billing'

export function useUsage(product?: string) {
  const [usage, setUsage] = useState<UsageRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!product) { setLoading(false); return }
    setLoading(true)
    try {
      const rec = await billingApi.getUsage(product)
      setUsage(rec)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load usage')
    } finally {
      setLoading(false)
    }
  }, [product])

  useEffect(() => { fetch() }, [fetch])

  return { usage, loading, error, refetch: fetch }
}
