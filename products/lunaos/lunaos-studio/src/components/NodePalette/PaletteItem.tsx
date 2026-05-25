/**
 * PaletteItem — draggable node type item within the NodePalette.
 * Supports drag-to-canvas, focus-visible ring, and reduced motion.
 */

import React, { useState, useMemo } from 'react';
import type { NodeTypeDefinition } from '../../types';
import {
  spacing, radius, fontSize, fontWeight, colors, shadow,
} from '../../lib/theme';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function PaletteItem({ node, isDark }: { node: NodeTypeDefinition; isDark: boolean }) {
  const c = isDark ? colors.dark : colors.light;
  const [focused, setFocused] = useState(false);
  const reducedMotion = useMemo(prefersReducedMotion, []);

  const onDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/lunaos-node', node.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const highlight = focused
    ? (isDark ? '#2C2C2E' : '#E5E5EA')
    : undefined;

  const itemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
    padding: `${spacing.md}px ${spacing.md}px`,
    minHeight: 44,
    margin: `2px ${spacing.sm}px`,
    borderRadius: radius.sm,
    cursor: 'grab',
    transition: reducedMotion ? 'none' : 'background 150ms ease',
    userSelect: 'none',
    outline: 'none',
    background: highlight ?? 'transparent',
    boxShadow: focused ? `0 0 0 3px ${c.accent}40` : undefined,
  };

  const dotStyle: React.CSSProperties = {
    width: 8,
    height: 8,
    borderRadius: radius.full,
    background: node.color,
    flexShrink: 0,
    boxShadow: shadow.glow(node.color),
  };

  const nameStyle: React.CSSProperties = {
    fontSize: fontSize.subheadline,
    fontWeight: fontWeight.medium,
    color: c.text,
    flex: 1,
  };

  const descStyle: React.CSSProperties = {
    fontSize: fontSize.caption2,
    color: c.textTertiary,
    marginTop: 2,
  };

  return (
    <div
      draggable
      tabIndex={0}
      onDragStart={onDragStart}
      style={itemStyle}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background =
          isDark ? '#2C2C2E' : '#E5E5EA';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background =
          focused ? (isDark ? '#2C2C2E' : '#E5E5EA') : 'transparent';
      }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      data-testid={`palette-item-${node.id}`}
      aria-label={`${node.name}: ${node.description}`}
    >
      <div style={dotStyle} />
      <div>
        <div style={nameStyle}>{node.name}</div>
        <div style={descStyle}>{node.description}</div>
      </div>
    </div>
  );
}
