import { ColumnDef } from '@tanstack/react-table'
import { ArrowUpDown, Mail, Shield } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { User as ManagedUser } from '@/types/user-management'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { cn } from '@/lib/utils'

const statusVariantMap: Record<string, React.ComponentProps<typeof Badge>['variant']> = {
  ACTIVE: 'success',
  INACTIVE: 'secondary',
  SUSPENDED: 'destructive',
  PENDING: 'warning',
  LOCKED: 'destructive',
}

export const userColumns: ColumnDef<ManagedUser>[] = [
  {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <Button
        variant="ghost"
        className="px-0 font-semibold"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        User
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const user = row.original
      return (
        <div className="flex flex-col">
          <span className="font-medium text-foreground">{user.name}</span>
          <span className="text-sm text-muted-foreground flex items-center gap-1">
            <Mail className="h-3.5 w-3.5" />
            {user.email}
          </span>
        </div>
      )
    },
  },
  {
    accessorKey: 'role.displayName',
    header: 'Role',
    cell: ({ row }) => {
      const role = row.original.role
      return (
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{role.displayName || role.name}</span>
        </div>
      )
    },
    sortingFn: 'alphanumeric',
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const status = row.original.status
      const variant = statusVariantMap[status] ?? 'secondary'
      return (
        <Badge variant={variant}>{status.toLowerCase()}</Badge>
      )
    },
  },
  {
    accessorKey: 'tenantName',
    header: 'Tenant',
    cell: ({ row }) => row.original.tenantName ?? '—',
  },
  {
    accessorKey: 'lastLoginAt',
    header: 'Last Active',
    cell: ({ row }) => {
      const lastLogin = row.original.lastLoginAt
      if (!lastLogin) {
        return <span className="text-muted-foreground">No activity</span>
      }

      try {
        const parsed = typeof lastLogin === 'string' ? parseISO(lastLogin) : lastLogin
        return (
          <span className="text-sm text-muted-foreground">
            {formatDistanceToNow(parsed, { addSuffix: true })}
          </span>
        )
      } catch (_error) {
        return <span className="text-muted-foreground">{lastLogin}</span>
      }
    },
  },
  {
    accessorKey: 'mfaEnabled',
    header: 'MFA',
    cell: ({ row }) => (
      <Badge variant={row.original.mfaEnabled ? 'success' : 'secondary'}>
        {row.original.mfaEnabled ? 'Enabled' : 'Disabled'}
      </Badge>
    ),
  },
  {
    accessorKey: 'emailVerified',
    header: 'Email Verified',
    cell: ({ row }) => (
      <span className={cn(
        'text-sm font-medium',
        row.original.emailVerified ? 'text-emerald-600' : 'text-muted-foreground'
      )}>
        {row.original.emailVerified ? 'Verified' : 'Pending'}
      </span>
    ),
  },
]
