import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { BulkUserOperation, UserRole } from '@/types/user-management'
import {
  UserCheck,
  UserX,
  UserCog,
  UserMinus,
  Shield,
  ShieldOff,
} from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface UserBulkActionsProps {
  open: boolean
  selectedCount: number
  userIds: string[]
  roles: UserRole[]
  processingAction?: string | null
  onSubmit: (operation: BulkUserOperation) => Promise<void>
  onClose: () => void
}

const ACTIONS: Array<{
  id: BulkUserOperation['action']
  label: string
  description: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  requiresParams?: boolean
}> = [
  {
    id: 'activate',
    label: 'Activate users',
    description: 'Enable login for selected users',
    icon: UserCheck,
  },
  {
    id: 'deactivate',
    label: 'Deactivate users',
    description: 'Temporarily disable access',
    icon: UserX,
  },
  {
    id: 'delete',
    label: 'Delete users',
    description: 'Permanently remove accounts',
    icon: UserMinus,
  },
  {
    id: 'update_role',
    label: 'Change role',
    description: 'Assign a new role to selected users',
    icon: UserCog,
    requiresParams: true,
  },
]

export function UserBulkActions({
  open,
  selectedCount,
  userIds,
  roles,
  processingAction,
  onSubmit,
  onClose,
}: UserBulkActionsProps) {
  const [selectedRole, setSelectedRole] = useState<string>('')

  if (!open) {
    return null
  }

  useEffect(() => {
    if (!open) {
      setSelectedRole('')
    }
  }, [open])

  const handleSubmit = async (action: BulkUserOperation['action']) => {
    const params: BulkUserOperation['params'] = {}
    if (action === 'update_role') {
      if (!selectedRole) {
        return
      }
      params.roleId = selectedRole
    }

    await onSubmit({
      action,
      userIds,
      params,
    })
    onClose()
  }

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            Bulk actions
            <Badge variant="default">{selectedCount} selected</Badge>
          </CardTitle>
          <CardDescription>
            Apply changes to all selected users at once.
          </CardDescription>
        </div>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          {ACTIONS.map((action) => {
            const Icon = action.icon
            return (
              <Button
                key={action.id}
                variant="outline"
                className="h-auto justify-start gap-3 whitespace-normal py-4 text-left"
                disabled={
                  (action.requiresParams && !selectedRole) ||
                  processingAction === action.id
                }
                onClick={() => handleSubmit(action.id)}
              >
                <Icon className="h-5 w-5 text-primary" />
                <span>
                  <span className="block text-sm font-semibold">{action.label}</span>
                  <span className="text-xs text-muted-foreground">{action.description}</span>
                </span>
              </Button>
            )
          })}
        </div>

        <div className="flex flex-col gap-2 rounded-md border border-dashed border-primary/30 p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Shield className="h-4 w-4 text-primary" />
            Role assignment
          </div>
          <p className="text-sm text-muted-foreground">
            Choose a role before applying the <strong>Change role</strong> bulk action.
          </p>
          <Select value={selectedRole} onValueChange={setSelectedRole}>
            <SelectTrigger>
              <SelectValue placeholder="Select a role" />
            </SelectTrigger>
            <SelectContent>
              {roles.map((role) => (
                <SelectItem key={role.id} value={role.id}>
                  {role.displayName || role.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedRole ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Shield className="h-3 w-3 text-primary" />
              Users will receive the selected role.
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-destructive">
              <ShieldOff className="h-3 w-3" />
              Select a role to enable the role change action.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
