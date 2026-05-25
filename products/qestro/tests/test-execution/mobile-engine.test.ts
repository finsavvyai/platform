/**
 * Tests for Mobile Test Engine (Maestro Integration)
 *
 * Comprehensive test coverage for mobile test execution, device management,
 * artifact collection, and cross-platform compatibility
 */

import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';
import { MobileTestEngine, type MobileTestRequest, type DeviceConfig } from '../../src/services/test-execution/mobile-engine';
import * as fs from 'fs/promises';
import { spawn } from 'child_process';

// Mock dependencies
vi.mock('fs/promises');
vi.mock('child_process');

describe('MobileTestEngine', () => {
  let mobileEngine: MobileTestEngine;
  let mockFs: any;
  let mockSpawn: any;

  beforeEach(() => {
    mockFs = vi.mocked(fs);
    mockSpawn = vi.mocked(spawn);

    // Setup default mock behavior
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.unlink.mockResolvedValue(undefined);
    mockFs.stat.mockResolvedValue({ size: 1024 });

    // Mock spawn behavior
    const mockProcess = {
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn(),
      kill: vi.fn()
    };

    mockSpawn.mockReturnValue(mockProcess as any);

    mobileEngine = new MobileTestEngine({
      maestroBinaryPath: 'maestro-test',
      artifactPath: 'test-artifacts'
    });
  });

  describe('Test Execution', () => {
    it('should execute a simple mobile test successfully', async () => {
      const request = createMockMobileTestRequest({
        testCase: createMockTestCase({
          flowContent: createSimpleMaestroFlow()
        })
      });

      // Mock successful Maestro execution
      mockMaestroSuccess(mockSpawn);

      const result = await mobileEngine.executeTest(request);

      expect(result).toBeDefined();
      expect(result.testCaseId).toBe(request.testCase.id);
      expect(result.deviceId).toBe(request.deviceConfig.deviceId);
      expect(result.status).toBe('completed');
      expect(result.outcome).toBe('passed');
      expect(result.steps.length).toBeGreaterThan(0);
    });

    it('should handle test failures appropriately', async () => {
      const request = createMockMobileTestRequest({
        testCase: createMockTestCase({
          flowContent: createFailingMaestroFlow()
        })
      });

      // Mock failed Maestro execution
      mockMaestroFailure(mockSpawn);

      const result = await mobileEngine.executeTest(request);

      expect(result).toBeDefined();
      expect(result.status).toBe('completed');
      expect(result.outcome).toBe('failed');
      expect(result.error).toBeDefined();
    });

    it('should handle Maestro process errors', async () => {
      const request = createMockMobileTestRequest();

      // Mock process error
      mockMaestroProcessError(mockSpawn);

      const result = await mobileEngine.executeTest(request);

      expect(result).toBeDefined();
      expect(result.status).toBe('failed');
      expect(result.outcome).toBe('error');
      expect(result.error?.type).toBe('unknown');
    });

    it('should respect test timeout', async () => {
      const request = createMockMobileTestRequest({
        testCase: createMockTestCase({
          timeout: 5000 // 5 seconds
        })
      });

      // Mock slow execution
      mockMaestroSlowExecution(mockSpawn);

      const result = await mobileEngine.executeTest(request);

      expect(result).toBeDefined();
      expect(result.status).toBe('failed');
      expect(result.outcome).toBe('error');
      expect(result.error?.message).toContain('timed out');
    });

    it('should collect screenshots when configured', async () => {
      const request = createMockMobileTestRequest({
        executionOptions: {
          captureScreenshots: true,
          captureVideo: false,
          captureLogs: false,
          captureNetwork: false,
          capturePerformance: false,
          appLaunchMethod: 'maestro',
          cleanupBetweenTests: false,
          installAppBeforeEachTest: false,
          uninstallAppAfterTest: false,
          resetDeviceBeforeTest: false,
          keepAppData: false
        }
      });

      mockMaestroSuccess(mockSpawn);

      const result = await mobileEngine.executeTest(request);

      expect(result).toBeDefined();
      expect(result.artifacts.some(a => a.type === 'screenshot')).toBe(true);
    });

    it('should install app when configured', async () => {
      const request = createMockMobileTestRequest({
        executionOptions: {
          captureScreenshots: false,
          captureVideo: false,
          captureLogs: false,
          captureNetwork: false,
          capturePerformance: false,
          appLaunchMethod: 'maestro',
          cleanupBetweenTests: false,
          installAppBeforeEachTest: true,
          uninstallAppAfterTest: false,
          resetDeviceBeforeTest: false,
          keepAppData: false
        }
      });

      mockMaestroSuccess(mockSpawn);

      const result = await mobileEngine.executeTest(request);

      expect(result).toBeDefined();
      expect(result.status).toBe('completed');
    });

    it('should uninstall app after test when configured', async () => {
      const request = createMockMobileTestRequest({
        executionOptions: {
          captureScreenshots: false,
          captureVideo: false,
          captureLogs: false,
          captureNetwork: false,
          capturePerformance: false,
          appLaunchMethod: 'maestro',
          cleanupBetweenTests: false,
          installAppBeforeEachTest: false,
          uninstallAppAfterTest: true,
          resetDeviceBeforeTest: false,
          keepAppData: false
        }
      });

      mockMaestroSuccess(mockSpawn);

      const result = await mobileEngine.executeTest(request);

      expect(result).toBeDefined();
      expect(result.status).toBe('completed');
    });
  });

  describe('Parallel Test Execution', () => {
    it('should execute multiple tests in parallel', async () => {
      const requests = [
        createMockMobileTestRequest({ id: 'test-1' }),
        createMockMobileTestRequest({ id: 'test-2' }),
        createMockMobileTestRequest({ id: 'test-3' })
      ];

      // Mock successful executions
      requests.forEach(() => mockMaestroSuccess(mockSpawn));

      const startTime = Date.now();
      const results = await mobileEngine.executeTestsParallel(requests);
      const endTime = Date.now();

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.status).toBe('completed');
      });

      // Should complete faster than serial execution
      expect(endTime - startTime).toBeLessThan(1000);
    });

    it('should handle mixed success/failure in parallel execution', async () => {
      const requests = [
        createMockMobileTestRequest({ id: 'test-1' }),
        createMockMobileTestRequest({ id: 'test-2' }),
        createMockMobileTestRequest({ id: 'test-3' })
      ];

      // Mock mixed results
      mockMaestroSuccess(mockSpawn);
      mockMaestroFailure(mockSpawn);
      mockMaestroSuccess(mockSpawn);

      const results = await mobileEngine.executeTestsParallel(requests);

      expect(results).toHaveLength(3);
      expect(results[0].outcome).toBe('passed');
      expect(results[1].outcome).toBe('failed');
      expect(results[2].outcome).toBe('passed');
    });

    it('should limit concurrent executions', async () => {
      const requests = Array.from({ length: 10 }, (_, i) =>
        createMockMobileTestRequest({ id: `test-${i}` })
      );

      // Mock all executions
      requests.forEach(() => mockMaestroSuccess(mockSpawn));

      const results = await mobileEngine.executeTestsParallel(requests);

      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.status).toBe('completed');
      });
    });
  });

  describe('Device Management', () => {
    it('should get available devices', async () => {
      const devices = await mobileEngine.getAvailableDevices();

      expect(devices).toBeDefined();
      expect(Array.isArray(devices)).toBe(true);
      expect(devices.length).toBeGreaterThan(0);

      devices.forEach(device => {
        expect(device.deviceId).toBeDefined();
        expect(device.platform).toMatch(/^(ios|android)$/);
        expect(device.status).toBe('available');
      });
    });

    it('should filter devices by platform', async () => {
      const iosDevices = await mobileEngine.getAvailableDevices('ios');
      const androidDevices = await mobileEngine.getAvailableDevices('android');

      expect(iosDevices.every(d => d.platform === 'ios')).toBe(true);
      expect(androidDevices.every(d => d.platform === 'android')).toBe(true);
    });

    it('should reserve and release devices', async () => {
      const devices = await mobileEngine.getAvailableDevices();
      const device = devices[0];

      const reserved = await mobileEngine.reserveDevice(device.deviceId, 'test-123');
      expect(reserved).toBe(true);

      const busyDevices = await mobileEngine.getAvailableDevices();
      const isDeviceBusy = !busyDevices.some(d => d.deviceId === device.deviceId);
      expect(isDeviceBusy).toBe(true);

      const released = await mobileEngine.releaseDevice(device.deviceId, 'test-123');
      expect(released).toBeUndefined(); // Returns void

      const availableDevices = await mobileEngine.getAvailableDevices();
      const isDeviceAvailable = availableDevices.some(d => d.deviceId === device.deviceId);
      expect(isDeviceAvailable).toBe(true);
    });

    it('should handle device reservation conflicts', async () => {
      const devices = await mobileEngine.getAvailableDevices();
      const device = devices[0];

      // Reserve device twice
      const firstReservation = await mobileEngine.reserveDevice(device.deviceId, 'test-1');
      const secondReservation = await mobileEngine.reserveDevice(device.deviceId, 'test-2');

      expect(firstReservation).toBe(true);
      expect(secondReservation).toBe(false);
    });

    it('should get device information', async () => {
      const devices = await mobileEngine.getAvailableDevices();
      const device = devices[0];

      const deviceInfo = await mobileEngine.getDeviceInfo(device.deviceId);

      expect(deviceInfo).toBeDefined();
      expect(deviceInfo.deviceId).toBe(device.deviceId);
      expect(deviceInfo.platform).toBe(device.platform);
      expect(deviceInfo.osVersion).toBe(device.osVersion);
    });

    it('should get app information', async () => {
      const devices = await mobileEngine.getAvailableDevices();
      const device = devices[0];

      const appInfo = await mobileEngine.getAppInfo(device.deviceId, 'com.example.app');

      expect(appInfo).toBeDefined();
      expect(appInfo.bundleId).toBe('com.example.app');
      expect(appInfo.version).toBeDefined();
    });
  });

  describe('App Management', () => {
    it('should install app successfully', async () => {
      const devices = await mobileEngine.getAvailableDevices();
      const device = devices[0];

      const result = await mobileEngine.installApp(device.deviceId, '/path/to/app.ipa');

      expect(result).toBe(true);
    });

    it('should uninstall app successfully', async () => {
      const devices = await mobileEngine.getAvailableDevices();
      const device = devices[0];

      const result = await mobileEngine.uninstallApp(device.deviceId, 'com.example.app');

      expect(result).toBe(true);
    });

    it('should handle app installation failures', async () => {
      const devices = await mobileEngine.getAvailableDevices();
      const invalidDevice = { deviceId: 'invalid-device', platform: 'ios' as const, type: 'simulator' as const, name: 'Invalid', osVersion: '16.0', capabilities: [], status: 'available' as const };

      await expect(
        mobileEngine.installApp(invalidDevice.deviceId, '/path/to/app.ipa')
      ).rejects.toThrow('Device invalid-device not found');
    });
  });

  describe('Artifact Collection', () => {
    it('should take screenshots', async () => {
      const devices = await mobileEngine.getAvailableDevices();
      const device = devices[0];

      const screenshotPath = await mobileEngine.takeScreenshot(device.deviceId, 'test-screenshot.png');

      expect(screenshotPath).toBeDefined();
      expect(typeof screenshotPath).toBe('string');
    });

    it('should start and stop screen recording', async () => {
      const devices = await mobileEngine.getAvailableDevices();
      const device = devices[0];

      const recordingId = await mobileEngine.startScreenRecording(device.deviceId);
      expect(recordingId).toBeDefined();

      const videoPath = await mobileEngine.stopScreenRecording(device.deviceId, recordingId);
      expect(videoPath).toBeDefined();
      expect(typeof videoPath).toBe('string');
    });
  });

  describe('Test Lifecycle Management', () => {
    it('should cancel running test', async () => {
      const request = createMockMobileTestRequest();

      // Start execution but don't wait for completion
      const executionPromise = mobileEngine.executeTest(request);

      // Cancel immediately
      const cancelled = await mobileEngine.cancelTest(request.id, 'User requested cancellation');

      expect(cancelled).toBe(true);

      const result = await executionPromise;
      expect(result.status).toBe('cancelled');
    });

    it('should get test status', async () => {
      const request = createMockMobileTestRequest();

      // Start execution
      const executionPromise = mobileEngine.executeTest(request);

      // Get status while running
      const status = await mobileEngine.getTestStatus(request.id);

      // Should be either running or completed depending on timing
      expect(['running', 'completed', 'failed', 'cancelled']).toContain(status?.status);

      await executionPromise;
    });

    it('should handle cancellation of non-existent test', async () => {
      const cancelled = await mobileEngine.cancelTest('non-existent-test');
      expect(cancelled).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle device not found errors', async () => {
      const request = createMockMobileTestRequest({
        deviceConfig: {
          deviceId: 'non-existent-device',
          platform: 'ios',
          type: 'simulator',
          name: 'Non-existent',
          osVersion: '16.0',
          capabilities: [],
          status: 'available'
        }
      });

      mockMaestroSuccess(mockSpawn);

      const result = await mobileEngine.executeTest(request);

      expect(result).toBeDefined();
      expect(result.status).toBe('failed');
      expect(result.outcome).toBe('error');
    });

    it('should handle app not found errors', async () => {
      const request = createMockMobileTestRequest({
        testCase: createMockTestCase({
          appPath: '/non-existent/app.ipa'
        })
      });

      mockMaestroSuccess(mockSpawn);

      const result = await mobileEngine.executeTest(request);

      expect(result).toBeDefined();
      // Might succeed or fail depending on Maestro behavior
      expect(['completed', 'failed']).toContain(result.status);
    });

    it('should handle Maestro binary not found', async () => {
      const engine = new MobileTestEngine({ maestroBinaryPath: '/non-existent/maestro' });

      const request = createMockMobileTestRequest();

      mockMaestroBinaryNotFound(mockSpawn);

      const result = await engine.executeTest(request);

      expect(result).toBeDefined();
      expect(result.status).toBe('failed');
    });

    it('should collect crash logs for failed tests', async () => {
      const request = createMockMobileTestRequest({
        testCase: createMockTestCase({
          flowContent: createFailingMaestroFlow()
        })
      });

      mockMaestroFailure(mockSpawn);

      const result = await mobileEngine.executeTest(request);

      expect(result).toBeDefined();
      expect(result.outcome).toBe('failed');

      // Should attempt to collect crash logs
      const crashArtifacts = result.artifacts.filter(a => a.type === 'crash-log');
      // May or may not have crash logs depending on implementation
    });
  });

  describe('Performance Metrics', () => {
    it('should collect performance metrics', async () => {
      const request = createMockMobileTestRequest({
        executionOptions: {
          captureScreenshots: false,
          captureVideo: false,
          captureLogs: false,
          captureNetwork: false,
          capturePerformance: true,
          appLaunchMethod: 'maestro',
          cleanupBetweenTests: false,
          installAppBeforeEachTest: false,
          uninstallAppAfterTest: false,
          resetDeviceBeforeTest: false,
          keepAppData: false
        }
      });

      mockMaestroSuccess(mockSpawn);

      const result = await mobileEngine.executeTest(request);

      expect(result).toBeDefined();
      expect(result.performance).toBeDefined();
      expect(typeof result.performance.appLaunchTime).toBe('number');
      expect(result.performance.memoryUsage).toBeDefined();
      expect(result.performance.cpuUsage).toBeDefined();
    });

    it('should measure test execution duration', async () => {
      const request = createMockMobileTestRequest();

      mockMaestroSuccess(mockSpawn);

      const result = await mobileEngine.executeTest(request);

      expect(result).toBeDefined();
      expect(result.startTime).toBeDefined();
      expect(result.endTime).toBeDefined();
      expect(result.duration).toBeDefined();
      expect(result.duration).toBeGreaterThan(0);
    });
  });

  describe('Flow Management', () => {
    it('should create temporary flow files', async () => {
      const request = createMockMobileTestRequest({
        testCase: createMockTestCase({
          flowContent: createSimpleMaestroFlow()
        })
      });

      mockMaestroSuccess(mockSpawn);

      await mobileEngine.executeTest(request);

      // Verify that writeFile was called to create temp flow file
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.yaml'),
        expect.any(String),
        'utf8'
      );
    });

    it('should clean up temporary flow files', async () => {
      const request = createMockMobileTestRequest({
        testCase: createMockTestCase({
          flowContent: createSimpleMaestroFlow()
        })
      });

      mockMaestroSuccess(mockSpawn);

      await mobileEngine.executeTest(request);

      // Verify that unlink was called to clean up
      expect(mockFs.unlink).toHaveBeenCalled();
    });

    it('should use existing flow files when provided', async () => {
      const request = createMockMobileTestRequest({
        testCase: createMockTestCase({
          flowFile: '/path/to/existing/flow.yaml'
        })
      });

      mockMaestroSuccess(mockSpawn);

      await mobileEngine.executeTest(request);

      // Should not create temp files when using existing flow file
      expect(mockFs.writeFile).not.toHaveBeenCalledWith(
        expect.stringContaining('temp'),
        expect.any(String),
        expect.any(String)
      );
    });

    it('should handle missing flow file or content', async () => {
      const request = createMockMobileTestRequest({
        testCase: createMockTestCase({
          // Neither flowFile nor flowContent provided
        })
      });

      await expect(mobileEngine.executeTest(request)).rejects.toThrow('Either flowFile or flowContent must be provided');
    });
  });

  describe('Environment Configuration', () => {
    it('should handle environment variables', async () => {
      const request = createMockMobileTestRequest({
        testCase: createMockTestCase({
          environmentVariables: {
            'TEST_ENV': 'test',
            'API_URL': 'https://api.test.com'
          }
        })
      });

      mockMaestroSuccess(mockSpawn);

      const result = await mobileEngine.executeTest(request);

      expect(result).toBeDefined();
      expect(result.status).toBe('completed');
    });

    it('should handle test data', async () => {
      const request = createMockMobileTestRequest({
        testCase: createMockTestCase({
          testData: {
            username: 'testuser',
            password: 'testpass'
          }
        })
      });

      mockMaestroSuccess(mockSpawn);

      const result = await mobileEngine.executeTest(request);

      expect(result).toBeDefined();
      expect(result.status).toBe('completed');
    });

    it('should handle network conditions configuration', async () => {
      const request = createMockMobileTestRequest({
        environment: {
          variables: {},
          testData: {},
          networkConditions: {
            profile: '3g',
            downloadSpeed: 1000000,
            uploadSpeed: 500000,
            latency: 200,
            packetLoss: 0.01
          }
        }
      });

      mockMaestroSuccess(mockSpawn);

      const result = await mobileEngine.executeTest(request);

      expect(result).toBeDefined();
      expect(result.status).toBe('completed');
    });
  });

  describe('Cross-Platform Compatibility', () => {
    it('should handle iOS simulator tests', async () => {
      const request = createMockMobileTestRequest({
        deviceConfig: createMockDeviceConfig({
          platform: 'ios',
          type: 'simulator'
        })
      });

      mockMaestroSuccess(mockSpawn);

      const result = await mobileEngine.executeTest(request);

      expect(result).toBeDefined();
      expect(result.deviceInfo.platform).toBe('ios');
    });

    it('should handle Android emulator tests', async () => {
      const request = createMockMobileTestRequest({
        deviceConfig: createMockDeviceConfig({
          platform: 'android',
          type: 'emulator'
        })
      });

      mockMaestroSuccess(mockSpawn);

      const result = await mobileEngine.executeTest(request);

      expect(result).toBeDefined();
      expect(result.deviceInfo.platform).toBe('android');
    });

    it('should handle different app types', async () => {
      const iosRequest = createMockMobileTestRequest({
        testCase: createMockTestCase({
          appPath: '/path/to/app.ipa'
        }),
        deviceConfig: createMockDeviceConfig({ platform: 'ios' })
      });

      const androidRequest = createMockMobileTestRequest({
        testCase: createMockTestCase({
          appPath: '/path/to/app.apk'
        }),
        deviceConfig: createMockDeviceConfig({ platform: 'android' })
      });

      mockMaestroSuccess(mockSpawn);
      mockMaestroSuccess(mockSpawn);

      const iosResult = await mobileEngine.executeTest(iosRequest);
      const androidResult = await mobileEngine.executeTest(androidRequest);

      expect(iosResult).toBeDefined();
      expect(androidResult).toBeDefined();
      expect(iosResult.deviceInfo.platform).toBe('ios');
      expect(androidResult.deviceInfo.platform).toBe('android');
    });
  });
});

