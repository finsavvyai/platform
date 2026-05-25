'use client'

import {
  ChevronDown,
  Filter,
  RefreshCw,
  Search,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { STATUS_CONFIG } from './constants'
import type { UserRole, UserStatus } from '@/types/user-management'

interface UserFiltersPanelProps {
  searchQuery: string
  onSearch: (value: string) => void
  statusFilter: UserStatus[]
  onStatusFilterChange: (status: UserStatus, checked: boolean) => void
  roleFilter: string[]
  onRoleFilterChange: (roleId: string, checked: boolean) => void
  showFilters: boolean
  onToggleFilters: () => void
  userRoles: UserRole[]
  isLoading: boolean
  onRefresh: () => void
}

export function UserFiltersPanel({
  searchQuery,
  onSearch,
  statusFilter,
  onStatusFilterChange,
  roleFilter,
  onRoleFilterChange,
  showFilters,
  onToggleFilters,
  userRoles,
  isLoading,
  onRefresh,
}: UserFiltersPanelProps) {
  return (
    <CardHeader>
      <CardTitle>Filters</CardTitle>
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, email..."
              value={searchQuery}
              onChange={(e) => onSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <Button
          variant="outline"
          onClick={onToggleFilters}
          className="gap-2"
        >
          <Filter className="h-4 w-4" />
          Filters
          {statusFilter.length > 0 || roleFilter.length > 0 ? (
            <Badge variant="secondary" className="ml-2 h-5 px-1">
              {statusFilter.length + roleFilter.length}
            </Badge>
          ) : null}
        </Button>
        <Button variant="outline" onClick={onRefresh} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {showFilters && (
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <Label className="mb-2 text-sm font-medium">Status</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  Select Status
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56">
                <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {Object.entries(STATUS_CONFIG).map(([status, config]) => (
                  <DropdownMenuCheckboxItem
                    key={status}
                    checked={statusFilter.includes(status as UserStatus)}
                    onCheckedChange={(checked) =>
                      onStatusFilterChange(status as UserStatus, checked)
                    }
                  >
                    {config.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div>
            <Label className="mb-2 text-sm font-medium">Role</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  Select Role
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56">
                <DropdownMenuLabel>Filter by Role</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {userRoles.map((role) => (
                  <DropdownMenuCheckboxItem
                    key={role.id}
                    checked={roleFilter.includes(role.id)}
                    onCheckedChange={(checked) =>
                      onRoleFilterChange(role.id, checked)
                    }
                  >
                    {role.displayName}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      )}
    </CardHeader>
  )
}
