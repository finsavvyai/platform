import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useSidebarOpen } from '@/store/useDashboardStore'
import { useIsAuthenticated, useUserRole } from '@/store/useDashboardStore'
import {
  LayoutDashboard,
  Shield,
  Activity,
  Zap,
  Users,
  Settings,
  Key,
  BarChart3,
  AlertTriangle,
  Menu,
  X
} from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface NavItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  roles?: string[]
  badge?: string
}

const navItems: NavItem[] = [
  {
    name: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
  },
  {
    name: 'Fraud Detection',
    href: '/fraud-detection',
    icon: Shield,
  },
  {
    name: 'Analytics',
    href: '/analytics',
    icon: BarChart3,
  },
  {
    name: 'System Health',
    href: '/system-health',
    icon: Activity,
  },
  {
    name: 'Quantum Processing',
    href: '/quantum',
    icon: Zap,
    roles: ['admin', 'user'],
  },
  {
    name: 'User Management',
    href: '/users',
    icon: Users,
    roles: ['admin'],
  },
  {
    name: 'API Keys',
    href: '/api-keys',
    icon: Key,
  },
  {
    name: 'Alerts',
    href: '/alerts',
    icon: AlertTriangle,
    badge: '3', // This would come from real-time data
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings,
  },
]

export function Sidebar() {
  const location = useLocation()
  const sidebarOpen = useSidebarOpen()
  const isAuthenticated = useIsAuthenticated()
  const userRole = useUserRole()

  const toggleSidebar = () => {
    useSidebarOpen.setState({ sidebarOpen: !sidebarOpen })
  }

  const filteredNavItems = navItems.filter(item => {
    if (!item.roles) return true
    return userRole && item.roles.includes(userRole)
  })

  return (
    <div className="flex h-full w-full flex-col">
      {/* Sidebar Header */}
      <div className="flex h-16 items-center justify-between border-b border-border px-6">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <div className="h-8 w-8 rounded-lg bg-quantum-600 flex items-center justify-center">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-semibold">QuantumBeam</span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="lg:hidden"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {filteredNavItems.map((item) => {
          const Icon = item.icon
          const isActive = location.pathname === item.href

          return (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) =>
                cn(
                  'group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 ease-in-out',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={cn(
                      'mr-3 h-4 w-4 flex-shrink-0',
                      isActive ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-accent-foreground'
                    )}
                  />
                  <span className="flex-1">{item.name}</span>
                  {item.badge && (
                    <span
                      className={cn(
                        'ml-auto inline-block px-2 py-1 text-xs rounded-full',
                        isActive
                          ? 'bg-primary-foreground text-primary'
                          : 'bg-muted text-muted-foreground'
                      )}
                    >
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          )
        })}
      </nav>

      {/* Sidebar Footer */}
      <div className="border-t border-border p-4">
        <div className="rounded-lg bg-muted/50 p-3">
          <div className="flex items-center space-x-3">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            <span className="text-xs text-muted-foreground">System Operational</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Last updated: Just now
          </p>
        </div>
      </div>

      {/* Version Info */}
      <div className="border-t border-border p-4">
        <div className="text-xs text-muted-foreground space-y-1">
          <div>QuantumBeam Dashboard v1.0.0</div>
          <div>© 2024 QuantumBeam Inc.</div>
        </div>
      </div>
    </div>
  )
}