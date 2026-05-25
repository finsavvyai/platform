export type NodeType =
  | 'agent_session'
  | 'cloud_account'
  | 'iam_role'
  | 'storage_bucket'
  | 'compute_instance'
  | 'database'
  | 'secret'
  | 'network';

export interface GraphNode {
  id: string;
  name: string;
  type: NodeType;
  riskScore: number;
  metadata: Record<string, string>;
  findings: Finding[];
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  direct: boolean;
}

export interface Finding {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export interface PositionedNode extends GraphNode {
  x: number;
  y: number;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export const NODE_COLORS: Record<NodeType, string> = {
  agent_session: '#3b82f6',
  cloud_account: '#a855f7',
  iam_role: '#f97316',
  storage_bucket: '#22c55e',
  compute_instance: '#06b6d4',
  database: '#ef4444',
  secret: '#f59e0b',
  network: '#9ca3af',
};

export const NODE_LABELS: Record<NodeType, string> = {
  agent_session: 'Agent Session',
  cloud_account: 'Cloud Account',
  iam_role: 'IAM Role',
  storage_bucket: 'Storage Bucket',
  compute_instance: 'Compute',
  database: 'Database',
  secret: 'Secret',
  network: 'Network',
};

export const ALL_NODE_TYPES: NodeType[] = [
  'agent_session', 'cloud_account', 'iam_role', 'storage_bucket',
  'compute_instance', 'database', 'secret', 'network',
];
