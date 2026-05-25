/**
 * Device Management and Orchestration Service
 *
 * Comprehensive device pool management system providing:
 * - Device inventory management and discovery
 * - Device allocation and reservation system
 * - Real-time device status monitoring
 * - Device preparation and cleanup procedures
 * - Device health checks and maintenance
 */

import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface DeviceManagerConfig {
  discoveryInterval?: number;
  healthCheckInterval?: number;
  maxRetries?: number;
  retryDelay?: number;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  providers?: DeviceProvider[];
  maintenanceWindow?: {
    start: string;
    end: string;
    timezone: string;
  };
}

export interface DeviceProvider {
  id: string;
  name: string;
  type: 'local' | 'cloud' | 'hybrid';
  supportedPlatforms: DevicePlatform[];
  config: ProviderConfig;
  enabled: boolean;
  priority: number;
}

export interface ProviderConfig {
  apiKey?: string;
  endpoint?: string;
  region?: string;
  credentials?: Record<string, string>;
  settings?: Record<string, any>;
}

export type DevicePlatform = 'ios' | 'android' | 'web' | 'api';

export interface Device {
  id: string;
  name: string;
  platform: DevicePlatform;
  type: DeviceType;
  status: DeviceStatus;
  capabilities: DeviceCapability[];
  location: DeviceLocation;
  provider: string;
  metadata: DeviceMetadata;
  health: DeviceHealth;
  allocation?: DeviceAllocation;
  lastSeen: Date;
  createdAt: Date;
}

export type DeviceType =
  | 'physical_device'
  | 'simulator'
  | 'emulator'
  | 'browser'
  | 'virtual_machine'
  | 'container'
  | 'cloud_device';

export type DeviceStatus =
  | 'available'
  | 'busy'
  | 'reserved'
  | 'maintenance'
  | 'offline'
  | 'error'
  | 'disconnected'
  | 'updating'
  | 'preparing'
  | 'cleaning';

export interface DeviceCapability {
  name: string;
  supported: boolean;
  version?: string;
  configuration?: Record<string, any>;
  description?: string;
}

export interface DeviceLocation {
  type: 'local' | 'cloud' | 'remote';
  datacenter?: string;
  region?: string;
  hostname?: string;
  port?: number;
  address?: string;
}

export interface DeviceMetadata {
  platform: {
    name: string;
    version: string;
    build?: string;
  };
  hardware: {
    model: string;
    manufacturer: string;
    cpu: string;
    memory: number;
    storage: number;
    screen?: ScreenInfo;
  };
  network: {
    type: string;
    speed?: number;
    latency?: number;
    carrier?: string;
  };
  software: {
    installedApps: string[];
    version: string;
    jailbroken?: boolean;
    developerMode?: boolean;
  };
  custom?: Record<string, any>;
}

export interface ScreenInfo {
  width: number;
  height: number;
  density: number;
  diagonal?: number;
  type?: 'lcd' | 'oled' | 'retina';
}

export interface DeviceHealth {
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  lastCheck: Date;
  checks: HealthCheck[];
  overallScore: number;
  issues: HealthIssue[];
  maintenanceDue?: Date;
}

export interface HealthCheck {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  timestamp: Date;
  duration: number;
  metrics?: Record<string, number>;
}

export interface HealthIssue {
  type: IssueType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  detectedAt: Date;
  resolvedAt?: Date;
  resolution?: string;
}

export type IssueType =
  | 'connectivity'
  | 'performance'
  | 'storage'
  | 'memory'
  | 'battery'
  | 'temperature'
  | 'software'
  | 'hardware'
  | 'network'
  | 'security';

export interface DeviceAllocation {
  allocatedTo: string;
  allocatedBy: string;
  allocatedAt: Date;
  expiresAt?: Date;
  purpose: AllocationPurpose;
  sessionId?: string;
  projectId?: string;
  testId?: string;
  exclusive: boolean;
  metadata?: Record<string, any>;
}

export type AllocationPurpose =
  | 'test_execution'
  | 'maintenance'
  | 'preparation'
  | 'cleanup'
  | 'health_check'
  | 'diagnostics';

export interface DeviceReservation {
  id: string;
  deviceId: string;
  userId: string;
  projectId?: string;
  startTime: Date;
  endTime: Date;
  priority: ReservationPriority;
  requirements: DeviceRequirement[];
  purpose: string;
  status: 'pending' | 'confirmed' | 'active' | 'completed' | 'cancelled';
  metadata?: Record<string, any>;
}

export type ReservationPriority = 'low' | 'medium' | 'high' | 'critical';

