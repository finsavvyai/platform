/**
 * Mobile Testing API Routes
 * Handles mobile device management and test execution
 */

import { MobileDeviceService } from '../services/mobile-device-service';
import { MobileTestExecutionService } from '../services/mobile-test-service';

export function setupMobileTestingRoutes(app, env) {
  const deviceService = new MobileDeviceService(env);
  const testService = new MobileTestExecutionService(env);

  // Mobile Device Management Routes

  // GET /api/v1/mobile/devices - List all mobile devices
  app.get('/api/v1/mobile/devices', async (c) => {
    try {
      const { platform, status, location, limit } = c.req.query();

      const filters: any = {};
      if (platform) filters.platform = platform;
      if (status) filters.status = status;
      if (location) filters.location = location;
      if (limit) filters.limit = parseInt(limit);

      const result = await deviceService.getDevices(filters);

      return c.json({
        success: true,
        devices: result.devices,
        total: result.devices.length,
        filters
      });
    } catch (error) {
      console.error('Failed to get devices:', error);
      return c.json({
        success: false,
        error: 'Failed to get mobile devices'
      }, 500);
    }
  });

  // POST /api/v1/mobile/devices - Register a new mobile device
  app.post('/api/v1/mobile/devices', async (c) => {
    try {
      const deviceData = await c.req.json();

      // Validate required fields
      if (!deviceData.name || !deviceData.platform || !deviceData.model) {
        return c.json({
          success: false,
          error: 'Missing required fields: name, platform, model'
        }, 400);
      }

      const device = await deviceService.registerDevice(deviceData);

      return c.json({
        success: true,
        device,
        message: 'Mobile device registered successfully'
      }, 201);
    } catch (error) {
      console.error('Failed to register device:', error);
      return c.json({
        success: false,
        error: 'Failed to register mobile device'
      }, 500);
    }
  });

  // GET /api/v1/mobile/devices/:id - Get device details
  app.get('/api/v1/mobile/devices/:id', async (c) => {
    try {
      const deviceId = c.req.param('id');
      const device = await deviceService.getDevice(deviceId);

      if (!device) {
        return c.json({
          success: false,
          error: 'Device not found'
        }, 404);
      }

      return c.json({
        success: true,
        device
      });
    } catch (error) {
      console.error('Failed to get device:', error);
      return c.json({
        success: false,
        error: 'Failed to get device details'
      }, 500);
    }
  });

  // PUT /api/v1/mobile/devices/:id/status - Update device status
  app.put('/api/v1/mobile/devices/:id/status', async (c) => {
    try {
      const deviceId = c.req.param('id');
      const { status, currentTest } = await c.req.json();

      if (!status) {
        return c.json({
          success: false,
          error: 'Status is required'
        }, 400);
      }

      await deviceService.updateDeviceStatus(deviceId, status, currentTest);

      return c.json({
        success: true,
        message: 'Device status updated successfully'
      });
    } catch (error) {
      console.error('Failed to update device status:', error);
      return c.json({
        success: false,
        error: 'Failed to update device status'
      }, 500);
    }
  });

  // DELETE /api/v1/mobile/devices/:id - Unregister device
  app.delete('/api/v1/mobile/devices/:id', async (c) => {
    try {
      const deviceId = c.req.param('id');
      await deviceService.unregisterDevice(deviceId);

      return c.json({
        success: true,
        message: 'Device unregistered successfully'
      });
    } catch (error) {
      console.error('Failed to unregister device:', error);
      return c.json({
        success: false,
        error: 'Failed to unregister device'
      }, 500);
    }
  });

  // Mobile Test Execution Routes

  // POST /api/v1/mobile/tests/execute - Execute mobile test
  app.post('/api/v1/mobile/tests/execute', async (c) => {
    try {
      const testConfig = await c.req.json();
      const projectId = c.req.header('X-Project-ID') || 'default-project';

      // Validate required fields
      if (!testConfig.deviceId || !testConfig.testScript) {
        return c.json({
          success: false,
          error: 'Missing required fields: deviceId, testScript'
        }, 400);
      }

      const execution = await testService.executeTest(testConfig, projectId);

      return c.json({
        success: true,
        execution,
        message: 'Mobile test queued for execution'
      }, 201);
    } catch (error) {
      console.error('Failed to execute test:', error);
      return c.json({
        success: false,
        error: 'Failed to execute mobile test'
      }, 500);
    }
  });

  // GET /api/v1/mobile/tests/:id - Get test execution details
  app.get('/api/v1/mobile/tests/:id', async (c) => {
    try {
      const executionId = c.req.param('id');
      const execution = await testService.getExecution(executionId);

      if (!execution) {
        return c.json({
          success: false,
          error: 'Test execution not found'
        }, 404);
      }

      return c.json({
        success: true,
        execution
      });
    } catch (error) {
      console.error('Failed to get test execution:', error);
      return c.json({
        success: false,
        error: 'Failed to get test execution'
      }, 500);
    }
  });

  // GET /api/v1/mobile/tests - List test executions for project
  app.get('/api/v1/mobile/tests', async (c) => {
    try {
      const projectId = c.req.query('projectId') || 'default-project';
      const limit = parseInt(c.req.query('limit') || '50');

      const executions = await testService.getProjectExecutions(projectId, limit);

      return c.json({
        success: true,
        executions,
        projectId,
        total: executions.length
      });
    } catch (error) {
      console.error('Failed to get test executions:', error);
      return c.json({
        success: false,
        error: 'Failed to get test executions'
      }, 500);
    }
  });

  // POST /api/v1/mobile/tests/:id/cancel - Cancel test execution
  app.post('/api/v1/mobile/tests/:id/cancel', async (c) => {
    try {
      const executionId = c.req.param('id');
      await testService.cancelExecution(executionId);

      return c.json({
        success: true,
        message: 'Test execution cancelled successfully'
      });
    } catch (error) {
      console.error('Failed to cancel execution:', error);
      return c.json({
        success: false,
        error: 'Failed to cancel test execution'
      }, 500);
    }
  });

  // GET /api/v1/mobile/tests/:id/report - Generate test report
  app.get('/api/v1/mobile/tests/:id/report', async (c) => {
    try {
      const executionId = c.req.param('id');
      const report = await testService.generateReport(executionId);

      return c.json({
        success: true,
        report
      });
    } catch (error) {
      console.error('Failed to generate report:', error);
      return c.json({
        success: false,
        error: 'Failed to generate test report'
      }, 500);
    }
  });

  // POST /api/v1/mobile/scripts/generate - Generate test script
  app.post('/api/v1/mobile/scripts/generate', async (c) => {
    try {
      const { platform, appId, actions } = await c.req.json();

      if (!platform || !actions || !Array.isArray(actions)) {
        return c.json({
          success: false,
          error: 'Missing required fields: platform, actions (array)'
        }, 400);
      }

      const testScript = deviceService.generateMobileTestScript({
        platform,
        appId,
        actions
      });

      return c.json({
        success: true,
        testScript,
        platform,
        message: 'Test script generated successfully'
      });
    } catch (error) {
      console.error('Failed to generate test script:', error);
      return c.json({
        success: false,
        error: 'Failed to generate test script'
      }, 500);
    }
  });

  // GET /api/v1/mobile/capabilities - Get supported capabilities
  app.get('/api/v1/mobile/capabilities', async (c) => {
    try {
      const capabilities = {
        platforms: ['ios', 'android'],
        actions: [
          'tap',
          'swipe',
          'input',
          'assert',
          'wait',
          'launch',
          'close',
          'screenshot',
          'record'
        ],
        deviceFeatures: [
          'screenRecording',
          'screenshots',
          'touchGestures',
          'networkSimulation',
          'appInstallation',
          'gpsSimulation',
          'cameraAccess',
          'microphoneAccess'
        ],
        supportedFrameworks: ['Maestro', 'Appium', 'Espresso (Android)', 'XCUITest (iOS)'],
        fileFormats: ['yaml', 'json', 'js'],
        integrations: [
          'Jenkins',
          'GitHub Actions',
          'GitLab CI',
          'CircleCI',
          'Slack',
          'Email notifications'
        ]
      };

      return c.json({
        success: true,
        capabilities
      });
    } catch (error) {
      console.error('Failed to get capabilities:', error);
      return c.json({
        success: false,
        error: 'Failed to get capabilities'
      }, 500);
    }
  });

  // Health check for mobile testing services
  app.get('/api/v1/mobile/health', async (c) => {
    try {
      const devices = await deviceService.getDevices();
      const onlineDevices = devices.devices.filter(d => d.status === 'online').length;

      return c.json({
        success: true,
        status: 'healthy',
        services: {
          deviceManagement: 'operational',
          testExecution: 'operational',
          agentCommunication: 'operational'
        },
        metrics: {
          totalDevices: devices.devices.length,
          onlineDevices,
          platforms: {
            ios: devices.devices.filter(d => d.platform === 'ios').length,
            android: devices.devices.filter(d => d.platform === 'android').length
          }
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Mobile health check failed:', error);
      return c.json({
        success: false,
        error: 'Mobile testing health check failed'
      }, 500);
    }
  });
}
