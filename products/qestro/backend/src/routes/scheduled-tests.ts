import express from 'express';
import { schedulingService } from '../services/SchedulingService.js';
import { authenticateToken as auth } from '../middleware/auth.js';

const router = express.Router();

// Get all scheduled tests for user
router.get('/', auth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { status, testType, dataSourceId } = req.query;

    const filters: any = {};
    if (status) filters.status = status as string;
    if (testType) filters.testType = testType as string;
    if (dataSourceId) filters.dataSourceId = dataSourceId as string;

    const scheduledTests = await schedulingService.getScheduledTests(userId, filters);

    res.json({
      success: true,
      scheduledTests
    });
  } catch (error) {
    console.error('Failed to fetch scheduled tests:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch scheduled tests'
    });
  }
});

// Get scheduled test summary
router.get('/summary', auth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const summary = await schedulingService.getScheduledTestSummary(userId);

    res.json({
      success: true,
      summary
    });
  } catch (error) {
    console.error('Failed to fetch scheduled test summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch summary'
    });
  }
});

// Get specific scheduled test
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const scheduledTest = await schedulingService.getScheduledTest(id);

    if (!scheduledTest) {
      return res.status(404).json({
        success: false,
        error: 'Scheduled test not found'
      });
    }

    // Check if user owns this test
    if (scheduledTest.userId !== req.user!.userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    res.json({
      success: true,
      scheduledTest
    });
  } catch (error) {
    console.error('Failed to fetch scheduled test:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch scheduled test'
    });
  }
});

// Create new scheduled test
router.post('/', auth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const {
      name,
      description,
      dataSourceId,
      testType,
      config,
      schedule,
      alerts,
      thresholds
    } = req.body;

    // Validate required fields
    if (!name || !dataSourceId || !testType || !schedule) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, dataSourceId, testType, schedule'
      });
    }

    // Validate schedule
    if (!schedule.type || !schedule.expression) {
      return res.status(400).json({
        success: false,
        error: 'Schedule must include type and expression'
      });
    }

    // Validate test configuration based on type
    if (testType === 'query' && (!config.queries || config.queries.length === 0)) {
      return res.status(400).json({
        success: false,
        error: 'Query tests require at least one query in config'
      });
    }

    if (testType === 'api' && (!config.endpoints || config.endpoints.length === 0)) {
      return res.status(400).json({
        success: false,
        error: 'API tests require at least one endpoint in config'
      });
    }

    // Create scheduled test
    const scheduledTest = await schedulingService.createScheduledTest({
      name,
      description,
      userId,
      dataSourceId,
      testType,
      config: config || {},
      schedule,
      alerts: alerts || { enabled: false, conditions: [], channels: [] },
      thresholds: thresholds || {},
      status: 'active'
    });

    res.status(201).json({
      success: true,
      scheduledTest
    });
  } catch (error) {
    console.error('Failed to create scheduled test:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create scheduled test'
    });
  }
});

// Update scheduled test
router.put('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Get existing test to check ownership
    const existingTest = await schedulingService.getScheduledTest(id);
    if (!existingTest) {
      return res.status(404).json({
        success: false,
        error: 'Scheduled test not found'
      });
    }

    if (existingTest.userId !== req.user!.userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Remove fields that shouldn't be updated directly
    delete updates.id;
    delete updates.userId;
    delete updates.createdAt;
    delete updates.runCount;

    const updatedTest = await schedulingService.updateScheduledTest(id, updates);

    res.json({
      success: true,
      scheduledTest: updatedTest
    });
  } catch (error) {
    console.error('Failed to update scheduled test:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update scheduled test'
    });
  }
});

// Delete scheduled test
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    // Get existing test to check ownership
    const existingTest = await schedulingService.getScheduledTest(id);
    if (!existingTest) {
      return res.status(404).json({
        success: false,
        error: 'Scheduled test not found'
      });
    }

    if (existingTest.userId !== req.user!.userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    await schedulingService.deleteScheduledTest(id);

    res.json({
      success: true,
      message: 'Scheduled test deleted successfully'
    });
  } catch (error) {
    console.error('Failed to delete scheduled test:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete scheduled test'
    });
  }
});

// Pause scheduled test
router.post('/:id/pause', auth, async (req, res) => {
  try {
    const { id } = req.params;

    // Get existing test to check ownership
    const existingTest = await schedulingService.getScheduledTest(id);
    if (!existingTest) {
      return res.status(404).json({
        success: false,
        error: 'Scheduled test not found'
      });
    }

    if (existingTest.userId !== req.user!.userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    await schedulingService.pauseScheduledTest(id);

    res.json({
      success: true,
      message: 'Scheduled test paused successfully'
    });
  } catch (error) {
    console.error('Failed to pause scheduled test:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to pause scheduled test'
    });
  }
});

// Resume scheduled test
router.post('/:id/resume', auth, async (req, res) => {
  try {
    const { id } = req.params;

    // Get existing test to check ownership
    const existingTest = await schedulingService.getScheduledTest(id);
    if (!existingTest) {
      return res.status(404).json({
        success: false,
        error: 'Scheduled test not found'
      });
    }

    if (existingTest.userId !== req.user!.userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    await schedulingService.resumeScheduledTest(id);

    res.json({
      success: true,
      message: 'Scheduled test resumed successfully'
    });
  } catch (error) {
    console.error('Failed to resume scheduled test:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to resume scheduled test'
    });
  }
});

