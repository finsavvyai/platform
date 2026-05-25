/**
 * StatusBar — bottom bar showing node count, edge count, and workflow state.
 * Apple HIG: compact, muted, information-dense without clutter.
 */

import React from 'react';
import { useDarkMode } from '../../hooks/useDarkMode';
import {
  spacing, fontFamily, fontSize, fontWeight, colors,
} from '../../lib/theme';

interface StatusBarProps {
  nodeCount: number;
  edgeCount: number;
  isRunning: boolean;
  workflowName: string;
}

export function StatusBar({ nodeCount, edgeCount, isRunning, workflowName }: StatusBarProps) {
  const isDark = useDarkMode();
  const c = isDark ? colors.dark : colors.light;

  const barStyle: React.CSSProperties = {
    fontFamily,
    display: 'flex',
    alignItems: 'center',
    gap: spacing.md,
    padding: `${spacing.xs}px ${spacing.md}px`,
    background: isDark ? '#1C1C1E' : '#F2F2F7',
    borderTop: `1px solid ${c.separator}`,
    height: 28,
    flexShrink: 0,
    fontSize: fontSize.caption2,
    color: c.textTertiary,
    zIndex: 10,
  };

  const dotStyle = (color: string): React.CSSProperties => ({
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: color,
    flexShrink: 0,
  });

  const itemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  };

  const statusColor = isRunning ? c.orange : c.green;
  const statusText = isRunning ? 'Running' : 'Ready';

  return (
    <div style={barStyle} data-testid="status-bar">
      <div style={itemStyle}>
        <div
          style={{
            ...dotStyle(statusColor),
            animation: isRunning ? 'pulse 1.2s infinite' : 'none',
          }}
        />
        <span style={{ fontWeight: fontWeight.medium }}>{statusText}</span>
      </div>

      <div style={{ width: 1, height: 12, background: c.separator }} />

      <span>{nodeCount} node{nodeCount !== 1 ? 's' : ''}</span>

      <div style={{ width: 1, height: 12, background: c.separator }} />

      <span>{edgeCount} connection{edgeCount !== 1 ? 's' : ''}</span>

      <div style={{ flex: 1 }} />

      <span style={{ color: c.textTertiary }}>
        {workflowName || 'Untitled'}
      </span>

      <div style={{ width: 1, height: 12, background: c.separator }} />

      <span style={{ color: c.textTertiary, opacity: 0.6 }}>v2.0.0</span>
    </div>
  );
}
