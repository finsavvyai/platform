import { jest } from '@jest/globals';

describe('WorkflowEngine', () => {
  let workflowEngine;
  let mockSanitizer;
  let mockRetryManager;
  let mockNodeSystem;

  beforeEach(async () => {
    // Set up mocks
    mockSanitizer = {
      sanitizeWorkflowName: jest.fn((name) => name),
      sanitizeText: jest.fn((text) => text),
      sanitizeNodeConfig: jest.fn((config) => config),
      sanitizeWorkflowExport: jest.fn((data) => data),
      sanitizeWorkflowImport: jest.fn((data) => JSON.parse(data))
    };

    mockRetryManager = {
      retry: jest.fn()
    };

    mockNodeSystem = {
      getNodeType: jest.fn((type) => ({
        name: type,
        inputs: [{ name: 'input', required: false }],
        outputs: [{ name: 'output' }],
        execute: jest.fn(async () => ({ output: 'test result' }))
      }))
    };

    // Set up global mocks
    global.window = {
      nodeSystem: mockNodeSystem
    };

    // Import WorkflowEngine dynamically
    const WorkflowEngineModule = await import('../../js/workflow-engine.js');
    
    // Create a new instance for each test
    workflowEngine = new WorkflowEngineModule.default.constructor();
    workflowEngine.sanitizer = mockSanitizer;
    workflowEngine.retryManager = mockRetryManager;
    jest.clearAllMocks();
  });

  describe('createWorkflow', () => {
    it('should create a new workflow with unique ID', () => {
      const workflowId = workflowEngine.createWorkflow('Test Workflow');
      
      expect(workflowId).toMatch(/^workflow_\d+_[a-z0-9]+$/);
      expect(workflowEngine.getWorkflow(workflowId)).toBeDefined();
    });

    it('should sanitize workflow name and description', () => {
      const name = 'Test Workflow';
      const description = 'Test Description';
      
      workflowEngine.createWorkflow(name, description);
      
      expect(mockSanitizer.sanitizeWorkflowName).toHaveBeenCalledWith(name);
      expect(mockSanitizer.sanitizeText).toHaveBeenCalledWith(description);
    });

    it('should initialize workflow with default settings', () => {
      const workflowId = workflowEngine.createWorkflow('Test Workflow');
      const workflow = workflowEngine.getWorkflow(workflowId);
      
      expect(workflow.settings).toEqual({
        timeout: 300000,
        retries: 3,
        parallel: false,
        errorHandling: 'stop'
      });
    });

    it('should emit workflow:created event', () => {
      const listener = jest.fn();
      workflowEngine.on('workflow:created', listener);
      
      workflowEngine.createWorkflow('Test Workflow');
      
      expect(listener).toHaveBeenCalled();
    });
  });

  describe('addNode', () => {
    it('should add a node to workflow', () => {
      const workflowId = workflowEngine.createWorkflow('Test Workflow');
      const result = workflowEngine.addNode(workflowId, 'node1', 'trigger', {});
      
      expect(result).toBe(true);
      const workflow = workflowEngine.getWorkflow(workflowId);
      expect(workflow.nodes.has('node1')).toBe(true);
    });

    it('should sanitize node configuration', () => {
      const workflowId = workflowEngine.createWorkflow('Test Workflow');
      const config = { key: 'value' };
      
      workflowEngine.addNode(workflowId, 'node1', 'trigger', config);
      
      expect(mockSanitizer.sanitizeNodeConfig).toHaveBeenCalledWith(config);
    });

    it('should return false for non-existent workflow', () => {
      const result = workflowEngine.addNode('invalid-id', 'node1', 'trigger', {});
      
      expect(result).toBe(false);
    });

    it('should emit node:added event', () => {
      const listener = jest.fn();
      workflowEngine.on('node:added', listener);
      
      const workflowId = workflowEngine.createWorkflow('Test Workflow');
      workflowEngine.addNode(workflowId, 'node1', 'trigger', {});
      
      expect(listener).toHaveBeenCalled();
    });
  });

  describe('removeNode', () => {
    it('should remove a node from workflow', () => {
      const workflowId = workflowEngine.createWorkflow('Test Workflow');
      workflowEngine.addNode(workflowId, 'node1', 'trigger', {});
      
      const result = workflowEngine.removeNode(workflowId, 'node1');
      
      expect(result).toBe(true);
      const workflow = workflowEngine.getWorkflow(workflowId);
      expect(workflow.nodes.has('node1')).toBe(false);
    });

    it('should remove connections involving the node', () => {
      const workflowId = workflowEngine.createWorkflow('Test Workflow');
      workflowEngine.addNode(workflowId, 'node1', 'trigger', {});
      workflowEngine.addNode(workflowId, 'node2', 'output', {});
      workflowEngine.addConnection(workflowId, 'conn1', 'node1', 'node2');
      
      workflowEngine.removeNode(workflowId, 'node1');
      
      const workflow = workflowEngine.getWorkflow(workflowId);
      expect(workflow.connections.has('conn1')).toBe(false);
    });

    it('should emit node:removed event', () => {
      const listener = jest.fn();
      workflowEngine.on('node:removed', listener);
      
      const workflowId = workflowEngine.createWorkflow('Test Workflow');
      workflowEngine.addNode(workflowId, 'node1', 'trigger', {});
      workflowEngine.removeNode(workflowId, 'node1');
      
      expect(listener).toHaveBeenCalled();
    });
  });

  describe('addConnection', () => {
    it('should add a connection between nodes', () => {
      const workflowId = workflowEngine.createWorkflow('Test Workflow');
      workflowEngine.addNode(workflowId, 'node1', 'trigger', {});
      workflowEngine.addNode(workflowId, 'node2', 'output', {});
      
      const result = workflowEngine.addConnection(workflowId, 'conn1', 'node1', 'node2');
      
      expect(result).toBe(true);
      const workflow = workflowEngine.getWorkflow(workflowId);
      expect(workflow.connections.has('conn1')).toBe(true);
    });

    it('should return false for non-existent workflow', () => {
      const result = workflowEngine.addConnection('invalid-id', 'conn1', 'node1', 'node2');
      
      expect(result).toBe(false);
    });

    it('should emit connection:added event', () => {
      const listener = jest.fn();
      workflowEngine.on('connection:added', listener);
      
      const workflowId = workflowEngine.createWorkflow('Test Workflow');
      workflowEngine.addNode(workflowId, 'node1', 'trigger', {});
      workflowEngine.addNode(workflowId, 'node2', 'output', {});
      workflowEngine.addConnection(workflowId, 'conn1', 'node1', 'node2');
      
      expect(listener).toHaveBeenCalled();
    });
  });

  describe('removeConnection', () => {
    it('should remove a connection from workflow', () => {
      const workflowId = workflowEngine.createWorkflow('Test Workflow');
      workflowEngine.addNode(workflowId, 'node1', 'trigger', {});
      workflowEngine.addNode(workflowId, 'node2', 'output', {});
      workflowEngine.addConnection(workflowId, 'conn1', 'node1', 'node2');
      
      const result = workflowEngine.removeConnection(workflowId, 'conn1');
      
      expect(result).toBe(true);
      const workflow = workflowEngine.getWorkflow(workflowId);
      expect(workflow.connections.has('conn1')).toBe(false);
    });

    it('should emit connection:removed event', () => {
      const listener = jest.fn();
      workflowEngine.on('connection:removed', listener);
      
      const workflowId = workflowEngine.createWorkflow('Test Workflow');
      workflowEngine.addNode(workflowId, 'node1', 'trigger', {});
      workflowEngine.addNode(workflowId, 'node2', 'output', {});
      workflowEngine.addConnection(workflowId, 'conn1', 'node1', 'node2');
      workflowEngine.removeConnection(workflowId, 'conn1');
      
      expect(listener).toHaveBeenCalled();
    });
  });

  describe('executeWorkflow', () => {
    it('should execute nodes in topological order', async () => {
      const workflowId = workflowEngine.createWorkflow('Test Workflow');
      workflowEngine.addNode(workflowId, 'node1', 'trigger', {});
      workflowEngine.addNode(workflowId, 'node2', 'output', {});
      workflowEngine.addConnection(workflowId, 'conn1', 'node1', 'node2');

      const execution = await workflowEngine.executeWorkflow(workflowId);
      
      expect(execution.status).toBe('completed');
      expect(execution.nodeResults.size).toBe(2);
    });

    it('should handle workflow execution errors', async () => {
      const workflowId = workflowEngine.createWorkflow('Test Workflow');
      workflowEngine.addNode(workflowId, 'node1', 'trigger', {});
      
      // Mock node execution to throw error
      mockNodeSystem.getNodeType.mockReturnValueOnce({
        name: 'trigger',
        inputs: [],
        outputs: [{ name: 'output' }],
        execute: jest.fn(async () => {
          throw new Error('Execution failed');
        })
      });

      const execution = await workflowEngine.executeWorkflow(workflowId);
      
      expect(execution.status).toBe('failed');
      expect(execution.errors.length).toBeGreaterThan(0);
    });

    it('should detect circular dependencies', async () => {
      const workflowId = workflowEngine.createWorkflow('Test Workflow');
      workflowEngine.addNode(workflowId, 'node1', 'trigger', {});
      workflowEngine.addNode(workflowId, 'node2', 'output', {});
      workflowEngine.addConnection(workflowId, 'conn1', 'node1', 'node2');
      workflowEngine.addConnection(workflowId, 'conn2', 'node2', 'node1');

      const execution = await workflowEngine.executeWorkflow(workflowId);
      
      expect(execution.status).toBe('failed');
      expect(execution.errors.some(e => e.message.includes('Circular dependency'))).toBe(true);
    });

    it('should emit execution events', async () => {
      const startListener = jest.fn();
      const completedListener = jest.fn();
      workflowEngine.on('execution:started', startListener);
      workflowEngine.on('execution:completed', completedListener);
      
      const workflowId = workflowEngine.createWorkflow('Test Workflow');
      workflowEngine.addNode(workflowId, 'node1', 'trigger', {});
      
      await workflowEngine.executeWorkflow(workflowId);
      
      expect(startListener).toHaveBeenCalled();
      expect(completedListener).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle errors based on errorHandling setting', async () => {
      const workflowId = workflowEngine.createWorkflow('Test Workflow');
      const workflow = workflowEngine.getWorkflow(workflowId);
      workflow.settings.errorHandling = 'continue';
      
      workflowEngine.addNode(workflowId, 'node1', 'trigger', {});
      workflowEngine.addNode(workflowId, 'node2', 'output', {});
      workflowEngine.addConnection(workflowId, 'conn1', 'node1', 'node2');
      
      // Mock first node to fail
      let callCount = 0;
      mockNodeSystem.getNodeType.mockImplementation(() => ({
        name: 'test',
        inputs: [],
        outputs: [{ name: 'output' }],
        execute: jest.fn(async () => {
          callCount++;
          if (callCount === 1) {
            throw new Error('Node failed');
          }
          return { output: 'success' };
        })
      }));

      const execution = await workflowEngine.executeWorkflow(workflowId);
      
      // Should continue despite error
      expect(execution.errors.length).toBeGreaterThan(0);
      expect(execution.nodeResults.size).toBeGreaterThan(0);
    });
  });
});
