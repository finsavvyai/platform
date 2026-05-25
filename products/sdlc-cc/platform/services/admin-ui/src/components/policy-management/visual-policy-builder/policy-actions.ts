// @ts-nocheck
/**
 * Policy save and export actions
 */

import { Node, Edge } from 'reactflow';
import { Policy, VisualPolicy } from '@/types/policy-management';

export function buildVisualPolicy(nodes: Node[], edges: Edge[]): VisualPolicy {
  return {
    nodes: nodes.map(n => ({
      ...n,
      security: {
        accessLevel: 'internal',
        requiredPermissions: ['policy:evaluate'],
        auditLog: true, encryptionRequired: false,
        validateInput: true, sanitizeOutput: true
      }
    })),
    edges: edges.map(e => ({
      ...e,
      security: {
        validateData: true, encryptTransit: false, auditTransit: true
      }
    })),
    layout: {
      direction: 'TB', spacing: { x: 100, y: 100 },
      alignment: 'center', zoom: 1,
      viewport: { x: 0, y: 0, zoom: 1 }
    }
  };
}

export function buildSavePayload(
  visualPolicy: VisualPolicy,
  regoCode: string
): Partial<Policy> {
  return {
    visualPolicy,
    regoCode,
    metadata: {
      version: '1.0.0', schema: 'visual-policy-v1',
      compatibility: ['opa-v1.0'], requirements: [], limitations: [],
      performance: {
        maxExecutionTime: 5000, averageExecutionTime: 1000,
        memoryUsage: 128, cpuUsage: 0.5, throughput: 1000, errorRate: 0.01
      },
      compliance: {
        frameworks: [], controls: [], certifications: [],
        lastAudit: new Date(), nextAudit: new Date()
      },
      risk: {
        level: 'low', score: 25, factors: [], mitigations: [],
        lastAssessed: new Date()
      }
    }
  };
}

export function exportPolicyToJson(
  nodes: Node[],
  edges: Edge[],
  regoCode: string,
  policyName?: string
) {
  const policyData = {
    visualPolicy: {
      nodes, edges,
      layout: {
        direction: 'TB', spacing: { x: 100, y: 100 },
        alignment: 'center', zoom: 1,
        viewport: { x: 0, y: 0, zoom: 1 }
      }
    },
    regoCode
  };
  const blob = new Blob([JSON.stringify(policyData, null, 2)], {
    type: 'application/json'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${policyName || 'policy'}-visual.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function getNodeColor(type?: string): string {
  switch (type) {
    case 'input': return '#10b981';
    case 'decision': return '#3b82f6';
    case 'condition': return '#8b5cf6';
    case 'action': return '#f59e0b';
    case 'validation': return '#06b6d4';
    case 'compliance': return '#ef4444';
    default: return '#6b7280';
  }
}