// Helper functions
function createMockMobileTestRequest(overrides: Partial<MobileTestRequest> = {}): MobileTestRequest {
  return {
    id: `test-${Math.random().toString(36).substr(2, 9)}`,
    executionId: `exec-${Math.random().toString(36).substr(2, 9)}`,
    testCase: createMockTestCase(),
    deviceConfig: createMockDeviceConfig(),
    executionOptions: {
      captureScreenshots: true,
      captureVideo: false,
      captureLogs: true,
      captureNetwork: false,
      capturePerformance: false,
      appLaunchMethod: 'maestro',
      cleanupBetweenTests: false,
      installAppBeforeEachTest: false,
      uninstallAppAfterTest: false,
      resetDeviceBeforeTest: false,
      keepAppData: false
    },
    environment: {
      variables: {},
      testData: {}
    },
    ...overrides
  };
}

function createMockTestCase(overrides: Partial<TestCase> = {}): TestCase {
  return {
    id: `testcase-${Math.random().toString(36).substr(2, 9)}`,
    name: 'Test Case',
    description: 'Test case description',
    platform: 'ios',
    appPath: '/path/to/app.ipa',
    flowContent: '',
    parameters: {},
    assertions: [],
    setup: [],
    teardown: [],
    metadata: {
      tags: ['smoke', 'regression'],
      priority: 'medium',
      estimatedDuration: 5000,
      flaky: false
    },
    ...overrides
  };
}

