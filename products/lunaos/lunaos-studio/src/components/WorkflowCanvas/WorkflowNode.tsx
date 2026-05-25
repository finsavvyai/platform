/**
 * WorkflowNode — custom ReactFlow node with Apple HIG styling.
 * Renders category color strip, icon, label, and handles.
 */

import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { WorkflowNodeData } from '../../types';
import { spacing, radius, fontFamily, fontSize, fontWeight, colors, shadow, transition } from '../../lib/theme';
import { useDarkMode } from '../../hooks/useDarkMode';

const statusIndicator: Record<string, string> = {
  idle: 'transparent',
  running: '#FF9500',
  success: '#34C759',
  error: '#FF3B30',
};

function WorkflowNodeInner(props: NodeProps) {
  const data = props.data as unknown as WorkflowNodeData;
  const selected = props.selected;
  const isDark = useDarkMode();
  const c = isDark ? colors.dark : colors.light;
  const status = data.status ?? 'idle';

  const containerStyle: React.CSSProperties = {
    fontFamily,
    background: isDark ? '#1C1C1E' : '#FFFFFF',
    border: `2px solid ${selected ? c.accent : c.separator}`,
    borderRadius: radius.md,
    minWidth: 200,
    boxShadow: selected
      ? shadow.glow(c.accent)
      : shadow.md,
    overflow: 'hidden',
    transition: `box-shadow ${transition.normal}, border-color ${transition.normal}, transform ${transition.fast}`,
    transform: selected ? 'scale(1.02)' : 'scale(1)',
    zIndex: selected ? 10 : 1,
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
    padding: `${spacing.sm}px ${spacing.md}px`,
    background: `${data.color}18`,
    borderBottom: `1px solid ${c.separator}`,
  };

  const colorStripStyle: React.CSSProperties = {
    width: 4,
    height: 24,
    borderRadius: 2,
    background: data.color,
    flexShrink: 0,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: fontSize.subheadline,
    fontWeight: fontWeight.semibold,
    color: c.text,
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };

  const statusContainerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 16,
    height: 16,
    borderRadius: radius.full,
    background: status === 'running' ? `${statusIndicator[status]}33` : 'transparent',
    animation: status === 'running' ? 'pulse 1.2s infinite' : 'none',
  };

  const statusDotStyle: React.CSSProperties = {
    width: 8,
    height: 8,
    borderRadius: radius.full,
    background: statusIndicator[status],
    flexShrink: 0,
  };

  const categoryStyle: React.CSSProperties = {
    fontSize: fontSize.caption2,
    fontWeight: fontWeight.medium,
    color: c.textTertiary,
    padding: `${spacing.xs}px ${spacing.md}px ${spacing.sm}px`,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  };

  const handleStyle: React.CSSProperties = {
    width: 12,
    height: 12,
    borderRadius: radius.full,
    border: `2px solid ${selected ? c.accent : c.separator}`,
    background: isDark ? '#1C1C1E' : '#FFFFFF',
    transition: `border-color ${transition.normal}`,
  };

  return (
    <div style={containerStyle} data-testid="workflow-node">
      {data.inputs.map((input) => (
        <Handle
          key={`in-${input.name}`}
          type="target"
          position={Position.Left}
          id={`in-${input.name}`}
          style={{ ...handleStyle, top: '50%', left: -6 }}
        />
      ))}

      <div style={headerStyle}>
        <div style={colorStripStyle} />
        <span style={labelStyle}>{data.label}</span>
        <div style={statusContainerStyle}>
          <div style={statusDotStyle} />
        </div>
      </div>

      <div style={categoryStyle}>{data.category}</div>

      {data.outputs.map((output, idx) => (
        <Handle
          key={`out-${output.name}`}
          type="source"
          position={Position.Right}
          id={`out-${output.name}`}
          style={{
            ...handleStyle,
            top: `${30 + idx * 20}%`,
            right: -6
          }}
        />
      ))}
    </div>
  );
}

export const WorkflowNode = memo(WorkflowNodeInner);
