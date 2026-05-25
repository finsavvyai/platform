/**
 * TemplateCard — single template item within the TemplateLibrary modal.
 */

import React from 'react';
import type { WorkflowTemplate } from '../../types';
import { spacing, radius, fontSize, fontWeight, colors } from '../../lib/theme';

const difficultyColor: Record<string, string> = {
  beginner: '#34C759',
  intermediate: '#FF9500',
  advanced: '#FF3B30',
};

export function TemplateCard({
  template: t, isSelected, onSelect, isDark,
}: {
  template: WorkflowTemplate;
  isSelected: boolean;
  onSelect: () => void;
  isDark: boolean;
}) {
  const c = isDark ? colors.dark : colors.light;

  const cardStyle: React.CSSProperties = {
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radius.md,
    border: `2px solid ${isSelected ? c.accent : c.separator}`,
    background: isSelected
      ? `${c.accent}12`
      : isDark ? '#2C2C2E' : '#F2F2F7',
    cursor: 'pointer',
    transition: 'border-color 150ms ease, background 150ms ease',
  };

  const nameStyle: React.CSSProperties = {
    fontSize: fontSize.body, fontWeight: fontWeight.semibold, color: c.text,
  };

  const descStyle: React.CSSProperties = {
    fontSize: fontSize.caption1, color: c.textSecondary, marginTop: spacing.xs,
  };

  const metaStyle: React.CSSProperties = {
    display: 'flex', gap: spacing.sm, marginTop: spacing.sm,
    flexWrap: 'wrap',
  };

  const badgeStyle = (bg: string): React.CSSProperties => ({
    fontSize: fontSize.caption2,
    padding: `2px ${spacing.sm}px`,
    borderRadius: radius.full,
    background: `${bg}24`,
    color: bg,
    fontWeight: fontWeight.medium,
  });

  return (
    <div
      style={cardStyle}
      onClick={onSelect}
      data-testid={`template-${t.id}`}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={nameStyle}>{t.name}</span>
        <span style={badgeStyle(difficultyColor[t.difficulty] ?? '#8E8E93')}>
          {t.difficulty}
        </span>
      </div>
      <div style={descStyle}>{t.description}</div>
      <div style={{ ...descStyle, fontStyle: 'italic', color: c.textTertiary }}>
        {t.preview}
      </div>
      <div style={metaStyle}>
        <span style={badgeStyle(c.accent)}>{t.category}</span>
        {t.tags.slice(0, 3).map((tag) => (
          <span key={tag} style={badgeStyle(c.textTertiary)}>
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}
