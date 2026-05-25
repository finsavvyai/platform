import React from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { Plan } from '../../types/billing'

interface UpgradeModalProps {
  visible: boolean; plan: Plan | null; onConfirm: () => void; onCancel: () => void
}

export default function UpgradeModal({ visible, plan, onConfirm, onCancel }: UpgradeModalProps) {
  const { t } = useTranslation('billing')
  if (!visible || !plan) return null
  const price = plan.monthlyPrice.toFixed(2)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      role="dialog" aria-modal="true" aria-labelledby="upgrade-title"
      onKeyDown={(e) => { if (e.key === 'Escape') onCancel() }}>
      <div className="glass-card rounded-apple-lg p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 id="upgrade-title" className="text-lg font-semibold sf-title">
            {t('upgrade.title', { plan: plan.name })}
          </h3>
          <button type="button" onClick={onCancel} aria-label={t('upgrade.cancel')}
            className="cursor-pointer min-h-[44px]" style={{ color: 'var(--dash-text-secondary)' }}>
            <X size={20} />
          </button>
        </div>
        <p className="text-sm mb-6" style={{ color: 'var(--dash-text-secondary)' }}>
          {t('upgrade.description', { price })}
        </p>
        <div className="rounded-apple-md p-4 mb-6" style={{ background: 'var(--dash-surface)' }}>
          <p className="text-xs" style={{ color: 'var(--dash-text-secondary)' }}>{t('upgrade.new_limit')}</p>
          <p className="text-xl font-bold sf-title">
            {t('upgrade.screenings_mo', { count: ((plan.limits['screenings'] ?? 0) / 1000).toFixed(0) })}
          </p>
        </div>
        <div className="flex flex-col-reverse sm:flex-row gap-3">
          <button type="button" onClick={onCancel} className="button-secondary flex-1">
            {t('upgrade.cancel')}
          </button>
          <button type="button" onClick={onConfirm} className="button-primary flex-1">
            {t('upgrade.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
