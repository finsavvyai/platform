import { describe, it, expect } from 'vitest';
import { createCounter } from '../src/metrics/counter.js';

describe('counter', () => {
  it('should create a counter instance', () => {
    const counter = createCounter('requests_total', 'Total requests');
    expect(counter).toBeDefined();
    expect(counter.increment).toBeDefined();
    expect(counter.getValue).toBeDefined();
  });

  it('should initialize with value 0', () => {
    const counter = createCounter('requests_total', 'Total requests');
    expect(counter.getValue()).toBe(0);
  });

  it('should increment value', () => {
    const counter = createCounter('requests_total', 'Total requests');
    counter.increment();
    expect(counter.getValue()).toBe(1);
  });

  it('should increment multiple times', () => {
    const counter = createCounter('requests_total', 'Total requests');
    counter.increment();
    counter.increment();
    counter.increment();
    expect(counter.getValue()).toBe(3);
  });

  it('should generate prometheus format output', () => {
    const counter = createCounter('requests_total', 'Total requests');
    counter.increment();
    counter.increment();

    const output = counter.getPrometheus();
    expect(output).toContain('# HELP requests_total');
    expect(output).toContain('# TYPE requests_total counter');
    expect(output).toContain('requests_total 2');
  });

  it('should support labels', () => {
    const counter = createCounter('requests_total', 'Total requests', [
      'method',
      'status',
    ]);
    counter.increment({ method: 'GET', status: '200' });
    counter.increment({ method: 'POST', status: '201' });

    const output = counter.getPrometheus();
    expect(output).toContain('method="GET"');
    expect(output).toContain('status="200"');
    expect(output).toContain('method="POST"');
    expect(output).toContain('status="201"');
  });

  it('should handle increment without labels', () => {
    const counter = createCounter('requests_total', 'Total requests');
    counter.increment();
    counter.increment();

    const output = counter.getPrometheus();
    expect(output).toContain('requests_total 2');
  });
});
