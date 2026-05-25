import { Dispatch, SetStateAction } from 'react';
import TeamMemberRow from './TeamMemberRow';
import { API_BASE_URL } from '../config';

interface Member {
  project_id: string; user_sub: string; login: string;
  provider: string; role: string; repo: string; created_at: string;
}
interface Project { id: string; repo: string; platform: string; }

interface Props {
  members: Member[];
  projects: Project[];
  setMembers: Dispatch<SetStateAction<Member[]>>;
}

function token() { return localStorage.getItem('pushci_token'); }

export default function TeamMembersList({ members, projects, setMembers }: Props) {
  const grouped = projects.map(p => ({ ...p, members: members.filter(m => m.project_id === p.id) }));

  const removeMember = async (projectId: string, sub: string) => {
    try {
      const t = token();
      await fetch(`${API_BASE_URL}/api/team/${projectId}/${encodeURIComponent(sub)}`, {
        method: 'DELETE',
        headers: t ? { Authorization: `Bearer ${t}` } : {},
      });
      setMembers(prev => prev.filter(m => !(m.project_id === projectId && m.user_sub === sub)));
    } catch { /* handled */ }
  };

  const changeRole = (_sub: string, _role: string) => {
    /* API integration placeholder */
  };

  if (grouped.every(g => g.members.length === 0)) {
    return <p className="text-sm text-zinc-500 py-8 text-center">No team members yet. Invite someone to get started.</p>;
  }

  return (
    <div className="space-y-6">
      {grouped.filter(g => g.members.length > 0).map(g => (
        <div key={g.id} className="bg-surface-card border border-surface-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-zinc-200 mb-3">{g.repo}</h3>
          <div className="space-y-2">
            {g.members.map(m => (
              <TeamMemberRow
                key={m.user_sub}
                member={m}
                onRoleChange={changeRole}
                onRemove={(sub) => removeMember(g.id, sub)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
