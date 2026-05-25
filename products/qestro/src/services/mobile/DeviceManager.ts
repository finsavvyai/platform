/**
 * Qestro Device Manager
 *
 * Comprehensive device management and orchestration system for mobile testing.
 * Provides real device discovery, management, and orchestration capabilities.
 *
 * Features:
 * - Automatic device discovery (local, cloud, emulators, simulators)
 * - Device pooling and reservation system
 * - Health monitoring and maintenance
 * - Cross-platform support (iOS/Android)
 * - Real-time device status tracking
 * - Device configuration management
 * - Resource optimization and scheduling
 * - Integration with test execution engine
 *
 * @author Qestro Platform Team
 * @version 1.0.0
 */

import { EventEmitter } from 'events';
import { MobileDevice, DeviceStatus, MobilePlatform, DeviceLocation, DeviceReservation } from './MobileTestEngine';

// Cloud Provider API Response Types
export interface BrowserStackDevice {
  device: string;
  os: string;
  os_version: string;
  browser?: string;
  browser_version?: string;
  realMobile?: boolean;
}

export interface SauceLabsDevice {
  id: string;
  name: string;
  os: string;
  osVersion: string;
  modelNumber?: string;
  isAvailable: boolean;
  dataCenterId?: string;
  screenSize?: string;
  resolutionWidth?: number;
  resolutionHeight?: number;
}

export interface LambdaTestDevice {
  deviceName: string;
  platformName: string;
  platformVersion: string;
  isAvailable: boolean;
  deviceId: string;
  region?: string;
}

// Device Management Types
export type DeviceProvider = 'local' | 'cloud' | 'emulator' | 'simulator' | 'browserstack' | 'saucelabs' | 'lambdatest' | 'aws';
export type DeviceType = 'real-device' | 'emulator' | 'simulator' | 'virtual-device';
export type PoolType = 'public' | 'private' | 'dedicated' | 'shared';

export interface DeviceProviderConfig {
  type: DeviceProvider;
  name: string;
  enabled: boolean;
  configuration: ProviderConfiguration;
  capabilities: ProviderCapabilities;
  limits: ProviderLimits;
  healthCheck: HealthCheckConfig;
}

export interface ProviderConfiguration {
  // Local provider config
  adbPath?: string;
  xcodePath?: string;
  iosSimulatorPath?: string;

  // Cloud provider config
  apiKey?: string;
  username?: string;
  endpoint?: string;
  region?: string;
  projectId?: string;

  // BrowserStack config
  browserstackUsername?: string;
  browserstackAccessKey?: string;
  browserstackLocal?: boolean;

  // AWS Device Farm config
  awsAccessKeyId?: string;
  awsSecretAccessKey?: string;
  awsRegion?: string;
  projectArn?: string;

  // Generic config
  timeout?: number;
  retries?: number;
  parallelism?: number;
}

export interface ProviderCapabilities {
  platforms: MobilePlatform[];
  deviceTypes: DeviceType[];
  maxConcurrentConnections: number;
  supportedFeatures: string[];
  automaticCleanup: boolean;
  screenshotSupport: boolean;
  videoRecording: boolean;
  networkSimulation: boolean;
  geolocationSupport: boolean;
}

export interface ProviderLimits {
  maxDevices: number;
  maxConcurrentTests: number;
  maxDailyExecutions: number;
  bandwidthLimit?: number;
  storageLimit?: number;
  costLimit?: number;
}

export interface HealthCheckConfig {
  enabled: boolean;
  interval: number; // milliseconds
  timeout: number; // milliseconds
  retryCount: number;
  healthChecks: DeviceHealthCheck[];
}

export interface DeviceHealthCheck {
  name: string;
  type: 'connectivity' | 'responsiveness' | 'resources' | 'capabilities';
  threshold: number;
  critical: boolean;
}

export interface DevicePool {
  id: string;
  name: string;
  type: PoolType;
  provider: DeviceProvider;
  platform: MobilePlatform;
  devices: MobileDevice[];
  configuration: PoolConfiguration;
  metrics: PoolMetrics;
  status: PoolStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface PoolConfiguration {
  maxDevices: number;
  minAvailableDevices: number;
  autoScaling: boolean;
  deviceRotation: boolean;
  maintenanceWindow: MaintenanceWindow;
  reservationPolicy: ReservationPolicy;
  priority: number;
}

export interface MaintenanceWindow {
  enabled: boolean;
  schedule: string; // Cron expression
  duration: number; // minutes
  maintenanceTasks: string[];
}

export interface ReservationPolicy {
  maxReservationTime: number; // minutes
  advanceBookingTime: number; // minutes
  allowOverbooking: boolean;
  priorityLevels: number;
  fairShareEnabled: boolean;
}

export interface PoolMetrics {
  totalDevices: number;
  availableDevices: number;
  busyDevices: number;
  offlineDevices: number;
  utilizationRate: number;
  averageResponseTime: number;
  successRate: number;
  totalExecutions: number;
  averageExecutionTime: number;
}

export type PoolStatus = 'active' | 'maintenance' | 'degraded' | 'offline';

export interface DeviceDiscovery {
  id: string;
  provider: DeviceProvider;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startTime: Date;
  endTime?: Date;
  discoveredDevices: number;
  errors: string[];
  configuration: ProviderConfiguration;
}

export interface DeviceMetrics {
  deviceId: string;
  timestamp: Date;
  cpu: number;
  memory: number;
  battery: number;
  temperature: number;
  network: NetworkMetrics;
  performance: PerformanceMetrics;
  availability: AvailabilityMetrics;
}

export interface NetworkMetrics {
  latency: number;
  bandwidth: number;
  packetLoss: number;
  connectionType: string;
  signalStrength: number;
}

export interface PerformanceMetrics {
  responseTime: number;
  throughput: number;
  errorRate: number;
  uptime: number;
  lastRestart: Date;
}

export interface AvailabilityMetrics {
  uptime: number;
  downtime: number;
  totalTests: number;
  failedTests: number;
  averageRecoveryTime: number;
  lastMaintenance: Date;
}

export interface DeviceSchedule {
  deviceId: string;
  reservations: ScheduledReservation[];
  maintenanceWindows: MaintenanceWindow[];
  blackouts: BlackoutPeriod[];
  availability: AvailabilitySchedule;
}

export interface ScheduledReservation {
  id: string;
  userId: string;
  projectId: string;
  startTime: Date;
  endTime: Date;
  priority: number;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  requirements: DeviceRequirement[];
}

export interface BlackoutPeriod {
  id: string;
  reason: string;
  startTime: Date;
  endTime: Date;
  recurring: boolean;
  affectedDevices: string[];
}

export interface AvailabilitySchedule {
  timezone: string;
  workingHours: WorkingHours[];
  exceptions: ScheduleException[];
}

export interface WorkingHours {
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  startTime: string; // HH:MM
  endTime: string; // HH:MM
}

export interface ScheduleException {
  date: Date;
  type: 'holiday' | 'maintenance' | 'special_event';
  description: string;
  available: boolean;
}

export interface DeviceRequirement {
  platform: MobilePlatform;
  minOsVersion?: string;
  maxOsVersion?: string;
  requiredModels?: string[];
  excludedModels?: string[];
  requiredCapabilities?: string[];
  preferences?: Record<string, any>;
}

/**
 * Main Device Manager class
 */
export class DeviceManager extends EventEmitter {
  private providers: Map<DeviceProvider, DeviceProviderConfig> = new Map();
  private devices: Map<string, MobileDevice> = new Map();
  private pools: Map<string, DevicePool> = new Map();
  private reservations: Map<string, DeviceReservation> = new Map();
  private schedules: Map<string, DeviceSchedule> = new Map();
  private discoveries: Map<string, DeviceDiscovery> = new Map();
  private metrics: Map<string, DeviceMetrics[]> = new Map();
  private config: DeviceManagerConfig;
  private healthMonitor: DeviceHealthMonitor;
  private resourceOptimizer: ResourceOptimizer;

