import { NavLink } from 'react-router-dom';

interface User {
  login: string;
  avatar_url: string;
  name: string;
}

interface Props {
  user: User;
  onLogout: () => void;
}

const links = [
  { to: '/runs', label: 'Runs', icon: '>' },
  { to: '/projects', label: 'Projects', icon: '#' },
  { to: '/analytics', label: 'Analytics', icon: '~' },
  { to: '/runners', label: 'Runners', icon: '=' },
  { to: '/artifacts', label: 'Artifacts', icon: '@' },
  { to: '/chat', label: 'Ask AI', icon: '?' },
  { to: '/settings', label: 'Settings', icon: '*' },
];

function navClass({ isActive }: { isActive: boolean }) {
  const base = 'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors';
  return isActive
    ? `${base} bg-accent/10 text-emerald-400`
    : `${base} text-zinc-400 hover:text-zinc-100 hover:bg-surface-hover`;
}

export default function Sidebar({ user, onLogout }: Props) {
  const initials = (user.name || user.login).slice(0, 2).toUpperCase();

  return (
    <aside className="w-56 h-screen flex flex-col border-r border-surface-border bg-surface-card">
      <div className="px-4 py-5 flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center text-xs font-bold text-black">
          RL
        </div>
        <span className="text-base font-semibold tracking-tight">PushCI</span>
      </div>

      <nav className="flex-1 px-3 space-y-1 mt-2">
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} className={navClass}>
            <span className="w-4 text-center font-mono text-xs opacity-60">{l.icon}</span>
            {l.label}
          </NavLink>
        ))}
      </nav>

      <div className="px-4 py-4 border-t border-surface-border">
        <div className="flex items-center gap-3">
          {user.avatar_url ? (
            <img src={user.avatar_url} alt="" className="w-8 h-8 rounded-full" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-bold">
              {initials}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="font-medium text-zinc-200 text-sm truncate">{user.name || user.login}</div>
            <div className="text-xs text-zinc-500 truncate">@{user.login}</div>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="mt-3 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
