import React from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle, X } from 'lucide-react'

interface PaymentAlertProps { visible: boolean; onDismiss: () => void }

export default function PaymentAlert({ visible, onDismiss }: PaymentAlertProps) {
  const { t } = useTranslation('billing')
  if (!visible) return null

  return (
    <div role="alert"
      className="bg-red-900/20 border border-red-800 rounded-apple-lg p-4 flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <AlertCircle size={20} className="text-red-400 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="font-semibold text-red-200">{t('payment.failed_title')}</h3>
          <p className="text-sm text-red-300 mt-1">{t('payment.failed_message')}</p>
          <button aria-label={t('payment.update_method')}
            className="text-sm font-semibold text-red-300 hover:text-red-100 mt-2 cursor-pointer min-h-[44px]">
            {t('payment.update_method')}
          </button>
        </div>
      </div>
      <button onClick={onDismiss} aria-label={t('payment.dismiss')}
        className="text-red-400 hover:text-red-300 cursor-pointer min-h-[44px]">
        <X size={20} />
      </button>
    </div>
  )
}
