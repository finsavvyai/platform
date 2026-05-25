import { useState, useEffect, useCallback } from 'react'
import * as billingApi from '../api/billing'
import type { Subscription, Invoice } from '../types/billing'

export function useBilling() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [subs, invs] = await Promise.all([
        billingApi.getSubscriptions(),
        billingApi.getInvoices(),
      ])
      setSubscriptions(subs ?? [])
      setInvoices(invs ?? [])
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load billing')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const checkout = useCallback(async (
    product: string, planId: string, promo?: string,
  ) => {
    const { checkoutUrl } = await billingApi.createCheckout(product, planId, promo)
    window.location.href = checkoutUrl
  }, [])

  return { subscriptions, invoices, loading, error, refetch: fetchAll, checkout }
}
