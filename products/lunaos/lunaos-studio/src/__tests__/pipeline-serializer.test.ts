/**
 * Tests for the pipeline serializer — export, import, and validation.
 */

import {
  serializePipeline,
  deserializePipeline,
  validatePipeline,
} from '../lib/pipeline-serializer';
import type { PipelineJSON } from '../types';
import type { Node, Edge } from '@xyflow/react';
import type { WorkflowNodeData } from '../types';

function mockNode(id: string): Node<WorkflowNodeData> {
  return {
    id,
    type: 'workflow-node',
    position: { x: 100, y: 200 },
    data: {
      typeId: 'chat-agent',
      label: 'Test Node',
      category: 'agent',
      icon: 'bubble.left.fill',
      color: '#007AFF',
      config: { model: 'gpt-4o' },
      inputs: [{ name: 'message', type: 'string', required: true, description: 'Input' }],
      outputs: [{ name: 'response', type: 'string', description: 'Output' }],
      status: 'idle',
    },
  };
}

function mockEdge(id: string, src: string, tgt: string): Edge {
  return {
    id,
    source: src,
    target: tgt,
    sourceHandle: 'out-response',
    targetHandle: 'in-message',
  };
}

describe('pipeline-serializer', () => {
  test('serializePipeline produces valid JSON structure', () => {
    const nodes = [mockNode('n1'), mockNode('n2')];
    const edges = [mockEdge('e1', 'n1', 'n2')];
    const result = serializePipeline(nodes, edges, 'Test', 'Description');

    expect(result.version).toBe('1.0.0');
    expect(result.name).toBe('Test');
    expect(result.description).toBe('Description');
    expect(result.nodes).toHaveLength(2);
    expect(result.edges).toHaveLength(1);
    expect(result.metadata.author).toBe('LunaOS Studio');
    expect(result.metadata.created).toBeTruthy();
  });

  test('deserializePipeline reconstructs nodes and edges', () => {
    const nodes = [mockNode('n1')];
    const edges: Edge[] = [];
    const json = serializePipeline(nodes, edges, 'Test');
    const result = deserializePipeline(json);

    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0]?.id).toBe('n1');
    expect(result.edges).toHaveLength(0);
  });

  test('validatePipeline rejects non-object', () => {
    expect(() => validatePipeline(null)).toThrow('must be an object');
    expect(() => validatePipeline('string')).toThrow('must be an object');
  });

  test('validatePipeline rejects missing version', () => {
    expect(() =>
      validatePipeline({ name: 'x', nodes: [], edges: [] })
    ).toThrow('missing version');
  });

  test('validatePipeline rejects missing name', () => {
    expect(() =>
      validatePipeline({ version: '1.0', nodes: [], edges: [] })
    ).toThrow('missing name');
  });

  test('validatePipeline rejects invalid nodes array', () => {
    expect(() =>
      validatePipeline({ version: '1.0', name: 'x', nodes: 'bad', edges: [] })
    ).toThrow('nodes must be an array');
  });

  test('validatePipeline rejects node without id', () => {
    expect(() =>
      validatePipeline({
        version: '1.0', name: 'x',
        nodes: [{ position: { x: 0, y: 0 }, data: {} }],
        edges: [],
      })
    ).toThrow('Node missing id');
  });

  test('validatePipeline accepts valid pipeline', () => {
    const valid: PipelineJSON = {
      version: '1.0.0', name: 'Valid', description: '',
      nodes: [{
        id: 'n1', type: 'workflow-node',
        position: { x: 0, y: 0 },
        data: {
          typeId: 'chat-agent', label: 'X', category: 'agent',
          icon: '', color: '#000', config: {},
          inputs: [], outputs: [],
        },
      }],
      edges: [{ id: 'e1', source: 'n1', target: 'n2', sourceHandle: null, targetHandle: null }],
      metadata: { created: '', modified: '', author: '' },
    };
    expect(validatePipeline(valid)).toBe(true);
  });

  test('round-trip serialize/deserialize preserves data', () => {
    const nodes = [mockNode('a'), mockNode('b')];
    const edges = [mockEdge('e1', 'a', 'b')];
    const json = serializePipeline(nodes, edges, 'Round Trip');
    const result = deserializePipeline(json);

    expect(result.nodes[0]?.data.typeId).toBe('chat-agent');
    expect(result.nodes[0]?.data.config['model']).toBe('gpt-4o');
    expect(result.edges[0]?.source).toBe('a');
    expect(result.edges[0]?.target).toBe('b');
  });
});
