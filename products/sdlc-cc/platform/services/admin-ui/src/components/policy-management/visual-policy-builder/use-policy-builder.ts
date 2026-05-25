// @ts-nocheck
/**
 * Hook for Visual Policy Builder logic
 */

import { useCallback, useRef, useState } from 'react';
import {
  Node, Edge, addEdge, useNodesState, useEdgesState,
  Connection, MarkerType, XYPosition
} from 'reactflow';

import { Policy, VisualPolicy, PolicyNode, PolicyEdge, ValidatePolicyResponse } from '@/types/policy-management';
import { securityRuleTemplates } from './security-rule-templates';
import { validateVisualPolicy, buildValidationResponse, generateRegoFromNodes } from './policy-validation';

interface UsePolicyBuilderProps {
  policy?: Policy;
  template?: VisualPolicy;
  onValidate?: (valid: boolean, errors: ValidatePolicyResponse) => void;
  onSave?: (policy: Partial<Policy>) => void;
}

export function usePolicyBuilder({ policy, template, onValidate, onSave }: UsePolicyBuilderProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(
    template?.nodes || policy?.visualPolicy?.nodes || [{
      id: 'input-1', type: 'input', position: { x: 250, y: 50 },
      data: { label: 'Input', description: 'Policy input data', parameters: { user: {}, resource: {}, context: {} } }
    }]
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    template?.edges || policy?.visualPolicy?.edges || []
  );

  const [selectedNode, setSelectedNode] = useState<PolicyNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<PolicyEdge | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [showSecurityPanel, setShowSecurityPanel] = useState(false);

  const onConnect = useCallback((params: Connection) => {
    const newEdge: Edge = {
      ...params, id: `edge-${Date.now()}`,
      type: params.sourceHandle?.includes('success') ? 'success' :
            params.sourceHandle?.includes('failure') ? 'failure' : 'default',
      markerEnd: { type: MarkerType.ArrowClosed },
      data: { condition: params.sourceHandle, type: params.sourceHandle?.includes('success') ? 'success' : 'failure' },
      style: {
        strokeWidth: 2,
        stroke: params.sourceHandle?.includes('success') ? '#10b981' :
                params.sourceHandle?.includes('failure') ? '#ef4444' : '#6b7280'
      }
    };
    setEdges((eds) => addEdge(newEdge, eds));
    validatePolicy();
  }, [setEdges]);

  const validatePolicy = useCallback(() => {
    const { errors, isValid: valid } = validateVisualPolicy(nodes, edges);
    setValidationErrors(errors);
    setIsValid(valid);
    if (onValidate) {
      onValidate(valid, buildValidationResponse(errors, nodes.length));
    }
  }, [nodes, edges, onValidate]);

  const addNode = useCallback((template: string, position?: XYPosition) => {
    const templateData = securityRuleTemplates[template];
    if (!templateData) return;
    const newNode: Node = {
      id: `node-${Date.now()}`, type: templateData.type!,
      position: position || { x: Math.random() * 400 + 100, y: Math.random() * 300 + 100 },
      data: templateData.data!, dragHandle: '.drag-handle'
    };
    setNodes((nds) => nds.concat(newNode));
    if (nodes.length === 1) {
      const inputNode = nodes.find(n => n.type === 'input');
      if (inputNode) {
        setEdges((eds) => eds.concat({
          id: `edge-${Date.now()}`, source: inputNode.id, target: newNode.id,
          type: 'default', markerEnd: { type: MarkerType.ArrowClosed }
        }));
      }
    }
    setTimeout(() => validatePolicy(), 100);
  }, [nodes, setNodes, setEdges]);

  const deleteNode = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    setSelectedNode(null);
  }, [setNodes, setEdges]);

  const deleteEdge = useCallback((edgeId: string) => {
    setEdges((eds) => eds.filter((e) => e.id !== edgeId));
    setSelectedEdge(null);
  }, [setEdges]);

  const generateRegoCode = useCallback(() => generateRegoFromNodes(nodes), [nodes]);

  return {
    reactFlowWrapper, nodes, setNodes, onNodesChange,
    edges, setEdges, onEdgesChange,
    selectedNode, setSelectedNode, selectedEdge, setSelectedEdge,
    validationErrors, isSaving, setIsSaving,
    isValid, showSecurityPanel, setShowSecurityPanel,
    onConnect, validatePolicy, addNode, deleteNode, deleteEdge, generateRegoCode
  };
}
