import { TFunction } from 'i18next'
import { Pencil, Trash2 } from 'lucide-react'

export interface TenantSummary {
  id: string
  name: string
  display_name: string
  created_at: string
  plan?: string
  subscription_status?: string
  screening_count?: number
  sanctions_count?: number
  role?: string
  user_count?: number
}

interface Props {
  tenant: TenantSummary
  t: TFunction
  onEdit: () => void
  onDelete: () => void
}

export function TenantRow({ tenant, t, onEdit, onDelete }: Props) {
  const plan = tenant.plan || t('tenants.free')
  const statusColor = tenant.subscription_status === 'active'
    ? 'bg-apple-green/15 text-apple-green'
    : tenant.subscription_status === 'past_due' || tenant.subscription_status === 'canceled'
      ? 'bg-apple-red/15 text-apple-red'
      : 'bg-white/10'

  return (
    <div className="w-full px-lg py-md flex items-center gap-md min-h-[56px]">
      <button type="button" onClick={onEdit}
        className="flex-1 min-w-0 text-left cursor-pointer group">
        <div className="flex items-center gap-sm flex-wrap">
          <span className="sf-headline truncate group-hover:underline">
            {tenant.display_name || tenant.name}
          </span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColor}`}
            style={{ color: 'var(--dash-text-secondary)' }}>
            {plan}{tenant.subscription_status ? ` · ${tenant.subscription_status}` : ''}
          </span>
          {tenant.role && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10"
              style={{ color: 'var(--dash-text-secondary)' }}>
              {tenant.role}
            </span>
          )}
        </div>
        <div className="flex items-center gap-lg mt-xs flex-wrap">
          <span className="sf-caption" style={{ color: 'var(--dash-text-tertiary)' }}>
            {tenant.id}
          </span>
          <span className="sf-caption" style={{ color: 'var(--dash-text-tertiary)' }}>
            {t('tenants.screenings_count', { count: tenant.screening_count ?? 0 })}
          </span>
          {typeof tenant.sanctions_count === 'number' && (
            <span className="sf-caption" style={{ color: 'var(--dash-text-tertiary)' }}>
              {t('tenants.sanctions_count', { count: tenant.sanctions_count })}
            </span>
          )}
          {typeof tenant.user_count === 'number' && (
            <span className="sf-caption" style={{ color: 'var(--dash-text-tertiary)' }}>
              {t('tenants.users_count', { count: tenant.user_count })}
            </span>
          )}
        </div>
      </button>
      <button type="button" onClick={onEdit}
        aria-label={t('tenants.edit')}
        className="p-2 rounded hover:bg-white/10 cursor-pointer min-h-[44px] min-w-[44px]
          flex items-center justify-center">
        <Pencil className="w-4 h-4" />
      </button>
      <button type="button" onClick={onDelete}
        aria-label={t('tenants.delete')}
        className="p-2 rounded hover:bg-red-500/20 cursor-pointer min-h-[44px] min-w-[44px]
          flex items-center justify-center text-red-500">
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  )
}
