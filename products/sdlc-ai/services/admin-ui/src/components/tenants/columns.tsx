import { ColumnDef } from '@tanstack/react-table'
import type { Tenant } from '@/types/user-management'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowUpDown, BarChart3, Building2 } from 'lucide-react'
import { formatDistanceToNow, parseISO } from 'date-fns'

const statusVariant: Record<string, React.ComponentProps<typeof Badge>['variant']> = {
  ACTIVE: 'success',
  INACTIVE: 'secondary',
  SUSPENDED: 'destructive',
  TRIAL: 'warning',
  PENDING_CANCELLATION: 'warning',
}

export const tenantColumns: ColumnDef<Tenant>[] = [
  {
    accessorKey: 'displayName',
    header: ({ column }) => (
      <Button
        variant="ghost"
        className="px-0 font-semibold"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        Tenant
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const tenant = row.original
      return (
        <div className="flex flex-col">
          <span className="font-medium text-foreground">{tenant.displayName || tenant.name}</span>
          <span className="text-sm text-muted-foreground">{tenant.domain}</span>
        </div>
      )
    },
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => (
      <Badge variant={statusVariant[row.original.status] ?? 'secondary'}>
        {row.original.status.toLowerCase()}
      </Badge>
    ),
  },
  {
    accessorKey: 'plan.displayName',
    header: 'Plan',
    cell: ({ row }) => row.original.plan.displayName || row.original.plan.name,
  },
  {
    accessorKey: 'usage.users',
    header: 'Users',
    cell: ({ row }) => `${row.original.usage.users} / ${row.original.limits.users}`,
  },
  {
    accessorKey: 'usage.storage',
    header: 'Storage',
    cell: ({ row }) => `${row.original.usage.storage} GB / ${row.original.limits.storage} GB`,
  },
  {
    accessorKey: 'usage.lastUpdated',
    header: 'Last updated',
    cell: ({ row }) => {
      const updated = row.original.usage.lastUpdated
      if (!updated) return '—'
      const date = typeof updated === 'string' ? parseISO(updated) : new Date(updated)
      return formatDistanceToNow(date, { addSuffix: true })
    },
  },
  {
    accessorKey: 'isEnterprise',
    header: 'Tier',
    cell: ({ row }) =>
      row.original.isEnterprise ? (
        <Badge variant="info" className="gap-1">
          <BarChart3 className="h-3 w-3" />
          Enterprise
        </Badge>
      ) : (
        <Badge variant="outline">Standard</Badge>
      ),
  },
]
