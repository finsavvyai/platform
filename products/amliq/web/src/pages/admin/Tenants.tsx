import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../../components/layout/PageHeader'
import { SearchField } from '../../components/ui/SearchField'
import { ConfirmModal } from '../../components/ui/ConfirmModal'
import { TenantRow, TenantSummary } from '../../components/admin/TenantRow'
import { api, ApiError } from '../../api/client'

export function AdminTenants() {
  const { t } = useTranslation('admin')
  const [tenants, setTenants] = useState<TenantSummary[]>([])
  const [search, setSearch] = useState('')
  const [toDelete, setToDelete] = useState<TenantSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  const load = useCallback(() => {
    api.get<{ tenants: TenantSummary[] }>('/admin/tenants')
      .then(d => setTenants(d?.tenants ?? []))
      .catch(() => setTenants([]))
  }, [])

  useEffect(() => { load() }, [load])

  const q = search.toLowerCase()
  const filtered = tenants.filter(
    tn => (tn.name ?? '').toLowerCase().includes(q)
      || (tn.display_name ?? '').toLowerCase().includes(q)
  )

  const handleDelete = async () => {
    if (!toDelete) return
    try {
      await api.del(`/admin/tenants/${toDelete.id}`)
      setToDelete(null)
      setError(null)
      load()
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : t('tenants.delete_failed')
      setError(msg)
      setToDelete(null)
    }
  }

  return (
    <div>
      <PageHeader title={t('tenants.title')} />
      <div className="mb-lg">
        <SearchField placeholder={t('tenants.search_placeholder')}
          value={search} onChange={setSearch} />
      </div>
      {error && (
        <p role="alert" className="sf-caption mb-md text-red-500">{error}</p>
      )}
      <div className="glass-panel rounded-apple-lg divide-y"
        style={{ borderColor: 'var(--dash-border)' }}>
        {filtered.map(tn => (
          <TenantRow key={tn.id} tenant={tn} t={t}
            onEdit={() => navigate(`/admin/tenants/${tn.id}`)}
            onDelete={() => setToDelete(tn)} />
        ))}
        {filtered.length === 0 && (
          <p className="sf-caption text-center py-xl"
            style={{ color: 'var(--dash-text-secondary)' }}>
            {t('tenants.empty')}
          </p>
        )}
      </div>
      <ConfirmModal
        open={toDelete != null}
        title={t('tenants.delete_title')}
        message={t('tenants.delete_message', { name: toDelete?.display_name || toDelete?.name || '' })}
        confirmLabel={t('tenants.delete_confirm')}
        cancelLabel={t('tenants.cancel')}
        variant="destructive"
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)} />
    </div>
  )
}

export default AdminTenants
