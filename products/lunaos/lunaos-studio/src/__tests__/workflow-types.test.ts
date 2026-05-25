/**
 * Tests for type definitions — ensures types are importable and consistent.
 * (Runtime validation tests since TS types are compile-time only.)
 */

import type {
  NodeCategory,
  WorkflowNodeData,
  PipelineJSON,
  WorkflowTemplate,
  ExecutionResult,
} from '../types';

describe('workflow types', () => {
  test('NodeCategory literal union is valid at runtime', () => {
    const categories: NodeCategory[] = ['agent', 'trigger', 'condition', 'output'];
    expect(categories).toHaveLength(4);
  });

  test('WorkflowNodeData shape is constructable', () => {
    const data: WorkflowNodeData = {
      typeId: 'chat-agent',
      label: 'Agent',
      category: 'agent',
      icon: 'bubble',
      color: '#007AFF',
      config: { model: 'gpt-4o' },
      inputs: [{ name: 'msg', type: 'string', required: true, description: 'x' }],
      outputs: [{ name: 'out', type: 'string', description: 'y' }],
      status: 'idle',
    };
    expect(data.typeId).toBe('chat-agent');
    expect(data.status).toBe('idle');
  });

  test('PipelineJSON shape is constructable', () => {
    const pipeline: PipelineJSON = {
      version: '1.0.0',
      name: 'Test',
      description: '',
      nodes: [],
      edges: [],
      metadata: { created: '', modified: '', author: '' },
    };
    expect(pipeline.version).toBe('1.0.0');
  });

  test('WorkflowTemplate shape is constructable', () => {
    const tpl: WorkflowTemplate = {
      id: 'test',
      name: 'Test',
      description: 'desc',
      category: 'AI',
      difficulty: 'beginner',
      tags: ['ai'],
      nodes: [],
      edges: [],
      preview: 'test',
    };
    expect(tpl.difficulty).toBe('beginner');
  });

  test('ExecutionResult shape is constructable', () => {
    const result: ExecutionResult = {
      executionId: 'exec-1',
      status: 'completed',
      nodeResults: {
        n1: { output: 'ok', duration: 100, status: 'success' },
      },
      startedAt: '2024-01-01',
      completedAt: '2024-01-01',
    };
    expect(result.status).toBe('completed');
    expect(result.nodeResults['n1']?.status).toBe('success');
  });
});
