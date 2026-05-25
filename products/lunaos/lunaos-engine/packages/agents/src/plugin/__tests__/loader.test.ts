import { PluginLoader, PluginSandbox } from '../loader';
import { IPluginManifest, PluginContext, ILogger, IEventBus, IStorage, ISecrets } from '../interfaces';
import * as fs from 'fs/promises';

// Mock implementations
const mockLogger: ILogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  child: jest.fn(() => mockLogger)
};

const mockEventBus: IEventBus = {
  emit: jest.fn(),
  on: jest.fn(),
  off: jest.fn()
};

const mockStorage: IStorage = {
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
  clear: jest.fn(),
  exists: jest.fn()
};

const mockSecrets: ISecrets = {
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
  list: jest.fn()
};

describe('PluginLoader', () => {
  let loader: PluginLoader;

  beforeEach(() => {
    jest.clearAllMocks();
    loader = new PluginLoader(mockLogger, mockEventBus, mockStorage, mockSecrets);
  });

  const createTestManifest = (type: string = 'task'): IPluginManifest => {
    return {
      name: 'test-plugin',
      version: '1.0.0',
      entryPoint: type === 'ts' ? 'index.ts' : 'index.js',
      description: 'Test plugin',
      author: 'test',
      license: 'MIT',
      permissions: ['module:crypto', 'module:path'],
      config: {},
      dependencies: [],
      tags: []
    };
  };

  describe('loadPlugin', () => {
    it('should load a JavaScript plugin', async () => {
      const manifest = createTestManifest();
      const workingDirectory = '/plugins/test-plugin';

      // Mock file reading
      const mockReadFile = jest.spyOn(fs, 'readFile');
      mockReadFile.mockResolvedValue(`
        exports.initialize = async (context) => {
          context.logger.info('Plugin initialized');
        };

        exports.start = async () => {
          console.log('Plugin started');
        };

        exports.stop = async () => {
          console.log('Plugin stopped');
        };

        exports.execute = async (request) => {
          return { result: 'success', data: request };
        };
      `);

      const plugin = await loader.loadPlugin(manifest, workingDirectory);

      expect(plugin.name).toBe('test-plugin');
      expect(plugin.version).toBe('1.0.0');
      expect(typeof plugin.initialize).toBe('function');
      expect(typeof plugin.start).toBe('function');
      expect(typeof plugin.stop).toBe('function');
      expect(typeof plugin.execute).toBe('function');

      mockReadFile.mockRestore();
    });

    it('should load a TypeScript plugin', async () => {
      const manifest = createTestManifest('ts');
      const workingDirectory = '/plugins/test-plugin';

      // Mock file reading
      const mockReadFile = jest.spyOn(fs, 'readFile');
      mockReadFile.mockResolvedValue(`
        export async function initialize(context: any) {
          context.logger.info('Plugin initialized');
        }

        export async function start() {
          console.log('Plugin started');
        }

        export async function stop() {
          console.log('Plugin stopped');
        }

        export async function execute(request: any) {
          return { result: 'success', data: request };
        }
      `);

      // Mock TypeScript transpilation
      jest.doMock('typescript', () => ({
        transpileModule: jest.fn().mockReturnValue({
          outputText: `
            exports.initialize = async (context) => {
              context.logger.info('Plugin initialized');
            };

            exports.start = async () => {
              console.log('Plugin started');
            };

            exports.stop = async () => {
              console.log('Plugin stopped');
            };

            exports.execute = async (request) => {
              return { result: 'success', data: request };
            };
          `
        })
      }));

      const plugin = await loader.loadPlugin(manifest, workingDirectory);

      expect(plugin.name).toBe('test-plugin');
      expect(plugin.version).toBe('1.0.0');
      expect(typeof plugin.initialize).toBe('function');
      expect(typeof plugin.start).toBe('function');
      expect(typeof plugin.stop).toBe('function');
      expect(typeof plugin.execute).toBe('function');

      mockReadFile.mockRestore();
      jest.clearAllMocks();
    });

    it('should handle loading errors', async () => {
      const manifest = createTestManifest();
      const workingDirectory = '/plugins/test-plugin';

      // Mock file reading error
      const mockReadFile = jest.spyOn(fs, 'readFile');
      mockReadFile.mockRejectedValue(new Error('File not found'));

      await expect(loader.loadPlugin(manifest, workingDirectory)).rejects.toThrow('File not found');

      mockReadFile.mockRestore();
    });

    it('should validate plugin exports', async () => {
      const manifest = createTestManifest();
      const workingDirectory = '/plugins/test-plugin';

      // Mock file reading with invalid exports
      const mockReadFile = jest.spyOn(fs, 'readFile');
      mockReadFile.mockResolvedValue(`
        // Missing required exports
        exports.someFunction = () => {
          return 'invalid';
        };
      `);

      await expect(loader.loadPlugin(manifest, workingDirectory)).rejects.toThrow('must export initialize function');

      mockReadFile.mockRestore();
    });
  });

  describe('safeRequire', () => {
    it('should allow whitelisted modules', async () => {
      const manifest = createTestManifest();
      const workingDirectory = '/plugins/test-plugin';

      // Mock file reading that uses whitelisted module
      const mockReadFile = jest.spyOn(fs, 'readFile');
      mockReadFile.mockResolvedValue(`
        const crypto = require('crypto');

        exports.initialize = async (context) => {
          const hash = crypto.createHash('sha256');
          context.logger.info('Plugin initialized');
        };

        exports.start = async () => {
          console.log('Plugin started');
        };

        exports.stop = async () => {
          console.log('Plugin stopped');
        };
      `);

      const plugin = await loader.loadPlugin(manifest, workingDirectory);
      expect(plugin).toBeDefined();

      mockReadFile.mockRestore();
    });

    it('should reject non-whitelisted modules', async () => {
      const manifest = createTestManifest();
      const workingDirectory = '/plugins/test-plugin';

      // Mock file reading that uses non-whitelisted module
      const mockReadFile = jest.spyOn(fs, 'readFile');
      mockReadFile.mockResolvedValue(`
        const fs = require('fs'); // Not in whitelist

        exports.initialize = async (context) => {
          context.logger.info('Plugin initialized');
        };

        exports.start = async () => {
          console.log('Plugin started');
        };

        exports.stop = async () => {
          console.log('Plugin stopped');
        };
      `);

      await expect(loader.loadPlugin(manifest, workingDirectory)).rejects.toThrow('is not allowed for plugins');

      mockReadFile.mockRestore();
    });
  });
});