  constructor(config: Partial<DeviceManagerConfig> = {}) {
    super();

    this.config = {
      healthCheckInterval: 30000, // 30 seconds
      metricsRetentionDays: 30,
      enableAutoDiscovery: true,
      enableAutoHealing: true,
      enablePredictiveMaintenance: true,
      maxDiscoveryRetries: 3,
      defaultReservationTime: 60, // minutes
      cleanupInterval: 3600000, // 1 hour
      enableResourceOptimization: true,
      enableLoadBalancing: true,
      enableFairShare: true,
      ...config
    };

    this.initializeProviders();
    this.healthMonitor = new DeviceHealthMonitor(this.config.healthCheckInterval);
    this.resourceOptimizer = new ResourceOptimizer();

    // All startup methods disabled for Cloudflare Workers compatibility
    // this.startHealthMonitoring();
    // this.startAutoDiscovery();
    // this.startResourceOptimization();
    // this.startCleanup();
  }

  /**
   * Initialize device providers
   */
  private initializeProviders(): void {
    // Local provider
    this.providers.set('local', {
      type: 'local',
      name: 'Local Devices',
      enabled: true,
      configuration: {
        adbPath: '/usr/local/bin/adb',
        xcodePath: '/Applications/Xcode.app/Contents/Developer',
        iosSimulatorPath: '/usr/bin/xcrun',
        timeout: 30000,
        retries: 3
      },
      capabilities: {
        platforms: ['ios', 'android'],
        deviceTypes: ['real-device', 'emulator', 'simulator'],
        maxConcurrentConnections: 10,
        supportedFeatures: ['screenshots', 'video-recording', 'network-simulation'],
        automaticCleanup: true,
        screenshotSupport: true,
        videoRecording: true,
        networkSimulation: true,
        geolocationSupport: true
      },
      limits: {
        maxDevices: 50,
        maxConcurrentTests: 10,
        maxDailyExecutions: 1000
      },
      healthCheck: {
        enabled: true,
        interval: 30000,
        timeout: 5000,
        retryCount: 3,
        healthChecks: [
          { name: 'connectivity', type: 'connectivity', threshold: 95, critical: true },
          { name: 'responsiveness', type: 'responsiveness', threshold: 2000, critical: true },
          { name: 'resources', type: 'resources', threshold: 80, critical: false }
        ]
      }
    });

    // Cloud providers (would be configured with actual API keys)
    this.providers.set('browserstack', {
      type: 'browserstack',
      name: 'BrowserStack',
      enabled: false, // Requires API key
      configuration: {
        endpoint: 'https://api-cloud.browserstack.com',
        timeout: 60000,
        retries: 3
      },
      capabilities: {
        platforms: ['ios', 'android'],
        deviceTypes: ['real-device', 'virtual-device'],
        maxConcurrentConnections: 5,
        supportedFeatures: ['screenshots', 'video-recording', 'network-simulation'],
        automaticCleanup: true,
        screenshotSupport: true,
        videoRecording: true,
        networkSimulation: true,
        geolocationSupport: true
      },
      limits: {
        maxDevices: 100,
        maxConcurrentTests: 5,
        maxDailyExecutions: 500
      },
      healthCheck: {
        enabled: true,
        interval: 60000,
        timeout: 10000,
        retryCount: 3,
        healthChecks: [
          { name: 'connectivity', type: 'connectivity', threshold: 95, critical: true }
        ]
      }
    });
  }

