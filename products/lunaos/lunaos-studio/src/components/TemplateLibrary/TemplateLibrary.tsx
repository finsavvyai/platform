/**
 * TemplateLibrary — modal overlay showing starter workflow templates.
 * Users can preview and load a template onto the canvas.
 */

import React, { useState, useEffect, useRef } from 'react';
import type { WorkflowTemplate } from '../../types';
import { templates } from '../../lib/template-data';
import { useDarkMode } from '../../hooks/useDarkMode';
import type { ColorScheme } from '../../lib/theme';
import {
  spacing, radius, fontFamily, fontSize, fontWeight, colors, shadow,
} from '../../lib/theme';
import { TemplateCard } from './TemplateCard';

interface TemplateLibraryProps {
  open: boolean;
  onClose: () => void;
  onSelect: (template: WorkflowTemplate) => void;
}

export function TemplateLibrary({ open, onClose, onSelect }: TemplateLibraryProps) {
  const isDark = useDarkMode();
  const c = isDark ? colors.dark : colors.light;
  const [selected, setSelected] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) modalRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
    }
  };

  const overlayStyle: React.CSSProperties = {
    position: 'fixed', inset: 0,
    background: c.overlay,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000,
    fontFamily,
  };

  const modalStyle: React.CSSProperties = {
    background: isDark ? '#1C1C1E' : '#FFFFFF',
    borderRadius: radius.lg,
    width: 640, maxHeight: '80vh',
    display: 'flex', flexDirection: 'column',
    boxShadow: shadow.lg,
    overflow: 'hidden',
    outline: 'none',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: `${spacing.md}px ${spacing.lg}px`,
    borderBottom: `1px solid ${c.separator}`,
  };

  const titleStyle: React.CSSProperties = {
    fontSize: fontSize.title2, fontWeight: fontWeight.bold, color: c.text,
  };

  const closeStyle: React.CSSProperties = {
    background: 'none', border: 'none',
    fontSize: fontSize.title3, color: c.textTertiary,
    cursor: 'pointer', padding: spacing.sm,
    borderRadius: radius.full, fontFamily,
  };

  const listStyle: React.CSSProperties = {
    flex: 1, overflowY: 'auto', padding: spacing.md,
  };

  const footerStyle: React.CSSProperties = {
    display: 'flex', justifyContent: 'flex-end', gap: spacing.sm,
    padding: `${spacing.md}px ${spacing.lg}px`,
    borderTop: `1px solid ${c.separator}`,
  };

  const handleLoad = () => {
    const tpl = templates.find((t) => t.id === selected);
    if (tpl) {
      onSelect(tpl);
      onClose();
    }
  };

  return (
    <div style={overlayStyle} onClick={onClose} data-testid="template-library">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label="Template Library"
        tabIndex={-1}
        style={modalStyle}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div style={headerStyle}>
          <span style={titleStyle}>Template Library</span>
          <button style={closeStyle} onClick={onClose} aria-label="Close">&times;</button>
        </div>

        <div style={listStyle}>
          {templates.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              isSelected={selected === t.id}
              onSelect={() => setSelected(t.id)}
              isDark={isDark}
            />
          ))}
        </div>

        <div style={footerStyle}>
          <button style={secondaryBtn(c)} onClick={onClose}>Cancel</button>
          <button
            style={primaryBtn(c, !selected)}
            disabled={!selected}
            onClick={handleLoad}
          >
            Load Template
          </button>
        </div>
      </div>
    </div>
  );
}

function primaryBtn(c: ColorScheme, disabled: boolean): React.CSSProperties {
  return {
    padding: `${spacing.sm}px ${spacing.lg}px`,
    borderRadius: radius.sm,
    border: 'none',
    background: disabled ? c.separator : c.accent,
    color: '#FFFFFF',
    fontWeight: fontWeight.semibold,
    fontSize: fontSize.subheadline,
    cursor: disabled ? 'default' : 'pointer',
    fontFamily,
    opacity: disabled ? 0.5 : 1,
  };
}

function secondaryBtn(c: ColorScheme): React.CSSProperties {
  return {
    padding: `${spacing.sm}px ${spacing.lg}px`,
    borderRadius: radius.sm,
    border: `1px solid ${c.separator}`,
    background: 'none',
    color: c.text,
    fontWeight: fontWeight.medium,
    fontSize: fontSize.subheadline,
    cursor: 'pointer',
    fontFamily,
  };
}
