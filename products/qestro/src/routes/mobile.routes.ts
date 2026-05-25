/**
 * Qestro Mobile Test API Routes
 * Comprehensive mobile testing API endpoints with device orchestration
 * and real-time test execution capabilities.
 *
 * Features:
 * - Device discovery and management
 * - Mobile test execution (Maestro, Appium, XCUITest, Espresso)
 * - Real-time test monitoring via WebSocket
 * - Device reservation and scheduling
 * - Performance metrics and artifact collection
 * - Cross-platform mobile testing (iOS/Android)
 *
 * @author Qestro Platform Team
 * @version 1.0.0
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { MobileTestEngine, MobileTest, MobilePlatform, TestStatus } from '../services/mobile/MobileTestEngine';
import { DeviceManager, DeviceRequirement, MobileDevice } from '../services/mobile/DeviceManager';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { schema } from '../db/schema';
import { HTTPException } from 'hono/http-exception';

// Initialize Hono router with proper typing
const mobileRoutes = new Hono<{ Bindings: Env }>();

// Initialize services
const deviceManager = new DeviceManager({
  enableAutoDiscovery: true,
  healthCheckInterval: 30000,
  enableResourceOptimization: true
});

const testEngine = new MobileTestEngine({
  maxConcurrentTests: 10,
  enablePerformanceMonitoring: true,
  enableVideoRecording: true,
  enableScreenshots: true
});

// Request validation schemas
const deviceDiscoverySchema = z.object({
  provider: z.enum(['local', 'browserstack', 'saucelabs', 'aws', 'all']).default('local'),
  platform: z.enum(['ios', 'android', 'all']).default('all'),
  force_refresh: z.boolean().default(false)
});

const deviceReservationSchema = z.object({
  device_id: z.string(),
  duration: z.number().min(5).max(1440).default(60), // 5 min to 24 hours
  priority: z.number().min(1).max(10).default(1),
  requirements: z.object({
    platform: z.enum(['ios', 'android']),
    min_os_version: z.string().optional(),
    max_os_version: z.string().optional(),
    required_models: z.array(z.string()).optional(),
    excluded_models: z.array(z.string()).optional(),
    required_capabilities: z.array(z.string()).optional()
  }).optional()
});

const mobileTestSchema = z.object({
  name: z.string().min(1, 'Test name is required'),
  description: z.string().min(10, 'Test description must be at least 10 characters'),
  platform: z.enum(['ios', 'android']),
  framework: z.enum(['maestro', 'appium', 'xcuitest', 'espresso']),
  test_file: z.string(),
  test_content: z.string(),
  configuration: z.object({
    device_requirements: z.array(z.object({
      platform: z.enum(['ios', 'android']),
      min_os_version: z.string().optional(),
      max_os_version: z.string().optional(),
      required_models: z.array(z.string()).optional(),
      excluded_models: z.array(z.string()).optional(),
      required_capabilities: z.array(z.string()).optional()
    })).optional(),
    environment_variables: z.record(z.string()).optional(),
    app_configuration: z.object({
      app_id: z.string(),
      app_version: z.string().optional(),
      bundle_id: z.string().optional(),
      package_name: z.string().optional(),
      install_options: z.object({
        force_install: z.boolean().default(false),
        grant_permissions: z.boolean().default(true),
        clear_data: z.boolean().default(false),
        timeout: z.number().default(300000)
      }).optional()
    }),
    execution_settings: z.object({
      timeout: z.number().default(300000),
      retries: z.number().default(2),
      retry_delay: z.number().default(5000),
      fail_fast: z.boolean().default(false),
      continue_on_failure: z.boolean().default(true),
      parallel_execution: z.boolean().default(false),
      max_concurrent_devices: z.number().default(1)
    }).optional()
  }).optional()
});

const testExecutionSchema = z.object({
  test_id: z.string(),
  device_id: z.string().optional(),
  auto_select_device: z.boolean().default(true),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal')
});

/**
 * POST /api/mobile/devices/discover
 * Discover mobile devices from specified providers
 */