  /**
   * Add device to management system
   */
  async addDevice(device: MobileDevice): Promise<void> {
    try {
      // Validate device
      this.validateDevice(device);

      // Check if device already exists
      if (this.devices.has(device.id)) {
        await this.updateDevice(device);
        return;
      }

      // Initialize device connection
      await this.initializeDevice(device);

      // Add device registry
      this.devices.set(device.id, device);

      // Add metrics collection
      this.metrics.set(device.id, []);

      // Create device schedule
      this.schedules.set(device.id, {
        deviceId: device.id,
        reservations: [],
        maintenanceWindows: [],
        blackouts: [],
        availability: {
          timezone: 'UTC',
          workingHours: [
            { dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }, // Monday
            { dayOfWeek: 2, startTime: '09:00', endTime: '17:00' }, // Tuesday
            { dayOfWeek: 3, startTime: '09:00', endTime: '17:00' }, // Wednesday
            { dayOfWeek: 4, startTime: '09:00', endTime: '17:00' }, // Thursday
            { dayOfWeek: 5, startTime: '09:00', endTime: '17:00' }, // Friday
            { dayOfWeek: 6, startTime: '10:00', endTime: '14:00' }, // Saturday
            { dayOfWeek: 0, startTime: '10:00', endTime: '14:00' }  // Sunday
          ],
          exceptions: []
        }
      });

      // Start health monitoring
      this.healthMonitor.addDevice(device);

      // Emit device added event
      this.emit('device-added', device);

      console.log(`✅ Device added: ${device.name} (${device.platform} - ${device.model})`);

    } catch (error) {
      console.error(`❌ Failed to add device ${device.name}:`, error);
      throw error;
    }
  }

  /**
   * Remove device from management system
   */
  async removeDevice(deviceId: string, force: boolean = false): Promise<void> {
    const device = this.devices.get(deviceId);
    if (!device) {
      throw new Error(`Device ${deviceId} not found`);
    }

    try {
      // Check for active reservations
      if (!force) {
        const activeReservation = this.getActiveReservation(deviceId);
        if (activeReservation) {
          throw new Error(`Device ${device.name} has active reservation until ${activeReservation.endTime}`);
        }
      }

      // Cancel active reservations if forcing
      if (force) {
        await this.cancelDeviceReservations(deviceId);
      }

      // Stop health monitoring
      this.healthMonitor.removeDevice(deviceId);

      // Disconnect from device
      await this.disconnectDevice(device);

      // Remove from registries
      this.devices.delete(deviceId);
      this.schedules.delete(deviceId);
      this.metrics.delete(deviceId);

      // Remove from pools
      await this.removeDeviceFromPools(deviceId);

      // Emit device removed event
      this.emit('device-removed', device);

      console.log(`✅ Device removed: ${device.name}`);

    } catch (error) {
      console.error(`❌ Failed to remove device ${device.name}:`, error);
      throw error;
    }
  }

  /**
   * Discover devices from all enabled providers
   */
  async discoverDevices(): Promise<DeviceDiscovery[]> {
    const discoveries: DeviceDiscovery[] = [];

    for (const [providerType, provider] of this.providers) {
      if (provider.enabled) {
        try {
          const discovery = await this.discoverProviderDevices(providerType);
          discoveries.push(discovery);
        } catch (error) {
          console.error(`Failed to discover devices from ${provider.name}:`, error);
        }
      }
    }

    return discoveries;
  }

  /**
   * Discover devices from specific provider
   */
  async discoverProviderDevices(providerType: DeviceProvider): Promise<DeviceDiscovery> {
    const provider = this.providers.get(providerType);
    if (!provider || !provider.enabled) {
      throw new Error(`Provider ${providerType} is not enabled`);
    }

    const discoveryId = this.generateDiscoveryId();
    const discovery: DeviceDiscovery = {
      id: discoveryId,
      provider: providerType,
      status: 'running',
      startTime: new Date(),
      discoveredDevices: 0,
      errors: [],
      configuration: provider.configuration
    };

    this.discoveries.set(discoveryId, discovery);
    this.emit('discovery-started', discovery);

    try {
      let discoveredDevices: MobileDevice[] = [];

      switch (providerType) {
        case 'local':
          discoveredDevices = await this.discoverLocalDevices(provider);
          break;
        case 'browserstack':
          discoveredDevices = await this.discoverBrowserStackDevices(provider);
          break;
        case 'saucelabs':
          discoveredDevices = await this.discoverSauceLabsDevices(provider);
          break;
        case 'aws':
          discoveredDevices = await this.discoverAWSDevices(provider);
          break;
        default:
          throw new Error(`Discovery not implemented for provider: ${providerType}`);
      }

      // Add discovered devices
      for (const device of discoveredDevices) {
        try {
          await this.addDevice(device);
          discovery.discoveredDevices++;
        } catch (error) {
          discovery.errors.push(`Failed to add device ${device.name}: ${error}`);
        }
      }

      discovery.status = 'completed';
      discovery.endTime = new Date();

      this.discoveries.set(discoveryId, discovery);
      this.emit('discovery-completed', discovery);

      console.log(`✅ Discovery completed: ${discovery.discoveredDevices} devices from ${provider.name}`);

    } catch (error) {
      discovery.status = 'failed';
      discovery.endTime = new Date();
      discovery.errors.push(error instanceof Error ? error.message : 'Unknown error');

      this.discoveries.set(discoveryId, discovery);
      this.emit('discovery-failed', discovery);

      throw error;
    }

    return discovery;
  }

  /**
   * Discover local devices (Android/iOS)
   */
  private async discoverLocalDevices(provider: DeviceProviderConfig): Promise<MobileDevice[]> {
    const devices: MobileDevice[] = [];

    try {
      // Discover Android devices via ADB
      const androidDevices = await this.discoverAndroidDevices(provider.configuration);
      devices.push(...androidDevices);

      // Discover iOS devices/simulators
      const iosDevices = await this.discoverIOSDevices(provider.configuration);
      devices.push(...iosDevices);

    } catch (error) {
      console.error('Failed to discover local devices:', error);
    }

    return devices;
  }

