import { useState, useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import ThemeSwitcher from './ThemeSwitcher';
import PlanBadge from './PlanBadge';
import PlanPerks from './PlanPerks';
import ProBadge from './ProBadge';
import SidebarUser from './SidebarUser';
import XPBar from './XPBar';
import type { Plan } from '../hooks/usePlan';
import { navGesture, btnGestureSubtle } from '../styles/gestures';
import { API_BASE_URL } from '../config';

interface Props {
  user: { login: string; avatar_url: string; name: string };
  onLogout: () => void;
  open: boolean;
  onClose: () => void;
}

const links: { to: string; label: string; icon: string; requiredPlan?: Plan }[] = [
  { to: '/', label: 'Overview', icon: '^' },
  { to: '/runs', label: 'Runs', icon: '>' },
  { to: '/projects', label: 'Projects', icon: '#' },
  { to: '/analytics', label: 'Analytics', icon: '~' },
  { to: '/runners', label: 'Runners', icon: '=', requiredPlan: 'pro' },
  { to: '/artifacts', label: 'Artifacts', icon: '@', requiredPlan: 'pro' },
  { to: '/chat', label: 'Ask AI', icon: '?', requiredPlan: 'pro' },
  { to: '/channels', label: 'Integrations', icon: '&' },
  { to: '/gitlab', label: 'GitLab', icon: 'L' },
  { to: '/bitbucket', label: 'Bitbucket', icon: 'B' },
  { to: '/github-actions', label: 'GitHub Actions', icon: 'G' },
  { to: '/gerrit', label: 'Gerrit', icon: 'GR' },
  { to: '/migrate', label: 'Migration', icon: 'M' },
  { to: '/skills', label: 'Skill Market', icon: '+' },
  { to: '/team', label: 'Team', icon: '%', requiredPlan: 'team' },
  { to: '/registries', label: 'Registries', icon: 'R', requiredPlan: 'team' },
  { to: '/enterprise', label: 'Enterprise', icon: 'E', requiredPlan: 'team' },
  { to: '/audit', label: 'Audit Log', icon: '!' },
  { to: '/achievements', label: 'Achievements', icon: '★' },
  { to: '/settings', label: 'Settings', icon: '*' },
];

function navClass({ isActive }: { isActive: boolean }) {
  const base = `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${navGesture}`;
  return isActive
    ? `${base} bg-accent/10 text-emerald-400`
    : `${base} text-zinc-400 hover:text-zinc-100 hover:bg-surface-hover`;
}

export default function Sidebar({ user, onLogout, open, onClose }: Props) {
  const [xp, setXp] = useState(0);
  const asideRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const token = localStorage.getItem('pushci_token');
    const controller = new AbortController();
    fetch(`${API_BASE_URL}/api/achievements`, {
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data?.xp != null) setXp(data.xp); })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!open) return;
    const isMobile = window.matchMedia('(max-width: 1023px)').matches;
    if (!isMobile) return;
    const first = asideRef.current?.querySelector<HTMLElement>('a, button');
    first?.focus();
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        id="dashboard-sidebar"
        ref={asideRef}
        aria-label="Primary navigation"
        className={`fixed inset-y-0 left-0 z-50 w-64 flex flex-col border-r border-surface-border bg-surface-card
          transform transition-transform duration-200 ease-in-out
          lg:static lg:translate-x-0 lg:w-56 lg:h-full lg:shrink-0
          ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="px-4 py-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center text-xs font-bold text-black">
              RL
            </div>
            <span className="text-base font-semibold tracking-tight">PushCI</span>
          </div>
          <button
            onClick={onClose}
            className={`lg:hidden text-zinc-400 hover:text-zinc-200 p-1 ${btnGestureSubtle}`}
            aria-label="Close menu"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 px-3 space-y-1 mt-2 overflow-y-auto">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} className={navClass} onClick={onClose}>
              <span className="w-4 text-center font-mono text-xs opacity-60">{l.icon}</span>
              {l.label}
              {l.requiredPlan && <ProBadge required={l.requiredPlan} />}
            </NavLink>
          ))}
        </nav>

        <PlanPerks />
        <div className="px-4 py-3 border-t border-surface-border">
          <XPBar xp={xp} compact />
        </div>
        <div className="px-4 py-4 border-t border-surface-border space-y-3">
          <PlanBadge />
          <ThemeSwitcher />
          <SidebarUser user={user} onLogout={onLogout} />
        </div>
      </aside>
    </>
  );
}
