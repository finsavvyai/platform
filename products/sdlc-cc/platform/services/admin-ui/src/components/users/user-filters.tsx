import { useEffect, useMemo, useState } from 'react'
import { Search, Filter, Users, UserPlus, Building2, ShieldCheck } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Tenant, UserListParams, UserRole, UserStatus } from '@/types/user-management'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface UserFiltersProps {
  filters: UserListParams
  roles: UserRole[]
  tenants: Tenant[]
  selectedCount: number
  onChange: (filters: Partial<UserListParams>) => void
  onInvite: () => void
  onBulkAction: () => void
  onRefresh: () => void
}

const STATUS_OPTIONS: Array<{ value: UserStatus; label: string }> = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'LOCKED', label: 'Locked' },
]

export function UserFilters({
  filters,
  roles,
  tenants,
  selectedCount,
  onChange,
  onInvite,
  onBulkAction,
  onRefresh,
}: UserFiltersProps) {
  const [searchValue, setSearchValue] = useState(filters.search ?? '')

  useEffect(() => {
    setSearchValue(filters.search ?? '')
  }, [filters.search])

  const toggleFilter = <T extends keyof UserListParams>(key: T, value: string) => {
    const current = new Set<string>(Array.isArray(filters[key]) ? (filters[key] as string[]) : [])
    if (current.has(value)) {
      current.delete(value)
    } else {
      current.add(value)
    }

    const nextFilters: Partial<UserListParams> = { ...filters }
    if (current.size === 0) {
      delete nextFilters[key]
    } else {
      nextFilters[key] = Array.from(current) as any
    }
    nextFilters.offset = 0
    onChange(nextFilters)
  }

  const isActive = (key: keyof UserListParams, value: string) =>
    Array.isArray(filters[key]) && (filters[key] as string[]).includes(value)

  const statusLookup = useMemo(
    () => Object.fromEntries(STATUS_OPTIONS.map((option) => [option.value, option.label])),
    []
  )
  const roleLookup = useMemo(
    () =>
      Object.fromEntries(
        roles.map((role) => [role.id, role.displayName || role.name])
      ),
    [roles]
  )
  const tenantLookup = useMemo(
    () =>
      Object.fromEntries(
        tenants.map((tenant) => [tenant.id, tenant.displayName || tenant.name])
      ),
    [tenants]
  )

  const getFilterLabel = (filter: { type: string; value: string }) => {
    switch (filter.type) {
      case 'status':
        return statusLookup[filter.value] ?? filter.value
      case 'role':
        return roleLookup[filter.value] ?? filter.value
      case 'tenant':
        return tenantLookup[filter.value] ?? filter.value
      default:
        return filter.value
    }
  }

  const activeFilters = [
    ...(filters.status?.map((status) => ({ type: 'status', value: status })) ?? []),
    ...(filters.role?.map((role) => ({ type: 'role', value: role })) ?? []),
    ...(filters.tenant?.map((tenant) => ({ type: 'tenant', value: tenant })) ?? []),
  ]

  const clearFilters = () => {
    onChange({
      status: undefined,
      role: undefined,
      tenant: undefined,
      department: undefined,
      location: undefined,
      mfaEnabled: undefined,
      emailVerified: undefined,
      search: filters.search,
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative w-full md:w-80">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchValue}
              placeholder="Search users by name, email, or department"
              className="pl-8"
              onChange={(event) => {
                const value = event.target.value
                setSearchValue(value)
                onChange({ search: value, offset: 0 })
              }}
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Filter className="h-4 w-4" />
                Filters
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuLabel className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Status
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {STATUS_OPTIONS.map((option) => (
                <DropdownMenuCheckboxItem
                  key={option.value}
                  checked={isActive('status', option.value)}
                  onCheckedChange={() => toggleFilter('status', option.value)}
                  className="capitalize"
                >
                  {option.label}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                Roles
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {roles.map((role) => (
                <DropdownMenuCheckboxItem
                  key={role.id}
                  checked={isActive('role', role.id)}
                  onCheckedChange={() => toggleFilter('role', role.id)}
                >
                  {role.displayName || role.name}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Tenants
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {tenants.map((tenant) => (
                <DropdownMenuCheckboxItem
                  key={tenant.id}
                  checked={isActive('tenant', tenant.id)}
                  onCheckedChange={() => toggleFilter('tenant', tenant.id)}
                >
                  {tenant.displayName}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {activeFilters.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          <Button variant="outline" onClick={onRefresh}>
            Refresh
          </Button>
          <Button variant="outline" onClick={onBulkAction} disabled={selectedCount === 0}>
            Bulk actions
            {selectedCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {selectedCount}
              </Badge>
            )}
          </Button>
          <Button onClick={onInvite} className="gap-2">
            <UserPlus className="h-4 w-4" />
            Invite users
          </Button>
        </div>
      </div>

      {activeFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Active filters:</span>
          {activeFilters.map((filter) => (
            <Badge
              key={`${filter.type}-${filter.value}`}
              variant="outline"
              className="flex items-center gap-1"
            >
              <span className="capitalize">{filter.type}</span>
              <span className={cn('font-semibold')}>
                {getFilterLabel(filter)}
              </span>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
