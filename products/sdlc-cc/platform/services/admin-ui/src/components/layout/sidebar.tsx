'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useUIStore } from '@/store/ui'
import { useAuthStore } from '@/store/auth'
import {
  LayoutDashboard,
  Users,
  Settings,
  BarChart3,
  FolderOpen,
  Shield,
  Bell,
  Search,
  Menu,
  X,
  LogOut,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { useState } from 'react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

const navigationItems = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    permissions: [],
  },
  {
    key: 'projects',
    label: 'Projects',
    href: '/projects',
    icon: FolderOpen,
    permissions: ['project:read'],
    children: [
      {
        key: 'projects-list',
        label: 'All Projects',
        href: '/projects',
        permissions: ['project:read'],
      },
      {
        key: 'projects-create',
        label: 'Create Project',
        href: '/projects/create',
        permissions: ['project:create'],
      },
    ],
  },
  {
    key: 'users',
    label: 'Users',
    href: '/users',
    icon: Users,
    permissions: ['user:read'],
    children: [
      {
        key: 'users-list',
        label: 'All Users',
        href: '/users',
        permissions: ['user:read'],
      },
      {
        key: 'users-roles',
        label: 'Roles & Permissions',
        href: '/users/roles',
        permissions: ['user:read', 'system:admin'],
      },
    ],
  },
  {
    key: 'analytics',
    label: 'Analytics',
    href: '/analytics',
    icon: BarChart3,
    permissions: ['analytics:view'],
  },
  {
    key: 'settings',
    label: 'Settings',
    href: '/settings',
    icon: Settings,
    permissions: ['settings:read'],
  },
  {
    key: 'admin',
    label: 'System Admin',
    href: '/admin',
    icon: Shield,
    permissions: ['system:admin'],
  },
]

interface SidebarProps {
  className?: string
}

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname()
  const { sidebar, setSidebarCollapsed, setActiveSidebarItem } = useUIStore()
  const { user, permissions, logout } = useAuthStore()
  const [expandedItems, setExpandedItems] = useState<string[]>([])

  // Filter navigation items based on user permissions
  const filteredNavigation = navigationItems.filter(item => {
    if (item.permissions.length === 0) return true
    return item.permissions.some(permission => permissions.includes(permission))
  })

  const toggleExpanded = (key: string) => {
    setExpandedItems(prev =>
      prev.includes(key)
        ? prev.filter(item => item !== key)
        : [...prev, key]
    )
  }

  const handleNavigation = (href: string, key: string) => {
    setActiveSidebarItem(key)
    // Close sidebar on mobile after navigation
    if (window.innerWidth < 768) {
      setSidebarCollapsed(true)
    }
  }

  const hasPermission = (requiredPermissions: string[]) => {
    if (requiredPermissions.length === 0) return true
    return requiredPermissions.some(permission => permissions.includes(permission))
  }

  const renderNavigationItem = (item: { key: string; href: string; label: string; icon?: React.ComponentType<{ className?: string }>; children?: Array<{ key: string; href: string; label: string; permissions: string[]; icon?: React.ComponentType<{ className?: string }> }>; permissions: string[] }, level = 0) => {
    const isActive = pathname === item.href
    const children = item.children ?? []
    const hasChildren = children.length > 0
    const isExpanded = expandedItems.includes(item.key)

    if (hasChildren) {
      // Filter children based on permissions
      const filteredChildren = children.filter((child: { key: string; href: string; label: string; permissions: string[]; icon?: React.ComponentType<{ className?: string }> }) =>
        hasPermission(child.permissions)
      )

      if (filteredChildren.length === 0) return null

      return (
        <div key={item.key} className="space-y-1">
          <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(item.key)}>
            <CollapsibleTrigger asChild>
              <Button
                variant={isActive ? 'secondary' : 'ghost'}
                className={cn(
                  'w-full justify-start',
                  sidebar.isCollapsed && level === 0 && 'h-9 w-9 p-0',
                  level > 0 && 'pl-8'
                )}
              >
                {item.icon && (
                  <item.icon
                    className={cn(
                      'h-4 w-4',
                      sidebar.isCollapsed && level === 0 ? 'mr-0' : 'mr-2'
                    )}
                  />
                )}
                {!sidebar.isCollapsed || level > 0 ? (
                  <>
                    <span className="flex-1 text-left">{item.label}</span>
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </>
                ) : (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="w-full" />
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        <p>{item.label}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1">
              {filteredChildren.map((child: { key: string; href: string; label: string; permissions: string[]; icon?: React.ComponentType<{ className?: string }> }) => renderNavigationItem(child, level + 1))}
            </CollapsibleContent>
          </Collapsible>
        </div>
      )
    }

    return (
      <Link key={item.key} href={item.href} onClick={() => handleNavigation(item.href, item.key)}>
        <Button
          variant={isActive ? 'secondary' : 'ghost'}
          className={cn(
            'w-full justify-start',
            sidebar.isCollapsed && level === 0 && 'h-9 w-9 p-0',
            level > 0 && 'pl-8'
          )}
        >
          {item.icon && (
            <item.icon
              className={cn(
                'h-4 w-4',
                sidebar.isCollapsed && level === 0 ? 'mr-0' : 'mr-2'
              )}
            />
          )}
          {(!sidebar.isCollapsed || level > 0) && (
            <span className="flex-1 text-left">{item.label}</span>
          )}
          {sidebar.isCollapsed && level === 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="w-full" />
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>{item.label}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </Button>
      </Link>
    )
  }

  return (
    <div
      className={cn(
        'flex flex-col h-full bg-card border-r transition-all duration-300',
        sidebar.isCollapsed ? 'w-16' : 'w-64',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        {!sidebar.isCollapsed ? (
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">SD</span>
            </div>
            <span className="font-semibold">SDLC.ai</span>
          </div>
        ) : (
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center mx-auto">
            <span className="text-primary-foreground font-bold text-sm">SD</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSidebarCollapsed(!sidebar.isCollapsed)}
          className="h-8 w-8 p-0"
        >
          {sidebar.isCollapsed ? (
            <Menu className="h-4 w-4" />
          ) : (
            <X className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 p-2">
        <nav className="space-y-2">
          {filteredNavigation.map(item => renderNavigationItem(item))}
        </nav>
      </ScrollArea>

      {/* User Section */}
      {!sidebar.isCollapsed && user && (
        <div className="p-4 border-t space-y-2">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
              <span className="text-sm font-medium">
                {user.name?.charAt(0)?.toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.name}</p>
              <p className="text-xs text-muted-foreground truncate">{typeof user.role === 'object' ? user.role.name : String(user.role)}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="w-full justify-start"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      )}
    </div>
  )
}
