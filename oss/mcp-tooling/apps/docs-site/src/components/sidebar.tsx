'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BookOpen, Zap, Users, Settings, FileText, Code, HelpCircle } from 'lucide-react'

import { Button } from '@mcpoverflow/ui'
import type { Doc } from 'contentlayer/generated'

interface SidebarProps {
  currentDoc?: Doc
}

export function Sidebar({ currentDoc }: SidebarProps) {
  const pathname = usePathname()

  const navigation = [
    {
      title: 'Getting Started',
      items: [
        { title: 'Introduction', href: '/docs/introduction', icon: BookOpen },
        { title: 'Quick Start', href: '/docs/getting-started', icon: Zap },
        { title: 'Installation', href: '/docs/installation', icon: Settings },
        { title: 'Configuration', href: '/docs/configuration', icon: Settings },
      ],
    },
    {
      title: 'Guides',
      items: [
        { title: 'Agent Deployment', href: '/docs/guides/deployment', icon: Users },
        { title: 'API Integration', href: '/docs/guides/api-integration', icon: Code },
        { title: 'Performance Optimization', href: '/docs/guides/performance', icon: Zap },
        { title: 'Security Best Practices', href: '/docs/guides/security', icon: Settings },
        { title: 'Troubleshooting', href: '/docs/guides/troubleshooting', icon: HelpCircle },
      ],
    },
    {
      title: 'API Reference',
      items: [
        { title: 'Overview', href: '/docs/api', icon: FileText },
        { title: 'Authentication', href: '/docs/api/authentication', icon: Settings },
        { title: 'Agents API', href: '/docs/api/agents', icon: Users },
        { title: 'Tools API', href: '/docs/api/tools', icon: Zap },
        { title: 'Webhooks', href: '/docs/api/webhooks', icon: Code },
      ],
    },
    {
      title: 'Examples',
      items: [
        { title: 'Simple Agent', href: '/docs/examples/simple-agent', icon: Code },
        { title: 'Chat Bot', href: '/docs/examples/chat-bot', icon: Users },
        { title: 'Data Processing', href: '/docs/examples/data-processing', icon: Zap },
        { title: 'Custom Tools', href: '/docs/examples/custom-tools', icon: Settings },
      ],
    },
  ]

  return (
    <div className="space-y-6">
      {/* Logo and Navigation */}
      <div className="mb-8">
        <Link href="/" className="flex items-center space-x-2 mb-6">
          <BookOpen className="h-8 w-8 text-purple-600" />
          <span className="text-xl font-bold">MCPOverflow Docs</span>
        </Link>

        <Button asChild className="w-full bg-purple-600 hover:bg-purple-700">
          <Link href="/docs/getting-started">Get Started</Link>
        </Button>
      </div>

      {/* Navigation Sections */}
      <nav className="space-y-8">
        {navigation.map((section) => (
          <div key={section.title}>
            <h3 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              {section.title}
            </h3>
            <ul className="space-y-1">
              {section.items.map((item) => {
                const isActive = pathname === item.href
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`sidebar-link flex items-center space-x-3 ${
                        isActive ? 'active' : 'inactive'
                      }`}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Quick Links */}
      <div className="pt-6 border-t border-border">
        <h3 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Quick Links
        </h3>
        <ul className="space-y-1">
          <li>
            <a
              href="https://github.com/mcpoverflow/mcpoverflow"
              target="_blank"
              rel="noopener noreferrer"
              className="sidebar-link"
            >
              GitHub
            </a>
          </li>
          <li>
            <a
              href="https://discord.gg/mcpoverflow"
              target="_blank"
              rel="noopener noreferrer"
              className="sidebar-link"
            >
              Discord
            </a>
          </li>
          <li>
            <a
              href="https://mcpoverflow.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="sidebar-link"
            >
              AI Platform
            </a>
          </li>
        </ul>
      </div>
    </div>
  )
}