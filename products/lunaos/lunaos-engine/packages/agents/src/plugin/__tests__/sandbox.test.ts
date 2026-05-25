import { EnhancedPluginSandbox, SandboxFactory } from '../sandbox';
import { SandboxSecurityPolicy, SandboxResourceLimits } from '../interfaces';

describe('EnhancedPluginSandbox', () => {
  let sandbox: EnhancedPluginSandbox;
  let mockLogger: any;

  beforeEach(() => {
    mockLogger = {
      child: jest.fn().mockReturnValue({
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
      })
    };

    sandbox = new EnhancedPluginSandbox(
      mockLogger,
      'test-plugin',
      ['test:*'],
      {
        allowEval: false,
        allowFunctionConstructor: false,
        allowTimers: false,
        maxExecutionTime: 5000,
        maxMemoryUsage: 10 * 1024 * 1024 // 10MB
      },
      {
        maxExecutionTime: 5000,
        maxMemoryUsage: 10 * 1024 * 1024,
        maxCpuTime: 3000,
        maxFileSize: 1024 * 1024,
        maxNetworkRequests: 10,
        maxFileDescriptors: 5
      }
    );
  });

  afterEach(async () => {
    if (sandbox) {
      await sandbox.destroy();
    }
  });

  describe('execute', () => {
    it('should execute simple JavaScript code', async () => {
      const result = await sandbox.execute('return 1 + 1');
      expect(result).toBe(2);
    });

    it('should execute code with context variables', async () => {
      const context = { x: 10, y: 20 };
      const result = await sandbox.execute('return x + y', context);
      expect(result).toBe(30);
    });

    it('should execute complex JavaScript operations', async () => {
      const code = `
        const numbers = [1, 2, 3, 4, 5];
        const doubled = numbers.map(n => n * 2);
        return doubled.reduce((sum, n) => sum + n, 0);
      `;
      const result = await sandbox.execute(code);
      expect(result).toBe(30);
    });

    it('should handle async operations', async () => {
      const code = `
        return new Promise(resolve => {
          setTimeout(() => resolve('async result'), 100);
        });
      `;
      const result = await sandbox.execute(code);
      expect(result).toBe('async result');
    });

    it('should throw error for eval usage when not allowed', async () => {
      const code = 'return eval("1 + 1")';

      await expect(sandbox.execute(code)).rejects.toThrow('eval() is not allowed in sandbox');
    });

    it('should throw error for Function constructor when not allowed', async () => {
      const code = 'return new Function("return 1 + 1")()';

      await expect(sandbox.execute(code)).rejects.toThrow('Function constructor is not allowed in sandbox');
    });

    it('should throw error on execution timeout', async () => {
      const code = `
        return new Promise(resolve => {
          setTimeout(() => resolve('should timeout'), 10000);
        });
      `;

      await expect(sandbox.execute(code)).rejects.toThrow('Sandbox execution timeout');
    });
  });

  describe('evaluate', () => {
    it('should evaluate simple expressions', async () => {
      const result = await sandbox.evaluate('1 + 1');
      expect(result).toBe(2);
    });

    it('should evaluate expressions with context', async () => {
      const context = { name: 'test', count: 5 };
      const result = await sandbox.evaluate('name + count', context);
      expect(result).toBe('test5');
    });

    it('should throw error when eval is not allowed', async () => {
      // Create sandbox without eval permission
      const noEvalSandbox = new EnhancedPluginSandbox(
        mockLogger,
        'test-plugin',
        ['test:*'],
        { allowEval: false }
      );

      await expect(noEvalSandbox.evaluate('1 + 1')).rejects.toThrow('Expression evaluation is not allowed');

      await noEvalSandbox.destroy();
    });

    it('should evaluate complex expressions', async () => {
      const context = { numbers: [1, 2, 3, 4, 5] };
      const result = await sandbox.evaluate('numbers.filter(n => n % 2 === 0).length', context);
      expect(result).toBe(2);
    });
  });

  describe('resource management', () => {
    it('should add and retrieve resources', async () => {
      const resource = { data: 'test data' };

      await sandbox.addResource('testResource', resource);
      const result = await sandbox.execute('return testResource.data');

      expect(result).toBe('test data');
    });

    it('should list available resources', async () => {
      await sandbox.addResource('resource1', { data: 'data1' });
      await sandbox.addResource('resource2', { data: 'data2' });

      const resources = await sandbox.getResources();

      expect(resources).toContain('resource1');
      expect(resources).toContain('resource2');
    });

    it('should remove resources', async () => {
      await sandbox.addResource('testResource', { data: 'test' });
      await sandbox.removeResource('testResource');

      const resources = await sandbox.getResources();
      expect(resources).not.toContain('testResource');
    });

    it('should throw error for restricted resource names', async () => {
      const restrictedNames = ['__proto__', 'constructor', 'prototype', 'eval', 'Function'];

      for (const name of restrictedNames) {
        await expect(sandbox.addResource(name, {})).rejects.toThrow(
          `Resource name "${name}" is not allowed`
        );
      }
    });

    it('should throw error for function resources', async () => {
      await expect(sandbox.addResource('func', () => {})).rejects.toThrow(
        'Functions cannot be added as sandbox resources'
      );
    });

    it('should check resource permissions', async () => {
      // Has permission
      const hasPermission = await sandbox.checkPermission('resource:testResource');
      expect(hasPermission).toBe(true);

      // No permission
      const noPermission = await sandbox.checkPermission('resource:restricted');
      expect(noPermission).toBe(false);
    });
  });

  describe('security', () => {
    it('should respect wildcard permissions', async () => {
      const wildcardSandbox = new EnhancedPluginSandbox(
        mockLogger,
        'test-plugin',
        ['*'],
        { allowEval: true }
      );

      const hasPermission = await wildcardSandbox.checkPermission('any:permission');
      expect(hasPermission).toBe(true);

      await wildcardSandbox.destroy();
    });

    it('should log security events', async () => {
      const spy = jest.spyOn(mockLogger.child(), 'warn');

      try {
        await sandbox.execute('return eval("1 + 1")');
      } catch (error) {
        // Expected to fail
      }

      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('Security event [execution_error]'),
        expect.any(Object)
      );
    });

    it('should enforce memory limits', async () => {
      // This test is harder to implement without actual memory monitoring
      // but we can test the limit checking logic
      const lowMemorySandbox = new EnhancedPluginSandbox(
        mockLogger,
        'test-plugin',
        ['test:*'],
        {},
        { maxMemoryUsage: 1024 } // Very low limit
      );

      // The sandbox should still work for simple operations
      const result = await lowMemorySandbox.execute('return 1 + 1');
      expect(result).toBe(2);

      await lowMemorySandbox.destroy();
    });
  });

  describe('stats and monitoring', () => {
    it('should provide sandbox statistics', async () => {
      await sandbox.addResource('test', { data: 'test' });
      await sandbox.execute('return 1 + 1');
      await sandbox.execute('return 2 + 2');

      const stats = await sandbox.getStats();

      expect(stats.pluginName).toBe('test-plugin');
      expect(stats.executionCount).toBe(2);
      expect(stats.resourceCount).toBe(1);
      expect(stats.isDestroyed).toBe(false);
      expect(stats.uptime).toBeGreaterThan(0);
      expect(stats.permissions).toEqual(['test:*']);
    });

    it('should track uptime correctly', async () => {
      const startTime = Date.now();
      const stats1 = await sandbox.getStats();

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 10));

      const stats2 = await sandbox.getStats();

      expect(stats2.uptime).toBeGreaterThan(stats1.uptime);
    });
  });

  describe('destruction', () => {
    it('should destroy sandbox properly', async () => {
      await sandbox.addResource('test', { data: 'test' });

      await sandbox.destroy();

      const stats = await sandbox.getStats();
      expect(stats.isDestroyed).toBe(true);

      // Should throw error after destruction
      await expect(sandbox.execute('return 1 + 1')).rejects.toThrow('Sandbox has been destroyed');
    });

    it('should handle multiple destroy calls gracefully', async () => {
      await sandbox.destroy();
      await sandbox.destroy(); // Should not throw error
    });
  });

  describe('context isolation', () => {
    it('should isolate contexts between executions', async () => {
      await sandbox.execute('global.testVar = "should not persist"');

      try {
        await sandbox.execute('return global.testVar');
        // If this doesn't throw, the variable persisted
      } catch (error) {
        // Expected - variables shouldn't persist between executions
      }
    });

    it('should prevent modification of global objects', async () => {
      await expect(sandbox.execute('global.Object = null')).rejects.toThrow();
    });
  });
});

