'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Menu, X } from 'lucide-react'

const SidebarContext = React.createContext<{
  open: boolean
  setOpen: React.Dispatch<React.SetStateAction<boolean>>
  collapsed: boolean
  setCollapsed: React.Dispatch<React.SetStateAction<boolean>>
}>({
  open: false,
  setOpen: () => {},
  collapsed: false,
  setCollapsed: () => {},
})

export function SidebarProvider({
  children,
  defaultOpen = true,
  defaultCollapsed = false,
}: {
  children: React.ReactNode
  defaultOpen?: boolean
  defaultCollapsed?: boolean
}) {
  const [open, setOpen] = React.useState(defaultOpen)
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed)

  return (
    <SidebarContext.Provider value={{ open, setOpen, collapsed, setCollapsed }}>
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebar() {
  const context = React.useContext(SidebarContext)
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider')
  }
  return context
}

export function SidebarTrigger({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  const { open, setOpen } = useSidebar()

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn('h-9 w-9', className)}
      onClick={() => setOpen(!open)}
      {...props}
    >
      <Menu className="h-4 w-4" />
      <span className="sr-only">Toggle sidebar</span>
    </Button>
  )
}

export function SidebarInset({
  className,
  ...props
}: React.ComponentProps<'main'>) {
  const { open } = useSidebar()

  return (
    <main
      className={cn(
        'flex-1 flex-col overflow-hidden transition-all duration-300 ease-in-out',
        open ? 'lg:ml-64' : 'lg:ml-16',
        className
      )}
      {...props}
    />
  )
}

export function SidebarLeft({
  className,
  ...props
}: React.ComponentProps<'aside'>) {
  const { open, collapsed } = useSidebar()

  return (
    <aside
      className={cn(
        'hidden md:flex flex-col border-r bg-background transition-all duration-300 ease-in-out',
        open ? 'w-64' : 'w-16',
        className
      )}
      {...props}
    />
  )
}

export function SidebarOverlay({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  const { open, setOpen } = useSidebar()

  if (!open) return null

  return (
    <div
      className={cn('fixed inset-0 z-50 bg-black/50 md:hidden', className)}
      onClick={() => setOpen(false)}
      {...props}
    />
  )
}
