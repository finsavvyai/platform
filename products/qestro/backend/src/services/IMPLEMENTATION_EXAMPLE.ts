'use strict';

/**
 * Complete Implementation Example
 * Shows how to integrate Webhook and Audit systems into an Express application
 */

import express, { Request, Response } from 'express';
import { WebhookManager } from './webhooks/index.js';
import { AuditLogger, createAuditMiddleware } from './audit/index.js';
import webhookRouter from './webhooks/routes/webhook.routes.js';
import auditRouter from './audit/routes/audit.routes.js';
import crypto from 'crypto';

// Initialize services
const webhookManager = new WebhookManager();
const auditLogger = new AuditLogger();

// Create Express app
const app = express();
app.use(express.json());

// Mount audit middleware for automatic request logging
app.use(createAuditMiddleware(auditLogger));

// Mount webhook and audit routes
app.use('/api/webhooks', webhookRouter);
app.use('/api/audit', auditRouter);

/**
 * Example 1: Register a webhook from a controller
 */
export async function createWebhookExample(req: Request, res: Response): Promise<void> {
  try {
    const { url, events } = req.body;
    const projectId = req.query.projectId as string;

    // Register webhook
    const webhookId = await webhookManager.registerWebhook(
      projectId,
      url,
      events,
      req.user?.userId || 'system',
      {
        maxRetries: 3,
        retryDelay: 5000,
        timeout: 30000,
      }
    );

    // Log the action
    await auditLogger.log({
      userId: req.user?.userId || 'system',
      userEmail: req.user?.email,
      action: 'webhook.created',
      category: 'configuration',
      projectId,
      resourceId: webhookId,
      resourceType: 'webhook',
      description: `Created webhook for events: ${events.join(', ')}`,
      ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || 'unknown',
      userAgent: req.get('user-agent') || 'unknown',
      status: 'success',
      metadata: {
        webhookId,
        url,
        eventsCount: events.length,
      },
    });

    res.json({ webhookId, message: 'Webhook created and logged' });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';

    // Log the failure
    await auditLogger.log({
      userId: req.user?.userId || 'system',
      action: 'webhook.created',
      category: 'configuration',
      projectId: req.query.projectId as string,
      description: `Failed to create webhook: ${msg}`,
      ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || 'unknown',
      userAgent: req.get('user-agent') || 'unknown',
      status: 'failure',
      errorMessage: msg,
    });

    res.status(400).json({ error: msg });
  }
}

/**
 * Example 2: Emit a webhook event from test execution service
 */
export async function emitTestCompletionEvent(
  projectId: string,
  testId: string,
  testName: string,
  status: 'passed' | 'failed',
  duration: number,
  userId: string
): Promise<void> {
  // Create webhook event
  const event = {
    id: crypto.randomUUID(),
    type: status === 'passed' ? ('test.completed' as const) : ('test.failed' as const),
    projectId,
    timestamp: new Date(),
    data: {
      testId,
      testName,
      status,
      duration,
    },
  };

  // Emit to all matching webhooks
  await webhookManager.emit(event);

  // Log the test execution
  await auditLogger.log({
    userId,
    action: 'test.executed',
    category: 'test_execution',
    projectId,
    resourceId: testId,
    resourceType: 'test',
    description: `Test executed: ${testName} - ${status}`,
    ipAddress: 'internal',
    userAgent: 'test-runner',
    status: status === 'passed' ? 'success' : 'failure',
    metadata: {
      testId,
      duration,
      webhookEvent: event.id,
    },
  });
}

/**
 * Example 3: Generate compliance report
 */
