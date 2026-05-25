'use strict';

import { Router, Request, Response } from 'express';
import { authenticate, requireRole } from '../../../middleware/authenticate.js';
import { WebhookManager } from '../WebhookManager.js';
import { WebhookEvent, WebhookEventType, WebhookRegistrationRequest } from '../types.js';
import { logger } from '../../../utils/logger.js';
import crypto from 'crypto';

const router = Router();
const webhookManager = new WebhookManager();

/**
 * POST /api/webhooks
 * Register a new webhook
 */
router.post('/', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { url, events, maxRetries, retryDelay, timeout, headers, secret } =
      req.body as WebhookRegistrationRequest;
    const projectId = req.query.projectId as string;

    if (!projectId) {
      res.status(400).json({ error: 'projectId query parameter required' });
      return;
    }

    if (!url || !events || events.length === 0) {
      res.status(400).json({ error: 'url and events are required' });
      return;
    }

    const webhookId = await webhookManager.registerWebhook(
      projectId,
      url,
      events as WebhookEventType[],
      req.user.userId,
      { secret, maxRetries, retryDelay, timeout, headers }
    );

    logger.info(`Webhook created: ${webhookId} by user ${req.user.userId}`);

    res.status(201).json({
      webhookId,
      message: 'Webhook registered successfully',
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Webhook registration failed: ${msg}`);
    res.status(400).json({ error: msg });
  }
});

/**
 * GET /api/webhooks
 * List webhooks for a project
 */
router.get('/', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const projectId = req.query.projectId as string;
    if (!projectId) {
      res.status(400).json({ error: 'projectId query parameter required' });
      return;
    }

    const webhooks = await webhookManager.listWebhooks(projectId);

    res.json({
      count: webhooks.length,
      webhooks: webhooks.map((wh) => ({
        id: wh.id,
        url: wh.url,
        events: wh.events,
        active: wh.active,
        maxRetries: wh.maxRetries,
        createdAt: wh.createdAt,
        updatedAt: wh.updatedAt,
      })),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Failed to list webhooks: ${msg}`);
    res.status(500).json({ error: msg });
  }
});

/**
 * GET /api/webhooks/:id
 * Get webhook details
 */
router.get('/:id', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const webhook = webhookManager.getWebhook(req.params.id);
    if (!webhook) {
      res.status(404).json({ error: 'Webhook not found' });
      return;
    }

    res.json({
      id: webhook.id,
      url: webhook.url,
      events: webhook.events,
      active: webhook.active,
      maxRetries: webhook.maxRetries,
      retryDelay: webhook.retryDelay,
      timeout: webhook.timeout,
      createdAt: webhook.createdAt,
      updatedAt: webhook.updatedAt,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

/**
 * DELETE /api/webhooks/:id
 * Remove a webhook
 */
router.delete('/:id', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    await webhookManager.removeWebhook(req.params.id);
    logger.info(`Webhook deleted: ${req.params.id} by user ${req.user.userId}`);

    res.json({ message: 'Webhook removed successfully' });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({ error: msg });
  }
});

/**
 * GET /api/webhooks/:id/deliveries
 * Get delivery history
 */
router.get('/:id/deliveries', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const deliveries = await webhookManager.getDeliveryHistory(req.params.id, limit);
    const stats = await webhookManager.getDeliveryStats(req.params.id);

    res.json({
      count: deliveries.length,
      stats,
      deliveries: deliveries.map((d) => ({
        id: d.id,
        eventId: d.eventId,
        attempt: d.attempt,
        status: d.status,
        statusCode: d.statusCode,
        errorMessage: d.errorMessage,
        timestamp: d.timestamp,
        deliveryTime: d.deliveryTime,
      })),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

/**
 * POST /api/webhooks/:id/test
 * Send a test event to a webhook
 */
router.post('/:id/test', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const webhook = webhookManager.getWebhook(req.params.id);
    if (!webhook) {
      res.status(404).json({ error: 'Webhook not found' });
      return;
    }

    const testEvent: WebhookEvent = {
      id: crypto.randomUUID(),
      type: webhook.events[0] || 'test.completed',
      projectId: webhook.projectId,
      timestamp: new Date(),
      data: {
        testId: 'test-webhook-' + Date.now(),
        testName: 'Webhook Test Event',
        status: 'test',
        errorMessage: null,
        duration: 1234,
      },
    };

    await webhookManager.emit(testEvent);
    logger.info(`Test webhook sent: ${webhook.id}`);

    res.json({
      message: 'Test event sent',
      eventId: testEvent.id,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

/**
 * PATCH /api/webhooks/:id
 * Update webhook configuration
 */
router.patch('/:id', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { events, maxRetries, retryDelay, timeout, active, headers } = req.body;

    await webhookManager.updateWebhook(req.params.id, {
      ...(events && { events }),
      ...(maxRetries !== undefined && { maxRetries }),
      ...(retryDelay !== undefined && { retryDelay }),
      ...(timeout !== undefined && { timeout }),
      ...(active !== undefined && { active }),
      ...(headers && { headers }),
    });

    logger.info(`Webhook updated: ${req.params.id} by user ${req.user.userId}`);

    res.json({ message: 'Webhook updated successfully' });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({ error: msg });
  }
});

export default router;
