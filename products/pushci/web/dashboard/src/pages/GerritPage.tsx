// Gerrit project management. Route: /gerrit. UI over /api/gerrit/projects and
// the runs feed, filtered to Gerrit-triggered runs.
import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader';
import { api, type RunSummary } from '../hooks/useApi';
import { friendlyError } from '../utils/errorMessages';
import { btnGesturePrimary } from '../styles/gestures';
import { useToast } from '../components/Toast';
import GerritProjectCard from '../components/gerrit/GerritProjectCard';
import GerritRecentRuns from '../components/gerrit/GerritRecentRuns';
import GerritDialog from '../components/gerrit/GerritDialog';
import {
  EMPTY_GERRIT_FORM,
  type GerritProject,
  type NewProjectForm,
} from '../components/gerrit/types';
import { gerritApi } from '../lib/api/gerrit';

export default function GerritPage() {
  const { toast, confirm } = useToast();
  const [projects, setProjects] = useState<GerritProject[]>([]);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<NewProjectForm>(EMPTY_GERRIT_FORM);
  const [busy, setBusy] = useState(false);
  const [testResult, setTestResult] = useState<Record<string, string>>({});
  const [testingId, setTestingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [projectList, runList] = await Promise.all([gerritApi.list(), api.getRuns()]);
      setProjects(projectList);
      setRuns(runList);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const gerritRuns = useMemo(
    () => runs.filter((r) => (r.trigger ?? '').startsWith('gerrit:')).slice(0, 20),
    [runs],
  );

  async function register(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await gerritApi.register(form);
      setShowModal(false);
      setForm(EMPTY_GERRIT_FORM);
      await load();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(project: GerritProject) {
    const ok = await confirm(
      'Delete Gerrit project',
      `Remove ${project.project} from PushCI? Webhook events will stop forwarding.`,
    );
    if (!ok) return;
    setDeletingId(project.id);
    try {
      await gerritApi.remove(project.id);
      toast({ type: 'success', title: 'Project removed', message: project.project });
      await load();
    } catch (err) {
      toast({ type: 'error', title: 'Failed to remove', message: friendlyError(err) });
    } finally {
      setDeletingId(null);
    }
  }

  async function test(id: string) {
    setTestingId(id);
    setTestResult((prev) => ({ ...prev, [id]: 'Testing…' }));
    try {
      const res = await gerritApi.test(id);
      setTestResult((prev) => ({
        ...prev,
        [id]: res.ok ? `OK (${res.version ?? 'connected'})` : `FAIL: ${res.error ?? 'unknown'}`,
      }));
    } catch (err) {
      setTestResult((prev) => ({ ...prev, [id]: `FAIL: ${friendlyError(err)}` }));
    } finally {
      setTestingId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Gerrit"
        description="Register Gerrit projects, ingest patchset-created events, and enable poll mode for air-gapped hosts."
        action={
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className={`px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-900 text-sm font-semibold ${btnGesturePrimary}`}
          >
            Add Gerrit project
          </button>
        }
      />

      {error && (
        <div role="alert" className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2].map((i) => <div key={i} className="h-32 rounded-xl bg-surface-card/50 animate-pulse" />)}
        </div>
      ) : projects.length === 0 ? (
        <div className="p-8 rounded-xl border border-surface-border bg-surface-card text-center">
          <h3 className="text-sm font-semibold text-zinc-100">No Gerrit projects yet</h3>
          <p className="text-xs text-zinc-500 mt-1">
            Register your first Gerrit project to forward patchset-created events into PushCI.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {projects.map((p) => (
            <GerritProjectCard
              key={p.id}
              project={p}
              testResult={testResult[p.id]}
              testing={testingId === p.id}
              deleting={deletingId === p.id}
              onTest={test}
              onRemove={remove}
            />
          ))}
        </div>
      )}

      <GerritRecentRuns runs={gerritRuns} />

      {showModal && (
        <GerritDialog
          form={form}
          busy={busy}
          onChange={setForm}
          onSubmit={register}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
