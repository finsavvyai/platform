'use client'

/**
 * Shared Projects — wired to gateway /v1/projects endpoints.
 * - List via TanStack Query.
 * - Create / delete via useMutation with optimistic updates.
 * - Members managed via separate Dialog (POST /v1/projects/{id}/members,
 *   DELETE /v1/projects/{id}/members/{user_id}).
 */

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { Plus, Trash2, Users } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/use-toast'
import { apiFetch } from '@/lib/api'

type MemberRole = 'viewer' | 'editor' | 'admin'

interface ProjectMember {
  user_id: string
  role: MemberRole
  added_at?: string
}

export interface Project {
  id: string
  tenant_id: string
  name: string
  description: string
  system_prompt: string
  connector_ids?: string[]
  members?: ProjectMember[]
  updated_at?: string
}

interface CreateInput {
  name: string
  description: string
  system_prompt: string
  connector_ids: string[]
}

const EMPTY_FORM: CreateInput = { name: '', description: '', system_prompt: '', connector_ids: [] }

export default function ProjectsPage() {
  const { data: session } = useSession()
  const tenantId = session?.user?.tenantId ?? 'unknown'
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState<CreateInput>(EMPTY_FORM)
  const [memberTarget, setMemberTarget] = useState<Project | null>(null)
  const [newMember, setNewMember] = useState<{ user_id: string; role: MemberRole }>({
    user_id: '',
    role: 'viewer',
  })

  const queryKey = ['v1', 'projects', tenantId] as const

  const projectsQuery = useQuery({
    queryKey,
    queryFn: () => apiFetch<Project[]>('/v1/projects'),
  })

  const createMutation = useMutation({
    mutationFn: (body: CreateInput) =>
      apiFetch<Project>('/v1/projects', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: (created) => {
      queryClient.setQueryData<Project[]>(queryKey, (prev) => [created, ...(prev ?? [])])
      toast({ title: 'Project created', description: created.name })
      setCreateOpen(false)
      setForm(EMPTY_FORM)
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to create project', description: err.message, variant: 'destructive' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/v1/projects/${id}`, { method: 'DELETE' }),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey })
      const prev = queryClient.getQueryData<Project[]>(queryKey)
      queryClient.setQueryData<Project[]>(queryKey, (curr) => (curr ?? []).filter((p) => p.id !== id))
      return { prev }
    },
    onError: (err: Error, _id, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(queryKey, ctx.prev)
      toast({ title: 'Failed to delete project', description: err.message, variant: 'destructive' })
    },
    onSuccess: () => toast({ title: 'Project deleted' }),
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  })

  const addMemberMutation = useMutation({
    mutationFn: ({ projectId, body }: { projectId: string; body: { user_id: string; role: MemberRole } }) =>
      apiFetch<ProjectMember>(`/v1/projects/${projectId}/members`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: (_member, { projectId, body }) => {
      queryClient.setQueryData<Project[]>(queryKey, (curr) =>
        (curr ?? []).map((p) =>
          p.id === projectId
            ? { ...p, members: [...(p.members ?? []), { user_id: body.user_id, role: body.role }] }
            : p,
        ),
      )
      toast({ title: 'Member added' })
      setNewMember({ user_id: '', role: 'viewer' })
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to add member', description: err.message, variant: 'destructive' })
    },
  })

  const removeMemberMutation = useMutation({
    mutationFn: ({ projectId, userId }: { projectId: string; userId: string }) =>
      apiFetch<void>(`/v1/projects/${projectId}/members/${userId}`, { method: 'DELETE' }),
    onSuccess: (_d, { projectId, userId }) => {
      queryClient.setQueryData<Project[]>(queryKey, (curr) =>
        (curr ?? []).map((p) =>
          p.id === projectId
            ? { ...p, members: (p.members ?? []).filter((m) => m.user_id !== userId) }
            : p,
        ),
      )
      toast({ title: 'Member removed' })
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to remove member', description: err.message, variant: 'destructive' })
    },
  })

  const submitCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      toast({ title: 'Name required', variant: 'destructive' })
      return
    }
    createMutation.mutate(form)
  }

  const submitAddMember = (e: React.FormEvent) => {
    e.preventDefault()
    if (!memberTarget || !newMember.user_id.trim()) return
    addMemberMutation.mutate({ projectId: memberTarget.id, body: newMember })
  }

  const projects = projectsQuery.data ?? []
  const liveTarget = useMemo(
    () => (memberTarget ? projects.find((p) => p.id === memberTarget.id) ?? memberTarget : null),
    [projects, memberTarget],
  )

  return (
    <div className="h-full flex flex-col">
      <div className="border-b bg-gray-50 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Shared Projects</h1>
            <p className="text-sm text-muted-foreground">
              Tenant-scoped collaboration spaces with shared system prompts and connectors.
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> New Project
          </Button>
        </div>
      </div>

      <div className="flex-1 p-4">
        {projectsQuery.isLoading && (
          <div data-testid="projects-loading" className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        )}
        {projectsQuery.isError && (
          <p role="alert" className="text-sm text-destructive">
            Failed to load projects: {(projectsQuery.error as Error).message}
          </p>
        )}
        {!projectsQuery.isLoading && projects.length === 0 && (
          <p className="text-muted-foreground">No projects yet.</p>
        )}
        {!projectsQuery.isLoading && projects.length > 0 && (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <div key={p.id} className="border rounded-lg p-4 bg-white shadow-sm">
                <h2 className="font-semibold">{p.name}</h2>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {p.description || 'No description'}
                </p>
                <div className="mt-3 text-xs text-muted-foreground">
                  {(p.members?.length ?? 0)} member(s)
                  {p.updated_at && ` · updated ${new Date(p.updated_at).toLocaleDateString()}`}
                </div>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setMemberTarget(p)}>
                    <Users className="mr-1 h-3 w-3" /> Members
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Delete ${p.name}`}
                    onClick={() => {
                      if (confirm(`Delete project "${p.name}"?`)) deleteMutation.mutate(p.id)
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Project</DialogTitle>
            <DialogDescription>Create a tenant-scoped collaboration space.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitCreate} className="space-y-3">
            <Input
              placeholder="Project name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <Textarea
              placeholder="Description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <Textarea
              placeholder="System prompt"
              className="font-mono"
              value={form.system_prompt}
              onChange={(e) => setForm({ ...form, system_prompt: e.target.value })}
            />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating…' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!memberTarget}
        onOpenChange={(open) => (open ? null : setMemberTarget(null))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Members — {liveTarget?.name}</DialogTitle>
            <DialogDescription>Manage who can view, edit, or admin this project.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {(liveTarget?.members ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No members yet.</p>
            )}
            {(liveTarget?.members ?? []).map((m) => (
              <div key={m.user_id} className="flex items-center justify-between rounded border p-2">
                <div className="text-sm">
                  <span className="font-mono">{m.user_id}</span>
                  <span className="ml-2 text-muted-foreground">({m.role})</span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Remove member ${m.user_id}`}
                  onClick={() =>
                    liveTarget &&
                    removeMemberMutation.mutate({ projectId: liveTarget.id, userId: m.user_id })
                  }
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
          <form onSubmit={submitAddMember} className="space-y-2 border-t pt-3">
            <Input
              placeholder="user_id"
              value={newMember.user_id}
              onChange={(e) => setNewMember({ ...newMember, user_id: e.target.value })}
            />
            <select
              value={newMember.role}
              onChange={(e) => setNewMember({ ...newMember, role: e.target.value as MemberRole })}
              className="rounded border px-3 py-2 text-sm w-full"
              aria-label="Member role"
            >
              <option value="viewer">viewer</option>
              <option value="editor">editor</option>
              <option value="admin">admin</option>
            </select>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setMemberTarget(null)}>
                Close
              </Button>
              <Button type="submit" disabled={addMemberMutation.isPending}>
                Add Member
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
