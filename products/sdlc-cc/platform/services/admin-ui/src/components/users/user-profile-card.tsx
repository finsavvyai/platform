import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { User as ManagedUser } from '@/types/user-management'
import { Mail, Phone, Shield, Users, Key } from 'lucide-react'

interface UserProfileCardProps {
  user: ManagedUser | null
  loading?: boolean
  onEdit?: () => void
  onResetMfa?: () => void
}

const statusVariantMap: Record<string, React.ComponentProps<typeof Badge>['variant']> = {
  ACTIVE: 'success',
  INACTIVE: 'secondary',
  SUSPENDED: 'destructive',
  PENDING: 'warning',
  LOCKED: 'destructive',
}

export function UserProfileCard({ user, loading, onEdit, onResetMfa }: UserProfileCardProps) {
  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-xl font-semibold">{user?.name ?? 'Loading user…'}</CardTitle>
          <CardDescription>{user?.email || 'Fetching account details'}</CardDescription>
        </div>
        {user && (
          <Badge variant={statusVariantMap[user.status] ?? 'secondary'} className="uppercase">
            {user.status}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {user ? (
          <>
            <dl className="grid gap-3 text-sm md:grid-cols-2">
              <div className="flex flex-col gap-1 rounded-md border border-border p-3">
                <span className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" />
                  Email
                </span>
                <span className="font-medium">{user.email}</span>
              </div>
              <div className="flex flex-col gap-1 rounded-md border border-border p-3">
                <span className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  Tenant
                </span>
                <span className="font-medium">{user.tenantName ?? user.tenantId}</span>
              </div>
              {user.phone && (
                <div className="flex flex-col gap-1 rounded-md border border-border p-3">
                  <span className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" />
                    Phone
                  </span>
                  <span className="font-medium">{user.phone}</span>
                </div>
              )}
              <div className="flex flex-col gap-1 rounded-md border border-border p-3">
                <span className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                  <Shield className="h-3.5 w-3.5" />
                  Role
                </span>
                <span className="font-medium">{user.role.displayName || user.role.name}</span>
              </div>
              <div className="flex flex-col gap-1 rounded-md border border-border p-3">
                <span className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                  <Key className="h-3.5 w-3.5" />
                  MFA
                </span>
                <span className="font-medium">
                  {user.mfaEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <div className="flex flex-col gap-1 rounded-md border border-border p-3">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  Email verification
                </span>
                <span className="font-medium">
                  {user.emailVerified ? 'Verified' : 'Pending verification'}
                </span>
              </div>
            </dl>
            <div className="flex flex-wrap gap-2">
              <Button variant="default" onClick={onEdit} disabled={loading}>
                Edit profile
              </Button>
              <Button variant="outline" onClick={onResetMfa} disabled={loading || !user.mfaEnabled}>
                Reset MFA
              </Button>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            {loading ? 'Loading user details…' : 'User not found.'}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
