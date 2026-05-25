'use client'

import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PAGINATION_LIMITS } from './constants'

interface UserPaginationProps {
  totalUsers: number
  currentPage: number
  totalPages: number
  offset: number
  limit: number
  onPageChange: (newOffset: number) => void
  onLimitChange: (newLimit: number) => void
}

export function UserPagination({
  totalUsers,
  currentPage,
  totalPages,
  offset,
  limit,
  onPageChange,
  onLimitChange,
}: UserPaginationProps) {
  return (
    <div className="flex items-center justify-between px-4 py-2 border-t">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">
          Showing {Math.min(offset + 1, totalUsers)} to{' '}
          {Math.min(offset + limit, totalUsers)} of {totalUsers} users
        </span>
        <Select
          value={String(limit)}
          onValueChange={(value) => onLimitChange(Number(value))}
        >
          <SelectTrigger className="h-8 w-[70px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGINATION_LIMITS.map((l) => (
              <SelectItem key={l} value={String(l)}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(0)}
          disabled={currentPage === 1}
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(offset - limit)}
          disabled={currentPage === 1}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="px-3 text-sm">
          Page {currentPage} of {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(offset + limit)}
          disabled={currentPage === totalPages}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange((totalPages - 1) * limit)}
          disabled={currentPage === totalPages}
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
