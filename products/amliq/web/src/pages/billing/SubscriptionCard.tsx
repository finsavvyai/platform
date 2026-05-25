import React from 'react'
import { useTranslation } from 'react-i18next'
import { Subscription } from '../../types/billing'
import { Zap, LayoutDashboard, Code, Code2, FileText } from 'lucide-react'
import clsx from 'clsx'

interface SubscriptionCardProps { subscription: Subscription }

const productIcons = {
  api: Zap, dashboard: LayoutDashboard, sdk: Code, iframe: Code2, dataset: FileText
}
const productNames = {
  api: 'API Access', dashboard: 'Dashboard', sdk: 'SDK', iframe: 'iFrame Widget', dataset: 'Dataset CSV'
}

export function SubscriptionCard({ subscription }: SubscriptionCardProps) {
  const { t } = useTranslation('billing')
  const Icon = productIcons[subscription.product as keyof typeof productIcons] ?? Zap
  const name = productNames[subscription.product as keyof typeof productNames] ?? subscription.product
  const price = subscription.plan?.monthlyPrice ?? 0
  const renewDate = new Date(subscription.currentPeriodEnd)

  return (
    <div className="glass-card rounded-apple-lg p-lg transition-colors">
      <div className="flex items-start justify-between mb-md">
        <div className="flex items-center gap-md">
          <div className="p-md bg-indigo-600/20 rounded-apple-md">
            <Icon className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h3 className="sf-body font-medium" style={{ color: 'var(--dash-text)' }}>{name}</h3>
            <p className="sf-caption" style={{ color: 'var(--dash-text-secondary)' }}>
              {subscription.plan?.name ?? 'Free'} plan
            </p>
          </div>
        </div>
        <span className={clsx('text-xs font-medium px-md py-xs rounded-apple-md',
          subscription.status === 'active' ? 'bg-green-600/20 text-green-400' : 'bg-[#C9A96E]/20 text-[#C9A96E]')}>
          {subscription.status}
        </span>
      </div>
      <div className="space-y-sm mb-lg">
        <InfoRow label={t('subscriptions.monthly_cost')} value={`$${price}`} />
        {(subscription.seatCount ?? 0) > 0 && <InfoRow label={t('subscriptions.active_seats')} value={subscription.seatCount!} />}
        <InfoRow label={t('subscriptions.renews')} value={renewDate.toLocaleDateString()} />
      </div>
      <button className="button-secondary w-full">{t('subscriptions.manage')}</button>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between">
      <span className="sf-caption" style={{ color: 'var(--dash-text-secondary)' }}>{label}</span>
      <span className="sf-body" style={{ color: 'var(--dash-text)' }}>{value}</span>
    </div>
  )
}
