// State orchestration hook for the GitLab importer page. Keeps the
// page component thin by centralizing loading/error wiring for
// connections, projects, pipelines, and the import preview.
import { useCallback, useEffect, useState } from 'react';
import {
  gitlabApi as defaultApi,
  type ConnectInput,
  type GitLabApi,
  type GitLabConnection,
  type GitLabImportPreview,
  type GitLabJob,
  type GitLabPipelineDetail,
  type GitLabPipelineSummary,
  type GitLabProject,
} from './useGitLabBridge';

export interface PipelineState {
  list: GitLabPipelineSummary[];
  loading: boolean;
  error: string | null;
  detail: GitLabPipelineDetail | null;
  jobs: GitLabJob[];
  triggering: boolean;
  triggerError: string | null;
}
export const EMPTY_PIPELINE_STATE: PipelineState = {
  list: [], loading: false, error: null, detail: null, jobs: [], triggering: false, triggerError: null,
};

const errMsg = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

export function useGitLabImporter(api: GitLabApi = defaultApi) {
  const [connections, setConnections] = useState<GitLabConnection[]>([]);
  const [connectionsLoading, setConnectionsLoading] = useState(true);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [activeConnId, setActiveConnId] = useState<string | null>(null);

  const [projects, setProjects] = useState<GitLabProject[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeProject, setActiveProject] = useState<GitLabProject | null>(null);

  const [pipelineState, setPipelineState] = useState<PipelineState>(EMPTY_PIPELINE_STATE);

  const [importOpen, setImportOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<GitLabImportPreview | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSaving, setImportSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setConnectionsLoading(true);
    api.listConnections()
      .then((r) => { if (!cancelled) setConnections(r.connections); })
      .catch((e: unknown) => { if (!cancelled) setConnectError(errMsg(e, 'Failed to load connections')); })
      .finally(() => { if (!cancelled) setConnectionsLoading(false); });
    return () => { cancelled = true; };
  }, [api]);

  useEffect(() => {
    if (activeConnId === null && connections[0]) setActiveConnId(connections[0].id);
  }, [connections, activeConnId]);

  const connect = useCallback(async (input: ConnectInput) => {
    setConnecting(true); setConnectError(null);
    try {
      const r = await api.connect(input);
      setConnections((prev) => [...prev, r.connection]);
      setActiveConnId(r.connection.id);
    } catch (e) { setConnectError(errMsg(e, 'Connect failed')); }
    finally { setConnecting(false); }
  }, [api]);

  useEffect(() => {
    if (!activeConnId) return;
    let cancelled = false;
    setProjectsLoading(true); setProjectsError(null);
    api.listProjects(activeConnId, search || undefined)
      .then((r) => { if (!cancelled) setProjects(r.projects); })
      .catch((e: unknown) => { if (!cancelled) setProjectsError(errMsg(e, 'Failed to list projects')); })
      .finally(() => { if (!cancelled) setProjectsLoading(false); });
    return () => { cancelled = true; };
  }, [api, activeConnId, search]);

  useEffect(() => {
    setPipelineState(EMPTY_PIPELINE_STATE);
    if (!activeConnId || !activeProject) return;
    let cancelled = false;
    setPipelineState((s) => ({ ...s, loading: true, error: null }));
    api.listPipelines(activeConnId, activeProject.id)
      .then((r) => { if (!cancelled) setPipelineState((s) => ({ ...s, loading: false, list: r.pipelines })); })
      .catch((e: unknown) => { if (!cancelled) setPipelineState((s) => ({ ...s, loading: false, error: errMsg(e, 'Failed to load pipelines') })); });
    return () => { cancelled = true; };
  }, [api, activeConnId, activeProject]);

  const selectPipeline = useCallback(async (pipelineId: number) => {
    if (!activeConnId || !activeProject) return;
    try {
      const r = await api.getPipeline(activeConnId, activeProject.id, pipelineId);
      setPipelineState((s) => ({ ...s, detail: r.pipeline, jobs: r.jobs, error: null }));
    } catch (e) { setPipelineState((s) => ({ ...s, error: errMsg(e, 'Failed to load pipeline') })); }
  }, [api, activeConnId, activeProject]);

  const trigger = useCallback(async (ref: string) => {
    if (!activeConnId || !activeProject) return;
    setPipelineState((s) => ({ ...s, triggering: true, triggerError: null }));
    try {
      await api.trigger(activeConnId, activeProject.id, ref);
      const r = await api.listPipelines(activeConnId, activeProject.id);
      setPipelineState((s) => ({ ...s, triggering: false, list: r.pipelines }));
    } catch (e) { setPipelineState((s) => ({ ...s, triggering: false, triggerError: errMsg(e, 'Trigger failed') })); }
  }, [api, activeConnId, activeProject]);

  const openImport = useCallback(async () => {
    if (!activeConnId || !activeProject) return;
    setImportOpen(true); setImportLoading(true); setImportError(null); setImportPreview(null);
    try { const r = await api.import(activeConnId, activeProject.id); setImportPreview(r.preview); }
    catch (e) { setImportError(errMsg(e, 'Import failed')); }
    finally { setImportLoading(false); }
  }, [api, activeConnId, activeProject]);

  const closeImport = useCallback(() => { setImportOpen(false); setImportPreview(null); setImportError(null); }, []);

  const acceptImport = useCallback(async () => {
    setImportSaving(true);
    try { await new Promise((r) => setTimeout(r, 200)); closeImport(); }
    finally { setImportSaving(false); }
  }, [closeImport]);

  return {
    connections, connectionsLoading, connectError, connecting, activeConnId, setActiveConnId,
    projects, projectsLoading, projectsError, search, setSearch, activeProject, setActiveProject,
    pipelineState, selectPipeline, trigger,
    importOpen, importPreview, importLoading, importError, importSaving,
    openImport, closeImport, acceptImport,
    connect,
  } as const;
}

export type GitLabImporterController = ReturnType<typeof useGitLabImporter>;