  /**
   * Discover Android devices using ADB
   */
  private async discoverAndroidDevices(config: ProviderConfiguration): Promise<MobileDevice[]> {
    const devices: MobileDevice[] = [];

    try {
      // Get list of connected devices
      const adbPath = config.adbPath || 'adb';
      const result = await this.executeCommand(`${adbPath} devices`, { timeout: 10000 });
      const lines = result.stdout.split('\n');

      for (const line of lines) {
        if (line.includes('\t')) {
          const [deviceId, status] = line.split('\t');
          if (status === 'device') {
            try {
              const device = await this.getAndroidDeviceInfo(deviceId, config);
              devices.push(device);
            } catch (error) {
              console.warn(`Failed to get info for Android device ${deviceId}:`, error);
            }
          }
        }
      }

    } catch (error) {
      console.error('Failed to discover Android devices:', error);
    }

    return devices;
  }

  /**
   * Get detailed Android device information
   */
  private async getAndroidDeviceInfo(deviceId: string, config: ProviderConfiguration): Promise<MobileDevice> {
    const adbPath = config.adbPath || 'adb';

    // Get device properties
    const modelResult = await this.executeCommand(`${adbPath} -s ${deviceId} shell getprop ro.product.model`, { timeout: 5000 });
    const versionResult = await this.executeCommand(`${adbPath} -s ${deviceId} shell getprop ro.build.version.release`, { timeout: 5000 });
    const apiLevelResult = await this.executeCommand(`${adbPath} -s ${deviceId} shell getprop ro.build.version.sdk`, { timeout: 5000 });

    const model = modelResult.stdout.trim();
    const osVersion = versionResult.stdout.trim();
    const apiLevel = apiLevelResult.trim();

    return {
      id: deviceId,
      name: `Android ${model}`,
      platform: 'android',
      model: model,
      osVersion: `${osVersion} (API ${apiLevel})`,
      status: 'available',
      capabilities: {
        supportsScreenshots: true,
        supportsVideoRecording: true,
        supportsNetworkSimulation: false,
        supportsGeolocation: true,
        supportsPerformanceMonitoring: true,
        supportsAccessibility: true,
        maxConcurrentTests: 1,
        supportedTestFrameworks: ['espresso', 'appium', 'maestro'],
        features: ['screenshot', 'video', 'logs', 'performance']
      },
      configuration: {
        timezone: 'UTC',
        locale: 'en_US',
        networkConfiguration: {
          wifiEnabled: true,
          cellularEnabled: true,
          vpnEnabled: false,
          networkSpeed: 'regular'
        },
        securitySettings: {
          allowUnknownApps: false,
          developerMode: true,
          usbDebugging: true,
          screenLock: false,
          encryption: false
        },
        testingSettings: {
          animationScale: 0,
          alwaysOnDisplay: false,
          doNotDisturb: true,
          screenTimeout: 300000,
          autoRotate: true
        },
        deviceSettings: {}
      },
      location: {
        type: 'local',
        hostname: 'localhost',
        port: 5555
      },
      metrics: {
        cpuUsage: 0,
        memoryUsage: 0,
        batteryLevel: 100,
        temperature: 25,
        networkLatency: 0,
        availableStorage: 0,
        uptime: 0,
        testCount: 0,
        successRate: 100,
        averageExecutionTime: 0
      },
      lastSeen: new Date(),
      tags: ['android', 'local', 'real-device']
    };
  }

  /**
   * Discover iOS devices and simulators
   */
  private async discoverIOSDevices(config: ProviderConfiguration): Promise<MobileDevice[]> {
    const devices: MobileDevice[] = [];

    try {
      // Discover real iOS devices via xcrun
      const realDevices = await this.discoverRealIOSDevices(config);
      devices.push(...realDevices);

      // Discover iOS simulators
      const simulators = await this.discoverIOSSimulators(config);
      devices.push(...simulators);

    } catch (error) {
      console.error('Failed to discover iOS devices:', error);
    }

    return devices;
  }

  /**
   * Discover real iOS devices
   */
  private async discoverRealIOSDevices(config: ProviderConfiguration): Promise<MobileDevice[]> {
    const devices: MobileDevice[] = [];

    try {
      const xcrunPath = config.iosSimulatorPath || 'xcrun';
      const result = await this.executeCommand(`${xcrunPath} devicectl list devices`, { timeout: 10000 });
      const lines = result.stdout.split('\n');

      for (const line of lines) {
        if (line.includes('iPhone') || line.includes('iPad')) {
          try {
            const device = await this.parseIOSDeviceInfo(line, 'real-device');
            devices.push(device);
          } catch (error) {
            console.warn(`Failed to parse iOS device info: ${line}`);
          }
        }
      }

    } catch (error) {
      console.error('Failed to discover real iOS devices:', error);
    }

    return devices;
  }

  /**
   * Discover iOS simulators
   */
  private async discoverIOSSimulators(config: ProviderConfiguration): Promise<MobileDevice[]> {
    const devices: MobileDevice[] = [];

    try {
      const xcrunPath = config.iosSimulatorPath || 'xcrun';
      const result = await this.executeCommand(`${xcrunPath} simctl list devices available`, { timeout: 10000 });
      const lines = result.stdout.split('\n');

      for (const line of lines) {
        if (line.includes('iPhone') || line.includes('iPad')) {
          try {
            const device = await this.parseIOSDeviceInfo(line, 'simulator');
            devices.push(device);
          } catch (error) {
            console.warn(`Failed to parse iOS simulator info: ${line}`);
          }
        }
      }

    } catch (error) {
      console.error('Failed to discover iOS simulators:', error);
    }

    return devices;
  }

