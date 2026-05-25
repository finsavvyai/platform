// Route: /registries
// Org-wide company registry management. Credentials never touch the browser —
// the page stores only secret-store references (usernameRef, tokenRef, etc).

import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import { useToast } from '../components/Toast';
import { btnGesturePrimary } from '../styles/gestures';
import RegistryDialog from '../components/registries/RegistryDialog';
import RegistryRow from '../components/registries/RegistryRow';
import {
  type CompanyRegistry,
  type RegistryDraft,
  emptyDraft,
} from '../components/registries/types';
import { registriesApi } from '../lib/api/registries';

export default function CompanyRegistriesPage() {
  const { toast, confirm } = useToast();
  const [registries, setRegistries] = useState<CompanyRegistry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CompanyRegistry | null>(null);
  const [draft, setDraft] = useState<RegistryDraft>(emptyDraft());
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      setRegistries(await registriesApi.list());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load registries.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  function openCreate() {
    setEditing(null);
    setDraft(emptyDraft());
    setOpen(true);
    setFormError(null);
  }

  function openEdit(r: CompanyRegistry) {
    setEditing(r);
    setDraft({
      name: r.name, type: r.type, url: r.url, authMode: r.authMode,
      usernameRef: r.usernameRef, passwordRef: r.passwordRef,
      tokenRef: r.tokenRef, region: r.region, properties: r.properties,
    });
    setOpen(true);
    setFormError(null);
  }

  async function submit() {
    setSubmitting(true);
    setFormError(null);
    try {
      if (editing) await registriesApi.update(editing.id, draft);
      else await registriesApi.create(draft);
      setOpen(false);
      await refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(r: CompanyRegistry) {
    const ok = await confirm('Delete registry', `Delete registry "${r.name}"?`);
    if (!ok) return;
    setDeletingId(r.id);
    try {
      await registriesApi.remove(r.id);
      toast({ type: 'success', title: 'Registry deleted', message: r.name });
      await refresh();
    } catch (err) {
      toast({
        type: 'error',
        title: 'Failed to delete',
        message: err instanceof Error ? err.message : 'Please try again.',
      });
    } finally {
      setDeletingId(null);
    }
  }

  async function handleTest(r: CompanyRegistry) {
    setTestingId(r.id);
    try {
      const data = await registriesApi.test(r.id);
      toast({
        type: data.ok ? 'success' : 'warning',
        title: data.ok ? 'Connection OK' : 'Connection test failed',
        message: data.ok ? r.name : data.error || r.name,
      });
    } catch (err) {
      toast({
        type: 'error',
        title: 'Connection test failed',
        message: err instanceof Error ? err.message : r.name,
      });
    } finally {
      setTestingId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Company registries"
        description="Connect your enterprise artifact stores: JFrog, Nexus, GitHub Packages, ECR, GAR, Harbor and more. Bind registries to environments on a per-project basis."
        action={
          <button
            type="button"
            onClick={openCreate}
            className={`px-4 py-2 text-sm font-medium bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-300 ${btnGesturePrimary}`}
          >
            Add registry
          </button>
        }
      />

      {error && (
        <div role="alert" className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-sm text-rose-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-zinc-500">Loading registries…</div>
      ) : registries.length === 0 ? (
        <div className="p-6 rounded-xl bg-surface-card border border-surface-border text-sm text-zinc-400">
          No registries configured. Click "Add registry" to connect your first artifact store.
        </div>
      ) : (
        <div className="space-y-2">
          {registries.map((r) => (
            <RegistryRow
              key={r.id}
              registry={r}
              testing={testingId === r.id}
              deleting={deletingId === r.id}
              onTest={handleTest}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {open && (
        <RegistryDialog
          editing={editing !== null}
          draft={draft}
          formError={formError}
          submitting={submitting}
          onDraftChange={setDraft}
          onSubmit={() => void submit()}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
