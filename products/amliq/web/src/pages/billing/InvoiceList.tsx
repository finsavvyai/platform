import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Invoice } from '../../types/billing'
import { getInvoices } from '../../api/billing'
import { Download } from 'lucide-react'

export default function InvoiceList() {
  const { t } = useTranslation('billing')
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getInvoices()
      .then(data => setInvoices(Array.isArray(data) ? data : []))
      .catch(() => setInvoices([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="sf-body" style={{ color: 'var(--dash-text-secondary)' }}>{t('invoices.loading')}</div>

  return (
    <div className="glass-card rounded-apple-lg overflow-hidden">
      <div className="px-lg py-md border-b" style={{ borderColor: 'var(--dash-border)' }}>
        <h3 className="sf-body font-medium" style={{ color: 'var(--dash-text)' }}>{t('invoices.recent')}</h3>
      </div>
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b" style={{ borderColor: 'var(--dash-border)' }}>
              {['date', 'product', 'amount', 'status', 'action'].map(col => (
                <th key={col} className={`px-lg py-md ${col === 'action' ? 'text-right' : 'text-left'} text-xs font-medium uppercase`}
                  style={{ color: 'var(--dash-text-secondary)' }}>{t(`invoices.${col}`)}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: 'var(--dash-border)' }}>
            {invoices.map(inv => (
              <tr key={inv.id} className="hover:bg-white/5 transition-colors">
                <td className="px-lg py-md sf-caption" style={{ color: 'var(--dash-text-secondary)' }}>{new Date(inv.date).toLocaleDateString()}</td>
                <td className="px-lg py-md sf-caption capitalize" style={{ color: 'var(--dash-text)' }}>{inv.product}</td>
                <td className="px-lg py-md sf-body" style={{ color: 'var(--dash-text)' }}>${(inv.amountCents / 100).toFixed(2)}</td>
                <td className="px-lg py-md"><InvoiceStatusBadge status={inv.status} /></td>
                <td className="px-lg py-md text-right">
                  <a href={inv.url} target="_blank" rel="noopener noreferrer"
                    aria-label={`${t('invoices.download')} ${inv.product}`}
                    className="inline-flex p-md hover:bg-white/10 rounded-apple-md transition-colors min-h-[44px]">
                    <Download className="w-4 h-4 text-[#C9A96E]" />
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="md:hidden divide-y" style={{ borderColor: 'var(--dash-border)' }}>
        {invoices.map(inv => (
          <div key={inv.id} className="p-lg">
            <div className="flex items-center justify-between mb-xs">
              <span className="sf-body capitalize font-medium" style={{ color: 'var(--dash-text)' }}>{inv.product}</span>
              <InvoiceStatusBadge status={inv.status} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <span className="sf-body font-semibold" style={{ color: 'var(--dash-text)' }}>${(inv.amountCents / 100).toFixed(2)}</span>
                <span className="sf-caption ml-sm" style={{ color: 'var(--dash-text-secondary)' }}>{new Date(inv.date).toLocaleDateString()}</span>
              </div>
              <a href={inv.url} target="_blank" rel="noopener noreferrer"
                className="p-sm hover:bg-white/10 rounded-apple-md transition-colors min-h-[44px]">
                <Download className="w-4 h-4 text-[#C9A96E]" />
              </a>
            </div>
          </div>
        ))}
      </div>
      {invoices.length === 0 && (
        <p className="text-center py-lg sf-caption" style={{ color: 'var(--dash-text-secondary)' }}>No invoices yet</p>
      )}
    </div>
  )
}

function InvoiceStatusBadge({ status }: { status: string }) {
  const cls = status === 'paid' ? 'bg-green-600/20 text-green-400' : 'bg-[#C9A96E]/20 text-[#C9A96E]'
  return <span className={`text-xs px-md py-xs rounded-apple-md font-medium ${cls}`}>{status}</span>
}
