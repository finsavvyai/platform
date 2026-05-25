'use client'

import {
  ChevronDown,
  Send,
  Trash2,
  UserCheck,
  UserMinus,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface BulkActionsBarProps {
  selectedCount: number
  onClearSelection: () => void
  onBulkAction: (action: string) => void
}

export function BulkActionsBar({
  selectedCount,
  onClearSelection,
  onBulkAction,
}: BulkActionsBarProps) {
  if (selectedCount === 0) return null

  return (
    <div className="border-t px-6 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {selectedCount} user{selectedCount > 1 ? 's' : ''} selected
          </span>
          <Button variant="ghost" size="sm" onClick={onClearSelection}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Bulk Actions
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => onBulkAction('activate')}>
                <UserCheck className="mr-2 h-4 w-4" />
                Activate
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onBulkAction('deactivate')}>
                <UserMinus className="mr-2 h-4 w-4" />
                Deactivate
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onBulkAction('invite')}>
                <Send className="mr-2 h-4 w-4" />
                Send Invite
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onBulkAction('delete')}
                className="text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  )
}