mobileRoutes.post('/devices/discover', async (c) => {
  try {
    const authUser = c.get('authUser');
    if (!authUser) {
      throw new HTTPException(401, { message: 'Authentication required' });
    }

    const body = await c.req.json();
    const validatedData = deviceDiscoverySchema.parse(body);

    let discoveries;
    if (validatedData.provider === 'all') {
      discoveries = await deviceManager.discoverDevices();
    } else {
      const discovery = await deviceManager.discoverProviderDevices(validatedData.provider);
      discoveries = [discovery];
    }

    // Filter by platform if specified
    if (validatedData.platform !== 'all') {
      const allDevices = deviceManager.getAllDevices();
      const filteredDevices = allDevices.filter(device =>
        device.platform === validatedData.platform
      );

      return c.json({
        success: true,
        data: {
          discoveries,
          devices: filteredDevices,
          summary: {
            total_discovered: discoveries.reduce((sum, d) => sum + d.discoveredDevices, 0),
            successful_discoveries: discoveries.filter(d => d.status === 'completed').length,
            failed_discoveries: discoveries.filter(d => d.status === 'failed').length,
            total_devices: filteredDevices.length,
            ios_devices: filteredDevices.filter(d => d.platform === 'ios').length,
            android_devices: filteredDevices.filter(d => d.platform === 'android').length
          }
        }
      });
    }

    return c.json({
      success: true,
      data: {
        discoveries,
        devices: deviceManager.getAllDevices(),
        summary: {
          total_discovered: discoveries.reduce((sum, d) => sum + d.discoveredDevices, 0),
          successful_discoveries: discoveries.filter(d => d.status === 'completed').length,
          failed_discoveries: discoveries.filter(d => d.status === 'failed').length
        }
      }
    });

  } catch (error) {
    console.error('Device discovery failed:', error);

    if (error instanceof z.ZodError) {
      throw new HTTPException(400, {
        message: 'Invalid request data',
        details: error.errors
      });
    }

    throw new HTTPException(500, {
      message: 'Failed to discover devices',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/mobile/devices
 * Get all mobile devices with their status
 */
mobileRoutes.get('/devices', async (c) => {
  try {
    const authUser = c.get('authUser');
    if (!authUser) {
      throw new HTTPException(401, { message: 'Authentication required' });
    }

    const platform = c.req.query('platform') as MobilePlatform | undefined;
    const status = c.req.query('status') as string | undefined;
    const provider = c.req.query('provider') as string | undefined;

    let devices = deviceManager.getAllDevices();

    // Apply filters
    if (platform) {
      devices = devices.filter(device => device.platform === platform);
    }

    if (status) {
      devices = devices.filter(device => device.status === status);
    }

    if (provider) {
      devices = devices.filter(device => device.location.type === provider);
    }

    // Get device metrics
    const devicesWithMetrics = devices.map(device => {
      const deviceMetrics = deviceManager.getDeviceStatus(device.id);
      return {
        ...device,
        metrics: deviceMetrics.metrics,
        last_health_check: deviceMetrics.metrics?.[deviceMetrics.metrics.length - 1]?.timestamp || null
      };
    });

    return c.json({
      success: true,
      data: {
        devices: devicesWithMetrics,
        summary: {
          total_devices: devices.length,
          available_devices: devices.filter(d => d.status === 'available').length,
          busy_devices: devices.filter(d => d.status === 'busy').length,
          offline_devices: devices.filter(d => d.status === 'offline').length,
          ios_devices: devices.filter(d => d.platform === 'ios').length,
          android_devices: devices.filter(d => d.platform === 'android').length
        }
      }
    });

  } catch (error) {
    console.error('Failed to get devices:', error);
    throw new HTTPException(500, {
      message: 'Failed to retrieve devices',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/mobile/devices/:id
 * Get detailed information about a specific device
 */
mobileRoutes.get('/devices/:id', async (c) => {
  try {
    const authUser = c.get('authUser');
    if (!authUser) {
      throw new HTTPException(401, { message: 'Authentication required' });
    }

    const deviceId = c.req.param('id');
    const deviceStatus = deviceManager.getDeviceStatus(deviceId);

    if (!deviceStatus.device) {
      throw new HTTPException(404, { message: 'Device not found' });
    }

    // Get active reservations
    const activeReservations = deviceManager.getActiveReservations();
    const deviceReservation = activeReservations.find(r => r.device.id === deviceId);

    return c.json({
      success: true,
      data: {
        device: deviceStatus.device,
        metrics: deviceStatus.metrics,
        reservation: deviceReservation || null,
        capabilities: deviceStatus.device.capabilities,
        configuration: deviceStatus.device.configuration
      }
    });

  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }

    console.error('Failed to get device details:', error);
    throw new HTTPException(500, {
      message: 'Failed to retrieve device details',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/mobile/devices/:id/reserve
 * Reserve a device for testing
 */
mobileRoutes.post('/devices/:id/reserve', async (c) => {
  try {
    const authUser = c.get('authUser');
    if (!authUser) {
      throw new HTTPException(401, { message: 'Authentication required' });
    }

    const deviceId = c.req.param('id');
    const body = await c.req.json();
    const validatedData = deviceReservationSchema.parse(body);

    const reservation = await deviceManager.reserveDevice(
      deviceId,
      authUser.id,
      body.project_id || 'default-project',
      validatedData.duration,
      validatedData.priority
    );

    // Log reservation to database
    const db = drizzle(c.env.DB, { schema });
    await db.insert(schema.deviceReservations).values({
      id: reservation.id,
      projectId: reservation.projectId,
      userId: reservation.userId,
      deviceId: deviceId,
      startTime: reservation.startTime.getTime(),
      endTime: reservation.endTime.getTime(),
      priority: reservation.priority,
      status: 'active',
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    return c.json({
      success: true,
      data: {
        reservation,
        device: deviceManager.getDeviceStatus(deviceId).device
      }
    });

  } catch (error) {
    console.error('Device reservation failed:', error);

    if (error instanceof z.ZodError) {
      throw new HTTPException(400, {
        message: 'Invalid request data',
        details: error.errors
      });
    }

    throw new HTTPException(500, {
      message: 'Failed to reserve device',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/mobile/devices/:id/release
 * Release a device reservation
 */
mobileRoutes.post('/devices/:id/release', async (c) => {
  try {
    const authUser = c.get('authUser');
    if (!authUser) {
      throw new HTTPException(401, { message: 'Authentication required' });
    }

    const deviceId = c.req.param('id');
    const reservationId = c.req.query('reservation_id') as string;

    if (!reservationId) {
      throw new HTTPException(400, { message: 'Reservation ID is required' });
    }

    // Verify reservation belongs to user
    const activeReservations = deviceManager.getActiveReservations();
    const reservation = activeReservations.find(r =>
      r.device.id === deviceId && r.id === reservationId && r.userId === authUser.id
    );

    if (!reservation) {
      throw new HTTPException(404, { message: 'Reservation not found' });
    }

    await deviceManager.releaseDevice(reservationId);

    // Update reservation in database
    const db = drizzle(c.env.DB, { schema });
    await db.update(schema.deviceReservations)
      .set({ status: 'completed', updatedAt: Date.now() })
      .where(eq(schema.deviceReservations.id, reservationId));

    return c.json({
      success: true,
      message: 'Device reservation released successfully'
    });

  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }

    console.error('Device release failed:', error);
    throw new HTTPException(500, {
      message: 'Failed to release device',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/mobile/tests
 * Create a new mobile test
 */
mobileRoutes.post('/tests', async (c) => {
  try {
    const authUser = c.get('authUser');
    if (!authUser) {
      throw new HTTPException(401, { message: 'Authentication required' });
    }

    const body = await c.req.json();
    const validatedData = mobileTestSchema.parse(body);

    // Generate test ID
    const testId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create test object
    const mobileTest: MobileTest = {
      id: testId,
      name: validatedData.name,
      description: validatedData.description,
      platform: validatedData.platform,
      framework: validatedData.framework,
      testFile: validatedData.test_file,
      testData: {
        format: validatedData.framework === 'maestro' ? 'yaml' : 'json',
        content: validatedData.test_content,
        variables: {},
        dependencies: [],
        assets: []
      },
      configuration: {
        deviceRequirements: validatedData.configuration?.device_requirements || [],
        environmentVariables: validatedData.configuration?.environment_variables || {},
        appConfiguration: validatedData.configuration?.app_configuration || {
          app_id: '',
          installOptions: {
            forceInstall: false,
            grantPermissions: true,
            clearData: false,
            timeout: 300000
          },
          launchOptions: {
            launchArguments: [],
            environment: 'development',
            waitForLaunch: true,
            launchTimeout: 30000
          }
        },
        executionSettings: validatedData.configuration?.execution_settings || {
          timeout: 300000,
          retries: 2,
          retryDelay: 5000,
          failFast: false,
          continueOnFailure: true,
          parallelExecution: false,
          maxConcurrentDevices: 1
        },
        notificationSettings: {
          onTestStart: true,
          onTestComplete: true,
          onTestFailure: true,
          onDeviceError: true,
          channels: ['email', 'webhook']
        }
      },
      requirements: {
        duration: 60,
        priority: 'normal',
        exclusiveDeviceAccess: true,
        requiresNetwork: true,
        requiresRealDevice: false
      },
      metadata: {
        tags: [],
        category: 'mobile-testing',
        suite: 'mobile',
        author: authUser.id,
        createdAt: new Date(),
        updatedAt: new Date(),
        estimatedDuration: 60,
        complexity: 'moderate'
      }
    };

    // Save test to database
    const db = drizzle(c.env.DB, { schema });
    await db.insert(schema.testCases).values({
      id: testId,
      projectId: body.project_id || 'default-project',
      userId: authUser.id,
      name: validatedData.name,
      description: validatedData.description,
      type: 'mobile',
      platform: validatedData.platform,
      testData: JSON.stringify(mobileTest),
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    return c.json({
      success: true,
      data: {
        test: mobileTest,
        message: 'Mobile test created successfully'
      }
    });

  } catch (error) {
    console.error('Test creation failed:', error);

    if (error instanceof z.ZodError) {
      throw new HTTPException(400, {
        message: 'Invalid request data',
        details: error.errors
      });
    }

    throw new HTTPException(500, {
      message: 'Failed to create test',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/mobile/tests/execute
 * Execute a mobile test
 */
mobileRoutes.post('/tests/execute', async (c) => {
  try {
    const authUser = c.get('authUser');
    if (!authUser) {
      throw new HTTPException(401, { message: 'Authentication required' });
    }

    const body = await c.req.json();
    const validatedData = testExecutionSchema.parse(body);

    // Get test from database
    const db = drizzle(c.env.DB, { schema });
    const testRecord = await db.query.testCases.findFirst({
      where: (testCases, { eq }) => eq(testCases.id, validatedData.test_id)
    });

    if (!testRecord) {
      throw new HTTPException(404, { message: 'Test not found' });
    }

    // Parse test data
    const mobileTest: MobileTest = JSON.parse(testRecord.testData);

    // Select device if not specified
    let deviceId = validatedData.device_id;
    if (!deviceId && validatedData.auto_select_device) {
      const availableDevices = deviceManager.getAvailableDevices(
        mobileTest.configuration.deviceRequirements
      );

      if (availableDevices.length === 0) {
        throw new HTTPException(409, {
          message: 'No available devices matching test requirements'
        });
      }

      // Auto-select best device
      deviceId = availableDevices[0].id;
    }

    if (!deviceId) {
      throw new HTTPException(400, { message: 'Device ID is required' });
    }

    // Execute test
    const execution = await testEngine.executeTest(mobileTest, deviceId);

    // Save execution to database
    await db.insert(schema.testExecutions).values({
      id: execution.id,
      projectId: testRecord.projectId,
      testSuiteId: null,
      status: execution.status,
      environment: JSON.stringify(execution.deviceInfo),
      metadata: JSON.stringify({
        deviceId: execution.deviceId,
        platform: execution.deviceInfo.platform,
        framework: mobileTest.framework
      }),
      summary: JSON.stringify(execution.result),
      error: execution.result.failureReason,
      requestedBy: authUser.id,
      startedAt: execution.startTime.getTime(),
      completedAt: execution.endTime?.getTime(),
      totalTests: execution.result.totalSteps,
      passedTests: execution.result.passedSteps,
      failedTests: execution.result.totalSteps - execution.result.passedSteps,
      skippedTests: 0,
      duration: execution.duration,
      artifacts: JSON.stringify(execution.artifacts),
      performance: JSON.stringify(execution.metrics),
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    return c.json({
      success: true,
      data: {
        execution: {
          id: execution.id,
          status: execution.status,
          startTime: execution.startTime,
          endTime: execution.endTime,
          duration: execution.duration,
          result: execution.result,
          device: execution.deviceInfo
        },
        message: 'Test execution started successfully'
      }
    });

  } catch (error) {
    console.error('Test execution failed:', error);

    if (error instanceof z.ZodError) {
      throw new HTTPException(400, {
        message: 'Invalid request data',
        details: error.errors
      });
    }

    if (error instanceof HTTPException) {
      throw error;
    }

    throw new HTTPException(500, {
      message: 'Failed to execute test',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/mobile/tests/execute/:id
 * Get test execution status and results
 */
mobileRoutes.get('/tests/execute/:id', async (c) => {
  try {
    const authUser = c.get('authUser');
    if (!authUser) {
      throw new HTTPException(401, { message: 'Authentication required' });
    }

    const executionId = c.req.param('id');

    // Get execution from test engine
    const activeExecutions = testEngine.getActiveExecutions();
    let execution = activeExecutions.find(e => e.id === executionId);

    // If not in active executions, check history
    if (!execution) {
      const history = testEngine.getExecutionHistory();
      execution = history.find(e => e.id === executionId);
    }

    if (!execution) {
      throw new HTTPException(404, { message: 'Test execution not found' });
    }

    return c.json({
      success: true,
      data: {
        execution: {
          id: execution.id,
          testId: execution.testId,
          deviceId: execution.deviceId,
          status: execution.status,
          startTime: execution.startTime,
          endTime: execution.endTime,
          duration: execution.duration,
          result: execution.result,
          artifacts: execution.artifacts,
          metrics: execution.metrics,
          logs: execution.logs,
          errors: execution.errors,
          deviceInfo: execution.deviceInfo
        }
      }
    });

  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }

    console.error('Failed to get execution status:', error);
    throw new HTTPException(500, {
      message: 'Failed to retrieve execution status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/mobile/tests/execute/:id/logs
 * Get real-time logs for test execution
 */
mobileRoutes.get('/tests/execute/:id/logs', async (c) => {
  try {
    const authUser = c.get('authUser');
    if (!authUser) {
      throw new HTTPException(401, { message: 'Authentication required' });
    }

    const executionId = c.req.param('id');
    const limit = parseInt(c.req.query('limit') || '100');

    // Get execution logs
    const activeExecutions = testEngine.getActiveExecutions();
    let execution = activeExecutions.find(e => e.id === executionId);

    if (!execution) {
      const history = testEngine.getExecutionHistory();
      execution = history.find(e => e.id === executionId);
    }

    if (!execution) {
      throw new HTTPException(404, { message: 'Test execution not found' });
    }

    const logs = execution.logs.slice(-limit);

    return c.json({
      success: true,
      data: {
        executionId,
        logs,
        totalLogs: execution.logs.length,
        hasMore: execution.logs.length > limit
      }
    });

  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }

    console.error('Failed to get execution logs:', error);
    throw new HTTPException(500, {
      message: 'Failed to retrieve execution logs',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/mobile/statistics
 * Get mobile testing statistics and metrics
 */
mobileRoutes.get('/statistics', async (c) => {
  try {
    const authUser = c.get('authUser');
    if (!authUser) {
      throw new HTTPException(401, { message: 'Authentication required' });
    }

    // Get device statistics
    const allDevices = deviceManager.getAllDevices();
    const activeReservations = deviceManager.getActiveReservations();
    const deviceStats = {
      totalDevices: allDevices.length,
      availableDevices: allDevices.filter(d => d.status === 'available').length,
      busyDevices: allDevices.filter(d => d.status === 'busy').length,
      offlineDevices: allDevices.filter(d => d.status === 'offline').length,
      iosDevices: allDevices.filter(d => d.platform === 'ios').length,
      androidDevices: allDevices.filter(d => d.platform === 'android').length,
      reservedDevices: activeReservations.length
    };

    // Get test execution statistics
    const executionHistory = testEngine.getExecutionHistory();
    const activeExecutions = testEngine.getActiveExecutions();
    const testStats = {
      totalExecutions: executionHistory.length,
      activeExecutions: activeExecutions.length,
      successfulExecutions: executionHistory.filter(e => e.status === 'passed').length,
      failedExecutions: executionHistory.filter(e => e.status === 'failed').length,
      averageExecutionTime: executionHistory.length > 0
        ? executionHistory.reduce((sum, e) => sum + (e.duration || 0), 0) / executionHistory.length
        : 0,
      successRate: executionHistory.length > 0
        ? (executionHistory.filter(e => e.status === 'passed').length / executionHistory.length) * 100
        : 0
    };

    // Get engine statistics
    const engineStats = testEngine.getStatistics();

    return c.json({
      success: true,
      data: {
        devices: deviceStats,
        tests: testStats,
        engine: engineStats,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Failed to get statistics:', error);
    throw new HTTPException(500, {
      message: 'Failed to retrieve statistics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/mobile/health
 * Health check endpoint for mobile testing services
 */
mobileRoutes.get('/health', async (c) => {
  try {
    const deviceStats = deviceManager.getProviderStatus();
    const engineStats = testEngine.getStatistics();

    const overallHealth = {
      deviceManager: {
        status: 'healthy',
        providers: deviceStats.length,
        activeDevices: engineStats.availableDevices,
        lastUpdate: new Date().toISOString()
      },
      testEngine: {
        status: 'healthy',
        activeExecutions: engineStats.busyDevices,
        totalExecutions: engineStats.totalExecutions,
        successRate: engineStats.successRate,
        lastUpdate: new Date().toISOString()
      }
    };

    return c.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: overallHealth
    });

  } catch (error) {
    return c.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 503);
  }
});

export { mobileRoutes };