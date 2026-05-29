'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useUIStore } from '@/store'
import { useSession } from 'next-auth/react'
import {
  BarChart3,
  Building,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Cog,
  Database,
  FileText,
  GitBranch,
  Home,
  Key,
  LifeBuoy,
  Lock,
  Monitor,
  Package,
  Puzzle,
  Search,
  Settings,
  Shield,
  Tags,
  Terminal,
  TreePine,
  Users,
  Zap,
} from 'lucide-react'

const navigation = [
  {
    title: 'Overview',
    items: [
      {
        title: 'Dashboard',
        href: '/dashboard',
        icon: Home,
        permissions: ['dashboard:view'],
      },
      {
        title: 'Analytics',
        href: '/dashboard/analytics',
        icon: BarChart3,
        permissions: ['analytics:view'],
      },
    ],
  },
  {
    title: 'Platform Management',
    items: [
      {
        title: 'Tenants',
        href: '/dashboard/tenants',
        icon: Building,
        permissions: ['tenant:read'],
      },
      {
        title: 'Users',
        href: '/dashboard/users',
        icon: Users,
        permissions: ['user:read'],
      },
      {
        title: 'Roles & Permissions',
        href: '/dashboard/roles',
        icon: Shield,
        permissions: ['role:read'],
      },
    ],
  },
  {
    title: 'Content & Documents',
    items: [
      {
        title: 'Documents',
        href: '/dashboard/documents',
        icon: FileText,
        permissions: ['document:read'],
      },
      {
        title: 'Vector Search',
        href: '/dashboard/vector-search',
        icon: Search,
        permissions: ['search:view'],
      },
      {
        title: 'Embeddings',
        href: '/dashboard/embeddings',
        icon: Database,
        permissions: ['embedding:read'],
      },
    ],
  },
  {
    title: 'Security & Policies',
    items: [
      {
        title: 'Policies',
        href: '/dashboard/policies',
        icon: Lock,
        permissions: ['policy:read'],
      },
      {
        title: 'DLP Management',
        href: '/dashboard/dlp',
        icon: Shield,
        permissions: ['dlp:read'],
      },
      {
        title: 'API Keys',
        href: '/dashboard/api-keys',
        icon: Key,
        permissions: ['api_key:read'],
      },
    ],
  },
  {
    title: 'AI & RAG',
    items: [
      {
        title: 'RAG Pipeline',
        href: '/dashboard/rag',
        icon: GitBranch,
        permissions: ['rag:read'],
      },
      {
        title: 'LLM Gateway',
        href: '/dashboard/llm-gateway',
        icon: Zap,
        permissions: ['llm:read'],
      },
      {
        title: 'Token Usage',
        href: '/dashboard/token-usage',
        icon: Tags,
        permissions: ['token:read'],
      },
    ],
  },
  {
    title: 'Infrastructure',
    items: [
      {
        title: 'Services',
        href: '/dashboard/services',
        icon: Monitor,
        permissions: ['service:read'],
      },
      {
        title: 'Vector Core',
        href: '/dashboard/vector-core',
        icon: TreePine,
        permissions: ['vector:read'],
      },
      {
        title: 'OPA Engine',
        href: '/dashboard/opa',
        icon: Puzzle,
        permissions: ['opa:read'],
      },
      {
        title: 'Terminal',
        href: '/dashboard/terminal',
        icon: Terminal,
        permissions: ['terminal:access'],
      },
    ],
  },
  {
    title: 'System',
    items: [
      {
        title: 'Settings',
        href: '/dashboard/settings',
        icon: Settings,
        permissions: ['settings:read'],
      },
      {
        title: 'Monitoring',
        href: '/dashboard/monitoring',
        icon: Monitor,
        permissions: ['monitoring:read'],
      },
      {
        title: 'Audit Logs',
        href: '/dashboard/audit-logs',
        icon: FileText,
        permissions: ['audit:read'],
      },
      {
        title: 'Help & Support',
        href: '/dashboard/help',
        icon: LifeBuoy,
        permissions: [], // Always accessible
      },
    ],
  },
]