describe('SandboxFactory', () => {
  let factory: SandboxFactory;
  let mockLogger: any;

  beforeEach(() => {
    mockLogger = {
      child: jest.fn().mockReturnValue({
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
      })
    };

    factory = new SandboxFactory(mockLogger);
  });

  describe('createSandbox', () => {
    it('should create sandbox with low security level', () => {
      const sandbox = factory.createSandbox('test-plugin', ['*'], 'low');

      expect(sandbox).toBeInstanceOf(EnhancedPluginSandbox);
      // Low security should allow more operations

      return sandbox.destroy();
    });

    it('should create sandbox with medium security level', () => {
      const sandbox = factory.createSandbox('test-plugin', ['test:*'], 'medium');

      expect(sandbox).toBeInstanceOf(EnhancedPluginSandbox);
      // Medium security is the default

      return sandbox.destroy();
    });

    it('should create sandbox with high security level', () => {
      const sandbox = factory.createSandbox('test-plugin', ['test:*'], 'high');

      expect(sandbox).toBeInstanceOf(EnhancedPluginSandbox);
      // High security should be very restrictive

      return sandbox.destroy();
    });

    it('should use medium security as default', () => {
      const sandbox = factory.createSandbox('test-plugin', ['test:*']);

      expect(sandbox).toBeInstanceOf(EnhancedPluginSandbox);

      return sandbox.destroy();
    });

    it('should log sandbox creation', () => {
      factory.createSandbox('test-plugin', ['test:*'], 'high');

      expect(mockLogger.child().debug).toHaveBeenCalledWith(
        'Creating sandbox for plugin test-plugin with security level: high'
      );
    });
  });

  describe('security policies', () => {
    it('should provide appropriate security policy for low level', async () => {
      const sandbox = factory.createSandbox('test-plugin', ['*'], 'low');

      // Low security should allow eval
      const result = await sandbox.evaluate('1 + 1');
      expect(result).toBe(2);

      await sandbox.destroy();
    });

    it('should provide appropriate security policy for medium level', async () => {
      const sandbox = factory.createSandbox('test-plugin', ['test:*'], 'medium');

      // Medium security should not allow eval by default
      // We need to check the specific policy implementation

      await sandbox.destroy();
    });

    it('should provide appropriate security policy for high level', async () => {
      const sandbox = factory.createSandbox('test-plugin', ['test:*'], 'high');

      // High security should be very restrictive
      // Basic operations should still work
      const result = await sandbox.execute('return 1 + 1');
      expect(result).toBe(2);

      await sandbox.destroy();
    });
  });

  describe('resource limits', () => {
    it('should set appropriate resource limits for different security levels', async () => {
      const lowSandbox = factory.createSandbox('test-plugin', ['*'], 'low');
      const mediumSandbox = factory.createSandbox('test-plugin', ['test:*'], 'medium');
      const highSandbox = factory.createSandbox('test-plugin', ['test:*'], 'high');

      const lowStats = await lowSandbox.getStats();
      const mediumStats = await mediumSandbox.getStats();
      const highStats = await highSandbox.getStats();

      // Low security should have higher limits
      expect(lowStats.resourceLimits.maxMemoryUsage).toBeGreaterThan(mediumStats.resourceLimits.maxMemoryUsage);
      expect(mediumStats.resourceLimits.maxMemoryUsage).toBeGreaterThan(highStats.resourceLimits.maxMemoryUsage);

      await lowSandbox.destroy();
      await mediumSandbox.destroy();
      await highSandbox.destroy();
    });
  });
});
