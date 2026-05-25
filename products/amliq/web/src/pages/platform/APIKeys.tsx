import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Key, Trash2 } from 'lucide-react'
import { PageHeader } from '../../components/layout/PageHeader'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { Badge } from '../../components/ui/Badge'
import { api } from '../../api/client'

interface APIKey {
  id: string; tenant_id: string; product: string;
  key_prefix: string; rate_limit: number; created_at: string;
}

export default function PlatformAPIKeys() {
  const { t } = useTranslation('platform')
  const [keys, setKeys] = useState<APIKey[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<{ api_keys: APIKey[] }>('/platform/keys')
      .then(d => setKeys(d?.api_keys ?? []))
      .catch(() => setKeys([]))
      .finally(() => setLoading(false))
  }, [])

  const handleRevoke = async (keyId: string) => {
    await api.put(`/platform/keys/${keyId}/revoke`, {})
    setKeys(prev => prev.filter(k => k.id !== keyId))
  }

  if (loading) return <div className="flex items-center justify-center h-96"><LoadingSpinner /></div>

  return (
    <div>
      <PageHeader title={t('api_keys.title')} description={`${keys.length} API keys`} />
      <div className="hidden md:block glass-panel rounded-apple-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b" style={{ color: 'var(--dash-text-secondary)', borderColor: 'var(--dash-border)' }}>
              <th className="px-lg py-md">{t('api_keys.prefix')}</th>
              <th className="px-lg py-md">{t('api_keys.tenant')}</th>
              <th className="px-lg py-md">{t('api_keys.product')}</th>
              <th className="px-lg py-md">{t('api_keys.rate_limit')}</th>
              <th className="px-lg py-md">{t('api_keys.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {keys.map(k => (
              <tr key={k.id} className="border-b" style={{ borderColor: 'var(--dash-border)' }}>
                <td className="px-lg py-md font-mono text-xs">{k.key_prefix}...</td>
                <td className="px-lg py-md font-mono text-xs">{k.tenant_id}</td>
                <td className="px-lg py-md"><Badge size="sm" color="purple">{k.product}</Badge></td>
                <td className="px-lg py-md">{k.rate_limit || t('api_keys.unlimited')}</td>
                <td className="px-lg py-md">
                  <button onClick={() => handleRevoke(k.id)}
                    className="text-apple-red text-xs hover:underline cursor-pointer min-h-[44px]">
                    {t('api_keys.revoke')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="md:hidden space-y-sm">
        {keys.map(k => (
          <div key={k.id} className="glass-panel rounded-apple-lg p-lg">
            <div className="flex items-start justify-between mb-sm">
              <div className="flex items-center gap-sm">
                <Key className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                <code className="text-xs font-mono" style={{ color: 'var(--dash-text)' }}>{k.key_prefix}...</code>
              </div>
              <button onClick={() => handleRevoke(k.id)}
                className="p-xs text-apple-red hover:bg-apple-red/10 rounded-apple-md cursor-pointer min-h-[44px]">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-sm">
              <Badge size="sm" color="purple">{k.product}</Badge>
              <span className="sf-caption" style={{ color: 'var(--dash-text-secondary)' }}>
                {k.rate_limit ? `${k.rate_limit} req/min` : t('api_keys.unlimited')}
              </span>
            </div>
            <p className="sf-caption mt-xs truncate" style={{ color: 'var(--dash-text-tertiary)' }}>{k.tenant_id}</p>
          </div>
        ))}
      </div>
      {keys.length === 0 && (
        <p className="text-center py-xl sf-body" style={{ color: 'var(--dash-text-tertiary)' }}>No API keys found</p>
      )}
    </div>
  )
}
