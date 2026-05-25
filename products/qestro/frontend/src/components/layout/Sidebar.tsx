/**
 * Sidebar Navigation Component
 * Fully theme-aware with CSS variable support
 */

import React, { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  ArrowRightOnRectangleIcon,
} from "@heroicons/react/24/outline";
import { useAuthStore } from "../../stores/authStore";
import { phaseOneReleaseMode } from "../../config/release";
import { phaseOneNavigation } from "./navigation";

const Sidebar: React.FC = () => {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const navigation = phaseOneNavigation;
  const [isDesktop, setIsDesktop] = useState(() => (
    typeof window === 'undefined' ? true : window.matchMedia('(min-width: 768px)').matches
  ));

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 768px)');
    const syncViewport = () => setIsDesktop(mediaQuery.matches);

    syncViewport();
    mediaQuery.addEventListener('change', syncViewport);
    return () => mediaQuery.removeEventListener('change', syncViewport);
  }, []);

  if (!isDesktop) {
    return null;
  }

  return (
    <div className="md:flex md:flex-shrink-0 h-full fixed left-0 top-0 z-40">
      <div className="flex flex-col w-64 h-full">
        {/* Sidebar Container - Uses theme CSS variables */}
        <div
          className="flex flex-col flex-grow backdrop-blur-xl pt-5 pb-4 overflow-y-auto h-full transition-colors duration-300"
          style={{
            backgroundColor: 'var(--bg-sidebar)',
            borderRight: '1px solid var(--border-color)',
          }}
        >
          {/* Logo */}
          <div className="flex items-center flex-shrink-0 px-5 mb-2">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div
                  className="h-10 w-10 rounded-xl flex items-center justify-center transition-colors duration-300"
                  style={{
                    backgroundColor: 'var(--brand-primary)',
                    boxShadow: `0 0 20px color-mix(in srgb, var(--brand-primary) 40%, transparent)`,
                  }}
                >
                  <svg
                    className="h-5 w-5"
                    style={{ color: 'var(--text-inverse)' }}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
              </div>
              <span
                className="text-xl font-bold transition-colors duration-300"
                style={{ color: 'var(--text-primary)' }}
              >
                Qestro
              </span>
            </div>
          </div>

          {/* Navigation */}
          <nav className="mt-6 flex-1 px-3 space-y-1 overflow-y-auto">
            {phaseOneReleaseMode && (
              <div className="mb-4 rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-3 text-xs leading-5 text-cyan-100">
                Production is locked to the real wedge: recording, runs, test cases, Jira settings, and billing.
              </div>
            )}
            {navigation.map((item) => {
              const isActive = location.pathname === item.href ||
                (item.href !== "/" && location.pathname.startsWith(item.href));

              return (
                <NavLink
                  key={item.name}
                  to={item.href}
                  className="group flex items-center px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200"
                  style={{
                    backgroundColor: isActive
                      ? 'color-mix(in srgb, var(--brand-primary) 15%, transparent)'
                      : 'transparent',
                    color: isActive ? 'var(--brand-primary)' : 'var(--text-muted)',
                    border: isActive
                      ? '1px solid color-mix(in srgb, var(--brand-primary) 30%, transparent)'
                      : '1px solid transparent',
                    boxShadow: isActive
                      ? `0 0 15px color-mix(in srgb, var(--brand-primary) 15%, transparent)`
                      : 'none',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'var(--bg-sidebar-hover)';
                      e.currentTarget.style.color = 'var(--text-primary)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = 'var(--text-muted)';
                    }
                  }}
                >
                  <item.icon
                    className="mr-3 h-5 w-5 flex-shrink-0 transition-colors"
                    style={{
                      color: isActive ? 'var(--brand-primary)' : 'var(--text-muted)',
                    }}
                    aria-hidden="true"
                  />
                  {item.name}
                  {isActive && (
                    <div
                      className="ml-auto w-1.5 h-1.5 rounded-full"
                      style={{
                        backgroundColor: 'var(--brand-primary)',
                        boxShadow: `0 0 8px var(--brand-primary)`,
                      }}
                    />
                  )}
                </NavLink>
              );
            })}
          </nav>

          {/* User Section */}
          <div
            className="flex-shrink-0 p-4 mx-3 mt-4 transition-colors duration-300"
            style={{ borderTop: '1px solid var(--border-color)' }}
          >
            <div className="flex items-center w-full gap-3">
              <div className="flex-shrink-0">
                <div
                  className="h-9 w-9 rounded-xl flex items-center justify-center transition-colors duration-300"
                  style={{
                    backgroundColor: 'var(--brand-accent)',
                    boxShadow: `0 0 15px color-mix(in srgb, var(--brand-accent) 30%, transparent)`,
                  }}
                >
                  <span
                    className="text-sm font-semibold"
                    style={{ color: 'var(--text-inverse)' }}
                  >
                    {user?.name?.charAt(0).toUpperCase() ||
                      user?.email?.charAt(0).toUpperCase() || "U"}
                  </span>
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className="text-sm font-medium truncate transition-colors duration-300"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {user?.name || user?.email || "User"}
                </p>
                <p
                  className="text-xs capitalize truncate transition-colors duration-300"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {user?.role || "Member"}
                </p>
              </div>
              <button
                onClick={logout}
                className="flex-shrink-0 p-2 rounded-lg transition-all"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--status-error)';
                  e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--status-error) 10%, transparent)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--text-muted)';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
                title="Logout"
              >
                <ArrowRightOnRectangleIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
