// BitbucketImporterPage — orchestrates the Bitbucket Cloud bridge flow:
// Connect → workspaces/repos → live pipeline browser → import preview.
// Route: <Route path="/bitbucket" element={<BitbucketImporterPage />} /> in App.tsx.
// License: Apache-2.0

import { useCallback, useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import BitbucketConnectionsSection from '../components/BitbucketConnectionsSection';
import BitbucketWorkspaceList from '../components/BitbucketWorkspaceList';
import BitbucketPipelineBrowser from '../components/BitbucketPipelineBrowser';
import BitbucketImportPreview from '../components/BitbucketImportPreview';
import {
  useBitbucketBridge, type BitbucketConnection, type BitbucketWorkspace,
  type BitbucketRepo, type BitbucketPipelineSummary, type ImportPreview,
  type ConnectPayload,
} from '../hooks/useBitbucketBridge';

export default function BitbucketImporterPage() {
  const bb = useBitbucketBridge();

  const [conns, setConns] = useState<BitbucketConnection[]>([]);
  const [connsLoading, setConnsLoading] = useState(true);
  const [connErr, setConnErr] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [activeConnId, setActiveConnId] = useState<string | null>(null);

  const [workspaces, setWorkspaces] = useState<BitbucketWorkspace[]>([]);
  const [wsLoading, setWsLoading] = useState(false);
  const [selectedWs, setSelectedWs] = useState<string | null>(null);

  const [repos, setRepos] = useState<BitbucketRepo[]>([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [reposErr, setReposErr] = useState<string | null>(null);
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);

  const [pipelines, setPipelines] = useState<BitbucketPipelineSummary[]>([]);
  const [pipelinesLoading, setPipelinesLoading] = useState(false);
  const [pipelinesErr, setPipelinesErr] = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);

  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importErr, setImportErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const loadConns = useCallback(async () => {
    setConnsLoading(true);
    try {
      const list = await bb.listConnections();
      setConns(list);
      setActiveConnId((prev) => prev ?? (list[0]?.id ?? null));
    } catch (e) {
      setConnErr(e instanceof Error ? e.message : 'Failed to load connections');
    } finally { setConnsLoading(false); }
  }, [bb]);

  useEffect(() => { void loadConns(); }, [loadConns]);

  const loadWorkspaces = useCallback(async (connectionId: string) => {
    setWsLoading(true);
    setWorkspaces([]); setSelectedWs(null); setRepos([]); setSelectedRepo(null); setPipelines([]);
    try { setWorkspaces(await bb.listWorkspaces(connectionId)); }
    catch (e) { setConnErr(e instanceof Error ? e.message : 'Failed to load workspaces'); }
    finally { setWsLoading(false); }
  }, [bb]);

  useEffect(() => { if (activeConnId) void loadWorkspaces(activeConnId); }, [activeConnId, loadWorkspaces]);

  const handleConnect = async (body: ConnectPayload) => {
    setConnecting(true); setConnErr(null);
    try {
      const conn = await bb.connect(body);
      setConns((c) => [...c, conn]); setActiveConnId(conn.id);
    } catch (e) { setConnErr(e instanceof Error ? e.message : 'Connect failed'); }
    finally { setConnecting(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      await bb.deleteConnection(id);
      setConns((c) => c.filter((x) => x.id !== id));
      if (activeConnId === id) setActiveConnId(null);
    } catch (e) { setConnErr(e instanceof Error ? e.message : 'Delete failed'); }
  };

  const handleSelectWorkspace = async (slug: string) => {
    if (!activeConnId) return;
    setSelectedWs(slug); setRepos([]); setSelectedRepo(null);
    setReposErr(null); setReposLoading(true);
    try { setRepos(await bb.listRepos(activeConnId, slug)); }
    catch (e) { setReposErr(e instanceof Error ? e.message : 'Failed to load repos'); }
    finally { setReposLoading(false); }
  };

  const loadPipelines = useCallback(async () => {
    if (!activeConnId || !selectedWs || !selectedRepo) return;
    setPipelinesLoading(true); setPipelinesErr(null);
    try { setPipelines(await bb.listPipelines(activeConnId, selectedWs, selectedRepo)); }
    catch (e) { setPipelinesErr(e instanceof Error ? e.message : 'Failed to load pipelines'); }
    finally { setPipelinesLoading(false); }
  }, [bb, activeConnId, selectedWs, selectedRepo]);

  useEffect(() => { void loadPipelines(); }, [loadPipelines]);

  const handleSelectRepo = (slug: string) => {
    setSelectedRepo(slug); setPreview(null); setImportErr(null); setSaveMsg(null);
  };

  const handleTrigger = async (ref: string, refType: 'branch' | 'tag') => {
    if (!activeConnId || !selectedWs || !selectedRepo) return;
    setTriggering(true); setPipelinesErr(null);
    try {
      await bb.triggerPipeline(activeConnId, selectedWs, selectedRepo, { ref, refType });
      await loadPipelines();
    } catch (e) { setPipelinesErr(e instanceof Error ? e.message : 'Trigger failed'); }
    finally { setTriggering(false); }
  };

  const handleImport = async () => {
    if (!activeConnId || !selectedWs || !selectedRepo) return;
    setImportLoading(true); setImportErr(null); setSaveMsg(null);
    try {
      setPreview(await bb.importPipeline({
        connectionId: activeConnId, workspace: selectedWs, repo: selectedRepo,
      }));
    } catch (e) { setImportErr(e instanceof Error ? e.message : 'Import failed'); }
    finally { setImportLoading(false); }
  };

  const handleSave = async () => {
    if (!preview) return;
    setSaving(true);
    try {
      await navigator.clipboard?.writeText(preview.preview.yaml);
      setSaveMsg('.pushci.yml copied to clipboard — paste into your repo to finish import.');
    } catch {
      setSaveMsg('.pushci.yml ready — copy the block above into your repo root.');
    } finally { setSaving(false); }
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Bitbucket live bridge"
        description="Connect a Bitbucket Cloud account, browse pipelines in real time, and import bitbucket-pipelines.yml into PushCI."
      />

      <div className="space-y-6">
        <BitbucketConnectionsSection
          connections={conns} loading={connsLoading}
          activeConnId={activeConnId}
          onSelect={setActiveConnId}
          onDelete={handleDelete}
          onConnect={handleConnect}
          connecting={connecting}
          error={connErr}
        />

        {activeConnId && (
          <BitbucketWorkspaceList
            workspaces={workspaces} repos={repos}
            selectedWorkspace={selectedWs} selectedRepo={selectedRepo}
            loadingWorkspaces={wsLoading} loadingRepos={reposLoading}
            error={reposErr}
            onSelectWorkspace={(slug) => void handleSelectWorkspace(slug)}
            onSelectRepo={handleSelectRepo}
          />
        )}

        {selectedRepo && (
          <BitbucketPipelineBrowser
            pipelines={pipelines} loading={pipelinesLoading} error={pipelinesErr}
            onTrigger={handleTrigger} triggering={triggering}
            onRefresh={() => void loadPipelines()}
          />
        )}

        {selectedRepo && (
          <>
            <BitbucketImportPreview
              preview={preview} loading={importLoading} error={importErr} saving={saving}
              onImport={handleImport} onSave={handleSave}
            />
            {saveMsg && (
              <div role="status" className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                {saveMsg}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