export interface DeviceRequirement {
  type: 'platform' | 'capability' | 'metadata' | 'location';
  field: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'exists';
  value: any;
  required: boolean;
}

export interface DevicePool {
  id: string;
  name: string;
  description?: string;
  devices: string[];
  filters: DeviceRequirement[];
  allocationStrategy: AllocationStrategy;
  priority: number;
  enabled: boolean;
  metadata?: Record<string, any>;
}

export type AllocationStrategy =
  | 'round_robin'
  | 'least_used'
  | 'random'
  | 'priority_based'
  | 'performance_based'
  | 'location_based';

export interface DeviceStatistics {
  totalDevices: number;
  devicesByPlatform: Record<DevicePlatform, number>;
  devicesByStatus: Record<DeviceStatus, number>;
  devicesByType: Record<DeviceType, number>;
  devicesByProvider: Record<string, number>;
  utilizationRate: number;
  averageResponseTime: number;
  healthDistribution: Record<'healthy' | 'warning' | 'critical' | 'unknown', number>;
  maintenanceSchedule: MaintenanceWindow[];
}

export interface MaintenanceWindow {
  deviceId: string;
  type: MaintenanceType;
  scheduledStart: Date;
  scheduledEnd: Date;
  actualStart?: Date;
  actualEnd?: Date;
  status: 'scheduled' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  tasks: MaintenanceTask[];
  performedBy?: string;
  notes?: string;
}

export type MaintenanceType =
  | 'health_check'
  | 'software_update'
  | 'cleanup'
  | 'calibration'
  | 'repair'
  | 'upgrade'
  | 'backup'
  | 'security_scan';

export interface MaintenanceTask {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  duration?: number;
  result?: string;
  error?: string;
}

export interface DeviceEvent {
  type: DeviceEventType;
  deviceId: string;
  timestamp: Date;
  data: Record<string, any>;
  source: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
}

export type DeviceEventType =
  | 'device_discovered'
  | 'device_connected'
  | 'device_disconnected'
  | 'device_allocated'
  | 'device_released'
  | 'health_check_completed'
  | 'maintenance_started'
  | 'maintenance_completed'
  | 'error_occurred'
  | 'configuration_changed'
  | 'performance_issue'
  | 'capacity_threshold_reached';

export class DeviceManager extends EventEmitter {
  private devices: Map<string, Device> = new Map();
  private pools: Map<string, DevicePool> = new Map();
  private reservations: Map<string, DeviceReservation> = new Map();
  private allocations: Map<string, DeviceAllocation> = new Map();
  private providers: Map<string, DeviceProvider> = new Map();
  private config: DeviceManagerConfig;
  private discoveryTimer?: NodeJS.Timeout;
  private healthCheckTimer?: NodeJS.Timeout;
  private maintenanceTasks: Map<string, MaintenanceWindow> = new Map();

  constructor(config: DeviceManagerConfig = {}) {
    super();

    this.config = {
      discoveryInterval: config.discoveryInterval || 60000, // 1 minute
      healthCheckInterval: config.healthCheckInterval || 300000, // 5 minutes
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 5000,
      logLevel: config.logLevel || 'info',
      providers: config.providers || [],
      maintenanceWindow: config.maintenanceWindow
    };

    this.setupEventHandlers();
    this.initializeProviders();
  }

  /**
   * Start device management services
   */
  async start(): Promise<void> {
    try {
      this.log('info', 'Starting device manager...');

      // Initialize providers
      await this.initializeProviders();

      // Discover devices
      await this.discoverDevices();

      // Start periodic tasks
      this.startPeriodicTasks();

      // Load device pools
      await this.loadDevicePools();

      this.log('info', 'Device manager started successfully');
      this.emit('manager_started', { timestamp: new Date() });

    } catch (error) {
      this.log('error', `Failed to start device manager: ${error.message}`);
      throw error;
    }
  }

  /**
   * Stop device management services
   */
  async stop(): Promise<void> {
    try {
      this.log('info', 'Stopping device manager...');

      // Stop periodic tasks
      if (this.discoveryTimer) {
        clearInterval(this.discoveryTimer);
      }

      if (this.healthCheckTimer) {
        clearInterval(this.healthCheckTimer);
      }

      // Release all allocations
      await this.releaseAllAllocations();

      // Cleanup providers
      await this.cleanupProviders();

      this.log('info', 'Device manager stopped');
      this.emit('manager_stopped', { timestamp: new Date() });

    } catch (error) {
      this.log('error', `Error stopping device manager: ${error.message}`);
    }
  }

