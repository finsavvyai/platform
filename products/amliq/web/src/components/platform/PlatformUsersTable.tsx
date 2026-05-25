import { Badge } from '../ui/Badge'

interface PlatformUser {
  id: string; email: string; name?: string; role: string; tenant_id?: string;
}

const roleColor: Record<string, 'red' | 'purple' | 'orange' | 'gray'> = {
  admin: 'red', analyst: 'purple', auditor: 'orange', viewer: 'gray',
}

export function PlatformUsersTable({ users, t }: { users: PlatformUser[]; t: (k: string) => string }) {
  return (
    <div className="glass-panel rounded-apple-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b"
            style={{ color: 'var(--dash-text-secondary)', borderColor: 'var(--dash-border)' }}>
            <th className="px-lg py-md">{t('users.email')}</th>
            <th className="px-lg py-md">Name</th>
            <th className="px-lg py-md">{t('users.role')}</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id} className="border-b transition-colors"
              style={{ borderColor: 'var(--dash-border)' }}>
              <td className="px-lg py-md sf-body" style={{ color: 'var(--dash-text)' }}>{u.email}</td>
              <td className="px-lg py-md sf-body" style={{ color: 'var(--dash-text)' }}>{u.name ?? '\u2014'}</td>
              <td className="px-lg py-md">
                <Badge size="sm" color={roleColor[u.role] ?? 'gray'}>{u.role}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
