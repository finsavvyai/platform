/**
 * Toolbar — top bar with workflow name, action buttons, and run control.
 * Apple HIG: compact, centered layout, SF font, 8px grid spacing.
 * Clear visual hierarchy: Run is primary, others are secondary/tertiary.
 */

import React from 'react';
import { useDarkMode } from '../../hooks/useDarkMode';
import {
  spacing, fontFamily, fontSize, fontWeight, colors, shadow,
} from '../../lib/theme';
import { ToolbarButton } from './ToolbarButton';
import { UserMenu } from '../UserMenu';
import type { User } from '../../lib/api-client';

interface ToolbarProps {
  workflowName: string;
  isRunning: boolean;
  user: User;
  onNameChange: (name: string) => void;
  onRun: () => void;
  onExport: () => void;
  onImport: () => void;
  onTemplates: () => void;
  onClear: () => void;
  onWorkflows: () => void;
  onLogout: () => void;
}

export function Toolbar({
  workflowName, isRunning, user,
  onNameChange, onRun, onExport, onImport, onTemplates, onClear, onWorkflows, onLogout,
}: ToolbarProps) {
  const isDark = useDarkMode();
  const c = isDark ? colors.dark : colors.light;

  const barStyle: React.CSSProperties = {
    fontFamily,
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
    padding: `${spacing.sm}px ${spacing.md}px`,
    background: isDark ? '#1C1C1E' : '#F2F2F7',
    borderBottom: `1px solid ${c.separator}`,
    height: 48,
    flexShrink: 0,
    zIndex: 10,
    boxShadow: shadow.sm,
  };

  const nameInput: React.CSSProperties = {
    background: 'none',
    border: 'none',
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
    color: c.text,
    fontFamily,
    outline: 'none',
    width: 200,
  };

  const dividerStyle: React.CSSProperties = {
    width: 1,
    height: 20,
    background: c.separator,
    flexShrink: 0,
  };

  return (
    <div style={barStyle} data-testid="toolbar">
      <input
        style={nameInput}
        value={workflowName}
        onChange={(e) => onNameChange(e.target.value.slice(0, 100))}
        onBlur={(e) => {
          if (!e.target.value.trim()) onNameChange('Untitled Workflow');
        }}
        placeholder="Workflow name"
        maxLength={100}
        required
        aria-label="Workflow name"
      />

      <ToolbarButton onClick={onWorkflows} tooltip="Your workflows">
        Workflows
      </ToolbarButton>

      <div style={{ flex: 1 }} />

      <ToolbarButton onClick={onTemplates} icon="grid" tooltip="Browse templates">
        Templates
      </ToolbarButton>
      <ToolbarButton onClick={onImport} icon="import" tooltip="Import workflow (Cmd+O)">
        Import
      </ToolbarButton>
      <ToolbarButton onClick={onExport} icon="export" tooltip="Export workflow (Cmd+S)">
        Export
      </ToolbarButton>

      <div style={dividerStyle} />

      <ToolbarButton onClick={onClear} variant="danger" icon="clear" tooltip="Clear canvas">
        Clear
      </ToolbarButton>

      <div style={dividerStyle} />

      <ToolbarButton
        onClick={onRun}
        disabled={isRunning}
        variant="primary"
        icon={isRunning ? 'loading' : 'play'}
        tooltip="Execute workflow"
      >
        {isRunning ? 'Running...' : 'Run'}
      </ToolbarButton>

      <div style={dividerStyle} />

      <UserMenu user={user} onLogout={onLogout} />
    </div>
  );
}
