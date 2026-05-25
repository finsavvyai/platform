import { useState, useRef, useCallback } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import { btnGestureSubtle } from '../styles/gestures';

interface User {
  login: string;
  avatar_url: string;
  name: string;
}

interface Props {
  user: User;
  onLogout: () => void;
}

export default function Layout({ user, onLogout }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const location = useLocation();

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false);
    queueMicrotask(() => menuButtonRef.current?.focus());
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-lg focus:bg-accent focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
      >
        Skip to main content
      </a>
      <Sidebar
        user={user}
        onLogout={onLogout}
        open={sidebarOpen}
        onClose={closeSidebar}
      />
      <main
        id="main-content"
        tabIndex={-1}
        key={location.pathname}
        className="flex-1 overflow-y-auto min-w-0 focus:outline-none"
      >
        <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-surface-border bg-surface/80 backdrop-blur-sm px-4 py-3 lg:hidden">
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-expanded={sidebarOpen}
            aria-controls="dashboard-sidebar"
            aria-label="Open navigation menu"
            className={`text-zinc-400 hover:text-zinc-200 p-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${btnGestureSubtle}`}
          >
            <svg aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="text-sm font-semibold tracking-tight">
            <span className="text-emerald-400">Push</span>CI
          </span>
        </div>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