  /**
   * Discover all available devices
   */
  async discoverDevices(): Promise<Device[]> {
    const discoveredDevices: Device[] = [];

    for (const provider of this.providers.values()) {
      if (provider.enabled) {
        try {
          const devices = await this.discoverDevicesFromProvider(provider);
          discoveredDevices.push(...devices);
        } catch (error) {
          this.log('warn', `Failed to discover devices from provider ${provider.name}: ${error.message}`);
        }
      }
    }

    // Update device registry
    for (const device of discoveredDevices) {
      const existingDevice = this.devices.get(device.id);

      if (existingDevice) {
        // Update existing device
        this.updateDevice(device.id, { ...device, lastSeen: new Date() });
      } else {
        // Add new device
        this.devices.set(device.id, device);
        this.emit('device_discovered', {
          type: 'device_discovered',
          deviceId: device.id,
          timestamp: new Date(),
          data: { device },
          source: provider.name,
          severity: 'info'
        } as DeviceEvent);
      }
    }

    // Remove devices that are no longer available
    await this.cleanupStaleDevices(discoveredDevices.map(d => d.id));

    this.log('info', `Discovered ${discoveredDevices.length} devices`);
    return discoveredDevices;
  }

  /**
   * Get available devices
   */
  async getAvailableDevices(filters?: {
    platform?: DevicePlatform;
    type?: DeviceType;
    provider?: string;
    capabilities?: string[];
    location?: string;
    minHealthScore?: number;
  }): Promise<Device[]> {
    let devices = Array.from(this.devices.values());

    // Filter by status
    devices = devices.filter(device => device.status === 'available');

    // Apply additional filters
    if (filters) {
      if (filters.platform) {
        devices = devices.filter(device => device.platform === filters.platform);
      }

      if (filters.type) {
        devices = devices.filter(device => device.type === filters.type);
      }

      if (filters.provider) {
        devices = devices.filter(device => device.provider === filters.provider);
      }

      if (filters.capabilities?.length) {
        devices = devices.filter(device =>
          filters.capabilities!.every(cap =>
            device.capabilities.some(deviceCap =>
              deviceCap.name === cap && deviceCap.supported
            )
          )
        );
      }

      if (filters.location) {
        devices = devices.filter(device =>
          device.location.datacenter === filters.location ||
          device.location.region === filters.location
        );
      }

      if (filters.minHealthScore) {
        devices = devices.filter(device =>
          device.health.overallScore >= filters.minHealthScore!
        );
      }
    }

    return devices;
  }

  /**
   * Allocate a device
   */
  async allocateDevice(requirements: {
    userId: string;
    projectId?: string;
    testId?: string;
    platform?: DevicePlatform;
    type?: DeviceType;
    capabilities?: string[];
    provider?: string;
    location?: string;
    exclusive?: boolean;
    duration?: number;
    priority?: ReservationPriority;
  }): Promise<DeviceAllocation | null> {
    try {
      // Find suitable device
      const device = await this.findSuitableDevice(requirements);

      if (!device) {
        this.log('warn', `No suitable device found for requirements: ${JSON.stringify(requirements)}`);
        return null;
      }

      // Create allocation
      const allocation: DeviceAllocation = {
        allocatedTo: requirements.userId,
        allocatedBy: 'system',
        allocatedAt: new Date(),
        expiresAt: requirements.duration ? new Date(Date.now() + requirements.duration) : undefined,
        purpose: 'test_execution',
        sessionId: this.generateSessionId(),
        projectId: requirements.projectId,
        testId: requirements.testId,
        exclusive: requirements.exclusive || false,
        metadata: { requirements }
      };

      // Update device status
      await this.updateDevice(device.id, {
        status: 'busy',
        allocation
      });

      // Store allocation
      this.allocations.set(allocation.allocatedTo, allocation);

      this.log('info', `Device ${device.id} allocated to user ${requirements.userId}`);
      this.emit('device_allocated', {
        type: 'device_allocated',
        deviceId: device.id,
        timestamp: new Date(),
        data: { allocation, device },
        source: 'device_manager',
        severity: 'info'
      } as DeviceEvent);

      return allocation;

    } catch (error) {
      this.log('error', `Failed to allocate device: ${error.message}`);
      return null;
    }
  }

  /**
   * Release a device
   */
  async releaseDevice(deviceId: string, userId: string, reason?: string): Promise<boolean> {
    try {
      const device = this.devices.get(deviceId);

      if (!device) {
        this.log('warn', `Device ${deviceId} not found`);
        return false;
      }

      if (device.allocation?.allocatedTo !== userId) {
        this.log('warn', `Device ${deviceId} not allocated to user ${userId}`);
        return false;
      }

      // Remove allocation
      this.allocations.delete(userId);

      // Update device status
      await this.updateDevice(deviceId, {
        status: 'available',
        allocation: undefined
      });

      this.log('info', `Device ${deviceId} released by user ${userId}${reason ? ` (${reason})` : ''}`);
      this.emit('device_released', {
        type: 'device_released',
        deviceId: deviceId,
        timestamp: new Date(),
        data: { userId, reason },
        source: 'device_manager',
        severity: 'info'
      } as DeviceEvent);

      return true;

    } catch (error) {
      this.log('error', `Failed to release device ${deviceId}: ${error.message}`);
      return false;
    }
  }

