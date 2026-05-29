import { useEffect, useState } from 'react'
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
import { Badge } from '@/components/ui/badge'
import { Building2, Filter, RefreshCcw } from 'lucide-react'

interface TenantFiltersProps {
  filters: Record<string, any>
  onChange: (filters: Record<string, any>) => void
  onCreateTenant: () => void
  onRefresh: () => void
}

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'TRIAL', label: 'Trial' },
  { value: 'PENDING_CANCELLATION', label: 'Pending cancellation' },
]

export function TenantFilters({
  filters,
  onChange,
  onCreateTenant,
  onRefresh,
}: TenantFiltersProps) {
  const [search, setSearch] = useState(filters.search ?? '')

  useEffect(() => {
    setSearch(filters.search ?? '')
  }, [filters.search])

  const toggleFilter = (key: string, value: string) => {
    const current = new Set<string>(Array.isArray(filters[key]) ? filters[key] : [])
    if (current.has(value)) {
      current.delete(value)
    } else {
      current.add(value)
    }
    const nextFilters = { ...filters }
    if (current.size === 0) {
      delete nextFilters[key]
    } else {
      nextFilters[key] = Array.from(current)
    }
    nextFilters.offset = 0
    onChange(nextFilters)
  }

  const activeStatusChips = Array.isArray(filters.status) ? filters.status : []

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-1 items-center gap-2">
        <div className="relative w-full md:w-80">
          <Input
            value={search}
            placeholder="Search tenants by name or domain"
            onChange={(event) => {
              const value = event.target.value
              setSearch(value)
              onChange({ ...filters, search: value, offset: 0 })
            }}
            className="pl-3"
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
            <DropdownMenuLabel>Status</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {STATUS_OPTIONS.map((option) => (
              <DropdownMenuCheckboxItem
                key={option.value}
                checked={activeStatusChips.includes(option.value)}
                onCheckedChange={() => toggleFilter('status', option.value)}
              >
                {option.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-wrap items-center gap-2 md:justify-end">
        {activeStatusChips.map((status) => (
          <Badge key={status} variant="outline" className="capitalize">
            {status.toLowerCase()}
          </Badge>
        ))}
        <Button variant="outline" onClick={onRefresh}>
          <RefreshCcw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
        <Button onClick={onCreateTenant} className="gap-2">
          <Building2 className="h-4 w-4" />
          New tenant
        </Button>
      </div>
    </div>
  )
}
