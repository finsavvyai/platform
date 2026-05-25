import { Badge } from '../ui/Badge'

interface PlatformUser {
  id: string; email: string; name?: string; role: string; tenant_id?: string;
}

const roleColor: Record<string, 'red' | 'purple' | 'orange' | 'gray'> = {
  admin: 'red', analyst: 'purple', auditor: 'orange', viewer: 'gray',
}

export function PlatformUserCard({ user }: { user: PlatformUser }) {
  const initials = (user.name ?? user.email).slice(0, 2).toUpperCase()
  return (
    <div className="glass-panel rounded-apple-lg p-lg">
      <div className="flex items-center gap-md">
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-indigo-600/20 flex items-center justify-center">
          <span className="text-sm font-semibold text-indigo-600">{initials}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="sf-body font-medium truncate" style={{ color: 'var(--dash-text)' }}>
            {user.name ?? '\u2014'}
          </p>
          <p className="sf-caption truncate" style={{ color: 'var(--dash-text-secondary)' }}>
            {user.email}
          </p>
        </div>
        <Badge size="sm" color={roleColor[user.role] ?? 'gray'}>{user.role}</Badge>
      </div>
    </div>
  )
}
