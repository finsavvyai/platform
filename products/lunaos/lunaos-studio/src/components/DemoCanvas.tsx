/**
 * DemoCanvas -- interactive demo of the Studio canvas with
 * pre-loaded sample nodes. No auth required. Allows visitors
 * to explore the visual builder before signing up.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  ReactFlowProvider, ReactFlow, Background, Controls,
  MiniMap, BackgroundVariant,
} from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { WorkflowNode } from './WorkflowCanvas/WorkflowNode';
import { colors, fontFamily, fontSize, fontWeight, spacing, radius } from '../lib/theme';
import type { WorkflowNodeData } from '../types';

interface DemoCanvasProps {
  onSignIn: () => void;
}

const DEMO_NODES: Node<WorkflowNodeData>[] = [
  {
    id: 'demo-1', type: 'workflow-node',
    position: { x: 80, y: 120 },
    data: {
      typeId: 'webhook-trigger', label: 'Webhook Trigger',
      category: 'trigger', icon: 'bolt.fill', color: '#FF9500',
      config: {}, inputs: [], outputs: [{ name: 'payload', type: 'object', description: 'Incoming data' }],
      status: 'success',
    },
  },
  {
    id: 'demo-2', type: 'workflow-node',
    position: { x: 380, y: 60 },
    data: {
      typeId: 'chat-agent', label: 'Chat Agent',
      category: 'agent', icon: 'bubble.left.fill', color: '#007AFF',
      config: { model: 'claude-sonnet-4-6' }, inputs: [{ name: 'message', type: 'string', required: true, description: 'Input' }],
      outputs: [{ name: 'response', type: 'string', description: 'AI response' }],
      status: 'running',
    },
  },
  {
    id: 'demo-3', type: 'workflow-node',
    position: { x: 380, y: 220 },
    data: {
      typeId: 'condition', label: 'Check Sentiment',
      category: 'condition', icon: 'arrow.triangle.branch', color: '#AF52DE',
      config: {}, inputs: [{ name: 'value', type: 'any', required: true, description: 'Value' }],
      outputs: [{ name: 'result', type: 'boolean', description: 'Result' }],
      status: 'idle',
    },
  },
  {
    id: 'demo-4', type: 'workflow-node',
    position: { x: 680, y: 140 },
    data: {
      typeId: 'email-sender', label: 'Send Response',
      category: 'output', icon: 'envelope.fill', color: '#34C759',
      config: {}, inputs: [{ name: 'body', type: 'string', required: true, description: 'Email body' }],
      outputs: [], status: 'idle',
    },
  },
];

const DEMO_EDGES: Edge[] = [
  { id: 'e1-2', source: 'demo-1', target: 'demo-2', type: 'smoothstep', animated: true },
  { id: 'e1-3', source: 'demo-1', target: 'demo-3', type: 'smoothstep', animated: true },
  { id: 'e2-4', source: 'demo-2', target: 'demo-4', type: 'smoothstep', animated: true },
  { id: 'e3-4', source: 'demo-3', target: 'demo-4', type: 'smoothstep', animated: true },
];

const nodeTypes = { 'workflow-node': WorkflowNode };

export function DemoCanvas({ onSignIn }: DemoCanvasProps) {
  const c = colors.dark;
  const handleBack = useCallback(() => { window.location.hash = ''; }, []);
  const defaultViewport = useMemo(() => ({ x: 40, y: 40, zoom: 0.85 }), []);
  const [selected, setSelected] = useState<Node<WorkflowNodeData> | null>(null);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node<WorkflowNodeData>) => {
      setSelected(node);
    },
    [],
  );
  const closeInspector = useCallback(() => setSelected(null), []);

  return (
    <ReactFlowProvider>
      <div style={{ ...shell, background: c.bg, color: c.text, fontFamily }}>
        <header style={{ ...bar, borderBottom: `1px solid ${c.separator}` }}>
          <button style={backBtn(c)} onClick={handleBack} aria-label="Back to landing page">
            Back
          </button>
          <span style={{ fontSize: fontSize.body, fontWeight: fontWeight.semibold }}>
            Interactive Demo
          </span>
          <button style={signInBtn(c)} onClick={onSignIn} aria-label="Sign in to Studio">
            Sign In to Build Your Own
          </button>
        </header>
        <div style={{ flex: 1, position: 'relative', display: 'flex' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <ReactFlow
              nodes={DEMO_NODES} edges={DEMO_EDGES}
              nodeTypes={nodeTypes} defaultViewport={defaultViewport}
              nodesDraggable edgesReconnectable={false}
              fitView={false} proOptions={{ hideAttribution: true }}
              onNodeClick={handleNodeClick}
              onPaneClick={closeInspector}
            >
              <Background variant={BackgroundVariant.Dots} gap={20} size={1} color={c.separator} />
              <Controls position="bottom-right" />
              <MiniMap style={{ background: c.bgSecondary }} nodeColor={c.accent} />
            </ReactFlow>
            {!selected && (
              <div style={bannerStyle(c)} role="status">
                Click any node to see its parameters. Drag to reposition, scroll to zoom.
              </div>
            )}
          </div>
          {selected && (
            <DemoInspector node={selected} onClose={closeInspector} />
          )}
        </div>
      </div>
    </ReactFlowProvider>
  );
}

/** Inspector panel shown when a demo node is clicked. */
function DemoInspector({
  node,
  onClose,
}: {
  node: Node<WorkflowNodeData>;
  onClose: () => void;
}) {
  const c = colors.dark;
  const d = node.data;

  return (
    <aside
      style={inspectorStyle(c)}
      role="dialog"
      aria-label={`Node inspector: ${d.label}`}
    >
      <div style={inspectorHeader(c)}>
        <div>
          <p style={{ margin: 0, fontSize: fontSize.caption1, color: c.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {d.category}
          </p>
          <h3 style={{ margin: `${spacing.xs}px 0 0`, fontSize: fontSize.title3, fontWeight: fontWeight.bold }}>
            {d.label}
          </h3>
        </div>
        <button style={closeBtn(c)} onClick={onClose} aria-label="Close inspector">
          ×
        </button>
      </div>

      <div style={section(c)}>
        <p style={sectionLabel(c)}>Type ID</p>
        <code style={codeChip(c)}>{d.typeId}</code>
      </div>

      <div style={section(c)}>
        <p style={sectionLabel(c)}>Status</p>
        <span style={statusBadge(c, d.status ?? 'idle')}>{d.status ?? 'idle'}</span>
      </div>

      {d.inputs && d.inputs.length > 0 && (
        <div style={section(c)}>
          <p style={sectionLabel(c)}>Inputs</p>
          {d.inputs.map((input) => (
            <div key={input.name} style={ioRow(c)}>
              <code style={codeChip(c)}>{input.name}</code>
              <span style={{ fontSize: fontSize.footnote, color: c.textSecondary }}>
                {input.type}{input.required ? ' · required' : ''}
              </span>
              {input.description && (
                <p style={ioDesc(c)}>{input.description}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {d.outputs && d.outputs.length > 0 && (
        <div style={section(c)}>
          <p style={sectionLabel(c)}>Outputs</p>
          {d.outputs.map((output) => (
            <div key={output.name} style={ioRow(c)}>
              <code style={codeChip(c)}>{output.name}</code>
              <span style={{ fontSize: fontSize.footnote, color: c.textSecondary }}>
                {output.type}
              </span>
              {output.description && (
                <p style={ioDesc(c)}>{output.description}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {d.config && Object.keys(d.config).length > 0 && (
        <div style={section(c)}>
          <p style={sectionLabel(c)}>Config</p>
          <pre style={configBlock(c)}>{JSON.stringify(d.config, null, 2)}</pre>
        </div>
      )}

      <div style={{ padding: spacing.md, borderTop: `1px solid ${c.separator}` }}>
        <p style={{ fontSize: fontSize.caption1, color: c.textSecondary, margin: 0 }}>
          Read-only demo. Sign in to edit node parameters.
        </p>
      </div>
    </aside>
  );
}

const shell: React.CSSProperties = {
  display: 'flex', flexDirection: 'column',
  height: '100vh', width: '100vw', overflow: 'hidden',
};

const bar: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: `${spacing.sm}px ${spacing.md}px`, gap: spacing.md,
};

const backBtn = (c: typeof colors.dark): React.CSSProperties => ({
  fontFamily, fontSize: fontSize.subheadline, fontWeight: fontWeight.medium,
  background: 'none', border: 'none', color: c.accent,
  cursor: 'pointer', padding: `${spacing.xs}px ${spacing.sm}px`,
});

const signInBtn = (c: typeof colors.dark): React.CSSProperties => ({
  fontFamily, fontSize: fontSize.subheadline, fontWeight: fontWeight.semibold,
  background: c.accent, color: '#fff', border: 'none',
  borderRadius: radius.sm, padding: `${spacing.xs}px ${spacing.md}px`,
  cursor: 'pointer',
});

const bannerStyle = (c: typeof colors.dark): React.CSSProperties => ({
  position: 'absolute', bottom: spacing.lg, left: '50%',
  transform: 'translateX(-50%)', background: c.surface,
  backdropFilter: 'blur(12px)', border: `1px solid ${c.separator}`,
  borderRadius: radius.md, padding: `${spacing.sm}px ${spacing.lg}px`,
  fontSize: fontSize.footnote, color: c.textSecondary,
  textAlign: 'center', zIndex: 10, maxWidth: 480,
});

// ── Inspector styles ────────────────────────────────────────

const inspectorStyle = (c: typeof colors.dark): React.CSSProperties => ({
  width: 320, flexShrink: 0, background: c.bgSecondary,
  borderLeft: `1px solid ${c.separator}`, overflowY: 'auto',
  fontFamily,
});

const inspectorHeader = (c: typeof colors.dark): React.CSSProperties => ({
  display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
  padding: spacing.md, borderBottom: `1px solid ${c.separator}`,
});

const closeBtn = (c: typeof colors.dark): React.CSSProperties => ({
  background: 'none', border: 'none', color: c.textSecondary,
  fontSize: 24, cursor: 'pointer', lineHeight: 1,
  padding: `0 ${spacing.xs}px`,
});

const section = (c: typeof colors.dark): React.CSSProperties => ({
  padding: spacing.md, borderBottom: `1px solid ${c.separator}`,
});

const sectionLabel = (c: typeof colors.dark): React.CSSProperties => ({
  margin: `0 0 ${spacing.xs}px`, fontSize: fontSize.caption1,
  color: c.textSecondary, textTransform: 'uppercase',
  letterSpacing: 0.5, fontWeight: fontWeight.semibold,
});

const codeChip = (c: typeof colors.dark): React.CSSProperties => ({
  display: 'inline-block', background: c.surface, color: c.accent,
  padding: `2px ${spacing.xs}px`, borderRadius: radius.sm,
  fontSize: fontSize.footnote, fontFamily: 'ui-monospace, SFMono-Regular, monospace',
});

const statusBadge = (
  c: typeof colors.dark,
  status: string,
): React.CSSProperties => {
  const map: Record<string, string> = {
    success: '#34C759', running: '#007AFF', idle: '#8E8E93',
    error: '#FF3B30', warning: '#FF9500',
  };
  const bg = map[status] || c.textSecondary;
  return {
    display: 'inline-block', padding: `2px ${spacing.sm}px`,
    borderRadius: radius.sm, background: `${bg}22`, color: bg,
    fontSize: fontSize.footnote, fontWeight: fontWeight.semibold,
    textTransform: 'capitalize',
  };
};

const ioRow = (_c: typeof colors.dark): React.CSSProperties => ({
  marginBottom: spacing.sm,
});

const ioDesc = (c: typeof colors.dark): React.CSSProperties => ({
  margin: `${spacing.xs}px 0 0`, fontSize: fontSize.footnote,
  color: c.textSecondary, lineHeight: 1.4,
});

const configBlock = (c: typeof colors.dark): React.CSSProperties => ({
  margin: 0, padding: spacing.sm, background: c.surface,
  borderRadius: radius.sm, fontSize: fontSize.footnote,
  color: c.text, overflow: 'auto',
  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
});
