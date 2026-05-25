import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '../../components/layout/PageHeader'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { Badge } from '../../components/ui/Badge'
import { SearchField } from '../../components/ui/SearchField'
import { api } from '../../api/client'
import { PlatformUsersTable } from '../../components/platform/PlatformUsersTable'
import { PlatformUserCard } from '../../components/platform/PlatformUserCard'

interface PlatformUser {
  id: string; email: string; name?: string; role: string; tenant_id?: string;
}

export default function PlatformUsers() {
  const { t } = useTranslation('platform')
  const [users, setUsers] = useState<PlatformUser[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<{ users: PlatformUser[] }>('/platform/users')
      .then(d => setUsers(d?.users ?? []))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex items-center justify-center h-96"><LoadingSpinner /></div>

  const q = search.toLowerCase()
  const filtered = users.filter(u =>
    (u.email ?? '').toLowerCase().includes(q) || (u.name ?? '').toLowerCase().includes(q)
  )

  return (
    <div>
      <PageHeader title={t('users.title')} description={`${users.length} users`} />
      <div className="mb-lg">
        <SearchField placeholder={t('users.search_placeholder')} value={search} onChange={setSearch} />
      </div>
      <div className="hidden md:block"><PlatformUsersTable users={filtered} t={t} /></div>
      <div className="md:hidden space-y-sm">
        {filtered.map(u => <PlatformUserCard key={u.id} user={u} />)}
      </div>
      {filtered.length === 0 && (
        <p className="text-center py-xl sf-body" style={{ color: 'var(--dash-text-tertiary)' }}>No users found</p>
      )}
    </div>
  )
}
