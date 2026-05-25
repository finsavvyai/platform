import React from 'react'
import { Download } from 'lucide-react'
import { Invoice } from '../../types/billing'

interface InvoiceRowProps { invoice: Invoice }

export default function InvoiceRow({ invoice }: InvoiceRowProps) {
  const date = new Date(invoice.date).toLocaleDateString()
  const amount = (invoice.amountCents / 100).toFixed(2)

  const statusColor = {
    paid: 'text-green-400 bg-green-900/20',
    open: 'text-[#A8813E] bg-[#C9A96E]/15',
    failed: 'text-red-400 bg-red-900/20'
  }

  return (
    <tr className="border-b hover:bg-white/[0.02]" style={{ borderColor: 'var(--dash-border)' }}>
      <td className="px-4 py-3 text-sm" style={{ color: 'var(--dash-text)' }}>{date}</td>
      <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--dash-text)' }}>
        ${amount} {invoice.currency}
      </td>
      <td className="px-4 py-3">
        <span className={`text-xs font-semibold px-3 py-1 rounded-full ${statusColor[invoice.status]}`}>
          {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <button type="button" className="transition-colors cursor-pointer" style={{ color: 'var(--dash-text-secondary)' }}>
          <Download size={16} />
        </button>
      </td>
    </tr>
  )
}
