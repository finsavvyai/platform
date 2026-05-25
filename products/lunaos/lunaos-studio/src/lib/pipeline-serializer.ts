/**
 * PipelineSerializer — export / import workflows as pipeline.json.
 * Handles validation, versioning, and safe serialization.
 */

import type { PipelineJSON, PipelineNode, PipelineEdge } from '../types';
import type { Node, Edge } from '@xyflow/react';
import type { WorkflowNodeData } from '../types';

const PIPELINE_VERSION = '1.0.0';

export function serializePipeline(
  nodes: Node<WorkflowNodeData>[],
  edges: Edge[],
  name: string,
  description = ''
): PipelineJSON {
  const pipelineNodes: PipelineNode[] = nodes.map((n) => ({
    id: n.id,
    type: n.type ?? 'workflow-node',
    position: n.position,
    data: n.data,
  }));

  const pipelineEdges: PipelineEdge[] = edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle ?? null,
    targetHandle: e.targetHandle ?? null,
  }));

  return {
    version: PIPELINE_VERSION,
    name,
    description,
    nodes: pipelineNodes,
    edges: pipelineEdges,
    metadata: {
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      author: 'LunaOS Studio',
    },
  };
}

export function deserializePipeline(
  json: PipelineJSON
): { nodes: Node<WorkflowNodeData>[]; edges: Edge[] } {
  validatePipeline(json);

  const nodes: Node<WorkflowNodeData>[] = json.nodes.map((n) => ({
    id: n.id,
    type: n.type,
    position: n.position,
    data: n.data,
  }));

  const edges: Edge[] = json.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle,
    targetHandle: e.targetHandle,
    type: 'smoothstep',
    animated: true,
  }));

  return { nodes, edges };
}

export function validatePipeline(json: unknown): json is PipelineJSON {
  if (!json || typeof json !== 'object') {
    throw new Error('Invalid pipeline: must be an object');
  }

  const p = json as Record<string, unknown>;

  if (typeof p['version'] !== 'string') {
    throw new Error('Invalid pipeline: missing version');
  }
  if (typeof p['name'] !== 'string') {
    throw new Error('Invalid pipeline: missing name');
  }
  if (!Array.isArray(p['nodes'])) {
    throw new Error('Invalid pipeline: nodes must be an array');
  }
  if (!Array.isArray(p['edges'])) {
    throw new Error('Invalid pipeline: edges must be an array');
  }

  for (const node of p['nodes'] as unknown[]) {
    validateNode(node);
  }
  for (const edge of p['edges'] as unknown[]) {
    validateEdge(edge);
  }

  return true;
}

function validateNode(node: unknown): void {
  if (!node || typeof node !== 'object') {
    throw new Error('Invalid node: must be an object');
  }
  const n = node as Record<string, unknown>;
  if (typeof n['id'] !== 'string') throw new Error('Node missing id');
  if (!n['position'] || typeof n['position'] !== 'object') {
    throw new Error('Node missing position');
  }
  if (!n['data'] || typeof n['data'] !== 'object') {
    throw new Error('Node missing data');
  }
}

function validateEdge(edge: unknown): void {
  if (!edge || typeof edge !== 'object') {
    throw new Error('Invalid edge: must be an object');
  }
  const e = edge as Record<string, unknown>;
  if (typeof e['id'] !== 'string') throw new Error('Edge missing id');
  if (typeof e['source'] !== 'string') throw new Error('Edge missing source');
  if (typeof e['target'] !== 'string') throw new Error('Edge missing target');
}

export function exportToFile(pipeline: PipelineJSON): void {
  const json = JSON.stringify(pipeline, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${pipeline.name.replace(/\s+/g, '-').toLowerCase()}.pipeline.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importFromFile(): Promise<PipelineJSON> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        reject(new Error('No file selected'));
        return;
      }
      try {
        const text = await file.text();
        const parsed: unknown = JSON.parse(text);
        validatePipeline(parsed);
        resolve(parsed as PipelineJSON);
      } catch (err) {
        reject(err);
      }
    };
    input.click();
  });
}
