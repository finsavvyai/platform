import { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';
import Select from './Select';

interface Org {
  id: string; name: string; slug: string; owner_sub: string;
  plan: string; member_role: string; created_at: string;
}
interface OrgMember { user_sub: string; login: string; provider: string; role: string; created_at: string; }
interface OrgProject { project_id: string; repo: string; platform: string; }
interface Project { id: string; repo: string; platform: string; }

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

export default function OrgManager({ projects }: { projects: Project[] }) {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [selected, setSelected] = useState<Org | null>(null);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [orgProjects, setOrgProjects] = useState<OrgProject[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    apiFetch<{ organizations: Org[] }>('/api/team/orgs').then(d => setOrgs(d.organizations)).catch(() => {});
  }, []);

  const selectOrg = async (org: Org) => {
    setSelected(org);
    try {
      const data = await apiFetch<{ members: OrgMember[]; projects: OrgProject[] }>(`/api/team/orgs/${org.id}/members`);
      setMembers(data.members);
      setOrgProjects(data.projects);
    } catch {}
  };

  const createOrg = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const org = await apiFetch<Org>('/api/team/orgs', { method: 'POST', body: JSON.stringify({ name: newName }) });
      setOrgs(prev => [{ ...org, plan: 'team', member_role: 'owner', created_at: new Date().toISOString() }, ...prev]);
      setNewName('');
    } catch {}
    setCreating(false);
  };

  const addProject = async (projectId: string) => {
    if (!selected) return;
    try {
      await apiFetch(`/api/team/orgs/${selected.id}/projects`, { method: 'POST', body: JSON.stringify({ project_id: projectId }) });
      const proj = projects.find(p => p.id === projectId);
      if (proj) setOrgProjects(prev => [...prev, { project_id: proj.id, repo: proj.repo, platform: proj.platform }]);
    } catch {}
  };

  const inviteMember = async (login: string, provider: string, role: string) => {
    if (!selected) return;
    try {
      await apiFetch(`/api/team/orgs/${selected.id}/members`, { method: 'POST', body: JSON.stringify({ login, provider, role }) });
      setMembers(prev => [...prev, { user_sub: `${provider}:${login}`, login, provider, role, created_at: new Date().toISOString() }]);
    } catch {}
  };

  if (selected) {
    return <OrgDetail org={selected} members={members} orgProjects={orgProjects} allProjects={projects}
      onBack={() => setSelected(null)} onAddProject={addProject} onInvite={inviteMember} />;
  }

  return (
    <div className="space-y-4">
      {/* Create new org */}
      <div className="flex gap-3 items-end">
        <div className="flex-1">
          <label className="text-xs text-zinc-400 mb-1 block">Organization Name</label>
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="My Company"
            className="w-full rounded-lg border border-surface-border bg-surface-hover px-3 py-2.5 text-sm text-zinc-100 focus:border-accent focus:outline-none" />
        </div>
        <button onClick={createOrg} disabled={creating || !newName.trim()}
          className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-black hover:bg-accent-hover disabled:bg-zinc-700 disabled:text-zinc-500 transition">
          {creating ? 'Creating...' : 'Create'}
        </button>
      </div>

      {/* Org list */}
      {orgs.length === 0 ? (
        <p className="text-sm text-zinc-500 py-6 text-center">No organizations yet. Create one to group projects and members.</p>
      ) : (
        <div className="space-y-3">
          {orgs.map(o => (
            <button key={o.id} onClick={() => selectOrg(o)}
              className="w-full text-left bg-surface-card border border-surface-border rounded-xl p-4 hover:border-zinc-600 transition">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-200">{o.name}</h3>
                  <p className="text-xs text-zinc-500">{o.slug} &middot; {o.member_role}</p>
                </div>
                <span className="text-xs text-zinc-500">{o.plan}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function OrgDetail({ org, members, orgProjects, allProjects, onBack, onAddProject, onInvite }: {
  org: Org; members: OrgMember[]; orgProjects: OrgProject[]; allProjects: Project[];
  onBack: () => void; onAddProject: (id: string) => void; onInvite: (login: string, provider: string, role: string) => void;
}) {
  const [invLogin, setInvLogin] = useState('');
  const [invRole, setInvRole] = useState('member');
  const unlinkedProjects = allProjects.filter(p => !orgProjects.some(op => op.project_id === p.id));

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="text-xs text-zinc-400 hover:text-zinc-200 transition">&larr; Back</button>

      <div>
        <h2 className="text-lg font-bold text-zinc-100">{org.name}</h2>
        <p className="text-xs text-zinc-500">{org.slug} &middot; {org.member_role}</p>
      </div>

      {/* Members */}
      <div className="bg-surface-card border border-surface-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-zinc-200 mb-3">Members ({members.length})</h3>
        <div className="space-y-2 mb-4">
          {members.map(m => (
            <div key={m.user_sub} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-surface-hover/30">
              <div className="w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center text-[10px] font-bold text-zinc-300">
                {m.login.slice(0, 2).toUpperCase()}
              </div>
              <span className="text-sm text-zinc-200 flex-1">{m.login}</span>
              <span className="text-[11px] text-zinc-500">{m.provider}</span>
              <span className={`text-[11px] rounded-full px-2 py-0.5 ${m.role === 'owner' ? 'bg-amber-500/10 text-amber-400' : 'bg-zinc-500/10 text-zinc-400'}`}>{m.role}</span>
            </div>
          ))}
        </div>
        {/* Invite form */}
        <div className="flex gap-2">
          <input value={invLogin} onChange={e => setInvLogin(e.target.value)} placeholder="username"
            className="flex-1 rounded-lg border border-surface-border bg-surface-hover px-3 py-2 text-xs text-zinc-100 focus:border-accent focus:outline-none" />
          <Select value={invRole} onChange={setInvRole}
            options={[{ value: 'admin', label: 'Admin' }, { value: 'member', label: 'Member' }, { value: 'viewer', label: 'Viewer' }]} />
          <button onClick={() => { if (invLogin.trim()) { onInvite(invLogin, 'github', invRole); setInvLogin(''); } }}
            className="rounded-lg bg-accent/20 text-accent border border-accent/30 px-3 py-2 text-xs font-medium hover:bg-accent/30 transition">
            Add
          </button>
        </div>
      </div>

      {/* Projects */}
      <div className="bg-surface-card border border-surface-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-zinc-200 mb-3">Projects ({orgProjects.length})</h3>
        <div className="space-y-2 mb-4">
          {orgProjects.map(p => (
            <div key={p.project_id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-surface-hover/30">
              <span className="text-sm text-zinc-200 flex-1">{p.repo}</span>
              <span className="text-[11px] text-zinc-500">{p.platform}</span>
            </div>
          ))}
        </div>
        {unlinkedProjects.length > 0 && (
          <div>
            <p className="text-xs text-zinc-500 mb-2">Add project:</p>
            <div className="flex flex-wrap gap-2">
              {unlinkedProjects.map(p => (
                <button key={p.id} onClick={() => onAddProject(p.id)}
                  className="rounded-lg border border-surface-border bg-surface-hover px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 transition">
                  + {p.repo}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