  /**
   * Parse iOS device information from xcrun output
   */
  private async parseIOSDeviceInfo(line: string, type: DeviceType): Promise<MobileDevice> {
    // Parse device info from xcrun output
    // This is a simplified parser - would need more robust parsing
    const parts = line.trim().split(/\s+/);
    const deviceId = parts[0] || this.generateDeviceId();
    const model = parts.slice(1).join(' ').replace(/[()]/g, '');

    return {
      id: deviceId,
      name: `${model} (${type})`,
      platform: 'ios',
      model: model,
      osVersion: 'iOS 17.0', // Would need to extract from device
      status: 'available',
      capabilities: {
        supportsScreenshots: true,
        supportsVideoRecording: true,
        supportsNetworkSimulation: type === 'simulator',
        supportsGeolocation: true,
        supportsPerformanceMonitoring: true,
        supportsAccessibility: true,
        maxConcurrentTests: 1,
        supportedTestFrameworks: ['xcuitest', 'appium', 'maestro'],
        features: ['screenshot', 'video', 'logs', 'performance']
      },
      configuration: {
        timezone: 'UTC',
        locale: 'en_US',
        networkConfiguration: {
          wifiEnabled: true,
          cellularEnabled: type === 'real-device',
          vpnEnabled: false,
          networkSpeed: 'regular'
        },
        securitySettings: {
          allowUnknownApps: type === 'simulator',
          developerMode: true,
          usbDebugging: false,
          screenLock: false,
          encryption: false
        },
        testingSettings: {
          animationScale: 0,
          alwaysOnDisplay: false,
          doNotDisturb: true,
          screenTimeout: 300000,
          autoRotate: true
        },
        deviceSettings: {}
      },
      location: {
        type: type,
        hostname: 'localhost',
        port: type === 'simulator' ? 8081 : 0
      },
      metrics: {
        cpuUsage: 0,
        memoryUsage: 0,
        batteryLevel: type === 'real-device' ? 100 : null,
        temperature: 25,
        networkLatency: 0,
        availableStorage: 0,
        uptime: 0,
        testCount: 0,
        successRate: 100,
        averageExecutionTime: 0
      },
      lastSeen: new Date(),
      tags: ['ios', 'local', type]
    };
  }

  /**
   * Discover BrowserStack devices via REST API
   * https://www.browserstack.com/docs/app-automate/api-reference/devices
   */
  private async discoverBrowserStackDevices(provider: DeviceProviderConfig): Promise<MobileDevice[]> {
    const devices: MobileDevice[] = [];
    const config = provider.configuration;

    if (!config.browserstackUsername || !config.browserstackAccessKey) {
      console.warn('⚠️ BrowserStack credentials not configured');
      return devices;
    }

    try {
      // BrowserStack App Automate API for real devices
      const authHeader = Buffer.from(
        `${config.browserstackUsername}:${config.browserstackAccessKey}`
      ).toString('base64');

      const response = await fetch('https://api-cloud.browserstack.com/app-automate/devices.json', {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${authHeader}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`BrowserStack API error: ${response.status} ${response.statusText}`);
      }

      const bsDevices = await response.json() as BrowserStackDevice[];

      for (const bsDevice of bsDevices) {
        const device = this.parseBrowserStackDevice(bsDevice);
        devices.push(device);
      }

      console.log(`✅ Discovered ${devices.length} devices from BrowserStack`);

    } catch (error) {
      console.error('❌ BrowserStack device discovery failed:', error);
    }

    return devices;
  }

  /**
   * Parse BrowserStack device response into MobileDevice format
   */
  private parseBrowserStackDevice(bsDevice: BrowserStackDevice): MobileDevice {
    const platform = bsDevice.os.toLowerCase() as MobilePlatform;
    const isRealDevice = bsDevice.realMobile === true;

    return {
      id: `browserstack-${bsDevice.device}-${bsDevice.os_version}`.replace(/\s+/g, '-').toLowerCase(),
      name: `${bsDevice.device} (${bsDevice.os_version})`,
      platform,
      model: bsDevice.device,
      osVersion: bsDevice.os_version,
      status: 'available',
      capabilities: {
        supportsScreenshots: true,
        supportsVideoRecording: true,
        supportsNetworkSimulation: true,
        supportsGeolocation: true,
        supportsPerformanceMonitoring: true,
        supportsAccessibility: true,
        maxConcurrentTests: 1,
        supportedTestFrameworks: platform === 'android'
          ? ['espresso', 'appium', 'maestro']
          : ['xcuitest', 'appium'],
        features: ['screenshot', 'video', 'logs', 'network-logs', 'console-logs']
      },
      configuration: {
        timezone: 'UTC',
        locale: 'en_US',
        networkConfiguration: {
          wifiEnabled: true,
          cellularEnabled: true,
          vpnEnabled: false,
          networkSpeed: 'regular'
        },
        securitySettings: {
          allowUnknownApps: true,
          developerMode: true,
          usbDebugging: true,
          screenLock: false,
          encryption: false
        },
        testingSettings: {
          animationScale: 0,
          alwaysOnDisplay: false,
          doNotDisturb: true,
          screenTimeout: 300000,
          autoRotate: true
        },
        deviceSettings: {}
      },
      location: {
        type: 'cloud',
        provider: 'browserstack',
        region: 'us-west-1'
      },
      metrics: {
        cpuUsage: 0,
        memoryUsage: 0,
        batteryLevel: 100,
        temperature: 25,
        networkLatency: 0,
        availableStorage: 0,
        uptime: 0,
        testCount: 0,
        successRate: 100,
        averageExecutionTime: 0
      },
      lastSeen: new Date(),
      tags: [platform, 'browserstack', isRealDevice ? 'real-device' : 'cloud']
    };
  }

