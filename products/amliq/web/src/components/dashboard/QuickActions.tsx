import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, UserCheck, Wallet, FileText, Package, Zap } from 'lucide-react'

const groups = [
  {
    title: 'Screening',
    actions: [
      { icon: Search, label: 'Screen Entity', desc: 'Screen against sanctions lists', path: '/screen' },
      { icon: Zap, label: 'Transaction Screen', desc: 'Screen payment parties', path: '/compliance/txn' },
      { icon: Wallet, label: 'Crypto Screen', desc: 'Screen wallet addresses', path: '/compliance/crypto' },
    ],
  },
  {
    title: 'Due Diligence',
    actions: [
      { icon: UserCheck, label: 'PEP Check', desc: 'Politically exposed persons', path: '/compliance/pep' },
      { icon: FileText, label: 'Document Screen', desc: 'Extract and screen names', path: '/screen' },
    ],
  },
  {
    title: 'Bulk',
    actions: [
      { icon: Package, label: 'Batch Jobs', desc: 'Screen lists in bulk', path: '/batch' },
    ],
  },
]

export function QuickActions() {
  const navigate = useNavigate()

  return (
    <div className="space-y-4">
      {groups.map(g => (
        <div key={g.title}>
          <p className="section-eyebrow mb-2">{g.title}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {g.actions.map(({ icon: Icon, label, desc, path }) => (
              <button key={path + label} onClick={() => navigate(path)}
                className="flex items-center gap-3 p-3 rounded-xl border text-left transition-all duration-200 cursor-pointer hover:shadow-sm hover:-translate-y-0.5"
                style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-surface)' }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(201,169,110,0.1)' }}>
                  <Icon className="w-4 h-4" style={{ color: 'var(--accent-gold)' }} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium" style={{ color: 'var(--dash-text)' }}>{label}</p>
                  <p className="text-xs truncate" style={{ color: 'var(--dash-text-tertiary)' }}>{desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
