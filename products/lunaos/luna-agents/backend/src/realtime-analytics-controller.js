/**
 * Real-time Analytics HTTP Controller — Task 3.1
 * Routes: POST /analytics/track, GET /analytics/events,
 *         POST /analytics/funnel, POST /analytics/cohort,
 *         GET  /analytics/live  (SSE)
 */
import { RealtimeAnalytics } from './realtime-analytics.js';

export class RealtimeAnalyticsController {
  constructor(env) {
    this.analytics = new RealtimeAnalytics(env);
  }

  async handle(request, userId) {
    const url = new URL(request.url);
    const sub = url.pathname.replace(/.*\/analytics\/?/, '').split('/')[0];

    switch (`${request.method}:${sub}`) {
      case 'POST:track':    return this.trackEvent(request, userId);
      case 'GET:events':    return this.getEvents(request, userId);
      case 'POST:funnel':   return this.runFunnel(request, userId);
      case 'POST:cohort':   return this.runCohort(request, userId);
      case 'GET:live':      return this.liveStream(request, userId);
      default:
        return json({ error: 'Not found' }, 404);
    }
  }

  async trackEvent(request, userId) {
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }

    const { type, sessionId, properties } = body;
    if (!type) return json({ error: 'event.type is required' }, 400);

    try {
      const result = await this.analytics.track({
        type,
        userId,
        sessionId,
        properties,
      });
      return json(result, 201);
    } catch (err) {
      return json({ error: err.message }, 500);
    }
  }

  async getEvents(request, userId) {
    const url = new URL(request.url);
    const params = {
      type:   url.searchParams.get('type') ?? undefined,
      userId: url.searchParams.get('userId') ?? userId,
      since:  url.searchParams.get('since')
        ? Number(url.searchParams.get('since'))
        : undefined,
      limit:  url.searchParams.get('limit')
        ? Number(url.searchParams.get('limit'))
        : 50,
    };

    try {
      const events = await this.analytics.queryEvents(params);
      return json({ events, count: events.length });
    } catch (err) {
      return json({ error: err.message }, 500);
    }
  }

  async runFunnel(request, userId) {
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }

    const { steps, since } = body;
    if (!Array.isArray(steps) || steps.length < 2) {
      return json({ error: 'steps must be an array of at least 2 event types' }, 400);
    }

    try {
      const funnel = await this.analytics.funnelAnalysis({ steps, since, userId });
      return json({ funnel });
    } catch (err) {
      return json({ error: err.message }, 500);
    }
  }

  async runCohort(request, userId) {
    let body = {};
    try { body = await request.json(); } catch { /* optional body */ }

    const { cohortEvent = 'signup', retentionEvent = 'query', weeks = 4 } = body;

    try {
      const cohorts = await this.analytics.cohortAnalysis({
        cohortEvent, retentionEvent, weeks,
      });
      return json({ cohorts, generatedFor: userId });
    } catch (err) {
      return json({ error: err.message }, 500);
    }
  }

  async liveStream(_request, userId) {
    const stream = new ReadableStream({
      async start(controller) {
        const analytics = new RealtimeAnalytics(this.env);
        for await (const chunk of analytics.liveStream(userId)) {
          controller.enqueue(new TextEncoder().encode(`data: ${chunk}\n\n`));
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
