/**
 * MobileGate — shows a friendly message on viewports too small
 * for the workflow builder. Renders children on desktop.
 */

import React, { useState, useEffect } from 'react';
import { useDarkMode } from '../../hooks/useDarkMode';
import {
  spacing, radius, fontFamily, fontSize, fontWeight, colors,
} from '../../lib/theme';

const MIN_WIDTH = 768;

interface MobileGateProps {
  children: React.ReactNode;
}

export function MobileGate({ children }: MobileGateProps) {
  const isDark = useDarkMode();
  const c = isDark ? colors.dark : colors.light;
  const [isTooSmall, setIsTooSmall] = useState(false);

  useEffect(() => {
    const check = () => setIsTooSmall(window.innerWidth < MIN_WIDTH);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  if (!isTooSmall) return <>{children}</>;

  const containerStyle: React.CSSProperties = {
    fontFamily,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    width: '100vw',
    background: c.bg,
    color: c.text,
    padding: spacing.xl,
    textAlign: 'center',
    gap: spacing.md,
  };

  const iconStyle: React.CSSProperties = {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    background: `${c.accent}15`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 32,
    marginBottom: spacing.sm,
  };

  const titleStyle: React.CSSProperties = {
    fontSize: fontSize.title2,
    fontWeight: fontWeight.bold,
    color: c.text,
  };

  const bodyStyle: React.CSSProperties = {
    fontSize: fontSize.body,
    color: c.textSecondary,
    maxWidth: 360,
    lineHeight: 1.5,
  };

  const badgeStyle: React.CSSProperties = {
    fontSize: fontSize.caption1,
    color: c.accent,
    fontWeight: fontWeight.medium,
    padding: `${spacing.xs}px ${spacing.md}px`,
    borderRadius: radius.full,
    background: `${c.accent}12`,
    marginTop: spacing.sm,
  };

  return (
    <div style={containerStyle} data-testid="mobile-gate">
      <div style={iconStyle}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={c.accent} strokeWidth="2" strokeLinecap="round">
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <path d="M8 21h8M12 17v4" />
        </svg>
      </div>
      <h2 style={titleStyle}>Desktop Required</h2>
      <p style={bodyStyle}>
        LunaOS Studio's visual workflow builder needs a larger screen
        for drag-and-drop node editing. Please open this page on a
        desktop or tablet in landscape mode.
      </p>
      <span style={badgeStyle}>Minimum 768px wide</span>
    </div>
  );
}
