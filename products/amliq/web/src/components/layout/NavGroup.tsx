import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import type { NavSection } from './navItems';
import { canAccess } from './navItems';

interface NavGroupProps {
  section: NavSection;
  userRole: string;
  collapsed?: boolean;
  onNavigate: () => void;
  index?: number;
}

const container = {
  animate: { transition: { staggerChildren: 0.045, delayChildren: 0 } },
};

const item = {
  initial: { opacity: 0, x: -8 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] } },
};

const itemRtl = {
  initial: { opacity: 0, x: 8 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] } },
};

export function NavGroup({ section, userRole, collapsed, onNavigate, index = 0 }: NavGroupProps) {
  const { t } = useTranslation('nav');
  const location = useLocation();
  const isRtl = document.documentElement.dir === 'rtl';

  if (!canAccess(userRole, section.minRole)) return null;

  const visibleItems = section.items.filter(
    (item) => canAccess(userRole, item.minRole),
  );
  if (visibleItems.length === 0) return null;

  const isActive = (path: string) =>
    location.pathname === path || (path !== '/dashboard' && location.pathname.startsWith(path));

  const itemVariant = isRtl ? itemRtl : item;

  return (
    <motion.div
      className="mb-4"
      initial="initial"
      animate="animate"
      variants={container}
    >
      {!collapsed && (
        <motion.p
          className="text-[10px] uppercase tracking-[0.12em] px-4 mb-1 font-bold"
          style={{ color: 'var(--dash-gold)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: index * 0.06, duration: 0.25 }}
        >
          {t(section.title.toLowerCase())}
        </motion.p>
      )}
      <div className="space-y-px">
        {visibleItems.map(({ icon: Icon, label, path }) => (
          <motion.div key={path} variants={itemVariant}>
            <Link
              to={path} onClick={onNavigate}
              title={collapsed ? label : undefined}
              className={clsx(
                'flex items-center gap-3 rounded-xl transition-colors cursor-pointer relative',
                collapsed ? 'justify-center px-2 py-3' : 'px-4 py-2',
              )}
              style={{
                background: isActive(path) ? 'var(--dash-sidebar-active)' : 'transparent',
                color: isActive(path) ? 'var(--dash-text)' : 'var(--dash-text-secondary)',
              }}
            >
              {isActive(path) && (
                <motion.span
                  className="absolute inset-inline-start-0 top-1/2 -translate-y-1/2 w-[3px] h-4 ltr:rounded-r-full rtl:rounded-l-full"
                  style={{ background: 'var(--dash-gold)' }}
                  layoutId="nav-active-indicator"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <Icon className="w-4 h-4 flex-shrink-0" />
              {!collapsed && (
                <span className="text-sm">{t(label.toLowerCase().replace(/ /g, '_'))}</span>
              )}
            </Link>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
