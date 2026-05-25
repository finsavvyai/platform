/**
 * WorkflowCanvas — ReactFlow canvas for drag-and-drop workflow building.
 * Supports node drop from palette, zoom, pan, minimap, and keyboard nav.
 */

import React, { useCallback, useRef, useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
} from '@xyflow/react';
import type {
  Node, Edge, ReactFlowInstance,
  OnNodesChange, OnEdgesChange, OnConnect,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { WorkflowNodeData } from '../../types';
import { WorkflowNode } from './WorkflowNode';
import { useDarkMode } from '../../hooks/useDarkMode';
import { colors, radius } from '../../lib/theme';

interface WorkflowCanvasProps {
  nodes: Node<WorkflowNodeData>[];
  edges: Edge[];
  onNodesChange: OnNodesChange<Node<WorkflowNodeData>>;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  onNodeSelect: (nodeId: string | null) => void;
  onDropNode: (typeId: string, position: { x: number; y: number }) => void;
}

const nodeTypes = { 'workflow-node': WorkflowNode };

export function WorkflowCanvas({
  nodes, edges,
  onNodesChange, onEdgesChange, onConnect,
  onNodeSelect, onDropNode,
}: WorkflowCanvasProps) {
  const isDark = useDarkMode();
  const c = isDark ? colors.dark : colors.light;
  const rfInstance = useRef<ReactFlowInstance | null>(null);
  const [announcedNode, setAnnouncedNode] = useState('');

  const onInit = useCallback((instance: ReactFlowInstance) => {
    rfInstance.current = instance;
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const typeId = e.dataTransfer.getData('application/lunaos-node');
      if (!typeId || !rfInstance.current) return;

      const bounds = (e.target as HTMLElement)
        .closest('.react-flow')
        ?.getBoundingClientRect();
      if (!bounds) return;

      const position = rfInstance.current.screenToFlowPosition({
        x: e.clientX - bounds.left,
        y: e.clientY - bounds.top,
      });

      onDropNode(typeId, position);
    },
    [onDropNode]
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node<WorkflowNodeData>) => {
      onNodeSelect(node.id);
      setAnnouncedNode(node.data?.label ?? node.id);
    },
    [onNodeSelect]
  );

  const onPaneClick = useCallback(() => {
    onNodeSelect(null);
    setAnnouncedNode('');
  }, [onNodeSelect]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      if (nodes.length === 0) return;
      e.preventDefault();

      const selectedIdx = nodes.findIndex((n) => n.selected);
      let nextIdx: number;
      if (selectedIdx === -1) {
        nextIdx = 0;
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        nextIdx = (selectedIdx + 1) % nodes.length;
      } else {
        nextIdx = (selectedIdx - 1 + nodes.length) % nodes.length;
      }
      const next = nodes[nextIdx];
      if (!next) return;
      onNodeSelect(next.id);
      setAnnouncedNode((next.data as WorkflowNodeData)?.label ?? next.id);
    },
    [nodes, onNodeSelect]
  );

  const defaultEdgeOptions = useMemo(
    () => ({
      type: 'smoothstep' as const,
      animated: true,
      style: { stroke: c.accent, strokeWidth: 2 },
    }),
    [c.accent]
  );

  const containerStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    borderRadius: radius.sm,
    overflow: 'hidden',
    outline: 'none',
  };

  return (
    <div
      style={containerStyle}
      data-testid="workflow-canvas"
      tabIndex={0}
      aria-label="Workflow canvas"
      onKeyDown={onKeyDown}
    >
      <div aria-live="polite" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
        {announcedNode && `Selected node: ${announcedNode}`}
      </div>
      <ReactFlow
        nodes={nodes as Node[]}
        edges={edges}
        onNodesChange={onNodesChange as OnNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={onInit}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onNodeClick={onNodeClick as (event: React.MouseEvent, node: Node) => void}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        snapToGrid
        snapGrid={[8, 8]}
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={16}
          size={1}
          color={isDark ? '#333' : '#ddd'}
        />
        <Controls
          showInteractive={false}
          style={{
            borderRadius: radius.sm,
            overflow: 'hidden',
            border: `1px solid ${c.separator}`,
          }}
        />
        <MiniMap
          nodeColor={(n) => {
            const d = n.data as WorkflowNodeData | undefined;
            return d?.color ?? c.accent;
          }}
          maskColor={isDark ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.7)'}
          style={{
            borderRadius: radius.sm,
            border: `1px solid ${c.separator}`,
          }}
        />
      </ReactFlow>
    </div>
  );
}
