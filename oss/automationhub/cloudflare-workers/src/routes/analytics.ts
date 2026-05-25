/**
 * Analytics Routes for Cloudflare Workers
 * Provides analytics and metrics collection via Analytics Engine
 */

import { Hono } from 'hono';
import { validator } from 'hono/validator';
import { z } from 'zod';

const analyticsRoutes = new Hono();

// Event tracking endpoint
analyticsRoutes.post('/event', async (c) => {
  try {
    const eventData = await c.req.json();

    // Validate required fields
    const requiredFields = ['event', 'timestamp'];
    for (const field of requiredFields) {
      if (!eventData[field]) {
        return c.json({
          error: `Missing required field: ${field}`,
          required_fields: requiredFields
        }, 400);
      }
    }

    // Write to Analytics Engine
    c.env.UPM_ANALYTICS?.writeDataPoint({
      blobs: [
        eventData.event,
        eventData.user_id || 'anonymous',
        eventData.session_id || 'no-session',
        eventData.properties ? JSON.stringify(eventData.properties) : '{}',
        c.req.header('User-Agent') || 'unknown',
        c.req.header('CF-Connecting-IP') || 'unknown',
        c.req.cf?.country || 'unknown',
        c.req.cf?.colo || 'unknown'
      ],
      doubles: [
        eventData.value || 0,
        eventData.duration || 0,
        new Date().getTime(),
        eventData.page_load_time || 0
      ],
      indexes: [
        getCategoryIndex(eventData.event),
        getStatusCodeIndex(eventData.status_code),
        getUserTypeIndex(eventData.user_type),
        getEnvironmentIndex(c.env.ENVIRONMENT)
      ]
    });

    // Also store recent events in KV for real-time dashboards
    const recentEventsKey = 'analytics:recent_events';
    const recentEvents = await c.env.UPM_CACHE.get(recentEventsKey);
    const events = recentEvents ? JSON.parse(recentEvents) : [];

    events.push({
      ...eventData,
      timestamp: new Date().toISOString(),
      cf: {
        colo: c.req.cf?.colo,
        country: c.req.cf?.country,
        ip: c.req.header('CF-Connecting-IP')
      }
    });

    // Keep only last 100 events
    if (events.length > 100) {
      events.splice(0, events.length - 100);
    }

    await c.env.UPM_CACHE.put(recentEventsKey, JSON.stringify(events), {
      expirationTtl: 300 // 5 minutes
    });

    return c.json({
      success: true,
      message: 'Event tracked successfully',
      event: eventData.event
    });
  } catch (error) {
    return c.json({
      error: 'Failed to track event',
      message: error.message
    }, 500);
  }
});

// Batch event tracking
analyticsRoutes.post('/events/batch', async (c) => {
  try {
    const { events } = await c.req.json();

    if (!Array.isArray(events)) {
      return c.json({
        error: 'Events must be an array'
      }, 400);
    }

    if (events.length > 100) {
      return c.json({
        error: 'Too many events in batch',
        max_events: 100
      }, 400);
    }

    // Process each event
    const processedEvents = [];
    for (const eventData of events) {
      try {
        c.env.UPM_ANALYTICS?.writeDataPoint({
          blobs: [
            eventData.event,
            eventData.user_id || 'anonymous',
            eventData.session_id || 'no-session',
            eventData.properties ? JSON.stringify(eventData.properties) : '{}',
            c.req.header('User-Agent') || 'unknown',
            c.req.header('CF-Connecting-IP') || 'unknown',
            c.req.cf?.country || 'unknown',
            c.req.cf?.colo || 'unknown'
          ],
          doubles: [
            eventData.value || 0,
            eventData.duration || 0,
            new Date().getTime(),
            eventData.page_load_time || 0
          ],
          indexes: [
            getCategoryIndex(eventData.event),
            getStatusCodeIndex(eventData.status_code),
            getUserTypeIndex(eventData.user_type),
            getEnvironmentIndex(c.env.ENVIRONMENT)
          ]
        });
        processedEvents.push(eventData.event);
      } catch (error) {
        console.error('Failed to process event:', eventData.event, error);
      }
    }

    return c.json({
      success: true,
      processed_events: processedEvents.length,
      total_events: events.length,
      message: `Successfully tracked ${processedEvents.length} events`
    });
  } catch (error) {
    return c.json({
      error: 'Failed to track batch events',
      message: error.message
    }, 500);
  }
});

