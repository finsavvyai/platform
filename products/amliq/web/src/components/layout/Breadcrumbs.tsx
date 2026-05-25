import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronRight, Home } from 'lucide-react'

const labelMap: Record<string, string> = {
  dashboard: 'Dashboard', alerts: 'Alerts', screen: 'Screen Entity',
  monitoring: 'Monitoring', batch: 'Batch Jobs', compliance: 'Compliance',
  cases: 'Cases', risk: 'Risk Assessment', pep: 'PEP Screening',
  media: 'Adverse Media', txn: 'Transactions', crypto: 'Crypto Screening',
  vessel: 'Vessel Screening', sar: 'SAR Form', report: 'Compliance Report',
  analytics: 'Analytics', audit: 'Audit Log', lists: 'Lists',
  marketplace: 'Marketplace', config: 'Configuration', billing: 'Billing',
  team: 'Team', admin: 'Admin', tenants: 'Tenants', health: 'System Health',
  keys: 'API Keys', webhooks: 'Webhooks', platform: 'Platform',
  users: 'Users', overview: 'Overview', tasks: 'Task History',
  operations: 'Operations', ubo: 'UBO Chain', edd: 'EDD Workflow',
  'data-sources': 'Data Sources', 'txn-screen': 'Txn Screening',
  'source-health': 'Source Health', 'data-coverage': 'Data Coverage',
}

export function Breadcrumbs() {
  const location = useLocation()
  const parts = location.pathname.split('/').filter(Boolean)

  if (parts.length <= 1) return null

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-xs px-lg py-sm text-[12px]">
      <Link to="/dashboard" className="text-apple-label-tertiary transition-colors"
        style={{ ['--hover-color' as string]: 'var(--dash-text)' }}>
        <Home className="w-3.5 h-3.5" />
      </Link>
      {parts.map((part, i) => {
        const path = '/' + parts.slice(0, i + 1).join('/')
        const isLast = i === parts.length - 1
        const label = labelMap[part] || part
        return (
          <React.Fragment key={path}>
            <ChevronRight className="w-3 h-3 rtl:rotate-180" style={{ color: 'var(--dash-text-tertiary)' }} />
            {isLast ? (
              <span style={{ color: 'var(--dash-text-secondary)' }}>{label}</span>
            ) : (
              <Link to={path} className="text-apple-label-tertiary transition-colors">
                {label}
              </Link>
            )}
          </React.Fragment>
        )
      })}
    </nav>
  )
}
