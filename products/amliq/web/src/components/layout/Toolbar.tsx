import React, { useState, useEffect } from 'react';
import { Menu, Search, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LanguageSwitcher } from '../ui/LanguageSwitcher';
import { NotificationBell } from './NotificationBell';
import { CommandPalette } from './CommandPalette';
import { Avatar } from '../ui/Avatar';
import { useAuth } from '../../context/AuthContext';

interface ToolbarProps {
  onMenuClick: () => void;
}

export function Toolbar({ onMenuClick }: ToolbarProps) {
  const [cmdOpen, setCmdOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const displayName = user?.email?.split('@')[0] ?? 'User';

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdOpen((v) => !v);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  return (
    <>
      <motion.header
        className="sticky top-0 z-40 px-3 sm:px-4 py-2"
        style={{
          background: 'var(--dash-nav-bg)',
          backdropFilter: 'blur(20px) saturate(150%)',
          WebkitBackdropFilter: 'blur(20px) saturate(150%)',
          borderBottom: '1px solid var(--dash-border)',
        }}
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30, delay: 0.05 }}
      >
        <div className="flex items-center gap-2">
          <motion.button
            onClick={onMenuClick} aria-label="Toggle menu"
            className="md:hidden p-2 rounded-lg cursor-pointer transition-colors hover:bg-[var(--dash-surface-hover)]"
            style={{ color: 'var(--dash-text-secondary)' }}
            whileTap={{ scale: 0.88 }}
            whileHover={{ scale: 1.1 }}
          >
            <Menu className="w-5 h-5" />
          </motion.button>

          <motion.button
            onClick={() => setCmdOpen(true)}
            className="hidden md:flex items-center gap-3 px-3 py-2 rounded-lg transition-colors cursor-pointer max-w-xs flex-1"
            style={{ background: 'var(--dash-surface)', color: 'var(--dash-text-tertiary)' }}
            whileHover={{ scale: 1.01 }}
            whileFocus={{ scale: 1.01 }}
          >
            <Search className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm">Search...</span>
            <kbd className="ms-auto text-[10px] px-1.5 py-0.5 rounded font-mono"
              style={{ background: 'var(--dash-surface-hover)', color: 'var(--dash-text-tertiary)' }}>⌘K</kbd>
          </motion.button>

          <div className="flex items-center gap-1 ms-auto">
            <div className="hidden sm:block">
              <LanguageSwitcher />
            </div>
            <NotificationBell />
            <div className="flex items-center gap-1.5 ps-1.5 ms-0.5"
              style={{ borderInlineStart: '1px solid var(--dash-border)' }}>
              <Avatar name={displayName} size="sm" />
              <motion.button
                onClick={() => { logout(); navigate('/login'); }}
                aria-label="Logout"
                className="p-2 rounded-lg cursor-pointer transition-colors hover:bg-[var(--dash-surface-hover)]"
                style={{ color: 'var(--dash-text-tertiary)' }}
                whileTap={{ scale: 0.88 }}
                whileHover={{ scale: 1.1, rotate: 10 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              >
                <LogOut className="w-4 h-4" />
              </motion.button>
            </div>
          </div>
        </div>
      </motion.header>
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
    </>
  );
}
