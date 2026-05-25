/**
 * Mobile Device Service
 * Manages iOS and Android devices for testing
 */

export interface MobileDevice {
  id: string;
  name: string;
  platform: 'ios' | 'android';
  model: string;
  osVersion: string;
  status: 'online' | 'offline' | 'busy' | 'error';
  capabilities: DeviceCapabilities;
  lastSeen: string;
  agentId?: string;
  location: 'local' | 'cloud' | 'farm';
  specs: DeviceSpecs;
  currentTest?: string;
}

export interface DeviceCapabilities {
  screenRecording: boolean;
  screenshots: boolean;
  touchGestures: boolean;
  networkSimulation: boolean;
  appInstallation: boolean;
  gpsSimulation: boolean;
  cameraAccess: boolean;
  microphoneAccess: boolean;
}

export interface DeviceSpecs {
  screenWidth: number;
  screenHeight: number;
  pixelDensity: number;
  cpuCores: number;
  memory: number; // in MB
  storage: number; // in GB
  batteryLevel?: number;
  networkType?: string;
}

/**
 * Mobile Device Service Implementation
 */
export class MobileDeviceService {
  constructor(private env: any) {}

  /**
   * Register a new mobile device
   */
  async registerDevice(deviceData: Omit<MobileDevice, 'id' | 'lastSeen'>): Promise<MobileDevice> {
    const device: MobileDevice = {
      ...deviceData,
      id: crypto.randomUUID(),
      lastSeen: new Date().toISOString(),
    };

    try {
      // For now, store in KV as a simple implementation
      // In production, this would use D1 database
      await this.env.DEVICES.put(`device:${device.id}`, JSON.stringify(device));

      return device;
    } catch (error) {
      console.error('Failed to register device:', error);
      throw new Error('Failed to register mobile device');
    }
  }

  /**
   * Get all registered mobile devices
   */
  async getDevices(filters: {
    platform?: 'ios' | 'android';
    status?: string;
    location?: string;
    limit?: number;
  } = {}): Promise<{ devices: MobileDevice[] }> {
    try {
      // List devices from KV storage
      const list = await this.env.DEVICES.list({
        prefix: 'device:',
        limit: filters.limit || 100
      });

      const devices: MobileDevice[] = [];

      for (const key of list.keys) {
        const deviceData = await this.env.DEVICES.get(key.name);
        if (deviceData) {
          const device = JSON.parse(deviceData) as MobileDevice;

          // Apply filters
          if (filters.platform && device.platform !== filters.platform) continue;
          if (filters.status && device.status !== filters.status) continue;
          if (filters.location && device.location !== filters.location) continue;

          devices.push(device);
        }
      }

      return { devices };
    } catch (error) {
      console.error('Failed to get devices:', error);
      throw new Error('Failed to get mobile devices');
    }
  }

  /**
   * Get device by ID
   */
  async getDevice(deviceId: string): Promise<MobileDevice | null> {
    try {
      const deviceData = await this.env.DEVICES.get(`device:${deviceId}`);
      if (!deviceData) return null;

      return JSON.parse(deviceData) as MobileDevice;
    } catch (error) {
      console.error('Failed to get device:', error);
      throw new Error('Failed to get mobile device');
    }
  }

  /**
   * Update device status
   */
  async updateDeviceStatus(deviceId: string, status: MobileDevice['status'], currentTest?: string): Promise<void> {
    try {
      const device = await this.getDevice(deviceId);
      if (!device) throw new Error('Device not found');

      device.status = status;
      device.lastSeen = new Date().toISOString();
      if (currentTest) {
        device.currentTest = currentTest;
      }

      await this.env.DEVICES.put(`device:${deviceId}`, JSON.stringify(device));
    } catch (error) {
      console.error('Failed to update device status:', error);
      throw new Error('Failed to update device status');
    }
  }

  /**
   * Create Maestro test configuration
   */
  createMaestroTestConfig(config: {
    appId?: string;
    flow: any[];
    launchArguments?: Record<string, any>;
    env?: Record<string, string>;
  }): string {
    const maestroConfig = {
      appId: config.appId,
      launchArguments: config.launchArguments || {},
      env: config.env || {},
      onFlowStart: [
        {
          "runScript": {
            "file": "setup.js"
          }
        }
      ],
      onFlowComplete: [
        {
          "runScript": {
            "file": "cleanup.js"
          }
        }
      ],
      flows: config.flow
    };

    return JSON.stringify(maestroConfig, null, 2);
  }

  /**
   * Generate mobile test script for common actions
   */
  generateMobileTestScript(actions: {
    platform: 'ios' | 'android';
    appId?: string;
    actions: Array<{
      type: 'tap' | 'swipe' | 'input' | 'assert' | 'wait' | 'launch';
      target?: string;
      value?: string;
      direction?: string;
      duration?: number;
    }>;
  }): string {
    const flow = actions.actions.map(action => {
      switch (action.type) {
        case 'tap':
          return action.target ? { tap: action.target } : {};
        case 'swipe':
          return {
            swipe: {
              direction: action.direction || 'up',
              duration: action.duration || 1000
            }
          };
        case 'input':
          return action.target ? {
            inputText: action.value,
            into: action.target
          } : {};
        case 'assert':
          return action.target ? {
            assertVisible: action.target
          } : {};
        case 'wait':
          return {
            wait: action.duration || 1000
          };
        case 'launch':
          return {
            launchApp: actions.appId
          };
        default:
          return {};
      }
    }).filter(step => Object.keys(step).length > 0);

    return this.createMaestroTestConfig({
      appId: actions.appId,
      flow
    });
  }
}

export default MobileDeviceService;
