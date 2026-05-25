import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '../../components/layout/PageHeader'
import { ConfirmModal } from '../../components/ui/ConfirmModal'
import {
  ScreeningSection, ConfigSection, IdentitySection,
  SubscriptionSection, DangerZoneSection,
} from '../../components/admin/TenantCards'
import { api } from '../../api/client'

interface TenantInfo {
  tenant: {
    ID: string
    Name: string
    DisplayName: string
    Plan?: string
    SubscriptionStatus?: string
    Role?: string
    UserCount?: number
  }
  screening_count: number
  sanctions_count?: number
}

export function TenantDetail() {
  const { t } = useTranslation('admin')
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [data, setData] = useState<TenantInfo | null>(null)
  const [threshold, setThreshold] = useState('75')
  const [displayName, setDisplayName] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    api.get<TenantInfo>(`/admin/tenants/${id}`)
      .then(d => {
        setData(d)
        setDisplayName(d?.tenant?.DisplayName ?? '')
      })
      .catch(() => setData(null))
  }, [id])

  const saveConfig = () => {
    api.put(`/admin/tenants/${id}/config`, {
      match_threshold: parseFloat(threshold) / 100,
    })
  }

  const saveIdentity = () => {
    api.put(`/admin/tenants/${id}`, { display_name: displayName })
  }

  const deleteTenant = async () => {
    try {
      await api.del(`/admin/tenants/${id}`)
      setConfirmDelete(false)
      navigate('/admin/tenants')
    } catch {
      setConfirmDelete(false)
    }
  }

  if (!data) {
    return (
      <p className="sf-body p-xl" role="status" aria-live="polite">
        {t('tenant_detail.loading')}
      </p>
    )
  }

  return (
    <div>
      <PageHeader title={data.tenant.DisplayName} description={data.tenant.ID} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
        <IdentitySection displayName={displayName} setDisplayName={setDisplayName}
          onSave={saveIdentity} role={data.tenant.Role} t={t} />
        <SubscriptionSection plan={data.tenant.Plan}
          status={data.tenant.SubscriptionStatus}
          userCount={data.tenant.UserCount} t={t} />
        <ScreeningSection label={t('tenant_detail.screening_history')}
          count={data.screening_count}
          sanctionsCount={data.sanctions_count} t={t} />
        <ConfigSection threshold={threshold} setThreshold={setThreshold}
          onSave={saveConfig} t={t} />
        <DangerZoneSection onDelete={() => setConfirmDelete(true)} t={t} />
      </div>
      <ConfirmModal
        open={confirmDelete}
        title={t('tenant_detail.delete_title')}
        message={t('tenant_detail.delete_message', { name: data.tenant.DisplayName })}
        confirmLabel={t('tenant_detail.delete_confirm')}
        cancelLabel={t('tenant_detail.cancel')}
        variant="destructive"
        onConfirm={deleteTenant}
        onCancel={() => setConfirmDelete(false)} />
    </div>
  )
}

export default TenantDetail