  /**
   * Get device information
   */
  async getDeviceInfo(deviceId: string): Promise<Device | null> {
    return this.devices.get(deviceId) || null;
  }

  /**
   * Get device status
   */
  async getDeviceStatus(deviceId: string): Promise<DeviceStatus | null> {
    const device = this.devices.get(deviceId);
    return device?.status || null;
  }

  /**
   * Reserve a device
   */
  async reserveDevice(reservation: Omit<DeviceReservation, 'id' | 'status'>): Promise<string> {
    const reservationId = this.generateReservationId();

    const fullReservation: DeviceReservation = {
      ...reservation,
      id: reservationId,
      status: 'pending'
    };

    this.reservations.set(reservationId, fullReservation);

    this.log('info', `Device reservation created: ${reservationId}`);
    return reservationId;
  }

  /**
   * Confirm a reservation
   */
  async confirmReservation(reservationId: string): Promise<boolean> {
    const reservation = this.reservations.get(reservationId);

    if (!reservation) {
      return false;
    }

    // Check if reservation is still valid
    if (new Date() > reservation.endTime) {
      this.reservations.delete(reservationId);
      return false;
    }

    // Find and allocate suitable device
    const requirements = this.convertReservationToRequirements(reservation);
    const allocation = await this.allocateDevice(requirements);

    if (allocation) {
      reservation.status = 'confirmed';
      reservation.metadata = { ...reservation.metadata, allocationId: allocation.allocatedTo };

      this.log('info', `Reservation ${reservationId} confirmed with device allocation`);
      return true;
    } else {
      reservation.status = 'cancelled';
      this.reservations.delete(reservationId);

      this.log('warn', `Reservation ${reservationId} cancelled - no suitable device available`);
      return false;
    }
  }

  /**
   * Cancel a reservation
   */
  async cancelReservation(reservationId: string, reason?: string): Promise<boolean> {
    const reservation = this.reservations.get(reservationId);

    if (!reservation) {
      return false;
    }

    reservation.status = 'cancelled';
    this.reservations.delete(reservationId);

    this.log('info', `Reservation ${reservationId} cancelled${reason ? ` (${reason})` : ''}`);
    return true;
  }

  /**
   * Get device statistics
   */
  async getStatistics(): Promise<DeviceStatistics> {
    const devices = Array.from(this.devices.values());

    const stats: DeviceStatistics = {
      totalDevices: devices.length,
      devicesByPlatform: {} as Record<DevicePlatform, number>,
      devicesByStatus: {} as Record<DeviceStatus, number>,
      devicesByType: {} as Record<DeviceType, number>,
      devicesByProvider: {} as Record<string, number>,
      utilizationRate: this.calculateUtilizationRate(devices),
      averageResponseTime: this.calculateAverageResponseTime(),
      healthDistribution: {} as Record<'healthy' | 'warning' | 'critical' | 'unknown', number>,
      maintenanceSchedule: []
    };

    // Calculate distributions
    for (const device of devices) {
      // Platform distribution
      stats.devicesByPlatform[device.platform] = (stats.devicesByPlatform[device.platform] || 0) + 1;

      // Status distribution
      stats.devicesByStatus[device.status] = (stats.devicesByStatus[device.status] || 0) + 1;

      // Type distribution
      stats.devicesByType[device.type] = (stats.devicesByType[device.type] || 0) + 1;

      // Provider distribution
      stats.devicesByProvider[device.provider] = (stats.devicesByProvider[device.provider] || 0) + 1;

      // Health distribution
      stats.healthDistribution[device.health.status] = (stats.healthDistribution[device.health.status] || 0) + 1;
    }

    return stats;
  }

  /**
   * Perform health check on a device
   */
  async performHealthCheck(deviceId: string): Promise<DeviceHealth> {
    const device = this.devices.get(deviceId);

    if (!device) {
      throw new Error(`Device ${deviceId} not found`);
    }

    const health = await this.checkDeviceHealth(device);

    // Update device health
    await this.updateDevice(deviceId, { health });

    this.emit('health_check_completed', {
      type: 'health_check_completed',
      deviceId: deviceId,
      timestamp: new Date(),
      data: { health },
      source: 'device_manager',
      severity: health.status === 'critical' ? 'error' : 'info'
    } as DeviceEvent);

    return health;
  }

