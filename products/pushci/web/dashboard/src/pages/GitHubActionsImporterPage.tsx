// GitHubActionsImporterPage — orchestrates the GitHub Actions bridge flow:
// Connect (PAT) → repos → workflows + runs → run details + dispatch.
// Route: <Route path="/github-actions" element={<GitHubActionsImporterPage />} /> in App.tsx.
// License: Apache-2.0

import { useCallback, useEffect, useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader';
import GitHubActionsConnectionsSection from '../components/GitHubActionsConnectionsSection';
import GitHubActionsRepoList from '../components/GitHubActionsRepoList';
import GitHubActionsWorkflowBrowser from '../components/GitHubActionsWorkflowBrowser';
import GitHubActionsRunDetails from '../components/GitHubActionsRunDetails';
import GitHubActionsDispatchForm from '../components/GitHubActionsDispatchForm';
import {
  useGitHubActionsBridge, type GitHubActionsConnection, type GHARepo,
  type GHAWorkflow, type GHARun, type GHARunDetail, type ConnectPayload,
} from '../hooks/useGitHubActionsBridge';

export default function GitHubActionsImporterPage() {
  const gha = useGitHubActionsBridge();

  const [conns, setConns] = useState<GitHubActionsConnection[]>([]);
  const [connsLoading, setConnsLoading] = useState(true);
  const [connErr, setConnErr] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [activeConnId, setActiveConnId] = useState<string | null>(null);

  const [repos, setRepos] = useState<GHARepo[]>([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [reposErr, setReposErr] = useState<string | null>(null);
  const [selectedRepo, setSelectedRepo] = useState<GHARepo | null>(null);

  const [workflows, setWorkflows] = useState<GHAWorkflow[]>([]);
  const [wfLoading, setWfLoading] = useState(false);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<number | null>(null);

  const [runs, setRuns] = useState<GHARun[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [runsErr, setRunsErr] = useState<string | null>(null);

  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [runDetail, setRunDetail] = useState<GHARunDetail | null>(null);
  const [runDetailLoading, setRunDetailLoading] = useState(false);
  const [runDetailErr, setRunDetailErr] = useState<string | null>(null);

  const [dispatching, setDispatching] = useState(false);
  const [dispatchErr, setDispatchErr] = useState<string | null>(null);
  const [dispatchOk, setDispatchOk] = useState<string | null>(null);

  const loadConns = useCallback(async () => {
    setConnsLoading(true);
    try {
      const list = await gha.listConnections();
      setConns(list);
      setActiveConnId((prev) => prev ?? (list[0]?.id ?? null));
    } catch (e) { setConnErr(e instanceof Error ? e.message : 'Failed to load connections'); }
    finally { setConnsLoading(false); }
  }, [gha]);

  useEffect(() => { void loadConns(); }, [loadConns]);

  const loadRepos = useCallback(async (id: string) => {
    setReposLoading(true); setReposErr(null); setSelectedRepo(null);
    setWorkflows([]); setRuns([]); setSelectedWorkflowId(null); setSelectedRunId(null); setRunDetail(null);
    try { setRepos(await gha.listRepos(id)); }
    catch (e) { setReposErr(e instanceof Error ? e.message : 'Failed to load repos'); }
    finally { setReposLoading(false); }
  }, [gha]);

  useEffect(() => { if (activeConnId) void loadRepos(activeConnId); }, [activeConnId, loadRepos]);

  const handleConnect = async (body: ConnectPayload) => {
    setConnecting(true); setConnErr(null);
    try {
      const conn = await gha.connect(body);
      setConns((c) => [...c, conn]); setActiveConnId(conn.id);
    } catch (e) { setConnErr(e instanceof Error ? e.message : 'Connect failed'); }
    finally { setConnecting(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      await gha.deleteConnection(id);
      setConns((c) => c.filter((x) => x.id !== id));
      if (activeConnId === id) setActiveConnId(null);
    } catch (e) { setConnErr(e instanceof Error ? e.message : 'Delete failed'); }
  };

  const loadWorkflowsAndRuns = useCallback(async () => {
    if (!activeConnId || !selectedRepo) return;
    setWfLoading(true); setRunsLoading(true); setRunsErr(null);
    try {
      const [wfs, list] = await Promise.all([
        gha.listWorkflows(activeConnId, selectedRepo.owner, selectedRepo.name),
        gha.listRuns(activeConnId, selectedRepo.owner, selectedRepo.name,
          selectedWorkflowId != null ? { workflowId: selectedWorkflowId } : undefined),
      ]);
      setWorkflows(wfs); setRuns(list);
    } catch (e) { setRunsErr(e instanceof Error ? e.message : 'Failed to load workflows/runs'); }
    finally { setWfLoading(false); setRunsLoading(false); }
  }, [gha, activeConnId, selectedRepo, selectedWorkflowId]);

  useEffect(() => { void loadWorkflowsAndRuns(); }, [loadWorkflowsAndRuns]);

  useEffect(() => {
    if (!activeConnId || !selectedRepo || selectedRunId == null) { setRunDetail(null); return; }
    let cancelled = false;
    (async () => {
      setRunDetailLoading(true); setRunDetailErr(null);
      try {
        const d = await gha.getRun(activeConnId, selectedRepo.owner, selectedRepo.name, selectedRunId);
        if (!cancelled) setRunDetail(d);
      } catch (e) { if (!cancelled) setRunDetailErr(e instanceof Error ? e.message : 'Failed to load run'); }
      finally { if (!cancelled) setRunDetailLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [gha, activeConnId, selectedRepo, selectedRunId]);

  const selectedWorkflow = useMemo(
    () => workflows.find((w) => w.id === selectedWorkflowId) ?? null,
    [workflows, selectedWorkflowId],
  );

  const handleSelectRepo = (r: GHARepo) => {
    setSelectedRepo(r); setSelectedWorkflowId(null); setSelectedRunId(null);
    setRunDetail(null); setDispatchOk(null); setDispatchErr(null);
  };

  const handleDispatch = async (payload: { workflowId: number; ref: string; inputs: Record<string, string> }) => {
    if (!activeConnId || !selectedRepo) return;
    setDispatching(true); setDispatchErr(null); setDispatchOk(null);
    try {
      await gha.dispatch(activeConnId, selectedRepo.owner, selectedRepo.name, payload);
      setDispatchOk(`Dispatched ${payload.ref} — a new run will appear in the list shortly.`);
      await loadWorkflowsAndRuns();
    } catch (e) { setDispatchErr(e instanceof Error ? e.message : 'Dispatch failed'); }
    finally { setDispatching(false); }
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="GitHub Actions importer"
        description="Connect a GitHub account, browse workflows live, inspect run details, and dispatch manual runs."
      />
      <div className="space-y-6">
        <GitHubActionsConnectionsSection
          connections={conns} loading={connsLoading} activeConnId={activeConnId}
          onSelect={setActiveConnId} onDelete={handleDelete}
          onConnect={handleConnect} connecting={connecting} error={connErr}
        />
        {activeConnId && (
          <GitHubActionsRepoList
            repos={repos} loading={reposLoading} error={reposErr}
            selectedFullName={selectedRepo?.full_name ?? null}
            onSelect={handleSelectRepo}
          />
        )}
        {selectedRepo && (
          <GitHubActionsWorkflowBrowser
            workflows={workflows} runs={runs}
            selectedWorkflowId={selectedWorkflowId} selectedRunId={selectedRunId}
            loadingWorkflows={wfLoading} loadingRuns={runsLoading} error={runsErr}
            onSelectWorkflow={setSelectedWorkflowId}
            onSelectRun={setSelectedRunId}
            onRefresh={() => void loadWorkflowsAndRuns()}
          />
        )}
        {selectedRepo && (
          <GitHubActionsRunDetails detail={runDetail} loading={runDetailLoading} error={runDetailErr} />
        )}
        {selectedRepo && (
          <GitHubActionsDispatchForm
            workflow={selectedWorkflow}
            defaultRef={selectedRepo.default_branch || 'main'}
            onDispatch={handleDispatch}
            dispatching={dispatching} error={dispatchErr} successMessage={dispatchOk}
          />
        )}
      </div>
    </div>
  );
}