// Run test now
router.post('/:id/run', auth, async (req, res) => {
  try {
    const { id } = req.params;

    // Get existing test to check ownership
    const existingTest = await schedulingService.getScheduledTest(id);
    if (!existingTest) {
      return res.status(404).json({
        success: false,
        error: 'Scheduled test not found'
      });
    }

    if (existingTest.userId !== req.user!.userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const result = await schedulingService.runTestNow(id);

    res.json({
      success: true,
      result
    });
  } catch (error) {
    console.error('Failed to run scheduled test:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to run test'
    });
  }
});

// Get test results
router.get('/:id/results', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50 } = req.query;

    // Get existing test to check ownership
    const existingTest = await schedulingService.getScheduledTest(id);
    if (!existingTest) {
      return res.status(404).json({
        success: false,
        error: 'Scheduled test not found'
      });
    }

    if (existingTest.userId !== req.user!.userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const results = await schedulingService.getTestResults(id, Number(limit));

    res.json({
      success: true,
      results
    });
  } catch (error) {
    console.error('Failed to fetch test results:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch test results'
    });
  }
});

// Test notification channels
router.post('/:id/test-notifications', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { channelIds } = req.body;

    // Get existing test to check ownership
    const existingTest = await schedulingService.getScheduledTest(id);
    if (!existingTest) {
      return res.status(404).json({
        success: false,
        error: 'Scheduled test not found'
      });
    }

    if (existingTest.userId !== req.user!.userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    if (!channelIds || !Array.isArray(channelIds)) {
      return res.status(400).json({
        success: false,
        error: 'channelIds must be an array'
      });
    }

    const testResults = [];

    for (const channelId of channelIds) {
      const channel = existingTest.alerts.channels.find(c => c.id === channelId);
      if (channel) {
        try {
          const result = await schedulingService.testNotificationChannel(channelId);
          testResults.push({
            channelId,
            channelType: channel.type,
            success: result.success,
            error: result.error
          });
        } catch (error) {
          testResults.push({
            channelId,
            channelType: channel.type,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      } else {
        testResults.push({
          channelId,
          success: false,
          error: 'Channel not found'
        });
      }
    }

    res.json({
      success: true,
      testResults
    });
  } catch (error) {
    console.error('Failed to test notification channels:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test notification channels'
    });
  }
});

// Get notification logs for a test
router.get('/:id/notification-logs', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50, type, status } = req.query;

    // Get existing test to check ownership
    const existingTest = await schedulingService.getScheduledTest(id);
    if (!existingTest) {
      return res.status(404).json({
        success: false,
        error: 'Scheduled test not found'
      });
    }

    if (existingTest.userId !== req.user!.userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Get notification logs (placeholder - implement in NotificationService)
    const logs = await schedulingService.getNotificationLogs({
      testId: id,
      type: type as string,
      status: status as string,
      limit: Number(limit)
    });

    res.json({
      success: true,
      logs
    });
  } catch (error) {
    console.error('Failed to fetch notification logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch notification logs'
    });
  }
});

// Get alert condition templates
router.get('/alert-templates', auth, async (req, res) => {
  try {
    const templates = [
      {
        id: 'response_time_high',
        name: 'High Response Time',
        metric: 'responseTime',
        operator: 'gt',
        value: 1000,
        severity: 'medium',
        description: 'Alert when response time exceeds 1 second'
      },
      {
        id: 'error_rate_high',
        name: 'High Error Rate',
        metric: 'errorRate',
        operator: 'gt',
        value: 5,
        severity: 'high',
        description: 'Alert when error rate exceeds 5%'
      },
      {
        id: 'availability_low',
        name: 'Low Availability',
        metric: 'availability',
        operator: 'lt',
        value: 95,
        severity: 'critical',
        description: 'Alert when availability drops below 95%'
      },
      {
        id: 'throughput_low',
        name: 'Low Throughput',
        metric: 'throughput',
        operator: 'lt',
        value: 100,
        severity: 'medium',
        description: 'Alert when throughput drops below 100 req/min'
      }
    ];

    res.json({
      success: true,
      templates
    });
  } catch (error) {
    console.error('Failed to fetch alert templates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch alert templates'
    });
  }
});

// Get schedule templates
router.get('/schedule-templates', auth, async (req, res) => {
  try {
    const templates = [
      {
        id: 'every_5_minutes',
        name: 'Every 5 Minutes',
        type: 'interval',
        expression: '5m',
        description: 'Run test every 5 minutes'
      },
      {
        id: 'every_hour',
        name: 'Every Hour',
        type: 'cron',
        expression: '0 * * * *',
        description: 'Run test at the top of every hour'
      },
      {
        id: 'daily_9am',
        name: 'Daily at 9 AM',
        type: 'cron',
        expression: '0 9 * * *',
        description: 'Run test every day at 9:00 AM'
      },
      {
        id: 'weekdays_6pm',
        name: 'Weekdays at 6 PM',
        type: 'cron',
        expression: '0 18 * * 1-5',
        description: 'Run test Monday-Friday at 6:00 PM'
      },
      {
        id: 'weekly_monday',
        name: 'Weekly on Monday',
        type: 'cron',
        expression: '0 9 * * 1',
        description: 'Run test every Monday at 9:00 AM'
      }
    ];

    res.json({
      success: true,
      templates
    });
  } catch (error) {
    console.error('Failed to fetch schedule templates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch schedule templates'
    });
  }
});

export default router;