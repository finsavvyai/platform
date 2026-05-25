import { jest } from '@jest/globals';

describe('NodeSystem', () => {
  let nodeSystem;

  beforeEach(async () => {
    // Mock global window object
    global.window = {};
    
    // Import NodeSystem dynamically
    const NodeSystemModule = await import('../../js/node-system.js');
    
    nodeSystem = new NodeSystemModule.default.constructor();
    jest.clearAllMocks();
  });

  describe('node type registration', () => {
    it('should register a new node type', () => {
      const nodeType = {
        name: 'Test Node',
        category: 'test',
        description: 'Test node type',
        inputs: [],
        outputs: [],
        config: {},
        execute: jest.fn()
      };

      nodeSystem.registerNodeType('test-node', nodeType);
      
      expect(nodeSystem.getNodeType('test-node')).toEqual(nodeType);
    });

    it('should retrieve all node types', () => {
      const allTypes = nodeSystem.getAllNodeTypes();
      
      expect(Array.isArray(allTypes)).toBe(true);
      expect(allTypes.length).toBeGreaterThan(0);
    });

    it('should filter node types by category', () => {
      const agentNodes = nodeSystem.getNodeTypesByCategory('agent');
      const controlNodes = nodeSystem.getNodeTypesByCategory('control');
      
      expect(agentNodes.every(node => node.category === 'agent')).toBe(true);
      expect(controlNodes.every(node => node.category === 'control')).toBe(true);
    });

    it('should have all required node types registered', () => {
      const requiredTypes = [
        'chat-agent',
        'data-processor',
        'trigger',
        'condition',
        'output'
      ];

      requiredTypes.forEach(type => {
        expect(nodeSystem.getNodeType(type)).toBeDefined();
      });
    });
  });

  describe('node execution methods', () => {
    describe('executeTrigger', () => {
      it('should execute trigger node', async () => {
        const inputs = {};
        const config = {
          triggerType: 'manual',
          schedule: '0 0 * * *',
          webhookPath: '/webhook'
        };

        const result = await nodeSystem.executeTrigger('node1', inputs, config);
        
        expect(result.start).toBeDefined();
        expect(result.start.triggerType).toBe('manual');
        expect(result.start.timestamp).toBeDefined();
      });
    });

    describe('executeCondition', () => {
      it('should return true output when condition is met', async () => {
        const inputs = { input: 10 };
        const config = {
          condition: 'return input > 5;',
          operator: 'custom'
        };

        const result = await nodeSystem.executeCondition('node1', inputs, config);
        
        expect(result.true).toBe(10);
        expect(result.false).toBeUndefined();
      });

      it('should return false output when condition is not met', async () => {
        const inputs = { input: 3 };
        const config = {
          condition: 'return input > 5;',
          operator: 'custom'
        };

        const result = await nodeSystem.executeCondition('node1', inputs, config);
        
        expect(result.false).toBe(3);
        expect(result.true).toBeUndefined();
      });

      it('should handle operator-based conditions', async () => {
        const inputs = { input: 10 };
        const config = {
          condition: '10',
          operator: 'equals'
        };

        const result = await nodeSystem.executeCondition('node1', inputs, config);
        
        expect(result.true).toBe(10);
      });
    });

    describe('executeDelay', () => {
      it('should delay execution and pass through input', async () => {
        const inputs = { input: 'test data' };
        const config = {
          delay: 100,
          unit: 'milliseconds'
        };

        const startTime = Date.now();
        const result = await nodeSystem.executeDelay('node1', inputs, config);
        const endTime = Date.now();
        
        expect(result.output).toBe('test data');
        expect(endTime - startTime).toBeGreaterThanOrEqual(100);
      });

      it('should convert delay units correctly', async () => {
        const inputs = { input: 'test' };
        const config = {
          delay: 1,
          unit: 'seconds'
        };

        const startTime = Date.now();
        await nodeSystem.executeDelay('node1', inputs, config);
        const endTime = Date.now();
        
        expect(endTime - startTime).toBeGreaterThanOrEqual(1000);
      });
    });

    describe('executeTransform', () => {
      it('should transform data to JSON', async () => {
        const inputs = { input: { key: 'value' } };
        const config = {
          transformType: 'json',
          expression: ''
        };

        const result = await nodeSystem.executeTransform('node1', inputs, config);
        
        expect(typeof result.output).toBe('string');
        expect(JSON.parse(result.output)).toEqual({ key: 'value' });
      });

      it('should handle custom transformations', async () => {
        const inputs = { input: { a: 1, b: 2 } };
        const config = {
          transformType: 'custom',
          expression: 'return input.a + input.b;'
        };

        const result = await nodeSystem.executeTransform('node1', inputs, config);
        
        expect(result.output).toBe(3);
      });
    });

    describe('executeFilter', () => {
      it('should filter array based on expression', async () => {
        const inputs = { input: [1, 2, 3, 4, 5] };
        const config = {
          filterExpression: 'return item > 2;',
          limit: 100
        };

        const result = await nodeSystem.executeFilter('node1', inputs, config);
        
        expect(result.output).toEqual([3, 4, 5]);
      });

      it('should respect limit parameter', async () => {
        const inputs = { input: [1, 2, 3, 4, 5] };
        const config = {
          filterExpression: 'return item > 0;',
          limit: 3
        };

        const result = await nodeSystem.executeFilter('node1', inputs, config);
        
        expect(result.output.length).toBe(3);
      });

      it('should throw error for non-array input', async () => {
        const inputs = { input: 'not an array' };
        const config = {
          filterExpression: 'return true;',
          limit: 100
        };

        await expect(nodeSystem.executeFilter('node1', inputs, config))
          .rejects.toThrow('Filter input must be an array');
      });
    });

    describe('executeAggregate', () => {
      it('should merge objects', async () => {
        const inputs = {
          input1: { a: 1, b: 2 },
          input2: { c: 3, d: 4 }
        };
        const config = {
          operation: 'merge',
          expression: ''
        };

        const result = await nodeSystem.executeAggregate('node1', inputs, config);
        
        expect(result.output).toEqual({ a: 1, b: 2, c: 3, d: 4 });
      });

      it('should concatenate arrays', async () => {
        const inputs = {
          input1: [1, 2, 3],
          input2: [4, 5, 6]
        };
        const config = {
          operation: 'concat',
          expression: ''
        };

        const result = await nodeSystem.executeAggregate('node1', inputs, config);
        
        expect(result.output).toEqual([1, 2, 3, 4, 5, 6]);
      });

      it('should add numbers', async () => {
        const inputs = {
          input1: 10,
          input2: 20
        };
        const config = {
          operation: 'add',
          expression: ''
        };

        const result = await nodeSystem.executeAggregate('node1', inputs, config);
        
        expect(result.output).toBe(30);
      });
    });

    describe('executeLoop', () => {
      it('should iterate over array', async () => {
        const inputs = { input: [1, 2, 3, 4, 5] };
        const config = {
          maxIterations: 1000,
          breakCondition: 'return false;'
        };

        const result = await nodeSystem.executeLoop('node1', inputs, config);
        
        expect(result.output).toEqual([1, 2, 3, 4, 5]);
      });

      it('should respect maxIterations', async () => {
        const inputs = { input: [1, 2, 3, 4, 5] };
        const config = {
          maxIterations: 3,
          breakCondition: 'return false;'
        };

        const result = await nodeSystem.executeLoop('node1', inputs, config);
        
        expect(result.output.length).toBe(3);
      });

      it('should throw error for non-array input', async () => {
        const inputs = { input: 'not an array' };
        const config = {
          maxIterations: 1000,
          breakCondition: 'return false;'
        };

        await expect(nodeSystem.executeLoop('node1', inputs, config))
          .rejects.toThrow('Loop input must be an array');
      });
    });

    describe('executeOutput', () => {
      it('should store output in execution context', async () => {
        const inputs = { input: { result: 'final data' } };
        const config = {
          outputType: 'json',
          filename: 'output.json'
        };

        const result = await nodeSystem.executeOutput('node1', inputs, config);
        
        expect(result.success).toBe(true);
        expect(nodeSystem.executionContext.get('finalOutput')).toBeDefined();
        expect(nodeSystem.executionContext.get('finalOutput').data).toEqual({ result: 'final data' });
      });
    });
  });

  describe('input/output handling', () => {
    it('should have correct input definitions for each node type', () => {
      const chatAgent = nodeSystem.getNodeType('chat-agent');
      
      expect(chatAgent.inputs).toBeDefined();
      expect(Array.isArray(chatAgent.inputs)).toBe(true);
      expect(chatAgent.inputs.some(input => input.name === 'message')).toBe(true);
    });

    it('should have correct output definitions for each node type', () => {
      const chatAgent = nodeSystem.getNodeType('chat-agent');
      
      expect(chatAgent.outputs).toBeDefined();
      expect(Array.isArray(chatAgent.outputs)).toBe(true);
      expect(chatAgent.outputs.some(output => output.name === 'response')).toBe(true);
    });
  });

  describe('error propagation', () => {
    it('should propagate errors from node execution', async () => {
      const inputs = { input: 'test' };
      const config = {
        transformType: 'custom',
        expression: 'throw new Error("Test error");'
      };

      await expect(nodeSystem.executeTransform('node1', inputs, config))
        .rejects.toThrow('Transform execution failed');
    });

    it('should include error context in error messages', async () => {
      const inputs = { input: 'not an array' };
      const config = {
        filterExpression: 'return true;',
        limit: 100
      };

      try {
        await nodeSystem.executeFilter('node1', inputs, config);
      } catch (error) {
        expect(error.message).toContain('Filter execution failed');
      }
    });
  });

  describe('helper methods', () => {
    it('should evaluate conditions correctly', () => {
      expect(nodeSystem.evaluateCondition(10, 'equals', 10)).toBe(true);
      expect(nodeSystem.evaluateCondition(10, 'not_equals', 5)).toBe(true);
      expect(nodeSystem.evaluateCondition(10, 'greater_than', 5)).toBe(true);
      expect(nodeSystem.evaluateCondition(5, 'less_than', 10)).toBe(true);
      expect(nodeSystem.evaluateCondition('hello world', 'contains', 'world')).toBe(true);
    });

    it('should group data correctly', () => {
      const data = [
        { category: 'A', value: 1 },
        { category: 'B', value: 2 },
        { category: 'A', value: 3 }
      ];
      
      const grouped = nodeSystem.groupData(data, 'item.category');
      
      expect(grouped.A).toHaveLength(2);
      expect(grouped.B).toHaveLength(1);
    });
  });
});
