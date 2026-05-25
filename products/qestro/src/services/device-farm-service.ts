/**
 * Device Farm Management Service
 * Enterprise-grade mobile device farm management and orchestration
 */

export interface DeviceFarm {
  id: string;
  name: string;
  description?: string;
  location: {
    name: string;
    address?: string;
    timezone: string;
    region: string;
  };
  capacity: {
    maxDevices: number;
    currentDevices: number;
    availableDevices: number;
  };
  configuration: {
    autoProvisioning: boolean;
    maintenanceWindow: {
      start: string; // HH:mm
      end: string;   // HH:mm
      timezone: string;
    };
    deviceRotation: boolean;
    healthCheckInterval: number; // minutes
  };
  networking: {
    vpnRequired: boolean;
    firewallRules: FirewallRule[];
    bandwidthLimit?: number; // Mbps
  };
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'maintenance' | 'offline';
}

export interface FirewallRule {
  id: string;
  name: string;
  action: 'allow' | 'deny';
  protocol: 'tcp' | 'udp' | 'icmp';
  source: string;
  destination: string;
  port?: number;
  description?: string;
}

export interface DeviceFarmMetrics {
  farmId: string;
  timestamp: string;
  utilization: {
    total: number;
    used: number;
    available: number;
    percentage: number;
  };
  performance: {
    averageTestDuration: number;
    successRate: number;
    errorRate: number;
    queueTime: number;
  };
  devices: {
    online: number;
    offline: number;
    error: number;
    maintenance: number;
  };
  resources: {
    cpuUsage: number;
    memoryUsage: number;
    storageUsage: number;
    networkUsage: number;
  };
}

export interface DeviceFarmSchedule {
  id: string;
  farmId: string;
  type: 'maintenance' | 'update' | 'backup' | 'calibration';
  title: string;
  description?: string;
  scheduledTime: string;
  duration: number; // minutes
  devices: string[]; // device IDs affected
  status: 'scheduled' | 'in-progress' | 'completed' | 'failed' | 'cancelled';
  recurrence?: {
    pattern: 'daily' | 'weekly' | 'monthly';
    interval: number;
    endDate?: string;
  };
  createdBy: string;
  createdAt: string;
}

/**
 * Device Farm Management Service Implementation
 */
export class DeviceFarmService {
  constructor(private env: any) {}

  /**
   * Create a new device farm
   */
  async createDeviceFarm(farmData: Omit<DeviceFarm, 'id' | 'createdAt' | 'updatedAt'>): Promise<DeviceFarm> {
    const farm: DeviceFarm = {
      ...farmData,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      // Store in device farms KV namespace
      await this.env.DEVICE_FARMS.put(`farm:${farm.id}`, JSON.stringify(farm));

      // Initialize farm metrics
      await this.initializeFarmMetrics(farm.id);

      return farm;
    } catch (error) {
      console.error('Failed to create device farm:', error);
      throw new Error('Failed to create device farm');
    }
  }

