import { Badge } from '../ui/Badge'

interface Member {
  ID: string; Email: string; Role: string; ActivatedAt: string
}

const roleColor = { admin: 'red', analyst: 'purple', auditor: 'orange', viewer: 'green' } as const

export function TeamRow({ member, onRemove, onChangeRole }: {
  member: Member; onRemove: (id: string) => void; onChangeRole: (id: string, role: string) => void
}) {
  return (
    <div className="px-lg py-md flex flex-col sm:flex-row sm:items-center justify-between border-b last:border-0 gap-sm"
      style={{ borderColor: 'var(--dash-border)' }}>
      <div className="min-w-0">
        <p className="sf-body truncate">{member.Email}</p>
        <p className="sf-caption" style={{ color: 'var(--dash-text-tertiary)' }}>
          {new Date(member.ActivatedAt).toLocaleDateString()}
        </p>
      </div>
      <div className="flex items-center gap-md shrink-0">
        <select value={member.Role} onChange={e => onChangeRole(member.ID, e.target.value)}
          className="bg-transparent text-sm cursor-pointer min-h-[44px]"
          style={{ color: 'var(--dash-text)' }}>
          {['admin', 'analyst', 'auditor', 'viewer'].map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <Badge color={roleColor[member.Role as keyof typeof roleColor] ?? 'purple'} size="sm">
          {member.Role}
        </Badge>
        <button onClick={() => onRemove(member.ID)}
          className="text-apple-red/60 hover:text-apple-red text-sm cursor-pointer min-h-[44px]">
          Remove
        </button>
      </div>
    </div>
  )
}
