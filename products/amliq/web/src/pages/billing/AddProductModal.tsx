import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Product } from '../../types/billing'
import { getProducts, getSubscriptions, createCheckout } from '../../api/billing'
import { X } from 'lucide-react'

interface AddProductModalProps { isOpen: boolean; onClose: () => void }

export function AddProductModal({ isOpen, onClose }: AddProductModalProps) {
  const { t } = useTranslation('billing')
  const [products, setProducts] = useState<Product[]>([])
  const [subscriptions, setSubscriptions] = useState<any[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isOpen) {
      Promise.all([getProducts(), getSubscriptions()])
        .then(([p, s]) => {
          setProducts(Array.isArray(p) ? p : [])
          setSubscriptions(Array.isArray(s) ? s : [])
          setLoading(false)
        })
        .catch(() => setLoading(false))
    }
  }, [isOpen])

  const availableProducts = products.filter(p => !subscriptions.find(s => s.product === p.type))

  const handleCheckout = async () => {
    if (!selectedProduct || !selectedPlanId) return
    const result = await createCheckout(selectedProduct.type, selectedPlanId)
    window.location.href = result.checkoutUrl
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-md"
      role="dialog" aria-modal="true" aria-labelledby="add-product-title"
      onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}>
      <div className="rounded-apple-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl"
        style={{ background: 'var(--dash-surface)', border: '1px solid var(--dash-border)' }}>
        <div className="flex items-center justify-between p-lg border-b" style={{ borderColor: 'var(--dash-border)' }}>
          <h2 id="add-product-title" className="sf-headline sf-title">{t('add_product')}</h2>
          <button onClick={onClose} aria-label={t('close')}
            className="p-md hover:bg-white/10 rounded-apple-md cursor-pointer min-h-[44px]">
            <X className="w-5 h-5" style={{ color: 'var(--dash-text)' }} />
          </button>
        </div>
        {loading ? (
          <div className="p-lg text-center">{t('loading')}</div>
        ) : availableProducts.length === 0 ? (
          <div className="p-lg text-center sf-body" style={{ color: 'var(--dash-text-secondary)' }}>
            {t('invoices.all_subscribed')}
          </div>
        ) : (
          <ModalBody products={availableProducts} selectedProduct={selectedProduct}
            selectedPlanId={selectedPlanId} onSelectProduct={(p: Product) => { setSelectedProduct(p); setSelectedPlanId(p.plans[0].id) }}
            onSelectPlan={setSelectedPlanId} onCheckout={handleCheckout} t={t} />
        )}
      </div>
    </div>
  )
}

function ModalBody({ products, selectedProduct, selectedPlanId, onSelectProduct, onSelectPlan, onCheckout, t }: any) {
  return (
    <div className="p-lg space-y-lg">
      <div className="grid grid-cols-1 gap-md">
        {products.map((product: Product) => (
          <button key={product.type} onClick={() => onSelectProduct(product)}
            aria-pressed={selectedProduct?.type === product.type}
            className={`p-md rounded-apple-lg border transition-colors text-left cursor-pointer min-h-[44px] ${
              selectedProduct?.type === product.type ? 'border-[#C9A96E] bg-[#C9A96E]/10' : ''}`}
            style={selectedProduct?.type !== product.type ? { borderColor: 'var(--dash-border)' } : undefined}>
            <h3 className="sf-body font-medium" style={{ color: 'var(--dash-text)' }}>{product.name}</h3>
            <p className="sf-caption" style={{ color: 'var(--dash-text-secondary)' }}>{product.tagline}</p>
          </button>
        ))}
      </div>
      {selectedProduct && (
        <div className="space-y-md">
          <h3 className="sf-body font-medium" style={{ color: 'var(--dash-text)' }}>{t('invoices.select_plan')}</h3>
          <div className="grid grid-cols-1 gap-sm">
            {selectedProduct.plans.map((plan: any) => (
              <button key={plan.id} onClick={() => onSelectPlan(plan.id)}
                aria-pressed={selectedPlanId === plan.id}
                className={`p-sm rounded-apple-md border transition-colors text-left sf-caption cursor-pointer min-h-[44px] ${
                  selectedPlanId === plan.id ? 'border-[#C9A96E] bg-[#C9A96E]/10' : ''}`}
                style={selectedPlanId !== plan.id ? { borderColor: 'var(--dash-border)' } : undefined}>
                <span style={{ color: 'var(--dash-text)' }}>{plan.name}</span> -{' '}
                <span style={{ color: 'var(--dash-text-secondary)' }}>${plan.monthlyPrice}{t('pricing.per_month')}</span>
              </button>
            ))}
          </div>
          <button onClick={onCheckout} className="button-primary w-full">{t('invoices.checkout')}</button>
        </div>
      )}
    </div>
  )
}
