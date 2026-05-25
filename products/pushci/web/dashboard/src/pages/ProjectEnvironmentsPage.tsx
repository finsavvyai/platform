// Route: /projects/:projectId/environments — wired in App.tsx.
//
// Per-project environments page. Enterprise customers like Norlys need
// multiple lifecycle envs per project (dev, test, staging, pre-prod,
// prod, canary) each with its own approval policy, protected branch
// and bound company registries. Secrets are referenced by id only —
// values never leave the secret store.

import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { btnGesturePrimary, btnGestureSubtle } from '../styles/gestures';
import {
  useProjectEnvironments,
  type EnvInput,
  type EnvKind,
  type ProjectEnvironment,
} from '../hooks/useEnvironments';

const KINDS: EnvKind[] = ['dev', 'test', 'staging', 'pre-prod', 'prod', 'canary', 'custom'];

const inputCls =
  'w-full px-3 py-2 text-sm bg-surface-hover/50 border border-surface-border rounded-lg text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40';
const labelCls = 'text-xs text-zinc-400 mb-1 block';

function emptyDraft(): EnvInput {
  return {
    name: '',
    kind: 'dev',
    order: 0,
    requireApproval: false,
    requiredApprovers: 0,
    protectedBranch: '',
    registryBindings: [],
    variables: {},
    secretRefs: [],
  };
}

function KindBadge({ kind }: { kind: EnvKind }) {
  const color =
    kind === 'prod' || kind === 'pre-prod'
      ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
      : kind === 'staging' || kind === 'canary'
      ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
      : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30';
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border ${color} capitalize`}>{kind}</span>
  );
}

export default function ProjectEnvironmentsPage() {
  const { projectId = '' } = useParams<{ projectId: string }>();
  const { envs, loading, error, create, update, remove } = useProjectEnvironments(projectId);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectEnvironment | null>(null);
  const [draft, setDraft] = useState<EnvInput>(emptyDraft());
  const [formError, setFormError] = useState<string | null>(null);

  const sorted = useMemo(() => [...envs].sort((a, b) => a.order - b.order), [envs]);

  function openCreate() {
    setEditing(null);
    setDraft(emptyDraft());
    setOpen(true);
    setFormError(null);
  }

  function openEdit(env: ProjectEnvironment) {
    setEditing(env);
    setDraft({
      name: env.name,
      kind: env.kind,
      order: env.order,
      requireApproval: env.requireApproval,
      requiredApprovers: env.requiredApprovers,
      protectedBranch: env.protectedBranch ?? '',
      registryBindings: env.registryBindings,
      variables: env.variables,
      secretRefs: env.secretRefs,
    });
    setOpen(true);
    setFormError(null);
  }

  async function submit() {
    setFormError(null);
    if (!draft.name.trim()) {
      setFormError('Name is required');
      return;
    }
    try {
      if (editing) {
        await update(editing.id, draft);
      } else {
        await create(draft);
      }
      setOpen(false);
    } catch (e) {
      setFormError('Failed to save. Please try again.');
    }
  }

  async function handleDelete(env: ProjectEnvironment) {
    if (!confirm(`Delete environment "${env.name}"? This cannot be undone.`)) return;
    try {
      await remove(env.id);
    } catch (e) {
      alert('Failed to delete environment. Please try again.');
    }
  }

  return (
    <div>
      <PageHeader
        title="Environments"
        description="Configure lifecycle stages, approval gates and registry bindings for this project."
        action={
          <button onClick={openCreate} className={`px-4 py-2 text-sm font-medium bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-300 ${btnGesturePrimary}`}>
            Add environment
          </button>
        }
      />

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-sm text-rose-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-zinc-500">Loading environments...</div>
      ) : sorted.length === 0 ? (
        <div className="p-6 rounded-xl bg-surface-card border border-surface-border text-sm text-zinc-400">
          No environments yet. Click "Add environment" to create your first lifecycle stage.
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((env) => (
            <div
              key={env.id}
              className="p-4 rounded-xl bg-surface-card border border-surface-border flex flex-col sm:flex-row sm:items-center gap-3"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <KindBadge kind={env.kind} />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-zinc-100 truncate">{env.name}</div>
                  <div className="text-xs text-zinc-500 truncate">
                    {env.protectedBranch && `branch: ${env.protectedBranch} · `}
                    {env.requireApproval ? `${env.requiredApprovers} approvers required` : 'no approval'} ·
                    {' '}
                    {env.registryBindings.length} registries
                  </div>
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => openEdit(env)} className={`px-3 py-1.5 text-xs rounded-md bg-surface-hover border border-surface-border text-zinc-200 ${btnGestureSubtle}`}>
                  Edit
                </button>
                <button onClick={() => handleDelete(env)} className={`px-3 py-1.5 text-xs rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-300 ${btnGestureSubtle}`}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-lg bg-surface-card border border-surface-border rounded-xl p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-zinc-100 mb-4">
              {editing ? 'Edit environment' : 'New environment'}
            </h2>

            <div className="space-y-3">
              <div>
                <label className={labelCls}>Name</label>
                <input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  className={inputCls}
                  placeholder="e.g. eu-west-prod"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Kind</label>
                  <select
                    value={draft.kind}
                    onChange={(e) => setDraft({ ...draft, kind: e.target.value as EnvKind })}
                    className={inputCls}
                  >
                    {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Order</label>
                  <input
                    type="number"
                    value={draft.order ?? 0}
                    onChange={(e) => setDraft({ ...draft, order: Number(e.target.value) })}
                    className={inputCls}
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>Protected branch pattern</label>
                <input
                  value={draft.protectedBranch ?? ''}
                  onChange={(e) => setDraft({ ...draft, protectedBranch: e.target.value })}
                  className={inputCls}
                  placeholder="main or release/*"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="require-approval"
                  type="checkbox"
                  checked={draft.requireApproval ?? false}
                  onChange={(e) => setDraft({ ...draft, requireApproval: e.target.checked })}
                />
                <label htmlFor="require-approval" className="text-sm text-zinc-300">
                  Require manual approval to deploy
                </label>
              </div>
              {draft.requireApproval && (
                <div>
                  <label className={labelCls}>Required approvers</label>
                  <input
                    type="number"
                    min={0}
                    max={25}
                    value={draft.requiredApprovers ?? 0}
                    onChange={(e) => setDraft({ ...draft, requiredApprovers: Number(e.target.value) })}
                    className={inputCls}
                  />
                </div>
              )}
            </div>

            {formError && (
              <div className="mt-3 text-xs text-rose-300">{formError}</div>
            )}

            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setOpen(false)} className={`px-4 py-2 text-sm rounded-lg bg-surface-hover border border-surface-border text-zinc-200 ${btnGestureSubtle}`}>
                Cancel
              </button>
              <button onClick={submit} className={`px-4 py-2 text-sm rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 ${btnGesturePrimary}`}>
                {editing ? 'Save' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
