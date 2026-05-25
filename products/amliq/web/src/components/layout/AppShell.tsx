import React, { useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Sidebar } from './Sidebar';
import { Toolbar } from './Toolbar';
import { Breadcrumbs } from './Breadcrumbs';
import { PageTransition } from './PageTransition';
import { useSidebar } from '../../hooks/useSidebar';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { isOpen, toggle, close, open } = useSidebar();
  const touchStart = useRef({ x: 0, y: 0, t: 0 });
  const isRtl = document.documentElement.dir === 'rtl';

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStart.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      t: Date.now(),
    };
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    const dt = Date.now() - touchStart.current.t;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;

    if (Math.abs(dy) > Math.abs(dx) * 1.5) return;

    const velocity = Math.abs(dx) / dt;
    const isQuickSwipe = velocity > 0.4;
    const edgeZone = isRtl ? window.innerWidth - 48 : 48;
    const nearEdge = isRtl
      ? touchStart.current.x > edgeZone
      : touchStart.current.x < edgeZone;

    const openSwipe = isRtl ? dx < -60 : dx > 60;
    const closeSwipe = isRtl ? dx > 60 : dx < -60;

    if ((openSwipe || isQuickSwipe) && nearEdge && !isOpen) open();
    if ((closeSwipe || (isQuickSwipe && isOpen)) && isOpen) close();
  }, [isOpen, open, close, isRtl]);

  return (
    <div
      className="flex h-screen w-full overflow-hidden"
      style={{ background: 'var(--dash-bg)', color: 'var(--dash-text)' }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-0 focus:start-0 focus:z-[9999] focus:px-6 focus:py-3 focus:bg-[var(--accent-gold)] focus:text-white focus:font-semibold focus:rounded-ee-lg"
      >
        Skip to main content
      </a>

      <Sidebar isOpen={isOpen} onClose={close} />

      <motion.div
        className="flex-1 flex flex-col min-w-0 overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <Toolbar onMenuClick={toggle} />
        <Breadcrumbs />
        <main id="main-content" className="flex-1 overflow-y-auto" tabIndex={-1}>
          <div className="px-4 py-4 md:px-6 lg:px-8 md:py-6 max-w-7xl mx-auto w-full">
            <PageTransition>
              {children}
            </PageTransition>
          </div>
        </main>
      </motion.div>
    </div>
  );
}
