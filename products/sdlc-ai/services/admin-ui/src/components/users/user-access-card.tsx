import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { Permission, User as ManagedUser } from '@/types/user-management'
import { Lock, Shield, Unlock } from 'lucide-react'

interface UserAccessCardProps {
  user: ManagedUser | null
}

export function UserAccessCard({ user }: UserAccessCardProps) {
  const permissions: Permission[] = user?.permissions ?? []

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-5 w-5 text-primary" />
          Access controls
        </CardTitle>
        <CardDescription>
          Permissions compiled from assigned roles and direct grants.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {user ? (
          <>
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Role
              </p>
              <Badge variant="outline" className="w-fit">
                {user.role.displayName || user.role.name}
              </Badge>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Permissions ({permissions.length})
              </p>
              {permissions.length === 0 ? (
                <div className="mt-2 rounded-md border border-dashed border-muted-foreground/30 p-4 text-sm text-muted-foreground">
                  This user inherits permissions through the assigned role.
                </div>
              ) : (
                <ul className="mt-2 grid gap-2 md:grid-cols-2">
                  {permissions.map((permission) => (
                    <li
                      key={permission.id}
                      className="flex items-start gap-2 rounded-md border border-border p-3"
                    >
                      <Shield className="mt-0.5 h-4 w-4 text-primary" />
                      <div>
                        <p className="text-sm font-medium">{permission.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {permission.resource} · {permission.action}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        ) : (
          <div className="rounded-md border border-dashed border-muted-foreground/30 p-4 text-sm text-muted-foreground">
            Select a user to view access details.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
