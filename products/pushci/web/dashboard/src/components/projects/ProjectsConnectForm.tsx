import { type FormEvent, useState } from 'react';
import { api, type Project } from '../../hooks/useApi';
import Select from '../Select';

interface RepoRow {
  name: string;
  private: boolean;
  language: string | null;
  description: string | null;
  connected: boolean;
}

interface Props {
  submitting: boolean;
  onSubmit: (input: { repo: string; platform: Project['platform'] }) => Promise<void>;
}

export default function ProjectsConnectForm({ submitting, onSubmit }: Props) {
  const [repo, setRepo] = useState('');
  const [platform, setPlatform] = useState<Project['platform']>('github');
  const [ghRepos, setGhRepos] = useState<RepoRow[]>([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [search, setSearch] = useState('');

  function loadGhRepos() {
    setReposLoading(true);
    api
      .fetchGitHubRepos()
      .then(setGhRepos)
      .catch(() => setGhRepos([]))
      .finally(() => setReposLoading(false));
  }

  function handlePlatformChange(val: string) {
    setPlatform(val as Project['platform']);
    setRepo('');
    setSearch('');
    if (val !== 'github') {
      setGhRepos([]);
    } else if (ghRepos.length === 0) {
      loadGhRepos();
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await onSubmit({ repo: repo.trim(), platform });
    if (!submitting) setRepo('');
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-zinc-100">Connect New Project</h2>
        <p className="mt-1 text-xs text-zinc-500">Select a repository from your GitHub account.</p>
      </div>
      <div className="space-y-2">
        <Select
          value={platform}
          onChange={handlePlatformChange}
          options={[
            { value: 'github', label: 'GitHub', icon: 'GH' },
            { value: 'gitlab', label: 'GitLab', icon: 'GL' },
            { value: 'bitbucket', label: 'Bitbucket', icon: 'BB' },
          ]}
        />
        {platform === 'github' && ghRepos.length === 0 && !reposLoading && (
          <button
            type="button"
            onClick={loadGhRepos}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            Load my GitHub repos
          </button>
        )}
        {reposLoading && <div className="text-xs text-zinc-500 py-2">Loading repositories…</div>}
        {ghRepos.length > 0 && (
          <>
            <label htmlFor="connect-repo-search" className="sr-only">Search repositories</label>
            <input
              id="connect-repo-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search repos…"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
            />
            <ul className="max-h-48 overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-950 divide-y divide-zinc-800">
              {ghRepos
                .filter((r) => r.name.toLowerCase().includes(search.toLowerCase()))
                .map((r) => (
                  <li key={r.name}>
                    <button
                      type="button"
                      disabled={r.connected}
                      onClick={() => { setRepo(r.name); setSearch(''); }}
                      className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                        r.connected
                          ? 'text-zinc-600 cursor-not-allowed'
                          : repo === r.name
                            ? 'bg-emerald-500/10 text-emerald-300'
                            : 'text-zinc-300 hover:bg-zinc-800'
                      }`}
                      aria-pressed={repo === r.name}
                    >
                      <div className="flex items-center justify-between">
                        <span className="truncate">{r.name}</span>
                        <span className="text-xs text-zinc-600 ml-2 shrink-0">
                          {r.connected ? 'connected' : r.language || ''}
                        </span>
                      </div>
                      {r.description && (
                        <p className="text-xs text-zinc-500 truncate mt-0.5">{r.description}</p>
                      )}
                    </button>
                  </li>
                ))}
            </ul>
          </>
        )}
        {platform !== 'github' && (
          <>
            <label htmlFor="connect-repo-input" className="sr-only">Repository slug</label>
            <input
              id="connect-repo-input"
              value={repo}
              onChange={(event) => setRepo(event.target.value)}
              placeholder="owner/repo"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
            />
          </>
        )}
        {repo && <div aria-live="polite" className="text-xs text-emerald-400 py-1">Selected: {repo}</div>}
      </div>
      <button
        type="submit"
        disabled={submitting || repo.trim().length === 0}
        aria-busy={submitting}
        className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-zinc-700"
      >
        {submitting ? 'Connecting…' : 'Connect project'}
      </button>
    </form>
  );
}
