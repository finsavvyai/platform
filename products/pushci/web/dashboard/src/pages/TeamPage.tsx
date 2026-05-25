import { useState, useEffect } from 'react';
import PageHeader from '../components/PageHeader';
import TeamInvite from '../components/TeamInvite';
import SSOImport from '../components/SSOImport';
import OrgManager from '../components/OrgManager';
import TeamSeatBar from '../components/TeamSeatBar';
import TeamMembersList from '../components/TeamMembersList';
import LockedFeature from '../components/LockedFeature';
import { usePlan } from '../hooks/usePlan';
import { API_BASE_URL } from '../config';

interface Member {
  project_id: string; user_sub: string; login: string;
  provider: string; role: string; repo: string; created_at: string;
}
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

export default function TeamPage() {
  const { hasFeature } = usePlan();
  const [members, setMembers] = useState<Member[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'members' | 'invite' | 'import' | 'orgs'>('members');

  useEffect(() => {
    if (!hasFeature('team')) { setLoading(false); return; }
    Promise.all([
      apiFetch<{ members: Member[] }>('/api/team'),
      apiFetch<{ projects: Project[] }>('/api/projects'),
    ]).then(([m, p]) => { setMembers(m.members); setProjects(p.projects); })
      .catch(() => {}).finally(() => setLoading(false));
  }, [hasFeature]);

  if (!hasFeature('team')) {
    return (
      <div>
        <PageHeader title="Team" description="Manage members and collaborators." />
        <LockedFeature title="Team Management" requiredPlan="team" description="Team management requires the Team plan." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Team" description="Manage members, invite collaborators, and import from SSO providers." />
      <div className="space-y-6">
        <TeamSeatBar used={members.length || 3} total={25} />
        <TeamTabs tab={tab} onTab={setTab} />
        {loading ? (
          <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-20 rounded-xl shimmer" />)}</div>
        ) : tab === 'members' ? (
          <TeamMembersList members={members} projects={projects} setMembers={setMembers} />
        ) : tab === 'invite' ? (
          <TeamInvite projects={projects} onInvited={(m) => setMembers(prev => [...prev, m])} />
        ) : tab === 'orgs' ? (
          <OrgManager projects={projects} />
        ) : (
          <SSOImport projects={projects} onImported={(ms) => setMembers(prev => [...prev, ...ms])} />
        )}
      </div>
    </div>
  );
}

function TeamTabs({ tab, onTab }: { tab: string; onTab: (t: 'members' | 'invite' | 'import' | 'orgs') => void }) {
  const tabs = [
    { key: 'members' as const, label: 'Members' },
    { key: 'invite' as const, label: 'Invite' },
    { key: 'import' as const, label: 'Import SSO' },
    { key: 'orgs' as const, label: 'Organizations' },
  ];
  return (
    <div className="flex gap-2">
      {tabs.map(t => (
        <button key={t.key} onClick={() => onTab(t.key)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.key ? 'bg-accent/20 text-accent border border-accent/30' : 'bg-surface-card border border-surface-border text-zinc-400 hover:text-zinc-200'}`}>
          {t.label}
        </button>
      ))}
    </div>
  );
}
