import { useNavigate } from 'react-router-dom'
import { UserPlus, Upload, Webhook, ArrowRight } from 'lucide-react'

interface Props {
  onAddManual: () => void
  onImport: () => void
}

export function MonitoringIngestCard({ onAddManual, onImport }: Props) {
  const navigate = useNavigate()

  const options = [
    {
      icon: UserPlus,
      title: 'Add one at a time',
      desc: 'Manually add an individual or company to monitor. Good for a handful of high-risk counterparties.',
      cta: 'Add entity',
      onClick: onAddManual,
    },
    {
      icon: Upload,
      title: 'Import your customer base',
      desc: 'Upload a CSV of customers (name, country, DOB, identifiers). We’ll onboard them in bulk and start screening against every list.',
      cta: 'Import CSV',
      onClick: onImport,
    },
    {
      icon: Webhook,
      title: 'Sync via webhook',
      desc: 'Point your CRM, KYC provider, or core system at our API. New customers are monitored automatically the moment they’re created.',
      cta: 'Set up webhook',
      onClick: () => navigate('/webhooks'),
    },
  ]

  return (
    <div className="rounded-apple-lg border p-lg mb-lg"
      style={{ background: 'var(--dash-surface)', borderColor: 'var(--dash-border)' }}>
      <div className="mb-md">
        <h2 className="sf-headline mb-xs">Monitor every customer — not just a sample</h2>
        <p className="sf-caption">
          Ongoing monitoring works for both individuals and companies. Screen your entire
          customer base against sanctions, PEP, and adverse-media lists, and get an alert the
          moment a previously-clean entity is added to a watchlist.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-md">
        {options.map(o => (
          <div key={o.title}
            className="rounded-apple-md border p-md flex flex-col"
            style={{ borderColor: 'var(--dash-border)' }}>
            <div className="flex items-center justify-center w-9 h-9 rounded-apple-md mb-sm"
              style={{ background: 'rgba(201,169,110,0.1)' }}>
              <o.icon className="w-4.5 h-4.5" style={{ color: '#C9A96E' }} />
            </div>
            <p className="text-sm font-semibold mb-xs" style={{ color: 'var(--dash-text)' }}>
              {o.title}
            </p>
            <p className="text-xs mb-md flex-1" style={{ color: 'var(--dash-text-secondary)' }}>
              {o.desc}
            </p>
            <button type="button" onClick={o.onClick}
              className="flex items-center gap-xs text-xs font-semibold transition-opacity hover:opacity-80"
              style={{ color: '#C9A96E' }}>
              {o.cta} <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