// Get real-time metrics
analyticsRoutes.get('/metrics/realtime', async (c) => {
  try {
    const recentEventsKey = 'analytics:recent_events';
    const recentEvents = await c.env.UPM_CACHE.get(recentEventsKey);
    const events = recentEvents ? JSON.parse(recentEvents) : [];

    // Calculate metrics
    const metrics = {
      total_events: events.length,
      unique_users: new Set(events.map(e => e.user_id).filter(Boolean)).size,
      events_by_type: {},
      events_by_country: {},
      events_by_colo: {},
      avg_duration: 0,
      total_value: 0,
      timestamp: new Date().toISOString()
    };

    let totalDuration = 0;
    let durationCount = 0;

    for (const event of events) {
      // Count by event type
      metrics.events_by_type[event.event] = (metrics.events_by_type[event.event] || 0) + 1;

      // Count by country
      if (event.cf?.country) {
        metrics.events_by_country[event.cf.country] = (metrics.events_by_country[event.cf.country] || 0) + 1;
      }

      // Count by colo
      if (event.cf?.colo) {
        metrics.events_by_colo[event.cf.colo] = (metrics.events_by_colo[event.cf.colo] || 0) + 1;
      }

      // Sum duration
      if (event.duration) {
        totalDuration += event.duration;
        durationCount++;
      }

      // Sum value
      if (event.value) {
        metrics.total_value += event.value;
      }
    }

    metrics.avg_duration = durationCount > 0 ? totalDuration / durationCount : 0;

    return c.json(metrics);
  } catch (error) {
    return c.json({
      error: 'Failed to get real-time metrics',
      message: error.message
    }, 500);
  }
});