  /**
   * Get all device farms
   */
  async getDeviceFarms(filters: {
    status?: string;
    region?: string;
    limit?: number;
  } = {}): Promise<{ farms: DeviceFarm[] }> {
    try {
      // For now, return mock data. In production, this would query the database
      const mockFarms: DeviceFarm[] = [
        {
          id: 'farm-1',
          name: 'San Francisco Mobile Lab',
          description: 'Primary West Coast device farm',
          location: {
            name: 'San Francisco, CA',
            timezone: 'America/Los_Angeles',
            region: 'us-west'
          },
          capacity: {
            maxDevices: 50,
            currentDevices: 32,
            availableDevices: 18
          },
          configuration: {
            autoProvisioning: true,
            maintenanceWindow: {
              start: '02:00',
              end: '04:00',
              timezone: 'America/Los_Angeles'
            },
            deviceRotation: true,
            healthCheckInterval: 5
          },
          networking: {
            vpnRequired: true,
            firewallRules: [],
            bandwidthLimit: 1000
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          status: 'active'
        },
        {
          id: 'farm-2',
          name: 'New York Testing Center',
          description: 'East Coast device farm for mobile testing',
          location: {
            name: 'New York, NY',
            timezone: 'America/New_York',
            region: 'us-east'
          },
          capacity: {
            maxDevices: 40,
            currentDevices: 28,
            availableDevices: 12
          },
          configuration: {
            autoProvisioning: true,
            maintenanceWindow: {
              start: '03:00',
              end: '05:00',
              timezone: 'America/New_York'
            },
            deviceRotation: true,
            healthCheckInterval: 5
          },
          networking: {
            vpnRequired: false,
            firewallRules: [],
            bandwidthLimit: 500
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          status: 'active'
        }
      ];

      let farms = mockFarms;

      // Apply filters
      if (filters.status) {
        farms = farms.filter(f => f.status === filters.status);
      }
      if (filters.region) {
        farms = farms.filter(f => f.location.region === filters.region);
      }

      return { farms };
    } catch (error) {
      console.error('Failed to get device farms:', error);
      throw new Error('Failed to get device farms');
    }
  }

  /**
   * Get device farm by ID
   */
  async getDeviceFarm(farmId: string): Promise<DeviceFarm | null> {
    try {
      const farms = await this.getDeviceFarms();
      return farms.farms.find(f => f.id === farmId) || null;
    } catch (error) {
      console.error('Failed to get device farm:', error);
      throw new Error('Failed to get device farm');
    }
  }

  /**
   * Get device farm metrics
   */
  async getFarmMetrics(farmId: string, timeRange: '1h' | '24h' | '7d' | '30d' = '24h'): Promise<DeviceFarmMetrics[]> {
    try {
      // Mock metrics data - in production, this would query time-series data
      const now = new Date();
      const metrics: DeviceFarmMetrics[] = [];

      // Generate sample metrics for the last 24 hours
      for (let i = 0; i < 24; i++) {
        const timestamp = new Date(now.getTime() - (i * 60 * 60 * 1000));

        metrics.push({
          farmId,
          timestamp: timestamp.toISOString(),
          utilization: {
            total: 50,
            used: 25 + Math.floor(Math.random() * 20),
            available: 5 + Math.floor(Math.random() * 15),
            percentage: 50 + Math.floor(Math.random() * 40)
          },
          performance: {
            averageTestDuration: 120 + Math.floor(Math.random() * 60),
            successRate: 85 + Math.floor(Math.random() * 14),
            errorRate: Math.floor(Math.random() * 10),
            queueTime: Math.floor(Math.random() * 300)
          },
          devices: {
            online: 20 + Math.floor(Math.random() * 10),
            offline: 2 + Math.floor(Math.random() * 3),
            error: Math.floor(Math.random() * 2),
            maintenance: Math.floor(Math.random() * 2)
          },
          resources: {
            cpuUsage: 30 + Math.floor(Math.random() * 40),
            memoryUsage: 40 + Math.floor(Math.random() * 30),
            storageUsage: 25 + Math.floor(Math.random() * 25),
            networkUsage: 20 + Math.floor(Math.random() * 30)
          }
        });
      }

      return metrics.reverse(); // Most recent first
    } catch (error) {
      console.error('Failed to get farm metrics:', error);
      throw new Error('Failed to get farm metrics');
    }
  }

  /**
   * Create farm schedule
   */
  async createSchedule(scheduleData: Omit<DeviceFarmSchedule, 'id' | 'createdAt'>): Promise<DeviceFarmSchedule> {
    const schedule: DeviceFarmSchedule = {
      ...scheduleData,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString()
    };

    try {
      // Store in schedules KV namespace
      await this.env.FARM_SCHEDULES.put(`schedule:${schedule.id}`, JSON.stringify(schedule));

      return schedule;
    } catch (error) {
      console.error('Failed to create farm schedule:', error);
      throw new Error('Failed to create farm schedule');
    }
  }

  /**
   * Get farm schedules
   */
  async getFarmSchedules(farmId: string): Promise<DeviceFarmSchedule[]> {
    try {
      // Mock schedules data
      const mockSchedules: DeviceFarmSchedule[] = [
        {
          id: 'schedule-1',
          farmId,
          type: 'maintenance',
          title: 'Weekly Device Maintenance',
          description: 'Routine maintenance and device calibration',
          scheduledTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
          duration: 120, // 2 hours
          devices: ['device-1', 'device-2', 'device-3'],
          status: 'scheduled',
          recurrence: {
            pattern: 'weekly',
            interval: 1
          },
          createdBy: 'system',
          createdAt: new Date().toISOString()
        },
        {
          id: 'schedule-2',
          farmId,
          type: 'update',
          title: 'OS Update for iOS Devices',
          description: 'Update iOS devices to latest version',
          scheduledTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // In 3 days
          duration: 180, // 3 hours
          devices: ['device-4', 'device-5'],
          status: 'scheduled',
          createdBy: 'admin',
          createdAt: new Date().toISOString()
        }
      ];

      return mockSchedules.filter(s => s.farmId === farmId);
    } catch (error) {
      console.error('Failed to get farm schedules:', error);
      throw new Error('Failed to get farm schedules');
    }
  }

  /**
   * Get farm utilization report
   */
  async getUtilizationReport(farmId: string, dateRange: '7d' | '30d' = '7d'): Promise<{
    farmId: string;
    period: string;
    utilization: {
      average: number;
      peak: number;
      minimum: number;
      trend: 'increasing' | 'decreasing' | 'stable';
    };
    deviceUsage: {
      mostUsed: string[];
      leastUsed: string[];
      neverUsed: string[];
    };
    recommendations: string[];
  }> {
    try {
      const metrics = await this.getFarmMetrics(farmId, dateRange === '7d' ? '24h' : '30d');

      if (metrics.length === 0) {
        throw new Error('No metrics available for the specified period');
      }

      // Calculate utilization statistics
      const utilizationValues = metrics.map(m => m.utilization.percentage);
      const average = utilizationValues.reduce((sum, val) => sum + val, 0) / utilizationValues.length;
      const peak = Math.max(...utilizationValues);
      const minimum = Math.min(...utilizationValues);

      // Determine trend (simple implementation)
      const recent = utilizationValues.slice(7); // Last 7 data points
      const older = utilizationValues.slice(0, 7); // First 7 data points
      const recentAvg = recent.reduce((sum, val) => sum + val, 0) / recent.length;
      const olderAvg = older.reduce((sum, val) => sum + val, 0) / older.length;

      let trend: 'increasing' | 'decreasing' | 'stable';
      if (recentAvg > olderAvg + 5) trend = 'increasing';
      else if (recentAvg < olderAvg - 5) trend = 'decreasing';
      else trend = 'stable';

      // Generate recommendations
      const recommendations: string[] = [];
      if (average < 30) recommendations.push('Consider reducing farm capacity to improve efficiency');
      if (peak > 90) recommendations.push('Consider expanding farm capacity or optimizing test scheduling');
      if (trend === 'decreasing') recommendations.push('Investigate the cause of declining utilization');

      return {
        farmId,
        period: dateRange,
        utilization: {
          average: Math.round(average),
          peak,
          minimum,
          trend
        },
        deviceUsage: {
          mostUsed: ['device-1', 'device-3'], // Mock data
          leastUsed: ['device-7', 'device-8'], // Mock data
          neverUsed: ['device-9'] // Mock data
        },
        recommendations
      };
    } catch (error) {
      console.error('Failed to generate utilization report:', error);
      throw new Error('Failed to generate utilization report');
    }
  }

  /**
   * Initialize farm metrics
   */
  private async initializeFarmMetrics(farmId: string): Promise<void> {
    const initialMetrics: DeviceFarmMetrics = {
      farmId,
      timestamp: new Date().toISOString(),
      utilization: {
        total: 0,
        used: 0,
        available: 0,
        percentage: 0
      },
      performance: {
        averageTestDuration: 0,
        successRate: 100,
        errorRate: 0,
        queueTime: 0
      },
      devices: {
        online: 0,
        offline: 0,
        error: 0,
        maintenance: 0
      },
      resources: {
        cpuUsage: 0,
        memoryUsage: 0,
        storageUsage: 0,
        networkUsage: 0
      }
    };

    // Store initial metrics
    try {
      await this.env.FARM_METRICS.put(
        `metrics:${farmId}:${Date.now()}`,
        JSON.stringify(initialMetrics),
        { expirationTtl: 7 * 24 * 60 * 60 } // 7 days
      );
    } catch (error) {
      console.error('Failed to initialize farm metrics:', error);
    }
  }
}

export default DeviceFarmService;
