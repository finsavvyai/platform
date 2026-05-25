'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { ChevronRight, Home } from 'lucide-react'
import { useUIStore } from '@/store/ui'

interface BreadcrumbItem {
  label: string
  href?: string
  active?: boolean
}

interface BreadcrumbProps {
  items?: BreadcrumbItem[]
  className?: string
}

export function Breadcrumb({ items, className }: BreadcrumbProps) {
  const { breadcrumbs } = useUIStore()
  const breadcrumbItems = items || breadcrumbs

  if (!breadcrumbItems || breadcrumbItems.length === 0) {
    return null
  }

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn('flex items-center space-x-1 text-sm text-muted-foreground', className)}
    >
      <Link
        href="/dashboard"
        className="flex items-center hover:text-foreground transition-colors"
      >
        <Home className="h-4 w-4" />
        <span className="sr-only">Home</span>
      </Link>

      {breadcrumbItems.map((item, index) => {
        const isLast = index === breadcrumbItems.length - 1
        const isActive = item.active || isLast

        return (
          <div key={index} className="flex items-center space-x-1">
            <ChevronRight className="h-4 w-4" />
            {item.href && !isActive ? (
              <Link
                href={item.href}
                className="hover:text-foreground transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <span
                className={cn(
                  isActive ? 'text-foreground font-medium' : 'text-muted-foreground'
                )}
              >
                {item.label}
              </span>
            )}
          </div>
        )
      })}
    </nav>
  )
}
