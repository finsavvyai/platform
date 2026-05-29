import {
  httpRequestDurationMicroseconds,
  httpRequestTotal,
  demoRequestsTotal,
  pageViewsTotal,
  activeUsers,
  formSubmissionDuration,
  errorRate,
  trackActiveUser,
  incrementPageView,
  incrementDemoRequest,
  recordFormSubmission,
  updateErrorRate,
  register,
} from '../../lib/metrics';

// Mock prom-client
jest.mock('prom-client', () => ({
  Registry: jest.fn().mockImplementation(() => ({
    setDefaultLabels: jest.fn(),
    contentType: 'text/plain',
    metrics: jest.fn().mockResolvedValue('# HELP test_metric\ntest_metric 1\n'),
  })),
  collectDefaultMetrics: jest.fn(),
  Histogram: jest.fn().mockImplementation(() => ({
    labels: jest.fn().mockReturnValue({
      observe: jest.fn(),
    }),
  })),
  Counter: jest.fn().mockImplementation(() => ({
    labels: jest.fn().mockReturnValue({
      inc: jest.fn(),
    }),
  })),
  Gauge: jest.fn().mockImplementation(() => ({
    labels: jest.fn().mockReturnValue({
      set: jest.fn(),
    }),
  })),
}));

describe('Metrics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Metrics Initialization', () => {
    it('should initialize all metrics correctly', () => {
      const { collectDefaultMetrics, Histogram, Counter, Gauge } = require('prom-client');

      expect(collectDefaultMetrics).toHaveBeenCalledWith({
        register: register,
      });

      expect(Histogram).toHaveBeenCalledWith({
        name: 'http_request_duration_ms',
        help: 'Duration of HTTP requests in ms',
        labelNames: ['method', 'route', 'status_code'],
        buckets: [1, 3, 5, 7, 10, 15, 20, 30, 50, 100, 200, 500, 1000],
      });

      expect(Counter).toHaveBeenCalledWith({
        name: 'http_requests_total',
        help: 'Total number of HTTP requests',
        labelNames: ['method', 'route', 'status_code'],
      });

      expect(Counter).toHaveBeenCalledWith({
        name: 'demo_requests_total',
        help: 'Total number of demo requests',
        labelNames: ['status'],
      });

      expect(Gauge).toHaveBeenCalledWith({
        name: 'active_users_total',
        help: 'Number of currently active users',
      });
    });

    it('should set default labels on register', () => {
      expect(register.setDefaultLabels).toHaveBeenCalledWith({
        app: 'sdlc-landing-page',
      });
    });
  });

  describe('User Tracking', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should track active users', () => {
      const setSpy = jest.spyOn(activeUsers, 'set');

      trackActiveUser('user123');
      trackActiveUser('user456');

      expect(setSpy).toHaveBeenCalledWith(2);
    });

    it('should remove inactive users after timeout', () => {
      const setSpy = jest.spyOn(activeUsers, 'set');

      trackActiveUser('user123');
      expect(setSpy).toHaveBeenCalledWith(1);

      // Fast-forward time
      jest.advanceTimersByTime(30 * 60 * 1000);

      expect(setSpy).toHaveBeenCalledWith(0);
    });

    it('should handle multiple tracking of same user', () => {
      const setSpy = jest.spyOn(activeUsers, 'set');

      trackActiveUser('user123');
      trackActiveUser('user123'); // Same user

      expect(setSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('Page Views', () => {
    it('should increment page view counter', () => {
      const incSpy = jest.spyOn(pageViewsTotal.labels(''), 'inc');

      incrementPageView('/home');

      expect(incSpy).toHaveBeenCalled();
    });

    it('should handle different pages', () => {
      const incSpy1 = jest.spyOn(pageViewsTotal.labels('/home'), 'inc');
      const incSpy2 = jest.spyOn(pageViewsTotal.labels('/pricing'), 'inc');

      incrementPageView('/home');
      incrementPageView('/pricing');

      expect(incSpy1).toHaveBeenCalled();
      expect(incSpy2).toHaveBeenCalled();
    });
  });

  describe('Demo Requests', () => {
    it('should increment successful demo requests', () => {
      const incSpy = jest.spyOn(demoRequestsTotal.labels('success'), 'inc');

      incrementDemoRequest('success');

      expect(incSpy).toHaveBeenCalled();
    });

    it('should increment failed demo requests', () => {
      const incSpy = jest.spyOn(demoRequestsTotal.labels('error'), 'inc');

      incrementDemoRequest('error');

      expect(incSpy).toHaveBeenCalled();
    });
  });

  describe('Form Submissions', () => {
    it('should record form submission duration', () => {
      const observeSpy = jest.spyOn(formSubmissionDuration.labels('demo'), 'observe');

      recordFormSubmission('demo', 1500);

      expect(observeSpy).toHaveBeenCalledWith(1500);
    });

    it('should handle different form types', () => {
      const observeSpy1 = jest.spyOn(formSubmissionDuration.labels('demo'), 'observe');
      const observeSpy2 = jest.spyOn(formSubmissionDuration.labels('contact'), 'observe');

      recordFormSubmission('demo', 1000);
      recordFormSubmission('contact', 2000);

      expect(observeSpy1).toHaveBeenCalledWith(1000);
      expect(observeSpy2).toHaveBeenCalledWith(2000);
    });
  });

  describe('Error Rate', () => {
    it('should update error rate for different types', () => {
      const setSpy1 = jest.spyOn(errorRate.labels('form'), 'set');
      const setSpy2 = jest.spyOn(errorRate.labels('api'), 'set');

      updateErrorRate('form', 0.05);
      updateErrorRate('api', 0.02);

      expect(setSpy1).toHaveBeenCalledWith(0.05);
      expect(setSpy2).toHaveBeenCalledWith(0.02);
    });

    it('should handle zero error rate', () => {
      const setSpy = jest.spyOn(errorRate.labels('general'), 'set');

      updateErrorRate('general', 0);

      expect(setSpy).toHaveBeenCalledWith(0);
    });
  });

  describe('HTTP Metrics', () => {
    it('should provide histogram for request duration', () => {
      expect(httpRequestDurationMicroseconds).toBeDefined();
      expect(httpRequestDurationMicroseconds.observe).toBeDefined();
    });

    it('should provide counter for total requests', () => {
      expect(httpRequestTotal).toBeDefined();
      expect(httpRequestTotal.labels().inc).toBeDefined();
    });

    it('should have correct bucket configuration for duration', () => {
      const { Histogram } = require('prom-client');
      const mockHistogram = Histogram.mock.results[0].value;

      expect(mockHistogram.options.buckets).toEqual([
        1, 3, 5, 7, 10, 15, 20, 30, 50, 100, 200, 500, 1000
      ]);
    });
  });

  describe('Metrics Registry', () => {
    it('should export register for metrics endpoint', () => {
      expect(register).toBeDefined();
      expect(register.metrics).toBeDefined();
    });

    it('should provide correct content type', () => {
      expect(register.contentType).toBe('text/plain');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long page names', () => {
      const incSpy = jest.spyOn(pageViewsTotal.labels(), 'inc');

      const longPageName = '/very/long/page/name/with/many/segments/that/might/be/problematic';
      incrementPageView(longPageName);

      expect(incSpy).toHaveBeenCalled();
    });

    it('should handle very fast form submissions', () => {
      const observeSpy = jest.spyOn(formSubmissionDuration.labels('demo'), 'observe');

      recordFormSubmission('demo', 1); // 1ms

      expect(observeSpy).toHaveBeenCalledWith(1);
    });

    it('should handle very slow form submissions', () => {
      const observeSpy = jest.spyOn(formSubmissionDuration.labels('demo'), 'observe');

      recordFormSubmission('demo', 30000); // 30 seconds

      expect(observeSpy).toHaveBeenCalledWith(30000);
    });

    it('should handle zero error rate as valid input', () => {
      const setSpy = jest.spyOn(errorRate.labels('api'), 'set');

      updateErrorRate('api', 0);

      expect(setSpy).toHaveBeenCalledWith(0);
    });

    it('should handle 100% error rate as valid input', () => {
      const setSpy = jest.spyOn(errorRate.labels('api'), 'set');

      updateErrorRate('api', 1);

      expect(setSpy).toHaveBeenCalledWith(1);
    });
  });
});