'use client'

import { AppLayout } from '@/components/layout/app-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Terminal,
  Play,
  AlertTriangle,
  Server,
  RefreshCw,
} from 'lucide-react'

const terminalLines = [
  { type: 'prompt', text: '$ sdlc health --all' },
  { type: 'output', text: 'Checking 6 services...' },
  { type: 'success', text: '[OK] API Gateway        — 200 OK (12ms)' },
  { type: 'success', text: '[OK] RAG Service        — 200 OK (34ms)' },
  { type: 'warn', text: '[WARN] Vector Core      — 200 OK (892ms) slow response' },
  { type: 'success', text: '[OK] Admin UI           — 200 OK (8ms)' },
  { type: 'success', text: '[OK] DLP Service        — 200 OK (21ms)' },
  { type: 'error', text: '[FAIL] LLM Gateway      — connection refused' },
  { type: 'output', text: '' },
  { type: 'output', text: 'Result: 4 healthy, 1 degraded, 1 down' },
  { type: 'prompt', text: '$ sdlc logs gateway --tail 3' },
  { type: 'output', text: '2026-03-07T14:32:01Z INFO  request_completed path=/api/v1/documents status=200 duration=12ms' },
  { type: 'output', text: '2026-03-07T14:32:02Z INFO  request_completed path=/api/v1/search status=200 duration=45ms' },
  { type: 'output', text: '2026-03-07T14:32:03Z WARN  rate_limit_approaching tenant=globex remaining=12' },
  { type: 'prompt', text: '$ _' },
]

const services = ['API Gateway', 'RAG Service', 'Vector Core', 'Admin UI', 'DLP Service', 'LLM Gateway']

function lineColor(type: string) {
  switch (type) {
    case 'prompt':
      return 'text-emerald-400'
    case 'success':
      return 'text-emerald-300'
    case 'warn':
      return 'text-amber-300'
    case 'error':
      return 'text-red-400'
    default:
      return 'text-slate-300'
  }
}

export default function TerminalPage() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Terminal</h1>
          <p className="text-muted-foreground">
            Execute commands and view service logs in real-time.
          </p>
        </div>

        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="flex items-center gap-3 py-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500 dark:text-amber-400" />
            <p className="text-sm text-yellow-700 dark:text-yellow-400">
              Terminal access is logged and audited. All commands are recorded for
              security compliance.
            </p>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-4">
          <div className="lg:col-span-3">
            <Card className="bg-slate-950 border-slate-800">
              <CardHeader className="border-b border-slate-800 py-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-sm text-slate-300">
                    <Terminal className="h-4 w-4" />
                    sdlc-console
                  </CardTitle>
                  <Badge variant="outline" className="border-green-600 text-green-400">
                    Connected
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <div className="space-y-0.5 font-mono text-sm leading-relaxed">
                  {terminalLines.map((line, i) => (
                    <p key={i} className={lineColor(line.type)}>
                      {line.text || '\u00A0'}
                    </p>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Connect To</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {services.map((svc) => (
                    <Button
                      key={svc}
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-xs"
                    >
                      <Server className="mr-2 h-3 w-3" />
                      {svc}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Quick Commands</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <Play className="mr-2 h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
                  Health Check
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <Terminal className="mr-2 h-3.5 w-3.5" />
                  View Logs
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <RefreshCw className="mr-2 h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
                  Restart Service
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
