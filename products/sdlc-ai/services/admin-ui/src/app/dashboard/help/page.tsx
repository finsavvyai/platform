'use client'

import { AppLayout } from '@/components/layout/app-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  LifeBuoy,
  Book,
  Code,
  MessageCircle,
  Mail,
  ChevronRight,
  Info,
} from 'lucide-react'

const quickLinks = [
  {
    title: 'Documentation',
    description: 'Comprehensive guides, tutorials, and architecture references.',
    icon: Book,
    href: '/docs',
  },
  {
    title: 'API Reference',
    description: 'OpenAPI specs, endpoint details, and authentication guides.',
    icon: Code,
    href: '/docs/api',
  },
  {
    title: 'Community Forum',
    description: 'Ask questions, share knowledge, and connect with other users.',
    icon: MessageCircle,
    href: '/community',
  },
  {
    title: 'Contact Support',
    description: 'Reach our engineering team for urgent issues and escalations.',
    icon: Mail,
    href: '/support',
  },
]

const faqs = [
  'How do I configure multi-tenant data isolation?',
  'What compliance certifications does SDLC.ai support?',
  'How do I set up SSO with SAML 2.0?',
  'What are the rate limits for the API Gateway?',
]

export default function HelpPage() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Help & Support</h1>
          <p className="text-muted-foreground">
            Find answers, browse documentation, and get in touch with our team.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {quickLinks.map((link) => {
            const Icon = link.icon
            return (
              <Card key={link.title} className="flex flex-col">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                      <Icon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{link.title}</CardTitle>
                      <CardDescription className="text-xs">
                        {link.description}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="mt-auto">
                  <Button variant="outline" size="sm" className="w-full">
                    Open
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LifeBuoy className="h-4 w-4" /> Frequently Asked Questions
              </CardTitle>
              <CardDescription>Common questions about the platform</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {faqs.map((question) => (
                  <button
                    key={question}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm hover:bg-muted transition-colors duration-200 cursor-pointer"
                  >
                    <span>{question}</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-4 w-4" /> System Information
              </CardTitle>
              <CardDescription>Current platform details</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Version</span>
                  <Badge variant="outline">v2.4.1</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Environment</span>
                  <Badge variant="secondary">Production</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Last Updated</span>
                  <span className="font-medium">2026-03-07</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">API Version</span>
                  <span className="font-medium">v1</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Region</span>
                  <span className="font-medium">Cloudflare Edge (Global)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Uptime</span>
                  <span className="font-medium">99.98%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  )
}
