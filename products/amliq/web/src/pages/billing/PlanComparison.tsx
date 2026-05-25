import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plan } from '../../types/billing'
import { getProducts } from '../../api/billing'
import PricingCard from '../marketing/PricingCard'

export default function PlanComparison() {
  const { t } = useTranslation('billing')
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [annual, setAnnual] = useState(false)

  useEffect(() => {
    getProducts().then(products => {
      setPlans(products.flatMap(p => p.plans))
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="animate-pulse h-96 bg-white/5 rounded-apple-lg" />

  return (
    <div className="glass-card rounded-apple-lg p-6">
      <h3 className="text-lg font-semibold mb-2 sf-title">{t('plan_comparison.title')}</h3>
      <p className="text-sm mb-6" style={{ color: 'var(--dash-text-secondary)' }}>{t('plan_comparison.subtitle')}</p>
      <div className="flex justify-center gap-2 mb-8">
        <button type="button" onClick={() => setAnnual(false)}
          className={`px-4 py-2 rounded-apple-md text-sm font-medium transition-colors min-h-[44px] ${
            !annual ? '' : ''}`}
          style={!annual ? { background: '#1A1814', color: '#FAFAF8' } : { background: 'var(--dash-surface)', color: 'var(--dash-text)' }}>
          {t('plan_comparison.monthly')}
        </button>
        <button type="button" onClick={() => setAnnual(true)}
          className={`px-4 py-2 rounded-apple-md text-sm font-medium transition-colors min-h-[44px] ${
            annual ? '' : ''}`}
          style={annual ? { background: '#1A1814', color: '#FAFAF8' } : { background: 'var(--dash-surface)', color: 'var(--dash-text)' }}>
          {t('plan_comparison.annual')}
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {plans.map(plan => (
          <PricingCard key={plan.id} plan={{
            name: plan.name, monthly: plan.monthlyPrice,
            features: plan.features ?? [],
          }} annual={annual} />
        ))}
      </div>
    </div>
  )
}
