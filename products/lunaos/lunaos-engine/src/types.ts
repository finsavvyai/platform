export type AgentState = 'idle' | 'running' | 'paused' | 'terminated';

export type NodeType = 'agent' | 'trigger' | 'condition' | 'output';

export interface Position3D {
  x: number;
  y: number;
  z: number;
}

export interface Agent {
  id: string;
  name: string;
  type: string;
  status: AgentState;
  config: {
    timeout: number;
    maxRetries?: number;
  };
  pid?: string;
}

export interface AgentMessage {
  id: string;
  from: string;
  to: string;
  type: string;
  payload: Record<string, unknown>;
}

export interface Connection {
  id: string;
  sourceId: string;
  targetId: string;
  condition?: string;
  delay?: number;
}

export interface WorkflowNode {
  id: string;
  name: string;
  type: NodeType;
  position: Position3D;
  config: Record<string, unknown>;
}

export interface Workflow {
  id: string;
  name: string;
  nodes: WorkflowNode[];
  connections: Connection[];
  valid: boolean;
  errors?: string[];
  executionOrder?: string[];
  paths?: any[];
}

export interface DeploymentConfig {
  environment: string;
  port?: number;
}
