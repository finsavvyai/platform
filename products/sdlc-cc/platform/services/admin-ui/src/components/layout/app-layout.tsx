'use client'

import { ReactNode } from 'react'
import { Sidebar } from './sidebar'
import { Header } from './header'
import { useUIStore } from '@/store/ui'
import { cn } from '@/lib/utils'

interface AppLayoutProps {
  children: ReactNode
  className?: string
}

export function AppLayout({ children, className }: AppLayoutProps) {
  const { sidebar } = useUIStore()

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className={cn('flex flex-col flex-1 overflow-hidden', sidebar.isCollapsed ? 'lg:ml-16' : 'lg:ml-64')}>
        <Header />
        <main className={cn('flex-1 overflow-y-auto p-6', className)}>
          {children}
        </main>
      </div>
    </div>
  )
}