// Get analytics summary
analyticsRoutes.get('/summary', async (c) => {
  const timeRange = c.req.query('range') || '24h'; // 1h, 24h, 7d, 30d

  try {
    const cacheKey = `analytics:summary:${timeRange}`;
    const cached = await c.env.UPM_CACHE.get(cacheKey);

    if (cached) {
      return c.json(JSON.parse(cached));
    }

    // Calculate time range
    const now = Date.now();
    let startTime;

    switch (timeRange) {
      case '1h':
        startTime = now - (60 * 60 * 1000);
        break;
      case '24h':
        startTime = now - (24 * 60 * 60 * 1000);
        break;
      case '7d':
        startTime = now - (7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startTime = now - (30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startTime = now - (24 * 60 * 60 * 1000);
    }

    // Query Analytics Engine
    const summary = await queryAnalyticsSummary(c.env, startTime, now);

    // Cache for appropriate time based on range
    const cacheTtl = timeRange === '1h' ? 60 : timeRange === '24h' ? 300 : 1800;
    await c.env.UPM_CACHE.put(cacheKey, JSON.stringify(summary), {
      expirationTtl: cacheTtl
    });

    return c.json(summary);
  } catch (error) {
    return c.json({
      error: 'Failed to get analytics summary',
      message: error.message
    }, 500);
  }
});

// Get top events
analyticsRoutes.get('/events/top', async (c) => {
  const limit = parseInt(c.req.query('limit') || '10');
  const timeRange = c.req.query('range') || '24h';

  try {
    const cacheKey = `analytics:top_events:${timeRange}:${limit}`;
    const cached = await c.env.UPM_CACHE.get(cacheKey);

    if (cached) {
      return c.json(JSON.parse(cached));
    }

    // Calculate time range
    const now = Date.now();
    let startTime;

    switch (timeRange) {
      case '1h':
        startTime = now - (60 * 60 * 1000);
        break;
      case '24h':
        startTime = now - (24 * 60 * 60 * 1000);
        break;
      case '7d':
        startTime = now - (7 * 24 * 60 * 60 * 1000);
        break;
      default:
        startTime = now - (24 * 60 * 60 * 1000);
    }

    // Query top events
    const topEvents = await queryTopEvents(c.env, startTime, now, limit);

    // Cache for 5 minutes
    await c.env.UPM_CACHE.put(cacheKey, JSON.stringify(topEvents), {
      expirationTtl: 300
    });

    return c.json(topEvents);
  } catch (error) {
    return c.json({
      error: 'Failed to get top events',
      message: error.message
    }, 500);
  }
});

// Get user analytics
analyticsRoutes.get('/users/:userId', async (c) => {
  const userId = c.req.param('userId');
  const timeRange = c.req.query('range') || '7d';

  try {
    const cacheKey = `analytics:user:${userId}:${timeRange}`;
    const cached = await c.env.UPM_CACHE.get(cacheKey);

    if (cached) {
      return c.json(JSON.parse(cached));
    }

    // Calculate time range
    const now = Date.now();
    let startTime;

    switch (timeRange) {
      case '1h':
        startTime = now - (60 * 60 * 1000);
        break;
      case '24h':
        startTime = now - (24 * 60 * 60 * 1000);
        break;
      case '7d':
        startTime = now - (7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startTime = now - (30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startTime = now - (7 * 24 * 60 * 60 * 1000);
    }

    // Query user analytics
    const userAnalytics = await queryUserAnalytics(c.env, userId, startTime, now);

    // Cache for 5 minutes
    await c.env.UPM_CACHE.put(cacheKey, JSON.stringify(userAnalytics), {
      expirationTtl: 300
    });

    return c.json(userAnalytics);
  } catch (error) {
    return c.json({
      error: 'Failed to get user analytics',
      message: error.message,
      user_id: userId
    }, 500);
  }
});

// Helper functions
function getCategoryIndex(event: string): number {
  const categories = {
    'page_view': 1,
    'click': 2,
    'api_call': 3,
    'error': 4,
    'task_execution': 5,
    'workflow_run': 6,
    'file_upload': 7,
    'file_download': 8,
    'user_login': 9,
    'user_logout': 10
  };
  return categories[event as keyof typeof categories] || 0;
}

function getStatusCodeIndex(statusCode?: number): number {
  if (!statusCode) return 0;
  if (statusCode >= 200 && statusCode < 300) return 1;
  if (statusCode >= 300 && statusCode < 400) return 2;
  if (statusCode >= 400 && statusCode < 500) return 3;
  if (statusCode >= 500) return 4;
  return 0;
}

function getUserTypeIndex(userType?: string): number {
  const types = {
    'anonymous': 1,
    'free': 2,
    'premium': 3,
    'enterprise': 4,
    'admin': 5
  };
  return types[userType as keyof typeof types] || 0;
}

function getEnvironmentIndex(env?: string): number {
  const environments = {
    'development': 1,
    'staging': 2,
    'production': 3
  };
  return environments[env as keyof typeof environments] || 0;
}

async function queryAnalyticsSummary(env: any, startTime: number, endTime: number): Promise<any> {
  // This would query the Analytics Engine
  // For now, return mock data structure
  return {
    total_events: 0,
    unique_users: 0,
    avg_session_duration: 0,
    top_events: [],
    geographic_distribution: {},
    error_rate: 0,
    time_range: {
      start: new Date(startTime).toISOString(),
      end: new Date(endTime).toISOString()
    }
  };
}

async function queryTopEvents(env: any, startTime: number, endTime: number, limit: number): Promise<any> {
  // This would query the Analytics Engine for top events
  return {
    events: [],
    time_range: {
      start: new Date(startTime).toISOString(),
      end: new Date(endTime).toISOString()
    }
  };
}

async function queryUserAnalytics(env: any, userId: string, startTime: number, endTime: number): Promise<any> {
  // This would query the Analytics Engine for user-specific data
  return {
    user_id: userId,
    total_events: 0,
    session_count: 0,
    avg_session_duration: 0,
    top_events: [],
    timeline: [],
    time_range: {
      start: new Date(startTime).toISOString(),
      end: new Date(endTime).toISOString()
    }
  };
}

export { analyticsRoutes };