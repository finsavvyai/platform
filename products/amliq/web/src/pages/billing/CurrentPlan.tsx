import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ExternalLink } from 'lucide-react'
import { Subscription } from '../../types/billing'
import { getSubscriptions } from '../../api/billing'

export default function CurrentPlan() {
  const { t } = useTranslation('billing')
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getSubscriptions()
      .then(subs => setSubscription(Array.isArray(subs) ? subs[0] ?? null : null))
      .catch(() => setSubscription(null))
      .finally(() => setLoading(false))
  }, [])

  if (loading || !subscription) return <div className="animate-pulse h-40 bg-white/5 rounded-apple-lg" />

  const renewalDate = new Date(subscription.currentPeriodEnd).toLocaleDateString()

  return (
    <div className="glass-card rounded-apple-lg p-6">
      <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--dash-text)' }}>
        {t('subscriptions.current_plan')}
      </h3>
      <div className="space-y-4">
        <div>
          <p className="text-3xl font-bold sf-title">{subscription.plan.name}</p>
          <p className="text-sm mt-1" style={{ color: 'var(--dash-text-secondary)' }}>
            <span className="inline-block px-3 py-1 bg-green-900/30 text-green-300 rounded-full text-xs font-semibold">
              {subscription.status === 'trialing' ? t('subscriptions.trialing') : t('subscriptions.active')}
            </span>
          </p>
        </div>
        <div className="text-sm" style={{ color: 'var(--dash-text-secondary)' }}>
          <p>{t('subscriptions.renews_on', { date: renewalDate })}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 pt-4">
          <button type="button" className="button-primary flex-1 flex items-center justify-center gap-2">
            <ExternalLink size={16} /> {t('subscriptions.manage')}
          </button>
          <button type="button" className="button-secondary flex-1">
            {t('subscriptions.change_plan')}
          </button>
        </div>
      </div>
    </div>
  )
}
