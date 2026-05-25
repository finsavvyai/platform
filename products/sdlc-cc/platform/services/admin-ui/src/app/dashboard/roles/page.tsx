'use client'

/**
 * Roles & Permissions page — wired to gateway /admin/roles endpoints.
 * - List via TanStack Query
 * - Create / update / delete via useMutation with optimistic updates
 * - Permission picker = controlled checkbox group (Radix Checkbox)
 */

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { Plus, Shield, Trash2, Users } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { apiFetch } from '@/lib/api'

export interface Role {
  id: string
  name: string
  description: string
  permissions: string[]
  user_count?: number
}

interface RoleInput {
  name: string
  description: string
  permissions: string[]
}

const PERMISSION_CATALOG = [
  'users:read', 'users:write', 'users:delete',
  'roles:read', 'roles:write',
  'policies:read', 'policies:write',
  'documents:read', 'documents:write',
  'audit:read:tenant', 'api_keys:*', 'llm:invoke',
] as const

const EMPTY_FORM: RoleInput = { name: '', description: '', permissions: [] }

export default function RolesPage() {
  const { data: session } = useSession()
  const tenantId = session?.user?.tenantId ?? 'unknown'
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [editing, setEditing] = useState<Role | null>(null)
  const [form, setForm] = useState<RoleInput>(EMPTY_FORM)
  const [dialogOpen, setDialogOpen] = useState(false)

  const rolesQuery = useQuery({
    queryKey: ['admin', 'roles', tenantId],
    queryFn: () => apiFetch<Role[]>('/admin/roles'),
  })

  const queryKey = ['admin', 'roles', tenantId] as const

  const createMutation = useMutation({
    mutationFn: (body: RoleInput) =>
      apiFetch<Role>('/admin/roles', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: (created) => {
      queryClient.setQueryData<Role[]>(queryKey, (prev) => [...(prev ?? []), created])
      toast({ title: 'Role created', description: created.name })
      closeDialog()
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to create role', description: err.message, variant: 'destructive' })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: RoleInput }) =>
      apiFetch<Role>(`/admin/roles/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    onMutate: async ({ id, body }) => {
      await queryClient.cancelQueries({ queryKey })
      const prev = queryClient.getQueryData<Role[]>(queryKey)
      queryClient.setQueryData<Role[]>(queryKey, (curr) =>
        (curr ?? []).map((r) => (r.id === id ? { ...r, ...body } : r)),
      )
      return { prev }
    },
    onError: (err: Error, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(queryKey, ctx.prev)
      toast({ title: 'Failed to update role', description: err.message, variant: 'destructive' })
    },
    onSuccess: () => {
      toast({ title: 'Role updated' })
      closeDialog()
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/admin/roles/${id}`, { method: 'DELETE' }),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey })
      const prev = queryClient.getQueryData<Role[]>(queryKey)
      queryClient.setQueryData<Role[]>(queryKey, (curr) => (curr ?? []).filter((r) => r.id !== id))
      return { prev }
    },
    onError: (err: Error, _id, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(queryKey, ctx.prev)
      toast({ title: 'Failed to delete role', description: err.message, variant: 'destructive' })
    },
    onSuccess: () => toast({ title: 'Role deleted' }),
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  })

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  const openEdit = (role: Role) => {
    setEditing(role)
    setForm({ name: role.name, description: role.description, permissions: [...role.permissions] })
    setDialogOpen(true)
  }

  const closeDialog = () => {
    setDialogOpen(false)
    setEditing(null)
    setForm(EMPTY_FORM)
  }

  const togglePermission = (p: string) => {
    setForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(p)
        ? prev.permissions.filter((x) => x !== p)
        : [...prev.permissions, p],
    }))
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      toast({ title: 'Name required', variant: 'destructive' })
      return
    }
    if (editing) updateMutation.mutate({ id: editing.id, body: form })
    else createMutation.mutate(form)
  }

  const roles = rolesQuery.data ?? []
  const totalGrants = useMemo(() => roles.reduce((s, r) => s + (r.user_count ?? 0), 0), [roles])
  const submitting = createMutation.isPending || updateMutation.isPending

  return (
    <div className="space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Roles & Permissions</h1>
          <p className="text-sm text-muted-foreground">Manage RBAC roles and assignments.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> New Role
        </Button>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Shield className="h-4 w-4" /> Total Roles
            </CardTitle>
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{roles.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Users className="h-4 w-4" /> Active Grants
            </CardTitle>
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{totalGrants}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Cache TTL</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">60s</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Roles</CardTitle>
          <CardDescription>Click a role to edit; trash to delete.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {rolesQuery.isLoading && (
            <div data-testid="roles-loading" className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          )}
          {rolesQuery.isError && (
            <p className="text-sm text-destructive">
              Failed to load roles: {(rolesQuery.error as Error).message}
            </p>
          )}
          {!rolesQuery.isLoading && roles.length === 0 && (
            <p className="text-sm text-muted-foreground">No roles yet. Create one above.</p>
          )}
          {roles.map((role) => (
            <div
              key={role.id}
              className="flex items-start justify-between rounded-md border p-4 hover:bg-muted/50"
            >
              <button onClick={() => openEdit(role)} className="flex-1 text-left">
                <p className="font-medium">{role.name}</p>
                <p className="text-sm text-muted-foreground">{role.description}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {role.permissions.map((p) => (
                    <Badge key={p} variant="secondary">{p}</Badge>
                  ))}
                </div>
              </button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Delete ${role.name}`}
                onClick={() => {
                  if (confirm(`Delete role "${role.name}"?`)) deleteMutation.mutate(role.id)
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(open) => (open ? null : closeDialog())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.name}` : 'Create Role'}</DialogTitle>
            <DialogDescription>Define name, description, and permissions.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <Input
              placeholder="Role name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <Textarea
              placeholder="Description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <div>
              <p className="mb-2 text-sm font-medium">Permissions</p>
              <div className="grid grid-cols-2 gap-2">
                {PERMISSION_CATALOG.map((p) => (
                  <label key={p} className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox
                      checked={form.permissions.includes(p)}
                      onCheckedChange={() => togglePermission(p)}
                      aria-label={`permission ${p}`}
                    />
                    <span>{p}</span>
                  </label>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={closeDialog}>Cancel</Button>
              <Button type="submit" disabled={submitting}>
                {editing ? 'Save' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