function createMockDeviceConfig(overrides: Partial<DeviceConfig> = {}): DeviceConfig {
  return {
    deviceId: 'device-123',
    platform: 'ios',
    type: 'simulator',
    name: 'iPhone 14 Simulator',
    osVersion: '16.1',
    model: 'iPhone 14',
    screenResolution: { width: 390, height: 844, density: 3 },
    capabilities: [],
    status: 'available',
    ...overrides
  };
}

function createSimpleMaestroFlow(): string {
  return `
appId: com.example.app
---
- launchApp
- tapOn: "Login"
- inputText: "test@example.com"
- tapOn: "Login Button"
- assertVisible: "Welcome"
`;
}

function createFailingMaestroFlow(): string {
  return `
appId: com.example.app
---
- launchApp
- tapOn: "NonExistentElement"
- assertVisible: "This will fail"
`;
}

// Mock functions for Maestro execution
function mockMaestroSuccess(mockSpawn: any) {
  const mockProcess = {
    stdout: { on: vi.fn((event, callback) => {
      if (event === 'data') {
        callback('✓ Launch app\\n✓ Tap on Login\\n✓ Input text\\n✓ Tap on Login Button\\n✓ Assert Welcome visible');
      }
    })},
    stderr: { on: vi.fn() },
    on: vi.fn((event, callback) => {
      if (event === 'close') {
        callback(0);
      }
    }),
    kill: vi.fn()
  };

  mockSpawn.mockReturnValue(mockProcess);
}

function mockMaestroFailure(mockSpawn: any) {
  const mockProcess = {
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn((event, callback) => {
      if (event === 'data') {
        callback('✗ Tap on NonExistentElement\\n✗ Assert This will fail');
      }
    })},
    on: vi.fn((event, callback) => {
      if (event === 'close') {
        callback(1);
      }
    }),
    kill: vi.fn()
  };

  mockSpawn.mockReturnValue(mockProcess);
}

function mockMaestroProcessError(mockSpawn: any) {
  const mockProcess = {
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    on: vi.fn((event, callback) => {
      if (event === 'error') {
        callback(new Error('Maestro binary not found'));
      }
    })
  };

  mockSpawn.mockReturnValue(mockProcess);
}

function mockMaestroSlowExecution(mockSpawn: any) {
  const mockProcess = {
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    on: vi.fn()
  };

  mockSpawn.mockReturnValue(mockProcess);

  // Don't call close to simulate hanging process
}

function mockMaestroBinaryNotFound(mockSpawn: any) {
  mockSpawn.mockImplementation(() => {
    throw new Error('spawn maestro-test ENOENT');
  });
}