  /**
   * Schedule maintenance for a device
   */
  async scheduleMaintenance(deviceId: string, maintenance: Omit<MaintenanceWindow, 'deviceId' | 'status'>): Promise<string> {
    const maintenanceId = this.generateMaintenanceId();

    const fullMaintenance: MaintenanceWindow = {
      ...maintenance,
      deviceId,
      status: 'scheduled'
    };

    this.maintenanceTasks.set(maintenanceId, fullMaintenance);

    // Update device status
    await this.updateDevice(deviceId, { status: 'maintenance' });

    this.log('info', `Maintenance scheduled for device ${deviceId}: ${maintenanceId}`);
    return maintenanceId;
  }

  /**
   * Get device pools
   */
  async getDevicePools(): Promise<DevicePool[]> {
    return Array.from(this.pools.values());
  }

  /**
   * Create device pool
   */
  async createDevicePool(pool: Omit<DevicePool, 'id'>): Promise<string> {
    const poolId = this.generatePoolId();

    const fullPool: DevicePool = {
      ...pool,
      id: poolId
    };

    this.pools.set(poolId, fullPool);

    this.log('info', `Device pool created: ${poolId}`);
    return poolId;
  }

  /**
   * Get devices from a pool
   */
  async getPoolDevices(poolId: string): Promise<Device[]> {
    const pool = this.pools.get(poolId);

    if (!pool) {
      return [];
    }

    return pool.devices
      .map(deviceId => this.devices.get(deviceId))
      .filter((device): device is Device => device !== undefined);
  }

  /**
   * Initialize device providers
   */
  private async initializeProviders(): Promise<void> {
    // Add default providers
    const defaultProviders: DeviceProvider[] = [
      {
        id: 'local-mobile',
        name: 'Local Mobile Devices',
        type: 'local',
        supportedPlatforms: ['ios', 'android'],
        config: {},
        enabled: true,
        priority: 1
      },
      {
        id: 'local-web',
        name: 'Local Web Browsers',
        type: 'local',
        supportedPlatforms: ['web'],
        config: {},
        enabled: true,
        priority: 1
      },
      {
        id: 'browserstack',
        name: 'BrowserStack Cloud',
        type: 'cloud',
        supportedPlatforms: ['ios', 'android', 'web'],
        config: {
          endpoint: 'https://api.browserstack.com',
          region: 'us-west-1'
        },
        enabled: false,
        priority: 2
      }
    ];

    for (const provider of [...defaultProviders, ...(this.config.providers || [])]) {
      this.providers.set(provider.id, provider);
    }
  }

  /**
   * Discover devices from a provider
   */
  private async discoverDevicesFromProvider(provider: DeviceProvider): Promise<Device[]> {
    // This would integrate with actual device providers
    // For now, return mock devices

    if (provider.type === 'local') {
      return this.discoverLocalDevices(provider);
    } else if (provider.type === 'cloud') {
      return this.discoverCloudDevices(provider);
    }

    return [];
  }