  /**
   * Discover Sauce Labs devices via REST API
   * https://docs.saucelabs.com/dev/api/rdc/#get-devices
   */
  private async discoverSauceLabsDevices(provider: DeviceProviderConfig): Promise<MobileDevice[]> {
    const devices: MobileDevice[] = [];
    const config = provider.configuration;

    if (!config.username || !config.apiKey) {
      console.warn('⚠️ Sauce Labs credentials not configured');
      return devices;
    }

    try {
      // Sauce Labs Real Device Cloud API
      const authHeader = Buffer.from(
        `${config.username}:${config.apiKey}`
      ).toString('base64');

      const endpoint = config.endpoint || 'https://api.us-west-1.saucelabs.com/v1';
      const response = await fetch(`${endpoint}/rdc/devices`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${authHeader}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Sauce Labs API error: ${response.status} ${response.statusText}`);
      }

      const slDevices = await response.json() as SauceLabsDevice[];

      for (const slDevice of slDevices) {
        const device = this.parseSauceLabsDevice(slDevice);
        devices.push(device);
      }

      console.log(`✅ Discovered ${devices.length} devices from Sauce Labs`);

    } catch (error) {
      console.error('❌ Sauce Labs device discovery failed:', error);
    }

    return devices;
  }

  /**
   * Parse Sauce Labs device response into MobileDevice format
   */
  private parseSauceLabsDevice(slDevice: SauceLabsDevice): MobileDevice {
    const platform = slDevice.os.toLowerCase().includes('ios') ? 'ios' : 'android' as MobilePlatform;

    return {
      id: `saucelabs-${slDevice.id}`,
      name: slDevice.name,
      platform,
      model: slDevice.modelNumber || slDevice.name,
      osVersion: slDevice.osVersion,
      status: slDevice.isAvailable ? 'available' : 'busy',
      capabilities: {
        supportsScreenshots: true,
        supportsVideoRecording: true,
        supportsNetworkSimulation: true,
        supportsGeolocation: true,
        supportsPerformanceMonitoring: true,
        supportsAccessibility: true,
        maxConcurrentTests: 1,
        supportedTestFrameworks: platform === 'android'
          ? ['espresso', 'appium']
          : ['xcuitest', 'appium'],
        features: ['screenshot', 'video', 'logs', 'network-logs']
      },
      configuration: {
        timezone: 'UTC',
        locale: 'en_US',
        networkConfiguration: {
          wifiEnabled: true,
          cellularEnabled: true,
          vpnEnabled: false,
          networkSpeed: 'regular'
        },
        securitySettings: {
          allowUnknownApps: true,
          developerMode: true,
          usbDebugging: true,
          screenLock: false,
          encryption: false
        },
        testingSettings: {
          animationScale: 0,
          alwaysOnDisplay: false,
          doNotDisturb: true,
          screenTimeout: 300000,
          autoRotate: true
        },
        deviceSettings: {}
      },
      location: {
        type: 'cloud',
        provider: 'saucelabs',
        region: slDevice.dataCenterId || 'us-west-1'
      },
      metrics: {
        cpuUsage: 0,
        memoryUsage: 0,
        batteryLevel: 100,
        temperature: 25,
        networkLatency: 0,
        availableStorage: 0,
        uptime: 0,
        testCount: 0,
        successRate: 100,
        averageExecutionTime: 0
      },
      lastSeen: new Date(),
      tags: [platform, 'saucelabs', 'real-device']
    };
  }

  /**
   * Discover AWS Device Farm devices
   * Note: AWS SDK would be used in production
   */
  private async discoverAWSDevices(provider: DeviceProviderConfig): Promise<MobileDevice[]> {
    const devices: MobileDevice[] = [];
    const config = provider.configuration;

    if (!config.awsAccessKeyId || !config.awsSecretAccessKey || !config.projectArn) {
      console.warn('⚠️ AWS Device Farm credentials not configured');
      return devices;
    }

    try {
      // In production, use AWS SDK:
      // const deviceFarm = new AWS.DeviceFarm({ region: config.awsRegion || 'us-west-2' });
      // const result = await deviceFarm.listDevices({ arn: config.projectArn }).promise();

      // For now, return empty - would need AWS SDK integration
      console.log('ℹ️ AWS Device Farm requires AWS SDK integration');

    } catch (error) {
      console.error('❌ AWS Device Farm device discovery failed:', error);
    }

    return devices;
  }

  /**
   * Reserve a device for testing
   */
  async reserveDevice(
    deviceId: string,
    userId: string,
    projectId: string,
    duration: number = 60,
    priority: number = 1
  ): Promise<DeviceReservation> {
    const device = this.devices.get(deviceId);
    if (!device) {
      throw new Error(`Device ${deviceId} not found`);
    }

    if (device.status !== 'available') {
      throw new Error(`Device ${device.name} is not available (status: ${device.status})`);
    }

    const reservationId = this.generateReservationId();
    const now = new Date();
    const endTime = new Date(now.getTime() + duration * 60000);

    const reservation: DeviceReservation = {
      id: reservationId,
      projectId,
      userId,
      startTime: now,
      endTime,
      priority,
      status: 'active'
    };

    // Add reservation
    this.reservations.set(reservationId, reservation);
    device.reservation = reservation;

    // Update device schedule
    const schedule = this.schedules.get(deviceId);
    if (schedule) {
      schedule.reservations.push({
        id: reservationId,
        userId,
        projectId,
        startTime: now,
        endTime,
        priority,
        status: 'scheduled',
        requirements: []
      });
    }

    // Update device status
    device.status = 'busy';
    device.lastSeen = now;

    this.emit('device-reserved', { device, reservation });

    console.log(`✅ Device ${device.name} reserved for user ${userId} until ${endTime}`);

    return reservation;
  }

  /**
   * Release a device reservation
   */
  async releaseDevice(reservationId: string): Promise<void> {
    const reservation = this.reservations.get(reservationId);
    if (!reservation) {
      throw new Error(`Reservation ${reservationId} not found`);
    }

    // Find device
    const device = Array.from(this.devices.values()).find(d => d.reservation?.id === reservationId);
    if (!device) {
      throw new Error('Device for reservation not found');
    }

    // Remove reservation
    this.reservations.delete(reservationId);
    device.reservation = undefined;

    // Update device status
    device.status = 'available';
    device.lastSeen = new Date();

    // Update schedule
    const schedule = this.schedules.get(device.id);
    if (schedule) {
      const scheduledReservation = schedule.reservations.find(r => r.id === reservationId);
      if (scheduledReservation) {
        scheduledReservation.status = 'completed';
      }
    }

    this.emit('device-released', { device, reservation });

    console.log(`✅ Device ${device.name} released from reservation`);

    // Check for pending reservations
    await this.processPendingReservations(device.id);
  }

  /**
   * Get available devices matching requirements
   */
  getAvailableDevices(requirements?: DeviceRequirement[]): MobileDevice[] {
    let devices = Array.from(this.devices.values()).filter(d => d.status === 'available');

    if (requirements) {
      devices = devices.filter(device =>
        this.deviceMatchesRequirements(device, requirements)
      );
    }

    return devices.sort((a, b) => {
      // Sort by priority (idle time, capabilities, etc.)
      const aIdle = Date.now() - a.lastSeen.getTime();
      const bIdle = Date.now() - b.lastSeen.getTime();
      return bIdle - aIdle; // Most idle first
    });
  }

  /**
   * Check if device matches requirements
   */
  private deviceMatchesRequirements(device: MobileDevice, requirements: DeviceRequirement[]): boolean {
    return requirements.every(requirement => {
      // Platform check
      if (requirement.platform && requirement.platform !== device.platform) {
        return false;
      }

      // OS version check
      if (requirement.minOsVersion && this.compareVersions(device.osVersion, requirement.minOsVersion) < 0) {
        return false;
      }

      if (requirement.maxOsVersion && this.compareVersions(device.osVersion, requirement.maxOsVersion) > 0) {
        return false;
      }

      // Model check
      if (requirement.requiredModels && !requirement.requiredModels.includes(device.model)) {
        return false;
      }

      if (requirement.excludedModels && requirement.excludedModels.includes(device.model)) {
        return false;
      }

      // Capabilities check
      if (requirement.requiredCapabilities) {
        const deviceCapabilities = device.capabilities.features;
        return requirement.requiredCapabilities.every(cap => deviceCapabilities.includes(cap));
      }

      return true;
    });
  }

  /**
   * Get device status and metrics
   */
  getDeviceStatus(deviceId: string): { device?: MobileDevice; metrics?: DeviceMetrics[] } {
    const device = this.devices.get(deviceId);
    const metrics = this.metrics.get(deviceId) || [];

    return {
      device,
      metrics: metrics.slice(-100) // Last 100 metrics entries
    };
  }

  /**
   * Get all devices with their status
   */
  getAllDevices(): MobileDevice[] {
    return Array.from(this.devices.values());
  }

  /**
   * Get provider status
   */
  getProviderStatus(): DeviceProviderConfig[] {
    return Array.from(this.providers.values());
  }

  /**
   * Get active reservations
   */
  getActiveReservations(): Array<DeviceReservation & { device: MobileDevice }> {
    const activeReservations: Array<DeviceReservation & { device: MobileDevice }> = [];

    for (const [reservationId, reservation] of this.reservations) {
      if (reservation.status === 'active') {
        const device = Array.from(this.devices.values()).find(d => d.reservation?.id === reservationId);
        if (device) {
          activeReservations.push({ ...reservation, device });
        }
      }
    }

    return activeReservations;
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    this.healthMonitor.on('device-health-update', (deviceId: string, metrics: DeviceMetrics) => {
      const device = this.devices.get(deviceId);
      if (device) {
        device.metrics = {
          ...device.metrics,
          cpu: metrics.cpu,
          memory: metrics.memory,
          battery: metrics.battery,
          temperature: metrics.temperature
        };
      }

      // Store metrics
      const deviceMetrics = this.metrics.get(deviceId) || [];
      deviceMetrics.push(metrics);

      // Keep only last N metrics (configurable)
      const maxMetrics = 1000;
      if (deviceMetrics.length > maxMetrics) {
        deviceMetrics.splice(0, deviceMetrics.length - maxMetrics);
      }

      this.metrics.set(deviceId, deviceMetrics);

      this.emit('device-metrics-updated', { deviceId, metrics });
    });

    // Health monitor start disabled for Cloudflare Workers compatibility
    // this.healthMonitor.start();
  }

  /**
   * Start automatic device discovery
   */
  private startAutoDiscovery(): void {
    if (!this.config.enableAutoDiscovery) return;

    // Auto discovery disabled for Cloudflare Workers compatibility
    // setInterval(async () => {
    //   try {
    //     await this.discoverDevices();
    //   } catch (error) {
    //     console.error('Auto discovery failed:', error);
    //   }
    // }, 300000);

    // Initial discovery disabled for Cloudflare Workers compatibility
    // this.discoverDevices().catch(console.error);
  }

  /**
   * Start resource optimization
   */
  private startResourceOptimization(): void {
    if (!this.config.enableResourceOptimization) return;

    setInterval(async () => {
      try {
        await this.optimizeResources();
      } catch (error) {
        console.error('Resource optimization failed:', error);
      }
    }, 60000); // Every minute
  }

  /**
   * Start cleanup process
   */
  private startCleanup(): void {
    setInterval(async () => {
      try {
        await this.cleanup();
      } catch (error) {
        console.error('Cleanup failed:', error);
      }
    }, this.config.cleanupInterval);
  }

  /**
   * Optimize device resources
   */
  private async optimizeResources(): Promise<void> {
    // Find devices that have been idle too long
    const now = Date.now();
    const maxIdleTime = this.config.maxDeviceIdleTime;

    for (const [deviceId, device] of this.devices) {
      if (device.status === 'available') {
        const idleTime = now - device.lastSeen.getTime();
        if (idleTime > maxIdleTime) {
          // Put device in maintenance mode or disconnect
          device.status = 'offline';
          this.emit('device-idle-timeout', device);
          console.log(`⚠️ Device ${device.name} idle timeout, status set to offline`);
        }
      }
    }

    // Optimize resource allocation
    this.resourceOptimizer.optimize(this.devices, this.reservations);
  }

  /**
   * Cleanup old data
   */
  private async cleanup(): Promise<void> {
    // Cleanup old metrics
    const retentionMs = this.config.metricsRetentionDays * 24 * 60 * 60 * 1000;
    const cutoffTime = Date.now() - retentionMs;

    for (const [deviceId, metrics] of this.metrics) {
      const filteredMetrics = metrics.filter(m => m.timestamp.getTime() > cutoffTime);
      this.metrics.set(deviceId, filteredMetrics);
    }

    // Cleanup old discoveries
    for (const [discoveryId, discovery] of this.discoveries) {
      if (discovery.status === 'completed' && discovery.endTime) {
        const age = Date.now() - discovery.endTime.getTime();
        if (age > retentionMs) {
          this.discoveries.delete(discoveryId);
        }
      }
    }
  }

  /**
   * Process pending device reservations
   */
  private async processPendingReservations(deviceId: string): Promise<void> {
    const device = this.devices.get(deviceId);
    if (!device || device.status !== 'available') return;

    // This would implement reservation queuing logic
    console.log(`📋 Checking pending reservations for device ${device.name}`);
  }

  /**
   * Remove device from all pools
   */
  private async removeDeviceFromPools(deviceId: string): Promise<void> {
    for (const [poolId, pool] of this.pools) {
      const index = pool.devices.findIndex(d => d.id === deviceId);
      if (index >= 0) {
        pool.devices.splice(index, 1);
        pool.metrics.totalDevices--;
        if (device.status === 'available') {
          pool.metrics.availableDevices--;
        }
      }
    }
  }

  /**
   * Cancel all reservations for a device
   */
  private async cancelDeviceReservations(deviceId: string): Promise<void> {
    const reservationsToCancel: string[] = [];

    for (const [reservationId, reservation] of this.reservations) {
      const device = Array.from(this.devices.values()).find(d => d.reservation?.id === reservationId);
      if (device && device.id === deviceId) {
        reservationsToCancel.push(reservationId);
      }
    }

    for (const reservationId of reservationsToCancel) {
      await this.releaseDevice(reservationId);
    }
  }

  /**
   * Get active reservation for device
   */
  private getActiveReservation(deviceId: string): DeviceReservation | undefined {
    for (const reservation of this.reservations.values()) {
      if (reservation.status === 'active') {
        const device = Array.from(this.devices.values()).find(d => d.reservation?.id === reservation.id);
        if (device && device.id === deviceId) {
          return reservation;
        }
      }
    }
    return undefined;
  }

  // Helper methods
  private validateDevice(device: MobileDevice): void {
    if (!device.id || !device.name || !device.platform) {
      throw new Error('Device must have id, name, and platform');
    }
  }

  private async initializeDevice(device: MobileDevice): Promise<void> {
    device.lastSeen = new Date();
    // Additional device initialization logic
  }

  private async updateDevice(device: MobileDevice): Promise<void> {
    const existingDevice = this.devices.get(device.id);
    if (existingDevice) {
      Object.assign(existingDevice, device);
      this.emit('device-updated', existingDevice);
    }
  }

  private async disconnectDevice(device: MobileDevice): Promise<void> {
    device.status = 'offline';
    device.lastSeen = new Date();
    // Additional cleanup logic
  }

  private generateDeviceId(): string {
    return `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateReservationId(): string {
    return `res_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateDiscoveryId(): string {
    return `disc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async executeCommand(command: string, options: any = {}): Promise<any> {
    // This would execute shell commands
    // For now, return a mock result
    return {
      stdout: '',
      stderr: '',
      exitCode: 0
    };
  }

  private compareVersions(version1: string, version2: string): number {
    const v1Parts = version1.split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);

    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
      const v1 = v1Parts[i] || 0;
      const v2 = v2Parts[i] || 0;
      if (v1 < v2) return -1;
      if (v1 > v2) return 1;
    }
    return 0;
  }

  /**
   * Shutdown device manager
   */
  async shutdown(): Promise<void> {
    // Stop health monitoring
    this.healthMonitor.stop();

    // Cancel all active reservations
    for (const reservationId of Array.from(this.reservations.keys())) {
      await this.releaseDevice(reservationId);
    }

    // Disconnect from all devices
    for (const device of this.devices.values()) {
      await this.disconnectDevice(device);
    }

    // Clear all data
    this.devices.clear();
    this.pools.clear();
    this.reservations.clear();
    this.schedules.clear();
    this.discoveries.clear();
    this.metrics.clear();

    this.removeAllListeners();
    console.log('Device Manager shutdown completed');
  }
}

interface DeviceManagerConfig {
  healthCheckInterval: number;
  metricsRetentionDays: number;
  enableAutoDiscovery: boolean;
  enableAutoHealing: boolean;
  enablePredictiveMaintenance: boolean;
  maxDiscoveryRetries: number;
  defaultReservationTime: number;
  cleanupInterval: number;
  enableResourceOptimization: boolean;
  enableLoadBalancing: boolean;
  enableFairShare: boolean;
}

// Supporting classes
class DeviceHealthMonitor extends EventEmitter {
  private interval: number;
  private timer: NodeJS.Timeout | null = null;
  private deviceMetrics: Map<string, any> = new Map();

  constructor(interval: number) {
    super();
    this.interval = interval;
  }

  addDevice(device: MobileDevice): void {
    this.deviceMetrics.set(device.id, { lastCheck: new Date(), status: 'healthy' });
  }

  removeDevice(deviceId: string): void {
    this.deviceMetrics.delete(deviceId);
  }

  start(): void {
    if (this.timer) return;

    this.timer = setInterval(async () => {
      await this.checkAllDevices();
    }, this.interval);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async checkAllDevices(): Promise<void> {
    // Implementation for health checking
  }
}

class ResourceOptimizer {
  optimize(devices: Map<string, MobileDevice>, reservations: Map<string, DeviceReservation>): void {
    // Implementation for resource optimization
  }
}

// DeviceManager is already exported with its class declaration