// Tests for BaseClient

import { BaseClient } from '../../src/client/base';
import { SDLCConfig } from '../../src/types';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('BaseClient', () => {
  let client: BaseClient;
  let config: SDLCConfig;

  beforeEach(() => {
    config = {
      baseURL: 'https://api.sdlc.ai',
      apiKey: 'test-api-key',
      timeout: 5000,
      retries: 3,
      retryDelay: 1000
    };

    mockedAxios.create = jest.fn().mockReturnValue({
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() }
      },
      defaults: {
        baseURL: config.baseURL,
        timeout: config.timeout,
        headers: {}
      }
    });

    client = new BaseClient(config);
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      expect(client).toBeDefined();
    });

    it('should normalize configuration with defaults', () => {
      const minimalConfig = { baseURL: 'https://api.sdlc.ai' };
      const clientWithMinimalConfig = new BaseClient(minimalConfig);
      const normalizedConfig = clientWithMinimalConfig.getConfig();

      expect(normalizedConfig.timeout).toBe(30000);
      expect(normalizedConfig.retries).toBe(3);
      expect(normalizedConfig.environment).toBe('production');
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', () => {
      const newConfig = { timeout: 10000, retries: 5 };
      client.updateConfig(newConfig);

      const updatedConfig = client.getConfig();
      expect(updatedConfig.timeout).toBe(10000);
      expect(updatedConfig.retries).toBe(5);
    });
  });

  describe('healthCheck', () => {
    it('should return true when health check succeeds', async () => {
      mockedAxios.create.mockReturnValueOnce({
        interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
        get: jest.fn().mockResolvedValue({ status: 200 })
      } as any);

      const isHealthy = await client.healthCheck();
      expect(isHealthy).toBe(true);
    });

    it('should return false when health check fails', async () => {
      mockedAxios.create.mockReturnValueOnce({
        interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
        get: jest.fn().mockRejectedValue(new Error('Health check failed'))
      } as any);

      const isHealthy = await client.healthCheck();
      expect(isHealthy).toBe(false);
    });
  });

  describe('close', () => {
    it('should clean up resources', () => {
      const removeAllListenersSpy = jest.spyOn(client as any, 'removeAllListeners');
      client.close();

      expect(removeAllListenersSpy).toHaveBeenCalled();
    });
  });
});
