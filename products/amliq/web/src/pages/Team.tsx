import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { EmptyState } from '../components/ui/EmptyState'
import { api } from '../api/client'
import { TeamRow } from '../components/team/TeamRow'

interface Member {
  ID: string; Email: string; Role: string; ActivatedAt: string
}

export function Team() {
  const { t } = useTranslation('team')
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('analyst')
  const [inviting, setInviting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await api.get<{ members: Member[] }>('/team')
      setMembers(d?.members ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load team')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const invite = async () => {
    if (!email.trim()) return
    setInviting(true); setError('')
    try { await api.post('/team/invite', { email, role }); setEmail(''); load() }
    catch (err) { setError(err instanceof Error ? err.message : 'Invite failed') }
    finally { setInviting(false) }
  }

  const remove = async (id: string) => {
    if (!confirm('Remove this team member?')) return
    try { await api.del(`/team/${id}`); load() }
    catch (err) { setError(err instanceof Error ? err.message : 'Remove failed') }
  }

  const changeRole = async (id: string, newRole: string) => {
    try { await api.put(`/team/${id}/role`, { role: newRole }); load() }
    catch (err) { setError(err instanceof Error ? err.message : 'Role change failed') }
  }

  return (
    <div>
      <PageHeader title={t('title')} description="Manage your team members and roles" />
      <Card className="mb-lg">
        <div className="flex flex-col md:flex-row gap-sm">
          <input placeholder={t('email_placeholder')} value={email}
            aria-label={t('email_placeholder')}
            onChange={e => setEmail(e.target.value)} className="input-field flex-1" />
          <select value={role} onChange={e => setRole(e.target.value)}
            aria-label={t('roles.label')} className="input-field">
            {['admin', 'analyst', 'auditor', 'viewer'].map(r => (
              <option key={r} value={r}>{t(`roles.${r}`)}</option>
            ))}
          </select>
          <Button onClick={invite} disabled={inviting || !email.trim()}>
            {inviting ? 'Inviting...' : t('invite')}
          </Button>
        </div>
      </Card>
      {error && <Card className="mb-lg"><p role="alert" className="text-apple-red sf-body">{error}</p></Card>}
      {loading && <LoadingSpinner />}
      {!loading && members.length === 0 && <EmptyState title={t('no_members')} />}
      {!loading && members.length > 0 && (
        <Card>{members.map(m => (
          <TeamRow key={m.ID} member={m} onRemove={remove} onChangeRole={changeRole} />
        ))}</Card>
      )}
    </div>
  )
}

export default Team
