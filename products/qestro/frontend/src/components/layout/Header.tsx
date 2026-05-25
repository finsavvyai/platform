/**
 * Header Component
 * Fully theme-aware with CSS variable support
 */

import React from 'react';
import {
  ArrowRightOnRectangleIcon,
  UserIcon,
} from '@heroicons/react/24/outline';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { phaseOneNavigation } from './navigation';

interface HeaderProps {
  title: string;
  onShare?: () => void;
}

const Header: React.FC<HeaderProps> = ({ title }) => {
  const { user, logout } = useAuthStore();
  const location = useLocation();

  // Use the passed title directly
  const currentTitle = title;

  return (
    <header
      className="backdrop-blur-xl sticky top-0 z-30 transition-colors duration-300"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--bg-primary) 80%, transparent)',
        borderBottom: '1px solid var(--border-color)',
      }}
    >
      <div className="px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Left side - Breadcrumb / Current Page */}
          <div className="flex items-center gap-3">
            <nav className="flex items-center space-x-2 text-sm">
              <span style={{ color: 'var(--text-muted)' }}>Dashboard</span>
              {currentTitle !== 'Dashboard' && (
                <>
                  <span style={{ color: 'var(--text-muted)' }}>/</span>
                  <span
                    className="font-medium"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {currentTitle}
                  </span>
                </>
              )}
            </nav>
          </div>

          {/* Right side - Actions */}
          <div className="flex items-center gap-4">
            <button
              onClick={logout}
              className="flex h-9 w-9 items-center justify-center rounded-xl transition-all md:hidden"
              style={{
                color: 'var(--text-muted)',
                border: '1px solid var(--border-color)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--status-error)';
                e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--status-error) 10%, transparent)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--text-muted)';
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              title="Logout"
              aria-label="Logout"
            >
              <ArrowRightOnRectangleIcon className="h-4 w-4" />
            </button>

            {/* User Menu */}
            <div className="flex items-center gap-3">
              <div className="hidden sm:block text-right">
                <div
                  className="text-sm font-medium transition-colors duration-300"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {user?.name || user?.email || 'User'}
                </div>
                <div
                  className="text-xs capitalize transition-colors duration-300"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {user?.role || 'Member'}
                </div>
              </div>
              <div
                className="h-9 w-9 rounded-xl flex items-center justify-center transition-all duration-300"
                style={{
                  backgroundColor: 'var(--brand-primary)',
                  boxShadow: `0 0 15px color-mix(in srgb, var(--brand-primary) 30%, transparent)`,
                }}
              >
                <UserIcon className="h-4 w-4" style={{ color: 'var(--text-inverse)' }} />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="border-t border-white/5 px-3 pb-3 md:hidden">
        <nav
          aria-label="Mobile navigation"
          className="flex gap-2 overflow-x-auto pt-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {phaseOneNavigation.map((item) => {
            const isActive = location.pathname === item.href ||
              (item.href !== '/' && location.pathname.startsWith(item.href));

            return (
              <NavLink
                key={item.href}
                to={item.href}
                className="inline-flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-all"
                style={{
                  borderColor: isActive
                    ? 'color-mix(in srgb, var(--brand-primary) 40%, transparent)'
                    : 'var(--border-color)',
                  backgroundColor: isActive
                    ? 'color-mix(in srgb, var(--brand-primary) 16%, transparent)'
                    : 'color-mix(in srgb, var(--bg-secondary) 70%, transparent)',
                  color: isActive ? 'var(--brand-primary)' : 'var(--text-muted)',
                }}
              >
                <item.icon className="h-4 w-4" />
                <span>{item.name}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>
    </header>
  );
};

export default Header;
