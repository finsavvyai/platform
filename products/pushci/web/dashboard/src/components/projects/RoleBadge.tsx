import type { ProjectMembership } from '../../hooks/useApi';

export default function RoleBadge({ role }: { role: ProjectMembership['role'] }) {
  return (
    <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-300">
      {role.replace(/_/g, ' ')}
    </span>
  );
}