  /**
   * Discover local devices
   */
  private async discoverLocalDevices(provider: DeviceProvider): Promise<Device[]> {
    const devices: Device[] = [];

    // Mock iOS devices
    if (provider.supportedPlatforms.includes('ios')) {
      devices.push({
        id: 'ios-simulator-iphone-14',
        name: 'iPhone 14 Simulator',
        platform: 'ios',
        type: 'simulator',
        status: 'available',
        capabilities: [
          { name: 'touch', supported: true },
          { name: 'screenshot', supported: true },
          { name: 'video', supported: true },
          { name: 'network', supported: true }
        ],
        location: {
          type: 'local',
          hostname: 'localhost',
          port: 8080
        },
        provider: provider.id,
        metadata: {
          platform: {
            name: 'iOS',
            version: '16.1',
            build: '20B72'
          },
          hardware: {
            model: 'iPhone 14',
            manufacturer: 'Apple',
            cpu: 'Apple A15 Bionic',
            memory: 6144,
            storage: 128000,
            screen: {
              width: 390,
              height: 844,
              density: 3,
              type: 'retina'
            }
          },
          network: {
            type: 'wifi',
            carrier: undefined
          },
          software: {
            installedApps: ['Safari', 'Mail'],
            version: '16.1',
            developerMode: true
          }
        },
        health: {
          status: 'healthy',
          lastCheck: new Date(),
          checks: [],
          overallScore: 100,
          issues: []
        },
        lastSeen: new Date(),
        createdAt: new Date()
      });
    }

    // Mock Android devices
    if (provider.supportedPlatforms.includes('android')) {
      devices.push({
        id: 'android-emulator-pixel-4',
        name: 'Pixel 4 Emulator',
        platform: 'android',
        type: 'emulator',
        status: 'available',
        capabilities: [
          { name: 'touch', supported: true },
          { name: 'screenshot', supported: true },
          { name: 'video', supported: true },
          { name: 'network', supported: true }
        ],
        location: {
          type: 'local',
          hostname: 'localhost',
          port: 5554
        },
        provider: provider.id,
        metadata: {
          platform: {
            name: 'Android',
            version: '13',
            build: 'TQ3A.230901.001'
          },
          hardware: {
            model: 'Pixel 4',
            manufacturer: 'Google',
            cpu: 'Snapdragon 855',
            memory: 6144,
            storage: 128000,
            screen: {
              width: 411,
              height: 869,
              density: 2.625,
              type: 'oled'
            }
          },
          network: {
            type: 'wifi',
            carrier: undefined
          },
          software: {
            installedApps: ['Chrome', 'Gmail'],
            version: '13',
            developerMode: true
          }
        },
        health: {
          status: 'healthy',
          lastCheck: new Date(),
          checks: [],
          overallScore: 100,
          issues: []
        },
        lastSeen: new Date(),
        createdAt: new Date()
      });
    }

    // Mock web browsers
    if (provider.supportedPlatforms.includes('web')) {
      const browsers = ['Chrome', 'Firefox', 'Safari', 'Edge'];

      browsers.forEach(browser => {
        devices.push({
          id: `browser-${browser.toLowerCase()}`,
          name: `${browser} Browser`,
          platform: 'web',
          type: 'browser',
          status: 'available',
          capabilities: [
            { name: 'screenshot', supported: true },
            { name: 'video', supported: true },
            { name: 'network', supported: true },
            { name: 'javascript', supported: true }
          ],
          location: {
            type: 'local',
            hostname: 'localhost',
            port: 9000 + browsers.indexOf(browser)
          },
          provider: provider.id,
          metadata: {
            platform: {
              name: browser,
              version: 'latest'
            },
            hardware: {
              model: 'Web Browser',
              manufacturer: browser,
              cpu: 'System CPU',
              memory: 4096,
              storage: 512000
            },
            network: {
              type: 'wifi'
            },
            software: {
              installedApps: [],
              version: 'latest'
            }
          },
          health: {
            status: 'healthy',
            lastCheck: new Date(),
            checks: [],
            overallScore: 100,
            issues: []
          },
          lastSeen: new Date(),
          createdAt: new Date()
        });
      });
    }

    return devices;
  }

  /**
   * Discover cloud devices
   */
  private async discoverCloudDevices(provider: DeviceProvider): Promise<Device[]> {
    // This would integrate with cloud device providers like BrowserStack
    // For now, return empty array
    return [];
  }

  /**
   * Start periodic tasks
   */
  private startPeriodicTasks(): void {
    // Device discovery
    this.discoveryTimer = setInterval(async () => {
      try {
        await this.discoverDevices();
      } catch (error) {
        this.log('error', `Device discovery failed: ${error.message}`);
      }
    }, this.config.discoveryInterval);

    // Health checks
    this.healthCheckTimer = setInterval(async () => {
      try {
        await this.performHealthChecks();
      } catch (error) {
        this.log('error', `Health checks failed: ${error.message}`);
      }
    }, this.config.healthCheckInterval);
  }

  /**
   * Perform health checks on all devices
   */
  private async performHealthChecks(): Promise<void> {
    for (const device of this.devices.values()) {
      if (device.status !== 'offline' && device.status !== 'maintenance') {
        try {
          await this.performHealthCheck(device.id);
        } catch (error) {
          this.log('warn', `Health check failed for device ${device.id}: ${error.message}`);
        }
      }
    }
  }

  /**
   * Load device pools
   */
  private async loadDevicePools(): Promise<void> {
    // This would load pools from configuration or database
    // For now, create default pools

    const defaultPools: Omit<DevicePool, 'id'>[] = [
      {
        name: 'Mobile Devices',
        description: 'All mobile devices (iOS and Android)',
        devices: [],
        filters: [
          {
            type: 'platform',
            field: 'platform',
            operator: 'in',
            value: ['ios', 'android'],
            required: true
          }
        ],
        allocationStrategy: 'least_used',
        priority: 1,
        enabled: true
      },
      {
        name: 'Web Browsers',
        description: 'All web browsers',
        devices: [],
        filters: [
          {
            type: 'platform',
            field: 'platform',
            operator: 'equals',
            value: 'web',
            required: true
          }
        ],
        allocationStrategy: 'round_robin',
        priority: 2,
        enabled: true
      }
    ];

    for (const pool of defaultPools) {
      await this.createDevicePool(pool);
    }
  }

