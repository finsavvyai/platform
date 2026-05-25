import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { getSubscriptions } from '../../api/billing'
import { SubscriptionCard } from './SubscriptionCard'
import { Subscription } from '../../types/billing'

interface Props { onAddProduct?: () => void }

export function ActiveSubscriptions({ onAddProduct }: Props = {}) {
  const { t } = useTranslation('billing')
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getSubscriptions()
      .then(subs => setSubscriptions(Array.isArray(subs) ? subs : []))
      .catch(() => setSubscriptions([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="sf-body" style={{ color: 'var(--dash-text-secondary)' }}>{t('subscriptions.loading')}</div>
  }

  if (subscriptions.length === 0) {
    return (
      <div className="text-center py-lg glass-card rounded-apple-lg">
        <p className="sf-body mb-md" style={{ color: 'var(--dash-text-secondary)' }}>{t('subscriptions.no_subscriptions')}</p>
        <button type="button" onClick={onAddProduct} className="button-primary">
          {t('add_product')}
        </button>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-lg">
      {subscriptions.map(sub => (
        <SubscriptionCard key={sub.id} subscription={sub} />
      ))}
    </div>
  )
}
