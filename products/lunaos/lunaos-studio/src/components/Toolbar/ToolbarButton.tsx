/**
 * ToolbarButton — styled button with icon, variants (primary/danger/secondary).
 */

import React, { useState, useMemo } from 'react';
import { useDarkMode } from '../../hooks/useDarkMode';
import {
  spacing, radius, fontFamily, fontSize, fontWeight, colors,
} from '../../lib/theme';
import { ToolbarIcon } from './ToolbarIcon';

export type ButtonVariant = 'secondary' | 'primary' | 'danger';

interface ToolbarButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  icon?: string;
  tooltip?: string;
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function ToolbarButton({
  children, variant = 'secondary', icon, tooltip, disabled, ...props
}: ToolbarButtonProps) {
  const isDark = useDarkMode();
  const c = isDark ? colors.dark : colors.light;
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const reducedMotion = useMemo(prefersReducedMotion, []);

  const baseBg = isDark ? '#2C2C2E' : '#FFFFFF';
  const hoverBg = isDark ? '#3A3A3C' : '#E5E5EA';
  const active = (hovered || focused) && !disabled;

  let bg = active ? hoverBg : baseBg;
  let textColor = c.text;
  let border = `1px solid ${c.separator}`;
  let fw: number = fontWeight.medium;
  let height = 32;
  let px: number = spacing.md;

  if (variant === 'primary') {
    const isRunning = icon === 'loading';
    bg = isRunning ? c.orange : c.accent;
    if (active) bg = isRunning ? c.orange : c.accentHover;
    textColor = '#FFFFFF';
    border = 'none';
    fw = fontWeight.semibold;
    height = 34;
    px = spacing.lg;
  }

  if (variant === 'danger') {
    textColor = active ? c.red : c.textSecondary;
    bg = active ? `${c.red}12` : 'transparent';
    border = `1px solid ${active ? `${c.red}40` : c.separator}`;
  }

  const focusRing = focused && !disabled
    ? `0 0 0 3px ${c.accent}40`
    : undefined;

  const scale = active && !reducedMotion ? 'scale(1.02)' : 'scale(1)';

  const style: React.CSSProperties = {
    padding: `${spacing.xs}px ${px}px`,
    borderRadius: radius.sm,
    fontSize: fontSize.caption1,
    fontWeight: fw,
    fontFamily,
    cursor: disabled ? 'default' : 'pointer',
    border,
    background: bg,
    color: textColor,
    transition: reducedMotion
      ? 'background 120ms ease, color 120ms ease'
      : 'background 120ms ease, transform 120ms ease, color 120ms ease',
    height,
    display: 'flex',
    alignItems: 'center',
    gap: spacing.xs,
    opacity: disabled ? 0.4 : 1,
    transform: scale,
    boxShadow: focusRing,
    outline: 'none',
  };

  return (
    <button
      {...props}
      disabled={disabled}
      aria-disabled={disabled}
      aria-label={tooltip}
      style={style}
      title={tooltip}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    >
      {icon && <ToolbarIcon name={icon} />}
      {children}
    </button>
  );
}
