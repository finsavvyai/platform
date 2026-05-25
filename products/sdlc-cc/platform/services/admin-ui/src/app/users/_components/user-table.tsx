'use client'

import { formatDistanceToNow } from 'date-fns'
import { MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { STATUS_CONFIG } from './constants'
import type { User } from '@/types/user-management'

interface UserTableProps {
  users: User[]
  selectedUserIds: string[]
  onSelectAll: (checked: boolean) => void
  onSelectUser: (userId: string, checked: boolean) => void
  onBulkAction: (action: string) => void
}

export function UserTable({
  users,
  selectedUserIds,
  onSelectAll,
  onSelectUser,
  onBulkAction,
}: UserTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12">
            <input
              type="checkbox"
              className="rounded"
              checked={selectedUserIds.length === users.length}
              onChange={(e) => onSelectAll(e.target.checked)}
            />
          </TableHead>
          <TableHead>User</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Tenant</TableHead>
          <TableHead>Last Login</TableHead>
          <TableHead>Created</TableHead>
          <TableHead className="w-12"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => (
          <TableRow key={user.id}>
            <TableCell>
              <input
                type="checkbox"
                className="rounded"
                checked={selectedUserIds.includes(user.id)}
                onChange={(e) => onSelectUser(user.id, e.target.checked)}
              />
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback>
                    {user.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-medium">{user.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {user.email}
                  </div>
                </div>
              </div>
            </TableCell>
            <TableCell>
              <Badge variant="outline">{user.role.displayName}</Badge>
            </TableCell>
            <TableCell>
              <Badge variant={STATUS_CONFIG[user.status].color}>
                {STATUS_CONFIG[user.status].label}
              </Badge>
            </TableCell>
            <TableCell>{user.tenantName || 'Unknown'}</TableCell>
            <TableCell>
              {user.lastLoginAt
                ? formatDistanceToNow(new Date(user.lastLoginAt), {
                    addSuffix: true,
                  })
                : 'Never'}
            </TableCell>
            <TableCell>
              {formatDistanceToNow(new Date(user.createdAt), {
                addSuffix: true,
              })}
            </TableCell>
            <TableCell>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() =>
                      (window.location.href = `/users/${user.id}`)
                    }
                  >
                    View Details
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      (window.location.href = `/users/${user.id}/edit`)
                    }
                  >
                    Edit User
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onBulkAction('delete')}
                    className="text-destructive"
                  >
                    Delete User
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
