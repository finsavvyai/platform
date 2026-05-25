// Cloudflare Analytics for SDLC Landing Page
// This file provides analytics tracking functions that work with Cloudflare's ecosystem

interface AnalyticsEvent {
  type: string;
  data: Record<string, unknown>;
  timestamp: number;
}

// Store events in memory (will be persisted to Cloudflare KV)
const events: AnalyticsEvent[] = [];

// Track page views
export function incrementPageView(page: string) {
  const event: AnalyticsEvent = {
    type: 'page_view',
    data: { page, url: typeof window !== 'undefined' ? window.location?.href : page },
    timestamp: Date.now(),
  };

  events.push(event);

  // Send to Cloudflare Analytics Engine if available
  if (typeof window !== 'undefined' && 'Analytics' in window) {
    // This would integrate with Cloudflare's Web Analytics
    console.log('Page view tracked:', page);
  }
}

// Track demo requests
export function incrementDemoRequest(status: 'success' | 'error') {
  const event: AnalyticsEvent = {
    type: 'demo_request',
    data: { status },
    timestamp: Date.now(),
  };

  events.push(event);
  console.log('Demo request tracked:', status);
}

// Track form submissions
export function recordFormSubmission(formType: string, duration: number) {
  const event: AnalyticsEvent = {
    type: 'form_submission',
    data: { formType, duration },
    timestamp: Date.now(),
  };

  events.push(event);
  console.log('Form submission tracked:', { formType, duration });
}

// Track active users (simplified version)
const activeUsersSet = new Set<string>();

export function trackActiveUser(userId: string) {
  activeUsersSet.add(userId);

  // Note: setTimeout is not fully supported in Edge Runtime
  // In production, use Cloudflare KV with TTL or cron-based cleanup
  // For now, this is a no-op in Edge Runtime
  if (typeof window !== 'undefined') {
    setTimeout(() => {
      activeUsersSet.delete(userId);
    }, 30 * 60 * 1000);
  }
}

export function getActiveUserCount(): number {
  return activeUsersSet.size;
}

// Track HTTP requests (for API routes)
export function recordHttpRequest(method: string, route: string, statusCode: number, duration: number) {
  const event: AnalyticsEvent = {
    type: 'http_request',
    data: { method, route, statusCode, duration },
    timestamp: Date.now(),
  };

  events.push(event);
  console.log('HTTP request tracked:', { method, route, statusCode, duration });
}

// Get all events for debugging/export
export function getEvents(): AnalyticsEvent[] {
  return [...events];
}

// Clear events (for memory management)
export function clearEvents(): void {
  events.length = 0;
}

// Export metrics in a format compatible with monitoring systems
export function getMetrics(): Record<string, unknown> {
  return {
    pageViews: events.filter(e => e.type === 'page_view').length,
    demoRequests: events.filter(e => e.type === 'demo_request').length,
    formSubmissions: events.filter(e => e.type === 'form_submission').length,
    httpRequests: events.filter(e => e.type === 'http_request').length,
    activeUsers: getActiveUserCount(),
    totalEvents: events.length,
  };
}

// Mock exports for backward compatibility with existing code
export const pageViewsTotal = {
  labels: (..._args: string[]) => ({
    inc: () => incrementPageView('')
  })
};

export const demoRequestsTotal = {
  labels: (..._args: string[]) => ({
    inc: () => incrementDemoRequest('success')
  })
};

export const httpRequestDuration = {
  labels: (..._args: string[]) => ({
    observe: (duration: number) => console.log('Duration tracked:', duration)
  })
};

export const httpRequestDurationMicroseconds = {
  observe: (duration: number) => console.log('Duration tracked:', duration),
  labels: (..._args: string[]) => ({
    observe: (duration: number) => console.log('Duration tracked:', duration)
  })
};

export const httpRequestTotal = {
  labels: (..._args: string[]) => ({
    inc: () => {}
  })
};

export const formSubmissionDuration = {
  labels: (..._args: string[]) => ({
    observe: (duration: number) => console.log('Form duration:', duration)
  })
};

export const errorRate = {
  labels: (..._args: string[]) => ({
    set: (value: number) => console.log('Error rate:', value)
  })
};

export function updateErrorRate(type: string, rate: number) {
  errorRate.labels(type).set(rate);
}

export const register = {
  setDefaultLabels: (_labels: Record<string, string>) => {},
  contentType: 'text/plain',
  metrics: async () => '# HELP test_metric\ntest_metric 1\n',
};

export const activeUsers = {
  set: (value: number) => console.log('Active users:', value),
  inc: () => console.log('Active users incremented'),
  dec: () => console.log('Active users decremented'),
};