export async function generateComplianceReportExample(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const startDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // Last 90 days
    const endDate = req.query.endDate
      ? new Date(req.query.endDate as string)
      : new Date();

    const report = await auditLogger.generateComplianceReport(
      'org-123',
      startDate,
      endDate,
      req.user?.userId || 'system'
    );

    // Log the report generation
    await auditLogger.log({
      userId: req.user?.userId || 'system',
      action: 'report.generated',
      category: 'compliance',
      description: 'Generated compliance report',
      ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || 'unknown',
      userAgent: req.get('user-agent') || 'unknown',
      status: 'success',
      metadata: {
        reportId: report.id,
        period: { startDate, endDate },
        actionCount: report.summary.totalActions,
        userCount: report.summary.uniqueUsers,
      },
    });

    res.json(report);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
}

/**
 * Example 4: Query user activity
 */
export async function getUserActivityExample(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const userId = req.params.userId;
    const days = parseInt(req.query.days as string) || 30;

    const activities = await auditLogger.getUserActivity(userId, days);

    res.json({
      userId,
      period: `Last ${days} days`,
      count: activities.length,
      activities,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
}

/**
 * Example 5: Export audit logs to CSV
 */
export async function exportAuditLogsExample(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const csv = await auditLogger.exportToCSV({
      projectId: req.query.projectId as string | undefined,
      userId: req.query.userId as string | undefined,
    });

    // Log the export
    await auditLogger.log({
      userId: req.user?.userId || 'system',
      action: 'export.executed',
      category: 'data_export',
      projectId: req.query.projectId as string | undefined,
      description: 'Exported audit logs to CSV',
      ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || 'unknown',
      userAgent: req.get('user-agent') || 'unknown',
      status: 'success',
      metadata: {
        format: 'csv',
        timestamp: new Date(),
      },
    });

    res.header('Content-Type', 'text/csv');
    res.header('Content-Disposition', `attachment; filename="audit-logs-${Date.now()}.csv"`);
    res.send(csv);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
}

/**
 * Example 6: Handle webhook test endpoint
 */
export async function testWebhookExample(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const webhookId = req.params.webhookId;
    const webhook = webhookManager.getWebhook(webhookId);

    if (!webhook) {
      res.status(404).json({ error: 'Webhook not found' });
      return;
    }

    // Send test event
    const testEvent = {
      id: crypto.randomUUID(),
      type: webhook.events[0] || 'test.completed' as const,
      projectId: webhook.projectId,
      timestamp: new Date(),
      data: {
        testId: 'webhook-test-' + Date.now(),
        testName: 'Webhook Test Event',
        status: 'test',
        duration: 1234,
      },
    };

    await webhookManager.emit(testEvent);

    // Log the test
    await auditLogger.log({
      userId: req.user?.userId || 'system',
      action: 'webhook.created', // Could be a new action: webhook.tested
      category: 'configuration',
      projectId: webhook.projectId,
      resourceId: webhookId,
      resourceType: 'webhook',
      description: `Sent test event to webhook: ${webhook.url}`,
      ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || 'unknown',
      userAgent: req.get('user-agent') || 'unknown',
      status: 'success',
    });

    res.json({ message: 'Test event sent', eventId: testEvent.id });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
}

/**
 * Example 7: Handle failing test with audit logging
 */
export async function logFailedTestExample(
  testId: string,
  testName: string,
  errorMessage: string,
  userId: string,
  projectId: string
): Promise<void> {
  // Log test failure to audit
  await auditLogger.log({
    userId,
    action: 'test.executed',
    category: 'test_execution',
    projectId,
    resourceId: testId,
    resourceType: 'test',
    description: `Test failed: ${testName}`,
    ipAddress: 'internal',
    userAgent: 'test-runner',
    status: 'failure',
    errorMessage,
    metadata: {
      testId,
      testName,
      failureReason: errorMessage,
      timestamp: new Date(),
    },
  });

  // Emit webhook event for test failure
  await webhookManager.emit({
    id: crypto.randomUUID(),
    type: 'test.failed',
    projectId,
    timestamp: new Date(),
    data: {
      testId,
      testName,
      status: 'failed',
      errorMessage,
    },
  });
}

// Export app for use in server
export default app;
