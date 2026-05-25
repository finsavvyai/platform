import { describe, it, expect } from 'vitest';
import { createHistogram } from '../src/metrics/histogram.js';

describe('histogram', () => {
  it('should create a histogram instance', () => {
    const histogram = createHistogram('request_latency', 'Request latency in seconds');
    expect(histogram).toBeDefined();
    expect(histogram.observe).toBeDefined();
    expect(histogram.getPrometheus).toBeDefined();
  });

  it('should observe values', () => {
    const histogram = createHistogram('request_latency', 'Request latency in seconds');
    histogram.observe(0.1);
    histogram.observe(0.2);
    histogram.observe(0.5);

    const output = histogram.getPrometheus();
    expect(output).toContain('request_latency_count 3');
  });

  it('should calculate sum of observations', () => {
    const histogram = createHistogram('request_latency', 'Request latency in seconds');
    histogram.observe(0.1);
    histogram.observe(0.2);
    histogram.observe(0.7);

    const output = histogram.getPrometheus();
    expect(output).toContain('request_latency_sum 1');
  });

  it('should generate prometheus format output', () => {
    const histogram = createHistogram('request_latency', 'Request latency in seconds');
    histogram.observe(0.05);

    const output = histogram.getPrometheus();
    expect(output).toContain('# HELP request_latency');
    expect(output).toContain('# TYPE request_latency histogram');
    expect(output).toContain('request_latency_bucket');
    expect(output).toContain('request_latency_sum');
    expect(output).toContain('request_latency_count');
  });

  it('should support custom buckets', () => {
    const histogram = createHistogram('response_time', 'Response time', [1, 2, 5]);
    histogram.observe(0.5);
    histogram.observe(1.5);
    histogram.observe(10);

    const output = histogram.getPrometheus();
    expect(output).toContain('le="1"');
    expect(output).toContain('le="2"');
    expect(output).toContain('le="5"');
    expect(output).toContain('le="+Inf"');
  });

  it('should include +Inf bucket', () => {
    const histogram = createHistogram('latency', 'Latency', [0.1, 0.5, 1]);
    histogram.observe(100);

    const output = histogram.getPrometheus();
    expect(output).toContain('le="+Inf"');
  });

  it('should count all observations in +Inf bucket', () => {
    const histogram = createHistogram('latency', 'Latency', [0.1]);
    histogram.observe(0.05);
    histogram.observe(0.15);
    histogram.observe(1);

    const output = histogram.getPrometheus();
    const lines = output.split('\n');
    const infLine = lines.find((l) => l.includes('le="+Inf"'));
    expect(infLine).toContain(' 3');
  });
});
