'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

const Pagination = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLElement>) => (
  <nav
    role="navigation"
    aria-label="pagination"
    className={cn('mx-auto flex w-full justify-center', className)}
    {...props}
  />
)
Pagination.displayName = 'Pagination'

const PaginationContent = React.forwardRef<
  HTMLUListElement,
  React.ComponentPropsWithoutRef<'ul'>
>(({ className, ...props }, ref) => (
  <ul ref={ref} className={cn('flex flex-row items-center gap-1', className)} {...props} />
))
PaginationContent.displayName = 'PaginationContent'

const PaginationItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentPropsWithoutRef<'li'>
>(({ className, ...props }, ref) => (
  <li ref={ref} className={cn('', className)} {...props} />
))
PaginationItem.displayName = 'PaginationItem'

const PaginationLink = React.forwardRef<
  HTMLAnchorElement,
  React.ComponentPropsWithoutRef<'a'> & {
    isActive?: boolean
  }
>(({ className, isActive, ...props }, ref) => (
  <a
    ref={ref}
    aria-current={isActive ? 'page' : undefined}
    className={cn(
      'inline-flex h-9 min-w-[36px] items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
      isActive && 'bg-accent text-accent-foreground',
      className
    )}
    {...props}
  />
))
PaginationLink.displayName = 'PaginationLink'

const PaginationPrevious = React.forwardRef<
  HTMLAnchorElement,
  React.ComponentPropsWithoutRef<'a'> & { disabled?: boolean; onClick?: () => void }
>(({ className, ...props }, ref) => (
  <PaginationLink
    ref={ref}
    className={cn('gap-1 pl-2.5 pr-3', className)}
    {...props}
  />
))
PaginationPrevious.displayName = 'PaginationPrevious'

const PaginationNext = React.forwardRef<
  HTMLAnchorElement,
  React.ComponentPropsWithoutRef<'a'> & { disabled?: boolean; onClick?: () => void }
>(({ className, ...props }, ref) => (
  <PaginationLink
    ref={ref}
    className={cn('gap-1 pl-3 pr-2.5', className)}
    {...props}
  />
))
PaginationNext.displayName = 'PaginationNext'

const PaginationEllipsis = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => (
  <span className={cn('flex h-9 w-9 items-center justify-center', className)} {...props}>
    …
  </span>
)
PaginationEllipsis.displayName = 'PaginationEllipsis'

export {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
}
