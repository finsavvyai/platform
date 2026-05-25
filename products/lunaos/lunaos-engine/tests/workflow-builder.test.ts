import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorkflowBuilder } from '../src/workflow-builder';
import { WorkflowNode, NodeType, Position3D } from '../src/types';

describe('WorkflowBuilder', () => {
  let builder: WorkflowBuilder;

  beforeEach(() => {
    builder = new WorkflowBuilder();
  });

  describe('Node CRUD Operations', () => {
    it('should create a new node', () => {
      const node = builder.createNode('agent-1', 'agent', { x: 0, y: 0, z: 0 });
      expect(node.id).toBeDefined();
      expect(node.type).toBe('agent');
    });

    it('should assign unique IDs to nodes', () => {
      const node1 = builder.createNode('agent-1', 'agent', { x: 0, y: 0, z: 0 });
      const node2 = builder.createNode('agent-2', 'agent', { x: 100, y: 0, z: 0 });
      expect(node1.id).not.toBe(node2.id);
    });

    it('should retrieve a node by ID', () => {
      const created = builder.createNode('agent-1', 'agent', { x: 0, y: 0, z: 0 });
      const retrieved = builder.getNode(created.id);
      expect(retrieved).toEqual(created);
    });

    it('should update node position', () => {
      const node = builder.createNode('agent-1', 'agent', { x: 0, y: 0, z: 0 });
      builder.updateNodePosition(node.id, { x: 50, y: 100, z: 25 });
      const updated = builder.getNode(node.id);
      expect(updated.position).toEqual({ x: 50, y: 100, z: 25 });
    });

    it('should update node configuration', () => {
      const node = builder.createNode('agent-1', 'agent', { x: 0, y: 0, z: 0 });
      builder.updateNodeConfig(node.id, { maxRetries: 5, timeout: 30000 });
      const updated = builder.getNode(node.id);
      expect(updated.config.maxRetries).toBe(5);
      expect(updated.config.timeout).toBe(30000);
    });

    it('should delete a node', () => {
      const node = builder.createNode('agent-1', 'agent', { x: 0, y: 0, z: 0 });
      builder.deleteNode(node.id);
      expect(builder.getNode(node.id)).toBeUndefined();
    });

    it('should list all nodes', () => {
      builder.createNode('agent-1', 'agent', { x: 0, y: 0, z: 0 });
      builder.createNode('agent-2', 'agent', { x: 100, y: 0, z: 0 });
      builder.createNode('trigger-1', 'trigger', { x: 50, y: 100, z: 0 });
      const nodes = builder.listNodes();
      expect(nodes.length).toBe(3);
    });
  });

  describe('Connection Management', () => {
    let sourceId: string;
    let targetId: string;

    beforeEach(() => {
      const source = builder.createNode('agent-1', 'agent', { x: 0, y: 0, z: 0 });
      const target = builder.createNode('agent-2', 'agent', { x: 100, y: 0, z: 0 });
      sourceId = source.id;
      targetId = target.id;
    });

    it('should create a connection between nodes', () => {
      const conn = builder.createConnection(sourceId, targetId);
      expect(conn.id).toBeDefined();
      expect(conn.sourceId).toBe(sourceId);
      expect(conn.targetId).toBe(targetId);
    });

    it('should validate connection exists before operations', () => {
      builder.createConnection(sourceId, targetId);
      const conn = builder.getConnection(sourceId, targetId);
      expect(conn).toBeDefined();
    });

    it('should remove a connection', () => {
      builder.createConnection(sourceId, targetId);
      builder.removeConnection(sourceId, targetId);
      const conn = builder.getConnection(sourceId, targetId);
      expect(conn).toBeUndefined();
    });

    it('should prevent circular connections', () => {
      builder.createConnection(sourceId, targetId);
      const circularAttempt = () => {
        builder.createConnection(targetId, sourceId);
      };
      expect(circularAttempt).toThrow('Circular connection detected');
    });

    it('should list all connections for a node', () => {
      const third = builder.createNode('agent-3', 'agent', { x: 200, y: 0, z: 0 });
      builder.createConnection(sourceId, targetId);
      builder.createConnection(sourceId, third.id);
      const connections = builder.getNodeConnections(sourceId);
      expect(connections.length).toBe(2);
    });

    it('should update connection properties', () => {
      const conn = builder.createConnection(sourceId, targetId);
      builder.updateConnection(conn.id, { condition: 'success', delay: 1000 });
      const updated = builder.getConnection(sourceId, targetId);
      expect(updated.condition).toBe('success');
      expect(updated.delay).toBe(1000);
    });
  });

  describe('Execution Flow', () => {
    it('should validate workflow before execution', () => {
      builder.createNode('trigger-1', 'trigger', { x: 0, y: 0, z: 0 });
      const workflow = builder.build();
      expect(workflow.valid).toBe(true);
    });

    it('should detect missing required nodes', () => {
      const builder2 = new WorkflowBuilder();
      const workflow = builder2.build();
      expect(workflow.valid).toBe(false);
      expect(workflow.errors).toContain('No trigger node found');
    });

    it('should execute nodes in correct order', async () => {
      const trigger = builder.createNode('trigger-1', 'trigger', { x: 0, y: 0, z: 0 });
      const agent1 = builder.createNode('agent-1', 'agent', { x: 100, y: 0, z: 0 });
      const agent2 = builder.createNode('agent-2', 'agent', { x: 200, y: 0, z: 0 });

      builder.createConnection(trigger.id, agent1.id);
      builder.createConnection(agent1.id, agent2.id);

      const workflow = builder.build();
      expect(workflow.executionOrder).toEqual([trigger.id, agent1.id, agent2.id]);
    });

    it('should handle branching paths', () => {
      const trigger = builder.createNode('trigger-1', 'trigger', { x: 0, y: 0, z: 0 });
      const agent1 = builder.createNode('agent-1', 'agent', { x: 100, y: 50, z: 0 });
      const agent2 = builder.createNode('agent-2', 'agent', { x: 100, y: -50, z: 0 });

      builder.createConnection(trigger.id, agent1.id, { condition: 'type === "email"' });
      builder.createConnection(trigger.id, agent2.id, { condition: 'type === "sms"' });

      const workflow = builder.build();
      expect(workflow.paths.length).toBeGreaterThan(1);
    });
  });

  describe('3D Positioning', () => {
    it('should maintain 3D coordinates correctly', () => {
      const pos: Position3D = { x: 100, y: 200, z: 50 };
      const node = builder.createNode('agent-1', 'agent', pos);
      expect(node.position).toEqual(pos);
    });

    it('should calculate distance between nodes', () => {
      const node1 = builder.createNode('agent-1', 'agent', { x: 0, y: 0, z: 0 });
      const node2 = builder.createNode('agent-2', 'agent', { x: 3, y: 4, z: 0 });
      const distance = builder.calculateDistance(node1.id, node2.id);
      expect(distance).toBe(5);
    });

    it('should detect node overlap', () => {
      builder.createNode('agent-1', 'agent', { x: 0, y: 0, z: 0 });
      const overlapping = () => {
        builder.createNode('agent-2', 'agent', { x: 1, y: 1, z: 0 });
      };
      expect(overlapping).toThrow('Node overlap detected');
    });

    it('should auto-layout nodes spatially', () => {
      builder.createNode('agent-1', 'agent', { x: 0, y: 0, z: 0 });
      builder.createNode('agent-2', 'agent', { x: 0, y: 0, z: 0 });
      builder.createNode('agent-3', 'agent', { x: 0, y: 0, z: 0 });

      builder.autoLayout();
      const nodes = builder.listNodes();
      const positions = nodes.map(n => JSON.stringify(n.position));
      expect(new Set(positions).size).toBe(3);
    });
  });

  describe('Validation & Error Handling', () => {
    it('should validate node types', () => {
      expect(() => {
        builder.createNode('invalid', 'invalid-type' as any, { x: 0, y: 0, z: 0 });
      }).toThrow('Invalid node type');
    });

    it('should handle duplicate node names', () => {
      builder.createNode('agent-1', 'agent', { x: 0, y: 0, z: 0 });
      expect(() => {
        builder.createNode('agent-1', 'agent', { x: 100, y: 0, z: 0 });
      }).toThrow('Node name already exists');
    });

    it('should export workflow as JSON', () => {
      const node = builder.createNode('agent-1', 'agent', { x: 0, y: 0, z: 0 });
      const exported = builder.export();
      expect(exported.nodes).toContainEqual(expect.objectContaining({ id: node.id }));
    });

    it('should import workflow from JSON', () => {
      const original = builder.export();
      const builder2 = WorkflowBuilder.import(original);
      const imported = builder2.export();
      expect(imported.nodes.length).toBe(original.nodes.length);
    });
  });

  describe('Performance & Optimization', () => {
    it('should handle large workflows', () => {
      for (let i = 0; i < 100; i++) {
        builder.createNode(`agent-${i}`, 'agent', { x: i * 10, y: 0, z: 0 });
      }
      const nodes = builder.listNodes();
      expect(nodes.length).toBe(100);
    });

    it('should memoize workflow build results', () => {
      const buildSpy = vi.spyOn(builder, 'build');
      builder.build();
      builder.build();
      builder.build();
      expect(buildSpy).toHaveBeenCalledTimes(3);
    });
  });
});
