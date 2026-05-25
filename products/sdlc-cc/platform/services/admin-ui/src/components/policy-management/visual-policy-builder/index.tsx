// @ts-nocheck
/**
 * Visual Policy Builder Component
 *
 * Enterprise-grade visual policy builder with drag-and-drop interface,
 * security rule templates, and comprehensive validation
 */

'use client';

import React, { useCallback } from 'react';
import ReactFlow, {
  Controls, MiniMap, Background, BackgroundVariant
} from 'reactflow';
import 'reactflow/dist/style.css';

import {
  Policy, VisualPolicy, PolicyNode, ValidatePolicyResponse
} from '@/types/policy-management';

import { CustomNodeTypes } from './custom-node-types';
import { CustomEdgeTypes, EdgeMarkerDefs } from './custom-edge-types';
import { usePolicyBuilder } from './use-policy-builder';
import { PolicySidebar } from './policy-sidebar';
import { NodePropertiesPanel } from './node-properties-panel';
import { SecuritySettingsPanel } from './security-settings-panel';
import { CanvasToolbar } from './canvas-toolbar';
import { buildVisualPolicy, buildSavePayload, exportPolicyToJson, getNodeColor } from './policy-actions';

interface VisualPolicyBuilderProps {
  policy?: Policy;
  template?: VisualPolicy;
  readOnly?: boolean;
  onSave?: (policy: Partial<Policy>) => void;
  onValidate?: (valid: boolean, errors: ValidatePolicyResponse) => void;
  onTest?: (policy: Policy) => void;
  onDeploy?: (policy: Policy) => void;
  onChange?: (visualPolicy: VisualPolicy) => void;
}

export default function VisualPolicyBuilder({
  policy, template, readOnly = false,
  onSave, onValidate, onTest, onDeploy, onChange
}: VisualPolicyBuilderProps) {
  const b = usePolicyBuilder({ policy, template, onValidate, onSave });

  React.useEffect(() => {
    if (policy?.visualPolicy) {
      b.setNodes(policy.visualPolicy.nodes || []);
      b.setEdges(policy.visualPolicy.edges || []);
    } else if (template) {
      b.setNodes(template.nodes || []);
      b.setEdges(template.edges || []);
    }
  }, [policy, template, b.setNodes, b.setEdges]);

  const handleSave = useCallback(async () => {
    if (!b.isValid) return;
    b.setIsSaving(true);
    const vp = buildVisualPolicy(b.nodes, b.edges);
    const payload = buildSavePayload(vp, b.generateRegoCode());
    if (onSave) await onSave(payload);
    b.setIsSaving(false);
  }, [b.isValid, b.nodes, b.edges, onSave, b.generateRegoCode]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const type = event.dataTransfer.getData('application/reactflow');
    if (!type) return;
    const bounds = b.reactFlowWrapper.current?.getBoundingClientRect();
    if (!bounds) return;
    b.addNode(type, { x: event.clientX - bounds.left - 75, y: event.clientY - bounds.top - 20 });
  }, [b.addNode]);

  return (
    <div className="h-full flex">
      <PolicySidebar
        policy={policy} readOnly={readOnly} isValid={b.isValid}
        isSaving={b.isSaving} validationErrors={b.validationErrors}
        showSecurityPanel={b.showSecurityPanel} onSave={handleSave}
        onTest={onTest}
        onExport={() => exportPolicyToJson(b.nodes, b.edges, b.generateRegoCode(), policy?.name)}
        onToggleSecurityPanel={() => b.setShowSecurityPanel(!b.showSecurityPanel)}
      />

      <div className="flex-1 relative" ref={b.reactFlowWrapper}>
        <ReactFlow
          nodes={b.nodes} edges={b.edges}
          onNodesChange={b.onNodesChange} onEdgesChange={b.onEdgesChange}
          onConnect={b.onConnect}
          onNodeClick={(e, node) => b.setSelectedNode(node as PolicyNode)}
          onEdgeClick={(e, edge) => b.setSelectedEdge(edge)}
          nodeTypes={CustomNodeTypes} edgeTypes={CustomEdgeTypes}
          onDragOver={onDragOver} onDrop={onDrop}
          defaultViewport={{ x: 0, y: 0, zoom: 1 }}
          minZoom={0.2} maxZoom={2} fitView attributionPosition="bottom-left"
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
          <Controls />
          <MiniMap nodeStrokeColor="#000" nodeColor={(n) => getNodeColor(n.type)}
            maskColor="rgb(240, 240, 240, 0.6)" />
          <EdgeMarkerDefs />
          <CanvasToolbar
            onAddCondition={() => b.addNode('condition')}
            onAddAction={() => b.addNode('action')}
            onAddDecision={() => b.addNode('decision')}
            onValidate={b.validatePolicy}
            onClear={() => { b.setNodes([]); b.setEdges([]); }}
          />
          {b.selectedNode && (
            <NodePropertiesPanel
              selectedNode={b.selectedNode} nodes={b.nodes}
              setNodes={b.setNodes} setSelectedNode={b.setSelectedNode}
              onDelete={b.deleteNode}
            />
          )}
        </ReactFlow>
      </div>

      {b.showSecurityPanel && (
        <SecuritySettingsPanel onClose={() => b.setShowSecurityPanel(false)} />
      )}
    </div>
  );
}
