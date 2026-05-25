// @ts-nocheck
/**
 * Policy validation utilities
 */

import { Node, Edge } from 'reactflow';
import { ValidatePolicyResponse } from '@/types/policy-management';

export function detectCycle(nodes: Node[], edges: Edge[]): boolean {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function dfs(nodeId: string): boolean {
    if (recursionStack.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;
    visited.add(nodeId);
    recursionStack.add(nodeId);
    for (const edge of edges) {
      if (edge.source === nodeId) {
        if (dfs(edge.target)) return true;
      }
    }
    recursionStack.delete(nodeId);
    return false;
  }

  for (const node of nodes) {
    if (dfs(node.id)) return true;
  }
  return false;
}

export function validateVisualPolicy(
  nodes: Node[],
  edges: Edge[]
): { errors: string[]; isValid: boolean } {
  const errors: string[] = [];
  const hasInput = nodes.some(n => n.type === 'input');
  const hasDecision = nodes.some(n => n.type === 'decision');

  if (!hasInput) errors.push('Policy must have an input node');
  if (!hasDecision) errors.push('Policy must have a decision node');

  const connectedNodes = new Set<string>();
  edges.forEach(edge => {
    connectedNodes.add(edge.source);
    connectedNodes.add(edge.target);
  });

  const unconnectedNodes = nodes.filter(n =>
    n.type !== 'input' && !connectedNodes.has(n.id)
  );
  if (unconnectedNodes.length > 0) {
    errors.push(`${unconnectedNodes.length} node(s) are not connected`);
  }

  if (detectCycle(nodes, edges)) {
    errors.push('Policy contains a cycle');
  }

  return { errors, isValid: errors.length === 0 };
}

export function buildValidationResponse(
  errors: string[],
  nodeCount: number
): ValidatePolicyResponse {
  return {
    valid: errors.length === 0,
    errors: errors.map(e => ({
      line: 0, column: 0, message: e,
      type: 'semantic' as const, severity: 'error' as const
    })),
    warnings: [],
    suggestions: [],
    metrics: {
      complexity: nodeCount,
      maintainability: 85,
      testability: 90,
      security: 95,
      performance: 88
    }
  };
}

export function generateRegoFromNodes(nodes: Node[]): string {
  let rego = 'package sdlc.policy\n\n';
  rego += 'default allow = false\n\n';
  nodes.forEach(node => {
    if (node.type === 'condition' && node.data.logic) {
      rego += `${node.data.label.replace(/\s+/g, '_').toLowerCase()} {\n`;
      rego += `    ${node.data.logic}\n`;
      rego += '}\n\n';
    }
  });
  const decisionNode = nodes.find(n => n.type === 'decision');
  if (decisionNode) {
    rego += 'allow {\n';
    rego += '    # All conditions must pass\n';
    nodes.filter(n => n.type === 'condition').forEach(node => {
      rego += `    ${node.data.label.replace(/\s+/g, '_').toLowerCase()}\n`;
    });
    rego += '}\n';
  }
  return rego;
}
