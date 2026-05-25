import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { ActiveSubscriptions } from './ActiveSubscriptions'
import { SeatManager } from './SeatManager'
import { PromoCodeInput } from './PromoCodeInput'
import { AddProductModal } from './AddProductModal'
import UsageHistory from './UsageHistory'
import InvoiceList from './InvoiceList'

export default function BillingPage() {
  const { t } = useTranslation('billing')
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <div className="space-y-xl">
        <div>
          <h1 className="sf-title sf-title">{t('title')}</h1>
          <p className="sf-body mt-xs" style={{ color: 'var(--dash-text-secondary)' }}>{t('subtitle')}</p>
        </div>
        <div className="flex justify-end">
          <button onClick={() => setModalOpen(true)}
            className="button-primary flex items-center gap-xs">
            <Plus className="w-4 h-4" /> {t('add_product')}
          </button>
        </div>
        <Section title={t('sections.active_subscriptions')}>
          <ActiveSubscriptions onAddProduct={() => setModalOpen(true)} />
        </Section>
        <Section title={t('sections.dashboard_seats')}>
          <div className="glass-card rounded-apple-lg p-lg"><SeatManager /></div>
        </Section>
        <Section title={t('sections.promo_code')}>
          <div className="glass-card rounded-apple-lg p-lg max-w-md"><PromoCodeInput /></div>
        </Section>
        <Section title={t('sections.usage_history')}><UsageHistory /></Section>
        <Section title={t('sections.invoices')}><InvoiceList /></Section>
        <AddProductModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-md">
      <h2 className="sf-body font-medium" style={{ color: 'var(--dash-text)' }}>{title}</h2>
      {children}
    </section>
  )
}
