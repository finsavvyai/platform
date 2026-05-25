/**
 * Core workflow type definitions for LunaOS Studio Visual Builder.
 * All node, edge, and pipeline types used across the application.
 */

export type NodeCategory = 'agent' | 'trigger' | 'condition' | 'output';

export interface PortDefinition {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'any';
  required?: boolean;
  description: string;
}

export interface ConfigField {
  type: 'string' | 'number' | 'boolean' | 'select' | 'textarea';
  default: string | number | boolean;
  options?: string[];
  min?: number;
  max?: number;
  placeholder?: string;
  label?: string;
}

export interface NodeTypeDefinition {
  id: string;
  name: string;
  category: NodeCategory;
  description: string;
  icon: string;
  color: string;
  inputs: PortDefinition[];
  outputs: PortDefinition[];
  configSchema: Record<string, ConfigField>;
}

export interface WorkflowNodeData extends Record<string, unknown> {
  typeId: string;
  label: string;
  category: NodeCategory;
  icon: string;
  color: string;
  config: Record<string, string | number | boolean>;
  inputs: PortDefinition[];
  outputs: PortDefinition[];
  status?: 'idle' | 'running' | 'success' | 'error';
  error?: string;
}

export interface WorkflowEdgeData extends Record<string, unknown> {
  sourcePort: string;
  targetPort: string;
  animated?: boolean;
}

export interface PipelineNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: WorkflowNodeData;
}

export interface PipelineEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle: string | null;
  targetHandle: string | null;
  data?: WorkflowEdgeData;
}

export interface PipelineJSON {
  version: string;
  name: string;
  description: string;
  nodes: PipelineNode[];
  edges: PipelineEdge[];
  metadata: {
    created: string;
    modified: string;
    author: string;
  };
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  tags: string[];
  nodes: PipelineNode[];
  edges: PipelineEdge[];
  preview: string;
}

export interface ExecutionResult {
  executionId: string;
  status: 'running' | 'completed' | 'failed';
  nodeResults: Record<string, {
    output: unknown;
    duration: number;
    status: 'success' | 'error';
    error?: string;
  }>;
  startedAt: string;
  completedAt?: string;
}