  /**
   * Find suitable device for requirements
   */
  private async findSuitableDevice(requirements: {
    userId: string;
    projectId?: string;
    testId?: string;
    platform?: DevicePlatform;
    type?: DeviceType;
    capabilities?: string[];
    provider?: string;
    location?: string;
    exclusive?: boolean;
    duration?: number;
    priority?: ReservationPriority;
  }): Promise<Device | null> {
    const availableDevices = await this.getAvailableDevices({
      platform: requirements.platform,
      type: requirements.type,
      provider: requirements.provider,
      capabilities: requirements.capabilities,
      location: requirements.location
    });

    if (availableDevices.length === 0) {
      return null;
    }

    // Sort devices by preference
    availableDevices.sort((a, b) => {
      // Prefer devices with better health
      const healthDiff = b.health.overallScore - a.health.overallScore;
      if (healthDiff !== 0) return healthDiff;

      // Prefer recently used devices
      const timeDiff = a.lastSeen.getTime() - b.lastSeen.getTime();
      return timeDiff;
    });

    return availableDevices[0];
  }

  /**
   * Update device information
   */
  private async updateDevice(deviceId: string, updates: Partial<Device>): Promise<void> {
    const device = this.devices.get(deviceId);

    if (device) {
      const updatedDevice = { ...device, ...updates };
      this.devices.set(deviceId, updatedDevice);
    }
  }

  /**
   * Clean up stale devices
   */
  private async cleanupStaleDevices(activeDeviceIds: string[]): Promise<void> {
    for (const [deviceId, device] of this.devices.entries()) {
      if (!activeDeviceIds.includes(deviceId)) {
        // Device hasn't been seen in recent discovery
        const timeSinceLastSeen = Date.now() - device.lastSeen.getTime();

        if (timeSinceLastSeen > 300000) { // 5 minutes
          await this.updateDevice(deviceId, { status: 'offline' });

          this.log('warn', `Device ${deviceId} marked as offline (not seen for ${Math.round(timeSinceLastSeen / 1000)}s)`);
        }
      }
    }
  }

  /**
   * Check device health
   */
  private async checkDeviceHealth(device: Device): Promise<DeviceHealth> {
    const checks: HealthCheck[] = [];
    const issues: HealthIssue[] = [];
    let overallScore = 100;

    // Connectivity check
    const connectivityStart = Date.now();
    try {
      // This would perform actual connectivity test
      const connected = await this.testDeviceConnectivity(device);

      checks.push({
        name: 'connectivity',
        status: connected ? 'pass' : 'fail',
        message: connected ? 'Device is reachable' : 'Device is not reachable',
        timestamp: new Date(),
        duration: Date.now() - connectivityStart
      });

      if (!connected) {
        issues.push({
          type: 'connectivity',
          severity: 'critical',
          description: 'Device is not reachable',
          detectedAt: new Date()
        });
        overallScore -= 50;
      }
    } catch (error) {
      checks.push({
        name: 'connectivity',
        status: 'error',
        message: `Connectivity check failed: ${error.message}`,
        timestamp: new Date(),
        duration: Date.now() - connectivityStart
      });

      issues.push({
        type: 'connectivity',
        severity: 'critical',
        description: `Connectivity check error: ${error.message}`,
        detectedAt: new Date()
      });
      overallScore -= 50;
    }

    // Performance check
    if (device.status !== 'offline') {
      const performanceStart = Date.now();
      try {
        const performanceScore = await this.testDevicePerformance(device);

        checks.push({
          name: 'performance',
          status: performanceScore > 70 ? 'pass' : performanceScore > 40 ? 'warning' : 'fail',
          message: `Performance score: ${performanceScore}%`,
          timestamp: new Date(),
          duration: Date.now() - performanceStart,
          metrics: { score: performanceScore }
        });

        if (performanceScore < 70) {
          const severity = performanceScore < 40 ? 'high' : 'medium';
          issues.push({
            type: 'performance',
            severity,
            description: `Device performance is below threshold (${performanceScore}%)`,
            detectedAt: new Date()
          });
          overallScore -= (70 - performanceScore);
        }
      } catch (error) {
        checks.push({
          name: 'performance',
          status: 'error',
          message: `Performance check failed: ${error.message}`,
          timestamp: new Date(),
          duration: Date.now() - performanceStart
        });

        overallScore -= 25;
      }
    }

    // Resource check
    const resourceStart = Date.now();
    try {
      const resourceStatus = await this.checkDeviceResources(device);

      checks.push({
        name: 'resources',
        status: resourceStatus.healthy ? 'pass' : 'warning',
        message: resourceStatus.message,
        timestamp: new Date(),
        duration: Date.now() - resourceStart,
        metrics: resourceStatus.metrics
      });

      if (!resourceStatus.healthy) {
        issues.push({
          type: resourceStatus.issueType || 'performance',
          severity: 'medium',
          description: resourceStatus.message,
          detectedAt: new Date()
        });
        overallScore -= 20;
      }
    } catch (error) {
      checks.push({
        name: 'resources',
        status: 'error',
        message: `Resource check failed: ${error.message}`,
        timestamp: new Date(),
        duration: Date.now() - resourceStart
      });

      overallScore -= 20;
    }

    // Determine overall health status
    let status: 'healthy' | 'warning' | 'critical' | 'unknown' = 'healthy';

    if (issues.some(issue => issue.severity === 'critical')) {
      status = 'critical';
      overallScore = Math.min(overallScore, 30);
    } else if (issues.some(issue => issue.severity === 'high') || overallScore < 70) {
      status = 'warning';
      overallScore = Math.max(overallScore, 40);
    }

    return {
      status,
      lastCheck: new Date(),
      checks,
      overallScore: Math.max(0, overallScore),
      issues
    };
  }

