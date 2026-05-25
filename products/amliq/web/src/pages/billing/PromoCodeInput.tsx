import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { applyPromoCode } from '../../api/billing'
import { Check } from 'lucide-react'

export function PromoCodeInput() {
  const { t } = useTranslation('billing')
  const [code, setCode] = useState('')
  const [discount, setDiscount] = useState<{ percent: number; message: string } | null>(null)
  const [loading, setLoading] = useState(false)

  const handleApply = async () => {
    if (!code) return
    setLoading(true)
    try {
      const result = await applyPromoCode(code)
      if (result && typeof result.discountPercent === 'number') {
        setDiscount({ percent: result.discountPercent, message: result.message ?? '' })
      }
    } catch {
      // ignore network errors
    } finally { setLoading(false) }
  }

  return (
    <div className="space-y-md">
      <div className="flex gap-xs">
        <input type="text" value={code} onChange={e => setCode(e.target.value.toUpperCase())}
          placeholder={t('promo.placeholder')} aria-label={t('promo.placeholder')}
          className="input-field flex-1" />
        <button onClick={handleApply} disabled={!code || loading}
          className="button-primary disabled:opacity-50">
          {t('promo.apply')}
        </button>
      </div>
      {discount && (
        <div className={`p-md rounded-apple-md flex items-start gap-xs ${
          discount.percent === 100 ? 'bg-green-600/20' : 'bg-indigo-600/20'}`}>
          <Check className={`w-4 h-4 flex-shrink-0 mt-xs ${
            discount.percent === 100 ? 'text-green-400' : 'text-indigo-600'}`} />
          <div>
            <p className={`sf-body font-medium ${
              discount.percent === 100 ? 'text-green-300' : 'text-indigo-600'}`}>
              {t('promo.discount', { percent: discount.percent })}
            </p>
            <p className={`sf-caption ${
              discount.percent === 100 ? 'text-green-400' : 'text-indigo-600'}`}>
              {discount.message}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