describe('PluginSandbox', () => {
  let sandbox: PluginSandbox;

  beforeEach(() => {
    jest.clearAllMocks();
    sandbox = new PluginSandbox(mockLogger, 'test-plugin', ['execute:*', 'read:*']);
  });

  describe('execute', () => {
    it('should execute code in sandbox', async () => {
      const result = await sandbox.execute('return 1 + 1');

      expect(result).toBe(2);
    });

    it('should provide context to executed code', async () => {
      const context = { x: 5, y: 10 };
      const result = await sandbox.execute('return x + y', context);

      expect(result).toBe(15);
    });

    it('should handle execution errors', async () => {
      await expect(sandbox.execute('throw new Error("Test error")')).rejects.toThrow('Test error');
    });

    it('should timeout long-running executions', async () => {
      const longRunningCode = `
        // Infinite loop
        while (true) {
          // Keep looping
        }
      `;

      await expect(sandbox.execute(longRunningCode)).rejects.toThrow();
    });
  });

  describe('evaluate', () => {
    it('should evaluate expressions', async () => {
      const result = await sandbox.evaluate('Math.sqrt(16)');

      expect(result).toBe(4);
    });

    it('should evaluate expressions with context', async () => {
      const context = { name: 'test' };
      const result = await sandbox.evaluate('name.toUpperCase()', context);

      expect(result).toBe('TEST');
    });
  });

  describe('resource management', () => {
    it('should add and remove resources', async () => {
      const resource = { data: 'test' };

      await sandbox.addResource('testResource', resource);

      const resources = await sandbox.getResources();
      expect(resources).toContain('testResource');

      await sandbox.removeResource('testResource');

      const resourcesAfter = await sandbox.getResources();
      expect(resourcesAfter).not.toContain('testResource');
    });

    it('should check permissions for resources', async () => {
      // Without permission
      await expect(sandbox.addResource('restrictedResource', {})).rejects.toThrow('Permission denied');

      // With permission
      const sandboxWithPermission = new PluginSandbox(mockLogger, 'test-plugin', ['*', 'resource:restrictedResource']);
      await sandboxWithPermission.addResource('restrictedResource', {});

      const resources = await sandboxWithPermission.getResources();
      expect(resources).toContain('restrictedResource');
    });
  });

  describe('permission checking', () => {
    it('should check permissions correctly', async () => {
      // Check allowed permission
      const hasPermission = await sandbox.checkPermission('execute:test');
      expect(hasPermission).toBe(true);

      // Check denied permission
      const hasNoPermission = await sandbox.checkPermission('admin:*');
      expect(hasNoPermission).toBe(false);

      // Check wildcard permission
      const sandboxWithWildcard = new PluginSandbox(mockLogger, 'test-plugin', ['*']);
      const hasWildcardPermission = await sandboxWithWildcard.checkPermission('any:permission');
      expect(hasWildcardPermission).toBe(true);
    });
  });
});