  /**
   * Test device connectivity
   */
  private async testDeviceConnectivity(device: Device): Promise<boolean> {
    // This would implement actual connectivity testing
    // For now, return true for mock devices
    return device.status !== 'offline';
  }

  /**
   * Test device performance
   */
  private async testDevicePerformance(device: Device): Promise<number> {
    // This would implement actual performance testing
    // Return mock score based on device type and health
    return device.health.overallScore || 85;
  }

  /**
   * Check device resources
   */
  private async checkDeviceResources(device: Device): Promise<{
    healthy: boolean;
    message: string;
    issueType?: IssueType;
    metrics?: Record<string, number>;
  }> {
    // This would implement actual resource checking
    return {
      healthy: true,
      message: 'All resources are within normal limits',
      metrics: {
        cpuUsage: 45,
        memoryUsage: 60,
        storageUsage: 30,
        temperature: 35
      }
    };
  }

  /**
   * Release all allocations
   */
  private async releaseAllAllocations(): Promise<void> {
    for (const [userId, allocation] of this.allocations.entries()) {
      // Find device for this allocation
      const device = Array.from(this.devices.values()).find(d =>
        d.allocation?.allocatedTo === userId
      );

      if (device) {
        await this.updateDevice(device.id, {
          status: 'available',
          allocation: undefined
        });
      }
    }

    this.allocations.clear();
  }

  /**
   * Cleanup providers
   */
  private async cleanupProviders(): Promise<void> {
    // Cleanup provider resources
    for (const provider of this.providers.values()) {
      try {
        // Provider-specific cleanup
      } catch (error) {
        this.log('warn', `Error cleaning up provider ${provider.name}: ${error.message}`);
      }
    }
  }

  /**
   * Convert reservation to requirements
   */
  private convertReservationToRequirements(reservation: DeviceReservation): {
    userId: string;
    projectId?: string;
    platform?: DevicePlatform;
    type?: DeviceType;
    capabilities?: string[];
    provider?: string;
    location?: string;
    exclusive?: boolean;
    priority?: ReservationPriority;
  } {
    return {
      userId: reservation.userId,
      projectId: reservation.projectId,
      // Extract requirements from reservation filters
      platform: reservation.requirements.find(r => r.field === 'platform')?.value as DevicePlatform,
      type: reservation.requirements.find(r => r.field === 'type')?.value as DeviceType,
      // Convert other requirements...
      exclusive: true
    };
  }

  /**
   * Calculate utilization rate
   */
  private calculateUtilizationRate(devices: Device[]): number {
    if (devices.length === 0) return 0;

    const busyDevices = devices.filter(device =>
      device.status === 'busy' || device.status === 'reserved'
    ).length;

    return (busyDevices / devices.length) * 100;
  }

  /**
   * Calculate average response time
   */
  private calculateAverageResponseTime(): number {
    // This would track actual response times
    return 150; // Mock value in milliseconds
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    this.on('error', (error) => {
      this.log('error', `Device manager error: ${error.message}`);
    });
  }

  /**
   * Log messages
   */
  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string): void {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [DeviceManager:${level.toUpperCase()}] ${message}`);
  }

  /**
   * Generate unique IDs
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateReservationId(): string {
    return `res_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateMaintenanceId(): string {
    return `maint_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generatePoolId(): string {
    return `pool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
