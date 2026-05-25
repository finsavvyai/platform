'use client'

/**
 * Connector Marketplace — wired to gateway /v1/connectors endpoints.
 * - List + status via TanStack Query (refetch every 5s when any is syncing).
 * - Connect = anchor link to /v1/connectors/{name}/oauth/start (browser
 *   follows the gateway's 302 to the vendor authorize URL — must NOT be a
 *   fetch).
 * - Uninstall = DELETE mutation, gated by Radix Dialog confirmation.
 */

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/use-toast'
import { apiFetch, API_BASE } from '@/lib/api'
import { ConnectorEcosystemBanner } from './components/connector-ecosystem-banner'
import { CONNECTOR_CATALOG, type ConnectorCatalogEntry } from './components/connector-catalog'

type ConnectorStatus = 'available' | 'connected' | 'syncing' | 'error'

interface ConnectorAPI {
  name: string
  status: ConnectorStatus
  last_sync?: string | null
  error?: string | null
}

interface ConnectorRow extends ConnectorCatalogEntry {
  status: ConnectorStatus
}

const STATUS_BADGE: Record<ConnectorStatus, string> = {
  available: 'bg-slate-100 text-slate-700 border-slate-200',
  connected: 'bg-green-100 text-green-800 border-green-200',
  syncing: 'bg-blue-100 text-blue-800 border-blue-200',
  error: 'bg-red-100 text-red-800 border-red-200',
}

const STATUS_LABEL: Record<ConnectorStatus, string> = {
  available: 'Available',
  connected: 'Connected',
  syncing: 'Syncing',
  error: 'Error',
}

export default function ConnectorsMarketplacePage() {
  const { data: session } = useSession()
  const tenantId = session?.user?.tenantId ?? 'unknown'
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [confirmTarget, setConfirmTarget] = useState<ConnectorRow | null>(null)

  const queryKey = ['v1', 'connectors', tenantId] as const

  const connectorsQuery = useQuery({
    queryKey,
    queryFn: () => apiFetch<ConnectorAPI[]>('/v1/connectors'),
    refetchInterval: (query) => {
      const data = query.state.data
      const hasSyncing = Array.isArray(data) && data.some((c) => c.status === 'syncing')
      return hasSyncing ? 5000 : false
    },
  })

  const uninstallMutation = useMutation({
    mutationFn: (name: string) => apiFetch<void>(`/v1/connectors/${name}`, { method: 'DELETE' }),
    onMutate: async (name: string) => {
      await queryClient.cancelQueries({ queryKey })
      const prev = queryClient.getQueryData<ConnectorAPI[]>(queryKey)
      queryClient.setQueryData<ConnectorAPI[]>(queryKey, (curr) =>
        (curr ?? []).map((c) => (c.name === name ? { ...c, status: 'available' } : c)),
      )
      return { prev }
    },
    onError: (err: Error, _name, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(queryKey, ctx.prev)
      toast({ title: 'Uninstall failed', description: err.message, variant: 'destructive' })
    },
    onSuccess: (_data, name) => {
      toast({ title: 'Connector uninstalled', description: name })
      setConfirmTarget(null)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  })

  const rows: ConnectorRow[] = useMemo(() => {
    const apiByName = new Map((connectorsQuery.data ?? []).map((c) => [c.name, c]))
    return CONNECTOR_CATALOG.map((c) => ({
      ...c,
      status: (apiByName.get(c.name)?.status ?? 'available') as ConnectorStatus,
    }))
  }, [connectorsQuery.data])

  const categories = useMemo(() => {
    const set = new Set(CONNECTOR_CATALOG.map((c) => c.category))
    return ['all', ...Array.from(set).sort()]
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (category !== 'all' && r.category !== category) return false
      if (!q) return true
      return (
        r.displayName.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q)
      )
    })
  }, [rows, search, category])

  const realCount = rows.filter((r) => r.status === 'connected' || r.status === 'syncing').length

  return (
    <div className="p-6 max-w-6xl">
      <h1 className="text-2xl font-bold tracking-tight">Connectors</h1>
      <p className="text-sm text-muted-foreground mb-4">
        Install integrations to bring documents, messages, and records into RAG search.
      </p>

      {realCount < 1 && <ConnectorEcosystemBanner />}

      {connectorsQuery.isError && (
        <div
          role="alert"
          className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-900"
        >
          Failed to load connectors: {(connectorsQuery.error as Error).message}
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="search"
          placeholder="Search connectors…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[220px] rounded border px-3 py-2 text-sm"
          aria-label="Search connectors"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded border px-3 py-2 text-sm"
          aria-label="Filter by category"
        >
          {categories.map((c) => (
            <option key={c} value={c}>{c === 'all' ? 'All categories' : c}</option>
          ))}
        </select>
      </div>

      {connectorsQuery.isLoading && (
        <div data-testid="connectors-loading" className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      )}

      {!connectorsQuery.isLoading && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <article key={c.name} className="rounded border p-4 flex flex-col">
              <header className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl" aria-hidden>{c.icon}</span>
                  <h2 className="font-semibold">{c.displayName}</h2>
                </div>
                <span className={`text-xs rounded-full border px-2 py-0.5 ${STATUS_BADGE[c.status]}`}>
                  {STATUS_LABEL[c.status]}
                </span>
              </header>
              <p className="text-sm text-muted-foreground mb-2 flex-1">{c.description}</p>
              <p className="text-xs text-muted-foreground mb-3">
                <span className="uppercase tracking-wide">{c.category}</span> · {c.vendor}
              </p>
              <div className="flex gap-2">
                {c.status === 'available' || c.status === 'error' ? (
                  <a
                    href={`${API_BASE}/v1/connectors/${c.name}/oauth/start`}
                    className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
                    data-testid={`connect-${c.name}`}
                  >
                    Connect
                  </a>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmTarget(c)}
                    data-testid={`uninstall-${c.name}`}
                  >
                    Uninstall
                  </Button>
                )}
                <a
                  href={c.docsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded border px-3 py-1 text-sm hover:bg-slate-50"
                >
                  Docs
                </a>
              </div>
            </article>
          ))}
          {filtered.length === 0 && (
            <p className="col-span-full text-sm text-muted-foreground">
              No connectors match the current filter.
            </p>
          )}
        </div>
      )}

      <Dialog open={!!confirmTarget} onOpenChange={(open) => (open ? null : setConfirmTarget(null))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Uninstall {confirmTarget?.displayName}?</DialogTitle>
            <DialogDescription>
              The OAuth token will be revoked and indexed embeddings dropped within 24h.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={uninstallMutation.isPending}
              onClick={() => confirmTarget && uninstallMutation.mutate(confirmTarget.name)}
            >
              {uninstallMutation.isPending ? 'Uninstalling…' : 'Uninstall'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
