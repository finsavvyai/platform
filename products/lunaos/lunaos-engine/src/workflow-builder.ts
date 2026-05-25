import { WorkflowNode, NodeType, Position3D, Connection } from './types';
import {
  euclideanDistance,
  checkOverlap,
  hasPath,
  topologicalSort,
  findPaths,
  LAYOUT_SPACING,
} from './workflow-graph-utils';

const VALID_TYPES: NodeType[] = ['agent', 'trigger', 'condition', 'output'];

export class WorkflowBuilder {
  private nodes: Map<string, WorkflowNode> = new Map();
  private connections: Map<string, Connection> = new Map();
  private nextNodeId = 1;
  private nextConnId = 1;

  createNode(
    name: string,
    type: NodeType,
    position: Position3D,
  ): WorkflowNode {
    if (!VALID_TYPES.includes(type)) {
      throw new Error('Invalid node type');
    }
    const nameExists = [...this.nodes.values()].some(
      (n) => n.name === name,
    );
    if (nameExists) throw new Error('Node name already exists');

    const existing = [...this.nodes.values()].map((n) => n.position);
    if (checkOverlap(position, existing)) {
      throw new Error('Node overlap detected');
    }

    const id = `node-${this.nextNodeId++}`;
    const node: WorkflowNode = {
      id, name, type, position, config: {},
    };
    this.nodes.set(id, node);
    return { ...node };
  }

  getNode(id: string): WorkflowNode | undefined {
    const node = this.nodes.get(id);
    return node ? { ...node, config: { ...node.config } } : undefined;
  }

  updateNodePosition(id: string, position: Position3D): void {
    const node = this.nodes.get(id);
    if (node) node.position = { ...position };
  }

  updateNodeConfig(id: string, config: Record<string, unknown>): void {
    const node = this.nodes.get(id);
    if (node) Object.assign(node.config, config);
  }

  deleteNode(id: string): void {
    this.nodes.delete(id);
    for (const [cid, conn] of this.connections) {
      if (conn.sourceId === id || conn.targetId === id) {
        this.connections.delete(cid);
      }
    }
  }

  listNodes(): WorkflowNode[] {
    return [...this.nodes.values()];
  }

  createConnection(
    sourceId: string,
    targetId: string,
    options?: Record<string, unknown>,
  ): Connection {
    const conns = [...this.connections.values()];
    if (hasPath(targetId, sourceId, conns)) {
      throw new Error('Circular connection detected');
    }
    const id = `conn-${this.nextConnId++}`;
    const conn: Connection = { id, sourceId, targetId, ...options };
    this.connections.set(id, conn);
    return { ...conn };
  }

  getConnection(
    sourceId: string,
    targetId: string,
  ): Connection | undefined {
    const conn = [...this.connections.values()].find(
      (c) => c.sourceId === sourceId && c.targetId === targetId,
    );
    return conn ? { ...conn } : undefined;
  }

  removeConnection(sourceId: string, targetId: string): void {
    for (const [id, conn] of this.connections) {
      if (conn.sourceId === sourceId && conn.targetId === targetId) {
        this.connections.delete(id);
        return;
      }
    }
  }

  getNodeConnections(nodeId: string): Connection[] {
    return [...this.connections.values()].filter(
      (c) => c.sourceId === nodeId,
    );
  }

  updateConnection(
    connId: string,
    updates: Record<string, unknown>,
  ): void {
    const conn = this.connections.get(connId);
    if (conn) Object.assign(conn, updates);
  }

  build(): Record<string, unknown> {
    const nodes = this.listNodes();
    const connections = [...this.connections.values()];
    if (nodes.length === 0) {
      return { valid: false, errors: ['No trigger node found'], nodes, connections };
    }
    const hasTrigger = nodes.some((n) => n.type === 'trigger');
    const errors: string[] = [];
    if (!hasTrigger) errors.push('No trigger node found');
    const valid = errors.length === 0;
    const ids = nodes.map((n) => n.id);
    const executionOrder = topologicalSort(ids, connections);
    const paths = findPaths(ids, connections);
    return { valid, errors, executionOrder, paths, nodes, connections };
  }

  calculateDistance(nodeId1: string, nodeId2: string): number {
    const a = this.nodes.get(nodeId1);
    const b = this.nodes.get(nodeId2);
    if (!a || !b) throw new Error('Node not found');
    return euclideanDistance(a.position, b.position);
  }

  autoLayout(): void {
    let idx = 0;
    for (const node of this.nodes.values()) {
      node.position = {
        x: idx * LAYOUT_SPACING,
        y: idx * LAYOUT_SPACING,
        z: 0,
      };
      idx++;
    }
  }

  export(): { nodes: WorkflowNode[]; connections: Connection[] } {
    return {
      nodes: this.listNodes(),
      connections: [...this.connections.values()],
    };
  }

  static import(data: {
    nodes: WorkflowNode[];
    connections: Connection[];
  }): WorkflowBuilder {
    const builder = new WorkflowBuilder();
    for (const node of data.nodes) {
      builder.nodes.set(node.id, { ...node });
    }
    for (const conn of data.connections) {
      builder.connections.set(conn.id, { ...conn });
    }
    return builder;
  }
}