interface SidebarItemProps {
  item: any
  isCollapsed: boolean
  permissions: string[]
}

function SidebarItem({ item, isCollapsed, permissions }: SidebarItemProps) {
  const pathname = usePathname()
  const isActive = pathname === item.href
  const hasPermission = item.permissions.length === 0 ||
    item.permissions.some((perm: string) => permissions.includes(perm))

  if (!hasPermission) {
    return null
  }

  if (isCollapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          <Button
            variant={isActive ? 'secondary' : 'ghost'}
            className={cn(
              'w-full justify-center',
              isActive && 'bg-secondary'
            )}
            asChild
          >
            <Link href={item.href}>
              <item.icon className="h-4 w-4" />
              <span className="sr-only">{item.title}</span>
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">{item.title}</TooltipContent>
      </Tooltip>
    )
  }

  return (
    <Button
      variant={isActive ? 'secondary' : 'ghost'}
      className={cn(
        'w-full justify-start',
        isActive && 'bg-secondary'
      )}
      asChild
    >
      <Link href={item.href}>
        <item.icon className="mr-2 h-4 w-4" />
        {item.title}
      </Link>
    </Button>
  )
}

interface SidebarSectionProps {
  section: any
  isCollapsed: boolean
  permissions: string[]
}

function SidebarSection({ section, isCollapsed, permissions }: SidebarSectionProps) {
  const pathname = usePathname()
  const [expanded, setExpanded] = React.useState(() => {
    // Check if any item in this section is active
    return section.items.some((item: any) => item.href === pathname)
  })

  const hasVisibleItems = section.items.some((item: any) =>
    item.permissions.length === 0 ||
    item.permissions.some((perm: string) => permissions.includes(perm))
  )

  if (!hasVisibleItems) {
    return null
  }

  if (isCollapsed) {
    return (
      <div className="space-y-1">
        {section.items.map((item: any) => (
          <SidebarItem
            key={item.href}
            item={item}
            isCollapsed={isCollapsed}
            permissions={permissions}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <Button
        variant="ghost"
        className="w-full justify-between px-2 text-sm font-medium text-muted-foreground"
        onClick={() => setExpanded(!expanded)}
      >
        {section.title}
        {expanded ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </Button>
      {expanded && (
        <div className="ml-2 space-y-1">
          {section.items.map((item: any) => (
            <SidebarItem
              key={item.href}
              item={item}
              isCollapsed={isCollapsed}
              permissions={permissions}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function AppSidebar() {
  const { sidebar } = useUIStore()
  const { data: session } = useSession()
  const permissions = session?.user?.permissions || []

  return (
    <TooltipProvider delayDuration={0}>
      <div
        className={cn(
          'flex h-full flex-col bg-card border-r',
          sidebar.collapsed ? 'w-16' : 'w-64',
          'transition-all duration-300 ease-in-out'
        )}
      >
        {/* Header */}
        <div className="flex h-16 items-center border-b px-4">
          <Link href="/dashboard" className="flex items-center space-x-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Package className="h-4 w-4" />
            </div>
            {!sidebar.collapsed && (
              <span className="text-lg font-semibold">SDLC.ai</span>
            )}
          </Link>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 px-2 py-4">
          <div className="space-y-6">
            {navigation.map((section) => (
              <SidebarSection
                key={section.title}
                section={section}
                isCollapsed={sidebar.collapsed}
                permissions={permissions}
              />
            ))}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="border-t p-2">
          <Button
            variant="ghost"
            className="w-full justify-center"
            onClick={sidebar.toggleCollapsed}
          >
            {sidebar.collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronRight className="mr-2 h-4 w-4 rotate-180" />
                Collapse
              </>
            )}
          </Button>
        </div>
      </div>
    </TooltipProvider>
  )
}
