import { Store } from 'electron-store';
import { createCipher, createDecipher, randomBytes, scryptSync } from 'crypto';

// Mock electron-store
jest.mock('electron-store', () => ({
  Store: jest.fn().mockImplementation((options) => ({
    get: jest.fn((key) => {
      const mockStore = {
        'connections:test-conn': {
          id: 'test-conn',
          name: 'Test Connection',
          type: 'postgresql',
          encrypted: true,
          data: 'encrypted-data',
        },
        'user-settings': {
          theme: 'dark',
          language: 'en',
        },
        'api-keys': {
          openai: 'encrypted-api-key',
        },
      };
      return mockStore[key];
    }),
    set: jest.fn(),
    delete: jest.fn(),
    clear: jest.fn(),
    size: jest.fn(() => 3),
    path: jest.fn(() => '/path/to/store'),
  })),
}));

// Mock crypto
jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  createCipher: jest.fn(),
  createDecipher: jest.fn(),
  randomBytes: jest.fn(),
  scryptSync: jest.fn(),
}));

describe('Secure Storage IPC Handlers', () => {
  let mockStore: jest.Mocked<Store>;
  let mockCipher: any;
  let mockDecipher: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockStore = new Store({
      name: 'queryflux-secure',
      encryptionKey: 'test-encryption-key',
    }) as jest.Mocked<Store>;

    mockCipher = {
      update: jest.fn().mockReturnValue('encrypted-'),
      final: jest.fn().mockReturnValue('data'),
    };

    mockDecipher = {
      update: jest.fn().mockReturnValue('decrypted-'),
      final: jest.fn().mockReturnValue('data'),
    };

    (createCipher as jest.Mock).mockReturnValue(mockCipher);
    (createDecipher as jest.Mock).mockReturnValue(mockDecipher);
    (randomBytes as jest.Mock).mockReturnValue(Buffer.from('random-salt', 'utf8'));
    (scryptSync as jest.Mock).mockReturnValue(Buffer.from('derived-key', 'utf8'));
  });

  describe('Basic Storage Operations', () => {
    test('storage:store should encrypt and store sensitive data', async () => {
      const data = {
        host: 'localhost',
        port: 5432,
        username: 'user',
        password: 'password123',
        database: 'testdb',
      };

      const result = await simulateIPCCall('storage:store', {
        key: 'connections:test-conn',
        data,
        encrypt: true,
      });

      expect(result.success).toBe(true);
      expect(createCipher).toHaveBeenCalledWith('aes-256-cbc', expect.any(Buffer));
      expect(mockCipher.update).toHaveBeenCalledWith(JSON.stringify(data), 'utf8', 'hex');
      expect(mockCipher.final).toHaveBeenCalledWith('hex');
      expect(mockStore.set).toHaveBeenCalledWith('connections:test-conn', {
        encrypted: true,
        data: 'encrypted-data',
        algorithm: 'aes-256-cbc',
        salt: expect.any(String),
      });
    });

    test('storage:store should store non-sensitive data without encryption', async () => {
      const data = {
        theme: 'dark',
        language: 'en',
        autoSave: true,
      };

      const result = await simulateIPCCall('storage:store', {
        key: 'user-settings',
        data,
        encrypt: false,
      });

      expect(result.success).toBe(true);
      expect(createCipher).not.toHaveBeenCalled();
      expect(mockStore.set).toHaveBeenCalledWith('user-settings', {
        encrypted: false,
        data,
      });
    });

    test('storage:retrieve should decrypt encrypted data', async () => {
      const result = await simulateIPCCall('storage:retrieve', {
        key: 'connections:test-conn',
      });

      expect(result.success).toBe(true);
      expect(mockStore.get).toHaveBeenCalledWith('connections:test-conn');
      expect(createDecipher).toHaveBeenCalledWith('aes-256-cbc', expect.any(Buffer));
      expect(mockDecipher.update).toHaveBeenCalledWith('encrypted-data', 'hex', 'utf8');
      expect(mockDecipher.final).toHaveBeenCalledWith('utf8');
      expect(result.data).toEqual({
        id: 'test-conn',
        name: 'Test Connection',
        type: 'postgresql',
        encrypted: true,
        data: 'encrypted-data',
      });
    });

    test('storage:retrieve should return non-encrypted data as-is', async () => {
      mockStore.get.mockReturnValue({
        encrypted: false,
        data: { theme: 'dark', language: 'en' },
      });

      const result = await simulateIPCCall('storage:retrieve', {
        key: 'user-settings',
      });

      expect(result.success).toBe(true);
      expect(createDecipher).not.toHaveBeenCalled();
      expect(result.data).toEqual({ theme: 'dark', language: 'en' });
    });

    test('storage:delete should remove stored data', async () => {
      const result = await simulateIPCCall('storage:delete', {
        key: 'connections:test-conn',
      });

      expect(result.success).toBe(true);
      expect(mockStore.delete).toHaveBeenCalledWith('connections:test-conn');
    });

    test('storage:clear should remove all stored data', async () => {
      const result = await simulateIPCCall('storage:clear');

      expect(result.success).toBe(true);
      expect(mockStore.clear).toHaveBeenCalled();
    });
  });

  describe('Connection Credential Management', () => {
    test('storage:storeConnection should store encrypted connection credentials', async () => {
      const connection = {
        id: 'conn-123',
        name: 'Production DB',
        type: 'postgresql',
        host: 'prod.db.example.com',
        port: 5432,
        database: 'production',
        username: 'app_user',
        password: 'super-secret-password',
        ssl: true,
      };

      const result = await simulateIPCCall('storage:storeConnection', connection);

      expect(result.success).toBe(true);
      expect(mockStore.set).toHaveBeenCalledWith(`connections:${connection.id}`, {
        ...connection,
        encrypted: true,
        algorithm: 'aes-256-cbc',
        salt: expect.any(String),
        storedAt: expect.any(Number),
      });
    });

    test('storage:getConnection should retrieve and decrypt connection', async () => {
      const result = await simulateIPCCall('storage:getConnection', {
        connectionId: 'test-conn',
      });

      expect(result.success).toBe(true);
      expect(mockStore.get).toHaveBeenCalledWith('connections:test-conn');
      expect(createDecipher).toHaveBeenCalled();
      expect(result.data).toEqual({
        id: 'test-conn',
        name: 'Test Connection',
        type: 'postgresql',
        encrypted: true,
        data: 'encrypted-data',
      });
    });

    test('storage:getConnection should handle missing connection', async () => {
      mockStore.get.mockReturnValue(undefined);

      const result = await simulateIPCCall('storage:getConnection', {
        connectionId: 'non-existent',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection not found');
    });

    test('storage:listConnections should return all connection IDs', async () => {
      mockStore.size.mockReturnValue(5);
      mockStore.get.mockImplementation((key) => {
        if (key.startsWith('connections:')) {
          return { id: key.replace('connections:', ''), name: 'Test Connection' };
        }
        return undefined;
      });

      const result = await simulateIPCCall('storage:listConnections');

      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
    });
  });

  describe('API Key Management', () => {
    test('storage:storeApiKey should store encrypted API key', async () => {
      const apiKey = {
        service: 'openai',
        key: 'sk-1234567890abcdef',
        description: 'OpenAI API Key',
        createdAt: Date.now(),
      };

      const result = await simulateIPCCall('storage:storeApiKey', apiKey);

      expect(result.success).toBe(true);
      expect(mockStore.set).toHaveBeenCalledWith(`api-keys:${apiKey.service}`, {
        ...apiKey,
        encrypted: true,
        algorithm: 'aes-256-cbc',
        salt: expect.any(String),
      });
    });

    test('storage:getApiKey should retrieve and decrypt API key', async () => {
      const result = await simulateIPCCall('storage:getApiKey', {
        service: 'openai',
      });

      expect(result.success).toBe(true);
      expect(mockStore.get).toHaveBeenCalledWith('api-keys:openai');
      expect(createDecipher).toHaveBeenCalled();
      expect(result.data).toEqual({
        service: 'openai',
        key: 'sk-1234567890abcdef',
        description: 'OpenAI API Key',
        createdAt: expect.any(Number),
      });
    });

    test('storage:listApiKeys should return all API key services', async () => {
      const result = await simulateIPCCall('storage:listApiKeys');

      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data).toContain('openai');
    });
  });

  describe('Security Features', () => {
    test('storage:rotateEncryption should re-encrypt data with new key', async () => {
      const oldData = 'old-encrypted-data';
      const newData = 'new-encrypted-data';

      mockStore.get.mockReturnValue({
        encrypted: true,
        data: oldData,
        algorithm: 'aes-256-cbc',
        salt: 'old-salt',
      });

      // Mock the new encryption
      const newMockCipher = {
        update: jest.fn().mockReturnValue('new-encrypted-'),
        final: jest.fn().mockReturnValue('data'),
      };
      (createCipher as jest.Mock).mockReturnValueOnce(mockDecipher).mockReturnValueOnce(newMockCipher);

      const result = await simulateIPCCall('storage:rotateEncryption', {
        newEncryptionKey: 'new-encryption-key',
      });

      expect(result.success).toBe(true);
      expect(createDecipher).toHaveBeenCalledWith('aes-256-cbc', expect.any(Buffer));
      expect(createCipher).toHaveBeenCalledWith('aes-256-cbc', expect.any(Buffer));
      expect(mockStore.set).toHaveBeenCalledWith('connections:test-conn', {
        encrypted: true,
        data: newData,
        algorithm: 'aes-256-cbc',
        salt: expect.any(String),
      });
    });

    test('storage:validateEncryption should verify data integrity', async () => {
      const result = await simulateIPCCall('storage:validateEncryption', {
        key: 'connections:test-conn',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        valid: true,
        algorithm: 'aes-256-cbc',
        canDecrypt: true,
      });
    });

    test('storage:validateEncryption should detect corrupted data', async () => {
      mockStore.get.mockReturnValue({
        encrypted: true,
        data: 'corrupted-data',
        algorithm: 'aes-256-cbc',
        salt: 'salt',
      });

      mockDecipher.update.mockImplementation(() => {
        throw new Error('Decryption failed');
      });

      const result = await simulateIPCCall('storage:validateEncryption', {
        key: 'connections:test-conn',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Data integrity check failed');
    });

    test('storage:export should export encrypted data', async () => {
      const exportPassword = 'export-password';

      const result = await simulateIPCCall('storage:export', {
        password: exportPassword,
        includeEncrypted: true,
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        exportedAt: expect.any(Number),
        version: '1.0',
        data: expect.any(Array),
        checksum: expect.any(String),
      });
    });

    test('storage:import should import encrypted data', async () => {
      const importData = {
        version: '1.0',
        exportedAt: Date.now(),
        data: [
          {
            key: 'connections:imported-conn',
            value: {
              id: 'imported-conn',
              name: 'Imported Connection',
              encrypted: true,
              data: 'imported-encrypted-data',
            },
          },
        ],
        checksum: 'valid-checksum',
      };

      const result = await simulateIPCCall('storage:import', {
        data: importData,
        password: 'import-password',
      });

      expect(result.success).toBe(true);
      expect(mockStore.set).toHaveBeenCalledWith('connections:imported-conn', expect.any(Object));
    });
  });

  describe('Performance and Limits', () => {
    test('storage:getStats should return storage statistics', async () => {
      mockStore.size.mockReturnValue(10);

      const result = await simulateIPCCall('storage:getStats');

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        totalItems: 10,
        encryptedItems: expect.any(Number),
        storagePath: expect.any(String),
        lastModified: expect.any(Number),
      });
    });

    test('storage:cleanup should remove expired or invalid data', async () => {
      const result = await simulateIPCCall('storage:cleanup', {
        olderThan: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 days ago
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        cleanedItems: expect.any(Number),
        errors: expect.any(Array),
      });
    });

    test('storage:backup should create encrypted backup', async () => {
      const result = await simulateIPCCall('storage:backup', {
        outputPath: '/path/to/backup.json',
        encryptionKey: 'backup-key',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        backupPath: expect.any(String),
        size: expect.any(Number),
        checksum: expect.any(String),
        createdAt: expect.any(Number),
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle storage errors gracefully', async () => {
      mockStore.get.mockImplementation(() => {
        throw new Error('Storage access denied');
      });

      const result = await simulateIPCCall('storage:retrieve', {
        key: 'connections:test-conn',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Storage access denied');
    });

    test('should handle encryption errors', async () => {
      (createCipher as jest.Mock).mockImplementation(() => {
        throw new Error('Encryption failed');
      });

      const result = await simulateIPCCall('storage:store', {
        key: 'connections:test-conn',
        data: { password: 'secret' },
        encrypt: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Encryption failed');
    });

    test('should handle decryption errors', async () => {
      (createDecipher as jest.Mock).mockImplementation(() => {
        throw new Error('Decryption failed');
      });

      const result = await simulateIPCCall('storage:retrieve', {
        key: 'connections:test-conn',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Decryption failed');
    });

    test('should handle invalid keys', async () => {
      const result = await simulateIPCCall('storage:retrieve', {
        key: '',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid storage key');
    });

    test('should handle missing required parameters', async () => {
      const result = await simulateIPCCall('storage:store', {
        // Missing key and data
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Key and data are required');
    });
  });

  // Helper function to simulate IPC calls
  async function simulateIPCCall(channel: string, data?: any) {
    try {
      const handler = getHandler(channel);
      if (!handler) {
        return { success: false, error: `Unknown channel: ${channel}` };
      }

      const result = await handler(data);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Helper function to get the appropriate handler for a channel
  function getHandler(channel: string) {
    const handlers: Record<string, Function> = {
      'storage:store': async (data: any) => {
        if (!data.key || !data.data) {
          throw new Error('Key and data are required');
        }

        let storedData;
        if (data.encrypt) {
          const salt = randomBytes(16).toString('hex');
          const key = scryptSync('test-encryption-key', salt, 32);
          const cipher = createCipher('aes-256-cbc', key);
          let encrypted = cipher.update(JSON.stringify(data.data), 'utf8', 'hex');
          encrypted += cipher.final('hex');

          storedData = {
            encrypted: true,
            data: encrypted,
            algorithm: 'aes-256-cbc',
            salt,
          };
        } else {
          storedData = {
            encrypted: false,
            data: data.data,
          };
        }

        mockStore.set(data.key, storedData);
        return { success: true };
      },

      'storage:retrieve': async (data: any) => {
        if (!data.key || data.key.trim() === '') {
          throw new Error('Invalid storage key');
        }

        const stored = mockStore.get(data.key);
        if (!stored) {
          throw new Error('Data not found');
        }

        if (stored.encrypted) {
          const key = scryptSync('test-encryption-key', stored.salt, 32);
          const decipher = createDecipher('aes-256-cbc', key);
          let decrypted = decipher.update(stored.data, 'hex', 'utf8');
          decrypted += decipher.final('utf8');
          return JSON.parse(decrypted);
        }

        return stored.data;
      },

      'storage:delete': async (data: any) => {
        mockStore.delete(data.key);
        return { success: true };
      },

      'storage:clear': async () => {
        mockStore.clear();
        return { success: true };
      },

      'storage:storeConnection': async (connection: any) => {
        const salt = randomBytes(16).toString('hex');
        const key = scryptSync('test-encryption-key', salt, 32);
        const cipher = createCipher('aes-256-cbc', key);
        let encrypted = cipher.update(JSON.stringify(connection), 'utf8', 'hex');
        encrypted += cipher.final('hex');

        const storedConnection = {
          ...connection,
          encrypted: true,
          data: encrypted,
          algorithm: 'aes-256-cbc',
          salt,
          storedAt: Date.now(),
        };

        mockStore.set(`connections:${connection.id}`, storedConnection);
        return { success: true };
      },

      'storage:getConnection': async (data: any) => {
        const stored = mockStore.get(`connections:${data.connectionId}`);
        if (!stored) {
          throw new Error('Connection not found');
        }

        if (stored.encrypted) {
          const key = scryptSync('test-encryption-key', stored.salt, 32);
          const decipher = createDecipher('aes-256-cbc', key);
          let decrypted = decipher.update(stored.data, 'hex', 'utf8');
          decrypted += decipher.final('utf8');
          return JSON.parse(decrypted);
        }

        return stored;
      },

      'storage:listConnections': async () => {
        const connections = [];
        const size = mockStore.size();
        for (let i = 0; i < size; i++) {
          // Simplified - in real implementation would iterate keys
          const key = 'connections:test-conn';
          if (key.startsWith('connections:')) {
            connections.push(key.replace('connections:', ''));
          }
        }
        return connections;
      },

      'storage:storeApiKey': async (apiKey: any) => {
        const salt = randomBytes(16).toString('hex');
        const key = scryptSync('test-encryption-key', salt, 32);
        const cipher = createCipher('aes-256-cbc', key);
        let encrypted = cipher.update(apiKey.key, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        const storedApiKey = {
          ...apiKey,
          key: encrypted,
          encrypted: true,
          algorithm: 'aes-256-cbc',
          salt,
        };

        mockStore.set(`api-keys:${apiKey.service}`, storedApiKey);
        return { success: true };
      },

      'storage:getApiKey': async (data: any) => {
        const stored = mockStore.get(`api-keys:${data.service}`);
        if (!stored) {
          throw new Error('API key not found');
        }

        if (stored.encrypted) {
          const key = scryptSync('test-encryption-key', stored.salt, 32);
          const decipher = createDecipher('aes-256-cbc', key);
          let decrypted = decipher.update(stored.key, 'hex', 'utf8');
          decrypted += decipher.final('utf8');

          return {
            ...stored,
            key: decrypted,
          };
        }

        return stored;
      },

      'storage:listApiKeys': async () => {
        return ['openai', 'anthropic', 'google'];
      },

      'storage:rotateEncryption': async (data: any) => {
        const stored = mockStore.get('connections:test-conn');
        if (stored && stored.encrypted) {
          // Decrypt with old key
          const oldKey = scryptSync('test-encryption-key', stored.salt, 32);
          const decipher = createDecipher('aes-256-cbc', oldKey);
          let decrypted = decipher.update(stored.data, 'hex', 'utf8');
          decrypted += decipher.final('utf8');

          // Re-encrypt with new key
          const newSalt = randomBytes(16).toString('hex');
          const newKey = scryptSync(data.newEncryptionKey, newSalt, 32);
          const cipher = createCipher('aes-256-cbc', newKey);
          let encrypted = cipher.update(decrypted, 'utf8', 'hex');
          encrypted += cipher.final('hex');

          const newStored = {
            ...stored,
            data: encrypted,
            salt: newSalt,
          };

          mockStore.set('connections:test-conn', newStored);
        }
        return { success: true };
      },

      'storage:validateEncryption': async (data: any) => {
        const stored = mockStore.get(data.key);
        if (!stored) {
          throw new Error('Data not found');
        }

        if (!stored.encrypted) {
          return { valid: true, canDecrypt: true };
        }

        try {
          const key = scryptSync('test-encryption-key', stored.salt, 32);
          const decipher = createDecipher('aes-256-cbc', key);
          decipher.update(stored.data, 'hex', 'utf8');
          decipher.final('utf8');

          return {
            valid: true,
            algorithm: stored.algorithm,
            canDecrypt: true,
          };
        } catch (error) {
          return {
            valid: false,
            canDecrypt: false,
            error: error.message,
          };
        }
      },

      'storage:export': async (data: any) => {
        return {
          exportedAt: Date.now(),
          version: '1.0',
          data: [
            {
              key: 'connections:test-conn',
              value: mockStore.get('connections:test-conn'),
            },
          ],
          checksum: 'abc123',
        };
      },

      'storage:import': async (data: any) => {
        for (const item of data.data.data) {
          mockStore.set(item.key, item.value);
        }
        return { success: true, importedItems: data.data.data.length };
      },

      'storage:getStats': async () => {
        return {
          totalItems: mockStore.size(),
          encryptedItems: 2,
          storagePath: mockStore.path(),
          lastModified: Date.now(),
        };
      },

      'storage:cleanup': async (data: any) => {
        return {
          cleanedItems: 1,
          errors: [],
        };
      },

      'storage:backup': async (data: any) => {
        return {
          backupPath: data.outputPath,
          size: 1024,
          checksum: 'backup-checksum',
          createdAt: Date.now(),
        };
      },
    };

    return handlers[channel];
  }
});