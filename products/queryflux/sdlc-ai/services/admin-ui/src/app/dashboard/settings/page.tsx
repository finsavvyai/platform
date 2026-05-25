'use client'

import { AppLayout } from '@/components/layout/app-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Settings,
  Shield,
  Bell,
  Globe,
  Palette,
  Lock,
} from 'lucide-react'

const sections = [
  {
    title: 'General Settings',
    description: 'Platform name, timezone, and default language configuration.',
    icon: Settings,
    details: [
      { label: 'Platform Name', value: 'SDLC.ai' },
      { label: 'Timezone', value: 'UTC' },
      { label: 'Default Language', value: 'English (US)' },
    ],
  },
  {
    title: 'Security Settings',
    description: 'Session management, multi-factor authentication, and password policies.',
    icon: Shield,
    details: [
      { label: 'Session Timeout', value: '15 minutes' },
      { label: '2FA Enforcement', value: 'Required for admins' },
      { label: 'Password Policy', value: 'Strong (12+ chars, special)' },
    ],
  },
  {
    title: 'Notification Settings',
    description: 'Configure email, Slack, and webhook notification channels.',
    icon: Bell,
    details: [
      { label: 'Email Notifications', value: 'Enabled' },
      { label: 'Slack Integration', value: 'Connected (#alerts)' },
      { label: 'Webhook Delivery', value: 'Enabled (3 endpoints)' },
    ],
  },
  {
    title: 'API Configuration',
    description: 'Rate limits, CORS origins, and API versioning settings.',
    icon: Globe,
    details: [
      { label: 'Rate Limit', value: '1,000 req/min per tenant' },
      { label: 'CORS Origins', value: '3 whitelisted domains' },
      { label: 'API Version', value: 'v1 (v2 beta available)' },
    ],
  },
  {
    title: 'Appearance',
    description: 'Theme preferences, branding, and display customization.',
    icon: Palette,
    details: [
      { label: 'Theme', value: 'System (auto)' },
      { label: 'Accent Color', value: 'Blue' },
      { label: 'Compact Mode', value: 'Disabled' },
    ],
  },
  {
    title: 'Access Control',
    description: 'Role-based access, SSO configuration, and audit settings.',
    icon: Lock,
    details: [
      { label: 'SSO Provider', value: 'SAML 2.0 (Okta)' },
      { label: 'Default Role', value: 'Viewer' },
      { label: 'Audit Logging', value: 'Enabled (90-day retention)' },
    ],
  },
]

export default function SettingsPage() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Manage platform configuration, security, and integrations.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {sections.map((section) => {
            const Icon = section.icon
            return (
              <Card key={section.title}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                        <Icon className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{section.title}</CardTitle>
                        <CardDescription className="text-xs">
                          {section.description}
                        </CardDescription>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    {section.details.map((d) => (
                      <div key={d.label} className="flex items-center justify-between">
                        <span className="text-muted-foreground">{d.label}</span>
                        <span className="font-medium">{d.value}</span>
                      </div>
                    ))}
                  </div>
                  <Button variant="outline" size="sm" className="mt-4 w-full">
                    Configure
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </AppLayout>
  )
}
