// Route: /gitlab — orchestrates the GitLab live-poll bridge flow.
// Connect → pick instance → browse projects → live pipeline preview →
// trigger a run → import .gitlab-ci.yml into a .pushci.yml draft.
import PageHeader from '../components/PageHeader';
import GitLabConnectionForm from '../components/GitLabConnectionForm';
import GitLabProjectList from '../components/GitLabProjectList';
import GitLabPipelinePreview from '../components/GitLabPipelinePreview';
import GitLabImportPreviewCard from '../components/GitLabImportPreview';
import { useGitLabImporter } from '../hooks/useGitLabImporter';
import type { GitLabApi } from '../hooks/useGitLabBridge';

interface Props { api?: GitLabApi }

export default function GitLabImporterPage({ api }: Props) {
  const ctrl = useGitLabImporter(api);

  const onSelectProject = ctrl.setActiveProject;
  const onPickConnection = (id: string) => {
    ctrl.setActiveConnId(id);
    ctrl.setActiveProject(null);
  };

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="GitLab Importer"
        description="Connect a GitLab instance, browse pipelines live, trigger runs, and import .gitlab-ci.yml."
      />

      {ctrl.connectionsLoading && ctrl.connections.length === 0 ? (
        <div className="rounded-xl border border-surface-border bg-surface-card p-6 text-xs text-zinc-500" aria-busy="true">
          Loading connections…
        </div>
      ) : ctrl.connections.length === 0 ? (
        <GitLabConnectionForm busy={ctrl.connecting} error={ctrl.connectError} onSubmit={ctrl.connect} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
          <div className="space-y-4">
            <div className="rounded-xl border border-surface-border bg-surface-card p-4">
              <label htmlFor="gitlab-conn" className="block text-xs text-zinc-400 mb-2">Instance</label>
              <select
                id="gitlab-conn"
                value={ctrl.activeConnId ?? ''}
                onChange={(e) => onPickConnection(e.target.value)}
                className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-zinc-200"
              >
                {ctrl.connections.map((c) => (
                  <option key={c.id} value={c.id}>{c.label} ({c.privateTokenPreview})</option>
                ))}
              </select>
            </div>
            <GitLabProjectList
              projects={ctrl.projects}
              loading={ctrl.projectsLoading}
              error={ctrl.projectsError}
              search={ctrl.search}
              onSearchChange={ctrl.setSearch}
              onSelect={onSelectProject}
              selectedId={ctrl.activeProject?.id ?? null}
            />
          </div>

          <div className="space-y-6">
            {ctrl.activeProject ? (
              <GitLabPipelinePreview
                project={ctrl.activeProject}
                pipelines={ctrl.pipelineState.list}
                selectedPipeline={ctrl.pipelineState.detail}
                jobs={ctrl.pipelineState.jobs}
                loading={ctrl.pipelineState.loading}
                triggering={ctrl.pipelineState.triggering}
                error={ctrl.pipelineState.error ?? ctrl.pipelineState.triggerError}
                onSelectPipeline={ctrl.selectPipeline}
                onTrigger={ctrl.trigger}
                onOpenImport={ctrl.openImport}
              />
            ) : (
              <section className="rounded-xl border border-surface-border bg-surface-card p-8 text-center text-xs text-zinc-500">
                Select a project to browse pipelines.
              </section>
            )}
            {ctrl.importOpen && (
              <GitLabImportPreviewCard
                preview={ctrl.importPreview}
                loading={ctrl.importLoading}
                saving={ctrl.importSaving}
                error={ctrl.importError}
                onAccept={ctrl.acceptImport}
                onCancel={ctrl.closeImport}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
