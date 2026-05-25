/**
 * NodeConfig — side panel for editing selected node properties.
 * Renders dynamic form fields based on the node's configSchema.
 */

import React, { useCallback } from 'react';
import type { Node } from '@xyflow/react';
import type { WorkflowNodeData, ConfigField } from '../../types';
import { getNodeTypeById } from '../../lib/node-registry';
import { useDarkMode } from '../../hooks/useDarkMode';
import { spacing, fontSize, fontWeight, colors } from '../../lib/theme';
import {
  panelStyle, emptyStyle, headerStyle, formStyle,
  labelStyle, inputStyle, colorDot, deleteBtn,
} from './styles';

interface NodeConfigProps {
  node: Node<WorkflowNodeData> | null;
  onUpdateConfig: (nodeId: string, config: Record<string, string | number | boolean>) => void;
  onUpdateLabel: (nodeId: string, label: string) => void;
  onDelete: (nodeId: string) => void;
}

export function NodeConfig({ node, onUpdateConfig, onUpdateLabel, onDelete }: NodeConfigProps) {
  const isDark = useDarkMode();
  const c = isDark ? colors.dark : colors.light;

  if (!node) {
    return (
      <aside style={emptyStyle(c, isDark)} data-testid="node-config-empty">
        <p style={{ color: c.textTertiary, fontSize: fontSize.subheadline }}>
          Select a node to configure
        </p>
      </aside>
    );
  }

  const def = getNodeTypeById(node.data.typeId);
  const schema = def?.configSchema ?? {};

  return (
    <aside style={panelStyle(c, isDark)} data-testid="node-config">
      <div style={headerStyle(c)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={colorDot(node.data.color)} />
          <span style={{ fontWeight: fontWeight.bold, fontSize: fontSize.title3, color: c.text }}>
            Configure
          </span>
        </div>
        <button onClick={() => onDelete(node.id)} style={deleteBtn(c)} aria-label="Delete node">
          Delete
        </button>
      </div>

      <div style={formStyle()}>
        <FieldGroup label="Label" fieldId="node-label">
          <input
            id="node-label"
            aria-label="Node label"
            style={inputStyle(c, isDark)}
            value={node.data.label}
            onChange={(e) => onUpdateLabel(node.id, e.target.value.slice(0, 60))}
            maxLength={60}
            required
            onBlur={(e) => {
              if (!e.target.value.trim()) onUpdateLabel(node.id, node.data.typeId);
            }}
          />
        </FieldGroup>

        {Object.entries(schema).map(([key, field]) => (
          <ConfigFieldInput
            key={key}
            fieldKey={key}
            field={field}
            value={node.data.config[key] ?? field.default}
            onChange={(val) => onUpdateConfig(node.id, { ...node.data.config, [key]: val })}
            isDark={isDark}
          />
        ))}
      </div>

      <PortList title="Inputs" ports={node.data.inputs} c={c} />
      <PortList title="Outputs" ports={node.data.outputs} c={c} />
    </aside>
  );
}

// ── Sub-components ──────────────────────────────────

function FieldGroup({ label, fieldId, children }: { label: string; fieldId?: string; children: React.ReactNode }) {
  const isDark = useDarkMode();
  const c = isDark ? colors.dark : colors.light;
  return (
    <div style={{ marginBottom: spacing.md }}>
      <label htmlFor={fieldId} style={labelStyle(c)}>{label}</label>
      {children}
    </div>
  );
}

function ConfigFieldInput({
  fieldKey, field, value, onChange, isDark,
}: {
  fieldKey: string; field: ConfigField;
  value: string | number | boolean;
  onChange: (v: string | number | boolean) => void;
  isDark: boolean;
}) {
  const c = isDark ? colors.dark : colors.light;
  const label = field.label ?? fieldKey;
  const fieldId = `config-${fieldKey}`;

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const v = e.target.value;
      if (field.type === 'number') onChange(Number(v));
      else if (field.type === 'boolean') onChange((e.target as HTMLInputElement).checked);
      else onChange(v);
    },
    [field.type, onChange]
  );

  return (
    <FieldGroup label={label} fieldId={fieldId}>
      {field.type === 'select' && (
        <select id={fieldId} aria-label={label} style={inputStyle(c, isDark)} value={String(value)} onChange={handleChange}>
          {field.options?.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      )}
      {field.type === 'textarea' && (
        <textarea id={fieldId} aria-label={label} style={{ ...inputStyle(c, isDark), minHeight: 64, resize: 'vertical' }} value={String(value)} onChange={handleChange} />
      )}
      {field.type === 'string' && (
        <input id={fieldId} aria-label={label} style={inputStyle(c, isDark)} value={String(value)} onChange={handleChange} placeholder={field.placeholder} />
      )}
      {field.type === 'number' && (
        <input id={fieldId} aria-label={label} type="number" style={inputStyle(c, isDark)} value={Number(value)} min={field.min} max={field.max} onChange={handleChange} />
      )}
      {field.type === 'boolean' && (
        <div style={{ display: 'flex', alignItems: 'center', minHeight: 44 }}>
          <input
            id={fieldId}
            aria-label={label}
            type="checkbox"
            checked={Boolean(value)}
            onChange={handleChange}
            style={{ width: 24, height: 24, accentColor: c.accent, cursor: 'pointer' }}
          />
          <label htmlFor={fieldId} style={{ marginLeft: 8, color: c.text, cursor: 'pointer' }}>
            {label}
          </label>
        </div>
      )}
    </FieldGroup>
  );
}

function PortList({ title, ports, c }: {
  title: string;
  ports: { name: string; type: string; description: string }[];
  c: { textSecondary: string; textTertiary: string };
}) {
  if (ports.length === 0) return null;
  return (
    <div style={{ padding: `${spacing.sm}px ${spacing.md}px` }}>
      <div style={labelStyle(c as Parameters<typeof labelStyle>[0])}>{title}</div>
      {ports.map((p) => (
        <div key={p.name} style={{ fontSize: fontSize.caption1, color: c.textSecondary, paddingLeft: spacing.sm }}>
          {p.name} <span style={{ color: c.textTertiary }}>({p.type})</span>
        </div>
      ))}
    </div>
  );
}
