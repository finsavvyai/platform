import { TFunction } from 'i18next'
import { Trash2 } from 'lucide-react'

interface ScreeningSectionProps {
  label: string
  count: number
  sanctionsCount?: number
  t: TFunction
}

export function ScreeningSection({ label, count, sanctionsCount, t }: ScreeningSectionProps) {
  return (
    <div className="card-vibrancy p-xl">
      <h2 className="sf-headline mb-md">{label}</h2>
      <p className="sf-body">{t('tenant_detail.total_screenings', { count })}</p>
      {typeof sanctionsCount === 'number' && (
        <p className="sf-body mt-xs">
          {t('tenant_detail.total_sanctions', { count: sanctionsCount })}
        </p>
      )}
    </div>
  )
}

interface ConfigSectionProps {
  threshold: string
  setThreshold: (v: string) => void
  onSave: () => void
  t: TFunction
}

export function ConfigSection({
  threshold, setThreshold, onSave, t,
}: ConfigSectionProps) {
  return (
    <div className="card-vibrancy p-xl">
      <h2 className="sf-headline mb-md">
        {t('tenant_detail.config_override')}
      </h2>
      <div className="flex items-center gap-md">
        <label htmlFor="threshold-input" className="sf-body">
          {t('tenant_detail.match_threshold')}
        </label>
        <input id="threshold-input" type="number" min="50" max="99"
          value={threshold}
          aria-label={t('tenant_detail.match_threshold')}
          onChange={e => setThreshold(e.target.value)}
          className="input-field w-20" />
        <button onClick={onSave} className="button-primary"
          aria-label={t('tenant_detail.save')}>
          {t('tenant_detail.save')}
        </button>
      </div>
    </div>
  )
}

interface IdentitySectionProps {
  displayName: string
  setDisplayName: (v: string) => void
  onSave: () => void
  role?: string
  t: TFunction
}

export function IdentitySection({
  displayName, setDisplayName, onSave, role, t,
}: IdentitySectionProps) {
  return (
    <div className="card-vibrancy p-xl">
      <h2 className="sf-headline mb-md">{t('tenant_detail.identity')}</h2>
      <div className="flex items-center gap-md mb-md">
        <label htmlFor="display-name-input" className="sf-body">
          {t('tenant_detail.display_name')}
        </label>
        <input id="display-name-input" type="text"
          value={displayName}
          aria-label={t('tenant_detail.display_name')}
          onChange={e => setDisplayName(e.target.value)}
          className="input-field flex-1" />
        <button onClick={onSave} className="button-primary"
          aria-label={t('tenant_detail.save')}>
          {t('tenant_detail.save')}
        </button>
      </div>
      {role && (
        <p className="sf-caption" style={{ color: 'var(--dash-text-secondary)' }}>
          {t('tenant_detail.role')}: {role}
        </p>
      )}
    </div>
  )
}

interface SubscriptionSectionProps {
  plan?: string
  status?: string
  userCount?: number
  t: TFunction
}

export function SubscriptionSection({
  plan, status, userCount, t,
}: SubscriptionSectionProps) {
  return (
    <div className="card-vibrancy p-xl">
      <h2 className="sf-headline mb-md">{t('tenant_detail.subscription')}</h2>
      <dl className="space-y-xs">
        <div className="flex justify-between">
          <dt className="sf-body">{t('tenant_detail.plan')}</dt>
          <dd className="sf-body font-medium">{plan || t('tenant_detail.free')}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="sf-body">{t('tenant_detail.status')}</dt>
          <dd className="sf-body font-medium">{status || '—'}</dd>
        </div>
        {typeof userCount === 'number' && (
          <div className="flex justify-between">
            <dt className="sf-body">{t('tenant_detail.users')}</dt>
            <dd className="sf-body font-medium">{userCount}</dd>
          </div>
        )}
      </dl>
    </div>
  )
}

interface DangerZoneProps { onDelete: () => void; t: TFunction }

export function DangerZoneSection({ onDelete, t }: DangerZoneProps) {
  return (
    <div className="card-vibrancy p-xl border border-red-500/30">
      <h2 className="sf-headline mb-xs text-red-500">
        {t('tenant_detail.danger_zone')}
      </h2>
      <p className="sf-caption mb-md" style={{ color: 'var(--dash-text-secondary)' }}>
        {t('tenant_detail.delete_warning')}
      </p>
      <button type="button" onClick={onDelete}
        className="inline-flex items-center gap-sm px-md py-sm rounded-lg
          bg-red-600 text-white hover:bg-red-700 cursor-pointer text-sm font-medium">
        <Trash2 className="w-4 h-4" /> {t('tenant_detail.delete_tenant')}
      </button>
    </div>
  )
}
