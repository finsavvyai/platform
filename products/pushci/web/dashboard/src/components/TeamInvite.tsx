import { useState } from 'react';
import { API_BASE_URL } from '../config';
import Select from './Select';

interface Member {
  project_id: string; user_sub: string; login: string;
  provider: string; role: string; repo: string; created_at: string;
}
interface Project { id: string; repo: string; platform: string; }

const ROLES = ['developer', 'viewer', 'auditor', 'deploy_approver', 'release_manager', 'maintainer'];

function token() { return localStorage.getItem('pushci_token'); }
async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const t = token();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}), ...opts?.headers },
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

export default function TeamInvite({ projects, onInvited }: {
  projects: Project[];
  onInvited: (m: Member) => void;
}) {
  const [login, setLogin] = useState('');
  const [provider, setProvider] = useState<'github' | 'gitlab'>('github');
  const [projectId, setProjectId] = useState(projects[0]?.id || '');
  const [role, setRole] = useState('developer');
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const invite = async () => {
    if (!login.trim() || !projectId) return;
    setSending(true);
    setMsg(null);
    try {
      await apiFetch('/api/team/invite', {
        method: 'POST',
        body: JSON.stringify({ login: login.trim(), provider, project_id: projectId, role }),
      });
      const repo = projects.find(p => p.id === projectId)?.repo || '';
      onInvited({ project_id: projectId, user_sub: `${provider}:${login}`, login, provider, role, repo, created_at: new Date().toISOString() });
      setMsg({ ok: true, text: `Invited ${login} as ${role}` });
      setLogin('');
    } catch (e) {
      setMsg({ ok: false, text: 'Failed to invite. Please try again.' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-surface-card border border-surface-border rounded-xl p-6 max-w-lg">
      <h3 className="text-sm font-semibold text-zinc-200 mb-4">Invite Team Member</h3>
      <div className="space-y-4">
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Username</label>
          <input value={login} onChange={e => setLogin(e.target.value)} placeholder="github-username"
            className="w-full rounded-lg border border-surface-border bg-surface-hover px-3 py-2.5 text-sm text-zinc-100 focus:border-accent focus:outline-none" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Provider</label>
            <div className="flex gap-2">
              {(['github', 'gitlab'] as const).map(p => (
                <button key={p} onClick={() => setProvider(p)}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium border transition ${provider === p ? 'border-accent/40 bg-accent/10 text-accent' : 'border-surface-border text-zinc-500 hover:text-zinc-300'}`}>
                  {p === 'github' ? 'GitHub' : 'GitLab'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Role</label>
            <Select value={role} onChange={setRole}
              options={ROLES.map(r => ({ value: r, label: r }))} />
          </div>
        </div>
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Project</label>
          <Select value={projectId} onChange={setProjectId}
            options={projects.map(p => ({ value: p.id, label: p.repo }))} />
        </div>
        <button onClick={invite} disabled={sending || !login.trim()}
          className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-black hover:bg-accent-hover disabled:bg-zinc-700 disabled:text-zinc-500 transition">
          {sending ? 'Inviting...' : 'Send Invite'}
        </button>
        {msg && (
          <p className={`text-xs ${msg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{msg.text}</p>
        )}
      </div>
    </div>
  );
}
