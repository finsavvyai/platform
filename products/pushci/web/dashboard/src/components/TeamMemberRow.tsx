interface Member {
  user_sub: string;
  login: string;
  role: string;
}

interface Props {
  member: Member;
  onRoleChange: (sub: string, role: string) => void;
  onRemove: (sub: string) => void;
}

const ROLES = ['owner', 'admin', 'member'] as const;

const ROLE_STYLE: Record<string, string> = {
  owner: 'bg-amber-500/10 text-amber-400',
  admin: 'bg-emerald-500/10 text-emerald-400',
  member: 'bg-zinc-500/10 text-zinc-400',
  maintainer: 'bg-emerald-500/10 text-emerald-400',
};

export default function TeamMemberRow({ member, onRoleChange, onRemove }: Props) {
  const initials = member.login.slice(0, 2).toUpperCase();
  const style = ROLE_STYLE[member.role] ?? ROLE_STYLE.member;

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-surface-hover/30 border border-surface-border/50">
      <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-300">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-sm text-zinc-200 font-medium">{member.login}</span>
      </div>
      <select
        value={member.role}
        onChange={(e) => onRoleChange(member.user_sub, e.target.value)}
        className={`text-[11px] font-medium rounded-full px-2.5 py-0.5 border-0 cursor-pointer appearance-none ${style}`}
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
        ))}
      </select>
      <button
        onClick={() => onRemove(member.user_sub)}
        className="text-xs text-red-400/60 hover:text-red-400 transition"
      >
        Remove
      </button>
    </div>
  );
}
