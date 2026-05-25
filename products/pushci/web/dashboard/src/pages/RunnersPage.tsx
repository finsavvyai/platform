import { useEffect, useMemo, useState } from 'react';
import RunnerHealthPanel from '../components/RunnerHealthPanel';
import RunnerFleet from '../components/RunnerFleet';
import PageHeader from '../components/PageHeader';
import Select from '../components/Select';
import { API_BASE_URL } from '../config';
import { api, type CloudRunner, type Project } from '../hooks/useApi';

const API_HOST = new URL(API_BASE_URL).host;

export default function RunnersPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [projectRunners, setProjectRunners] = useState<CloudRunner[]>([]);
  const [token, setToken] = useState<{ value: string; expiresAt: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadProjects() {
      try {
        const nextProjects = await api.getProjects();
        if (cancelled) return;
        setProjects(nextProjects);
        setSelectedProjectId((current) => current || nextProjects[0]?.id || '');
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load projects');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadProjects();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedProjectId) {
      setProjectRunners([]);
      return;
    }
    let cancelled = false;

    async function loadRunners() {
      try {
        const runners = await api.getProjectRunners(selectedProjectId);
        if (!cancelled) setProjectRunners(runners);
      } catch (err) {
        if (!cancelled) {
          setProjectRunners([]);
          setError(err instanceof Error ? err.message : 'Failed to load project runners');
        }
      }
    }

    void loadRunners();
    return () => {
      cancelled = true;
    };
  }, [selectedProjectId]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  async function handleGenerateToken() {
    if (!selectedProjectId) return;
    setBusy(true);
    setError(null);
    try {
      const created = await api.createRunnerRegistrationToken(selectedProjectId);
      setToken({ value: created.token, expiresAt: created.expiresAt });
      setProjectRunners(await api.getProjectRunners(selectedProjectId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create registration token');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Runners"
        description="Manage your self-hosted runner fleet"
      />
      <RunnerHealthPanel />
      <RunnerFleet />

      {error && (
        <div className="rounded-lg border border-red-900 bg-red-950/30 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="bg-surface-card border border-surface-border rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-zinc-200 mb-1">Register New Runner</h3>
        <p className="text-xs text-zinc-500 mb-4">
          Generate a one-time project-scoped registration token, then start the agent on the machine you want to add.
        </p>
        {loading ? (
          <div className="text-sm text-zinc-500">Loading accessible projects…</div>
        ) : projects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-surface-border px-4 py-6 text-sm text-zinc-400">
            Connect a project first. Runner tokens are project-scoped.
          </div>
        ) : (
          <>
            <Select
              value={selectedProjectId}
              onChange={setSelectedProjectId}
              options={projects.map((project) => ({ value: project.id, label: project.repo }))}
              placeholder="Select project..."
              className="mb-4"
            />

            <div className="bg-zinc-900 rounded-xl p-4 font-mono text-sm text-emerald-400
              border border-zinc-800 overflow-x-auto">
              {token ? (
                <>
                  PUSHCI_API_URL={API_BASE_URL}{'\n'}
                  PUSHCI_REGISTRATION_TOKEN={token.value}{'\n'}
                  PUSHCI_PROJECT_ID={selectedProjectId}{'\n'}
                  pushci agent
                </>
              ) : (
                <>
                  # Generate a registration token to get the exact command{'\n'}
                  PUSHCI_API_URL={API_BASE_URL}{'\n'}
                  pushci agent
                </>
              )}
            </div>
            {token && (
              <p className="mt-3 text-xs text-zinc-500">
                Token expires {new Date(token.expiresAt).toLocaleString()} for {selectedProject?.repo}.
              </p>
            )}
          </>
        )}
        <div className="mt-3 flex items-center gap-4">
          <button
            type="button"
            onClick={() => void handleGenerateToken()}
            disabled={!selectedProjectId || busy}
            className="text-xs px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500
              disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-medium transition-colors"
          >
            {busy ? 'Generating…' : 'Generate Token'}
          </button>
        </div>
      </div>

      {selectedProject && (
        <div className="bg-surface-card border border-surface-border rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-zinc-200 mb-3">Project Runners</h3>
          {projectRunners.length === 0 ? (
            <p className="text-sm text-zinc-500">No runners registered for {selectedProject.repo} yet.</p>
          ) : (
            <div className="space-y-3">
              {projectRunners.map((runner) => (
                <div key={runner.id} className="rounded-xl border border-surface-border bg-zinc-900/40 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-zinc-100">{runner.name}</div>
                      <div className="mt-1 text-xs text-zinc-500">
                        {runner.os}/{runner.arch} · {new Date(runner.last_heartbeat).toLocaleString()}
                      </div>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-[11px] font-medium uppercase tracking-wide ${
                      runner.status === 'idle'
                        ? 'bg-emerald-500/10 text-emerald-300'
                        : runner.status === 'busy'
                        ? 'bg-yellow-500/10 text-yellow-300'
                        : 'bg-zinc-700 text-zinc-300'
                    }`}>
                      {runner.status}
                    </span>
                  </div>
                  {runner.labels.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {runner.labels.map((label) => (
                        <span key={label} className="rounded-full bg-zinc-800 px-2 py-1 text-[11px] text-zinc-300">
                          {label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="bg-surface-card border border-surface-border rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-zinc-200 mb-3">Requirements</h3>
        <ul className="space-y-2 text-sm text-zinc-400">
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Linux (x64/arm64) or macOS (Apple Silicon)
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Docker installed (optional, for container-based builds)
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Outbound HTTPS access to {API_HOST}
          </li>
        </ul>
      </div>
    </div>
  );
}
