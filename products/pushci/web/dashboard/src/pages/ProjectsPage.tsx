import { useEffect, useMemo, useState } from 'react';
import {
  api,
  type Project,
  type ProjectAccess,
  type ProjectMembership,
} from '../hooks/useApi';
import { useProjects } from '../hooks/useProjects';
import PageHeader from '../components/PageHeader';
import ProjectsConnectForm from '../components/projects/ProjectsConnectForm';
import ProjectsBootstrapForm from '../components/projects/ProjectsBootstrapForm';
import ProjectsList from '../components/projects/ProjectsList';
import ProjectAccessPanel from '../components/projects/ProjectAccessPanel';
import { cardClassName } from '../components/projects/utils';

export default function ProjectsPage() {
  const { projects, loading, error, refresh } = useProjects();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [access, setAccess] = useState<ProjectAccess | null>(null);
  const [memberships, setMemberships] = useState<ProjectMembership[] | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<'create' | 'bootstrap' | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  useEffect(() => {
    if (projects.length === 0) {
      setSelectedProjectId(null);
      setAccess(null);
      setMemberships(null);
      return;
    }
    setSelectedProjectId((current) =>
      current && projects.some((p) => p.id === current) ? current : projects[0].id,
    );
  }, [projects]);

  useEffect(() => {
    if (!selectedProjectId) return;
    const projectId = selectedProjectId;
    let cancelled = false;
    async function loadDetails() {
      setDetailsLoading(true);
      setDetailsError(null);
      try {
        const projectAccess = await api.getProjectAccess(projectId);
        const list = await api.getProjectMemberships(projectId).catch(() => null);
        if (cancelled) return;
        setAccess(projectAccess);
        setMemberships(list);
      } catch (err) {
        if (cancelled) return;
        setAccess(null);
        setMemberships(null);
        setDetailsError(err instanceof Error ? err.message : 'Failed to load project access');
      } finally {
        if (!cancelled) setDetailsLoading(false);
      }
    }
    void loadDetails();
    return () => { cancelled = true; };
  }, [selectedProjectId]);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  async function handleCreateProject(input: { repo: string; platform: Project['platform'] }) {
    setSubmitting('create');
    setActionError(null);
    setActionSuccess(null);
    try {
      const result = await api.createProject(input);
      setActionSuccess(`Connected ${result.project.repo}. The webhook secret is available in the access panel.`);
      await refresh();
      setSelectedProjectId(result.project.id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to connect project');
    } finally {
      setSubmitting(null);
    }
  }

  async function handleBootstrapProject(repo: string) {
    setSubmitting('bootstrap');
    setActionError(null);
    setActionSuccess(null);
    try {
      const result = await api.bootstrapProjectAccess(repo);
      setActionSuccess(`Claimed access for ${result.project.repo}.`);
      await refresh();
      setSelectedProjectId(result.project.id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to claim project access');
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Projects"
        description="Connected repositories, access control, and deployment governance"
        action={
          <button
            type="button"
            onClick={() => void refresh()}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-zinc-700/80 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-all duration-150 flex items-center gap-1.5"
          >
            <svg aria-hidden="true" className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        }
      />
      {error && (
        <div role="alert" className="px-4 py-3 rounded-lg bg-red-900/30 border border-red-800 text-red-300 text-sm mb-4">
          {error}
        </div>
      )}
      {actionError && (
        <div role="alert" className="mb-4 rounded-lg border border-red-800 bg-red-900/20 px-4 py-3 text-sm text-red-300">
          {actionError}
        </div>
      )}
      {actionSuccess && (
        <div role="status" aria-live="polite" className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.07] px-4 py-3 text-sm text-emerald-300 flex items-start gap-3">
          <svg aria-hidden="true" className="w-4 h-4 mt-0.5 shrink-0 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          {actionSuccess}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <div className="space-y-6">
          <section className={cardClassName(true)}>
            <div className="grid gap-4 lg:grid-cols-2">
              <ProjectsConnectForm submitting={submitting === 'create'} onSubmit={handleCreateProject} />
              <ProjectsBootstrapForm submitting={submitting === 'bootstrap'} onSubmit={handleBootstrapProject} />
            </div>
          </section>
          <ProjectsList
            projects={projects}
            loading={loading}
            selectedProjectId={selectedProjectId}
            disconnecting={disconnecting}
            onSelect={setSelectedProjectId}
            onAfterDisconnect={refresh}
            onDisconnectStart={setDisconnecting}
          />
        </div>

        <div className="space-y-6">
          <ProjectAccessPanel
            selectedProject={selectedProject}
            pageLoading={loading}
            detailsLoading={detailsLoading}
            detailsError={detailsError}
            access={access}
            memberships={memberships}
          />
        </div>
      </div>
    </div>
  );
}
