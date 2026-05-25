/**
 * NodePalette — draggable sidebar listing all available node types.
 * Grouped by category. Apple HIG styling: SF fonts, 8px grid, rounded corners.
 */

import React, { useState } from 'react';
import type { NodeTypeDefinition, NodeCategory } from '../../types';
import { getNodeTypes } from '../../lib/node-registry';
import { useDarkMode } from '../../hooks/useDarkMode';
import {
  spacing, radius, fontFamily, fontSize, fontWeight, colors,
} from '../../lib/theme';
import { PaletteItem } from './PaletteItem';

const CATEGORY_LABELS: Record<NodeCategory, string> = {
  agent: 'Agents',
  trigger: 'Triggers',
  condition: 'Conditions',
  output: 'Outputs',
};

const CATEGORY_ORDER: NodeCategory[] = ['trigger', 'agent', 'condition', 'output'];

export function NodePalette() {
  const isDark = useDarkMode();
  const c = isDark ? colors.dark : colors.light;
  const [search, setSearch] = useState('');
  const allNodes = getNodeTypes();

  const filtered = search.trim()
    ? allNodes.filter(
      (n) =>
        n.name.toLowerCase().includes(search.toLowerCase()) ||
          n.description.toLowerCase().includes(search.toLowerCase())
    )
    : allNodes;

  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    label: CATEGORY_LABELS[cat],
    items: filtered.filter((n) => n.category === cat),
  })).filter((g) => g.items.length > 0);

  const sidebarStyle: React.CSSProperties = {
    fontFamily,
    width: 256,
    height: '100%',
    background: isDark ? '#1C1C1E' : '#F2F2F7',
    borderRight: `1px solid ${c.separator}`,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  };

  const headerStyle: React.CSSProperties = {
    padding: spacing.md,
    fontSize: fontSize.title3,
    fontWeight: fontWeight.bold,
    color: c.text,
    borderBottom: `1px solid ${c.separator}`,
  };

  const searchWrapStyle: React.CSSProperties = {
    position: 'relative',
    margin: `${spacing.sm}px ${spacing.md}px`,
  };

  const searchStyle: React.CSSProperties = {
    padding: `${spacing.sm}px ${spacing.md}px`,
    paddingRight: search ? 32 : spacing.md,
    borderRadius: radius.sm,
    border: `1px solid ${c.separator}`,
    background: isDark ? '#2C2C2E' : '#FFFFFF',
    color: c.text,
    fontSize: fontSize.body,
    fontFamily,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  };

  const clearBtnStyle: React.CSSProperties = {
    position: 'absolute',
    right: 6,
    top: '50%',
    transform: 'translateY(-50%)',
    background: isDark ? '#3A3A3C' : '#C6C6C8',
    border: 'none',
    borderRadius: radius.full,
    width: 20,
    height: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: isDark ? '#FFFFFF' : '#000000',
    fontSize: 12,
    lineHeight: 1,
    padding: 0,
  };

  const listStyle: React.CSSProperties = {
    flex: 1,
    overflowY: 'auto',
    padding: `${spacing.sm}px 0`,
  };

  return (
    <aside style={sidebarStyle} data-testid="node-palette">
      <div style={headerStyle}>Nodes</div>
      <div style={searchWrapStyle}>
        <input
          style={searchStyle}
          placeholder="Search nodes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search nodes"
        />
        {search && (
          <button
            style={clearBtnStyle}
            onClick={() => setSearch('')}
            aria-label="Clear search"
            type="button"
          >
            &times;
          </button>
        )}
      </div>
      <div style={listStyle}>
        {grouped.map((g) => (
          <CategoryGroup
            key={g.category}
            label={g.label}
            items={g.items}
            isDark={isDark}
          />
        ))}
      </div>
    </aside>
  );
}

function CategoryGroup({
  label, items, isDark,
}: {
  label: string;
  items: NodeTypeDefinition[];
  isDark: boolean;
}) {
  const c = isDark ? colors.dark : colors.light;

  const labelStyle: React.CSSProperties = {
    fontSize: fontSize.caption1,
    fontWeight: fontWeight.semibold,
    color: c.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    padding: `${spacing.sm}px ${spacing.md}px ${spacing.xs}px`,
  };

  return (
    <div>
      <div style={labelStyle}>{label}</div>
      {items.map((node) => (
        <PaletteItem key={node.id} node={node} isDark={isDark} />
      ))}
    </div>
  );
}
