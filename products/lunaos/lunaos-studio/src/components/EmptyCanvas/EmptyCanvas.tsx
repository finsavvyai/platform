/**
 * EmptyCanvas — onboarding guidance shown when no nodes exist.
 * Shows how to get started: drag nodes, use templates, keyboard shortcuts.
 */

import React, { useState } from 'react';
import { useDarkMode } from '../../hooks/useDarkMode';
import {
  spacing, radius, fontFamily, fontSize, fontWeight, colors,
} from '../../lib/theme';

interface EmptyCanvasProps {
  onOpenTemplates: () => void;
}

export function EmptyCanvas({ onOpenTemplates }: EmptyCanvasProps) {
  const isDark = useDarkMode();
  const c = isDark ? colors.dark : colors.light;
  const [btnFocused, setBtnFocused] = useState(false);

  const overlayStyle: React.CSSProperties = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    textAlign: 'center',
    color: c.textTertiary,
    zIndex: 10,
    background: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)',
    padding: `${spacing.xl}px ${spacing.xxl}px`,
    borderRadius: radius.lg,
    backdropFilter: 'blur(12px)',
    border: `1px solid ${c.separator}`,
    maxWidth: 420,
    fontFamily,
  };

  const headingStyle: React.CSSProperties = {
    margin: 0,
    fontSize: fontSize.title3,
    fontWeight: fontWeight.bold,
    color: c.text,
    marginBottom: spacing.sm,
  };

  const descStyle: React.CSSProperties = {
    margin: 0,
    fontSize: fontSize.subheadline,
    color: c.textSecondary,
    lineHeight: 1.5,
    marginBottom: spacing.lg,
  };

  const tipsStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.sm,
    textAlign: 'left',
    marginBottom: spacing.lg,
  };

  const tipStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
    fontSize: fontSize.caption1,
    color: c.textSecondary,
  };

  const kbdStyle: React.CSSProperties = {
    padding: `1px ${spacing.xs}px`,
    borderRadius: 4,
    background: isDark ? '#3A3A3C' : '#E5E5EA',
    fontSize: fontSize.caption2,
    fontFamily: 'monospace',
    color: c.text,
    border: `1px solid ${c.separator}`,
  };

  const bulletStyle: React.CSSProperties = {
    width: 20,
    height: 20,
    borderRadius: radius.full,
    background: `${c.accent}15`,
    color: c.accent,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: fontSize.caption2,
    fontWeight: fontWeight.bold,
    flexShrink: 0,
  };

  const btnStyle: React.CSSProperties = {
    padding: `${spacing.sm}px ${spacing.lg}px`,
    borderRadius: radius.sm,
    border: 'none',
    background: c.accent,
    color: '#FFFFFF',
    fontWeight: fontWeight.semibold,
    fontSize: fontSize.subheadline,
    cursor: 'pointer',
    fontFamily,
    transition: 'background 120ms ease',
    outline: 'none',
    boxShadow: btnFocused ? `0 0 0 3px ${c.accent}40` : undefined,
  };

  const arrowStyle: React.CSSProperties = {
    position: 'absolute', left: -80, top: '50%',
    transform: 'translateY(-50%)', pointerEvents: 'none',
  };

  return (
    <div style={overlayStyle} data-testid="empty-canvas">
      <div style={arrowStyle} aria-hidden="true">
        <svg width="64" height="48" viewBox="0 0 64 48" fill="none">
          <path d="M60 24H8M8 24l14-12M8 24l14 12"
            stroke={c.accent} strokeWidth="2.5" strokeLinecap="round"
            strokeLinejoin="round" opacity="0.6" />
        </svg>
      </div>

      <h3 style={headingStyle}>Your canvas is empty</h3>
      <p style={descStyle}>
        Drag an agent from the panel to start, or choose a template.
      </p>

      <div style={tipsStyle}>
        <div style={tipStyle}>
          <div style={bulletStyle}>1</div>
          <span>Drag agents from the left panel</span>
        </div>
        <div style={tipStyle}>
          <div style={bulletStyle}>2</div>
          <span>Connect them with edges</span>
        </div>
        <div style={tipStyle}>
          <div style={bulletStyle}>3</div>
          <span>
            Click <kbd style={kbdStyle}>Run</kbd> to execute
          </span>
        </div>
      </div>

      <button
        style={btnStyle}
        onClick={onOpenTemplates}
        onMouseEnter={(e) => {
          (e.target as HTMLElement).style.background =
            isDark ? colors.dark.accentHover : colors.light.accentHover;
        }}
        onMouseLeave={(e) => {
          (e.target as HTMLElement).style.background =
            isDark ? colors.dark.accent : colors.light.accent;
        }}
        onFocus={() => setBtnFocused(true)}
        onBlur={() => setBtnFocused(false)}
      >
        Choose a Template
      </button>

      <div style={{
        marginTop: spacing.md,
        fontSize: fontSize.caption2,
        color: c.textTertiary,
      }}>
        <kbd style={kbdStyle}>Cmd+Z</kbd> undo
        {' \u00B7 '}
        <kbd style={kbdStyle}>Cmd+S</kbd> export
        {' \u00B7 '}
        <kbd style={kbdStyle}>Del</kbd> remove node
      </div>
    </div>
  );
}
