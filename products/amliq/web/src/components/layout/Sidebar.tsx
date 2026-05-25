import React, { useEffect, useState } from 'react';
import { X, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { Avatar } from '../ui/Avatar';
import { NavGroup } from './NavGroup';
import { navSections } from './navItems';
import { ThemeToggle } from '../ui/ThemeToggle';
import { useAuth } from '../../context/AuthContext';
import Logo from '../brand/Logo';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const spring = { type: 'spring' as const, stiffness: 340, damping: 34, mass: 0.85 };

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const isRtl = document.documentElement.dir === 'rtl';
  const displayName = user?.email?.split('@')[0] ?? 'User';
  const displayEmail = user?.email ?? 'Compliance Officer';
  const userRole = user?.role ?? 'viewer';

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <SidebarHeader collapsed={collapsed} onClose={onClose}
        onToggle={() => setCollapsed(!collapsed)} />
      <div className="mx-3 h-px" style={{ background: 'var(--dash-border)' }} />

      <nav className="flex-1 px-2 py-2 overflow-y-auto scrollbar-thin" aria-label="Main navigation">
        {navSections.map((section, i) => (
          <NavGroup key={section.title} section={section} userRole={userRole}
            collapsed={collapsed} onNavigate={onClose} index={i} />
        ))}
      </nav>

      <AnimatePresence>
        {!collapsed && (
          <motion.div
            className="p-3"
            style={{ borderTop: '1px solid var(--dash-border)' }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.18 }}
          >
            <div className="flex items-center justify-between mb-2 px-2">
              <ThemeToggle />
            </div>
            <Link to="/config"
              className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-[var(--dash-sidebar-hover)]"
              style={{ color: 'var(--dash-text)' }}>
              <Avatar name={displayName} size="md" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{displayName}</p>
                <p className="text-[11px] truncate" style={{ color: 'var(--dash-text-tertiary)' }}>
                  {displayEmail}
                </p>
              </div>
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="backdrop"
            className="fixed inset-0 bg-black/50 backdrop-blur-sm md:hidden z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.aside
            key="sidebar-mobile"
            className={clsx(
              'fixed h-screen flex flex-col z-50 md:hidden',
              collapsed ? 'w-16' : 'w-[280px]',
              isRtl ? 'right-0' : 'left-0',
            )}
            style={{
              background: 'var(--dash-sidebar)',
              borderInlineEnd: '1px solid var(--dash-border)',
            }}
            initial={{ x: isRtl ? '100%' : '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: isRtl ? '100%' : '-100%' }}
            transition={spring}
          >
            {sidebarContent}
          </motion.aside>
        )}
      </AnimatePresence>

      <motion.aside
        className={clsx(
          'hidden md:flex flex-col h-screen z-50',
          collapsed ? 'w-16' : 'w-64',
        )}
        style={{
          background: 'var(--dash-sidebar)',
          borderInlineEnd: '1px solid var(--dash-border)',
        }}
        animate={{ width: collapsed ? 64 : 256 }}
        transition={{ type: 'spring', stiffness: 280, damping: 30 }}
      >
        {sidebarContent}
      </motion.aside>
    </>
  );
}

function SidebarHeader({ collapsed, onClose, onToggle }: {
  collapsed: boolean; onClose: () => void; onToggle: () => void;
}) {
  return (
    <div className="relative p-3 flex items-center justify-between">
      <Logo size={24} showText={!collapsed} />
      <motion.button
        onClick={onClose} aria-label="Close menu"
        className="md:hidden p-2 rounded-xl cursor-pointer transition-colors hover:bg-[var(--dash-sidebar-hover)]"
        style={{ color: 'var(--dash-text-secondary)' }}
        whileTap={{ scale: 0.88 }}
        whileHover={{ scale: 1.1 }}
      >
        <X className="w-5 h-5" />
      </motion.button>
      <motion.button
        onClick={onToggle} aria-label={collapsed ? 'Expand' : 'Collapse'}
        className="hidden md:block p-2 rounded-xl cursor-pointer transition-colors hover:bg-[var(--dash-sidebar-hover)]"
        style={{ color: 'var(--dash-text-tertiary)' }}
        whileTap={{ scale: 0.88 }}
        whileHover={{ scale: 1.1 }}
      >
        {collapsed ? <ChevronsRight className="w-4 h-4" /> : <ChevronsLeft className="w-4 h-4" />}
      </motion.button>
    </div>
  );
}
