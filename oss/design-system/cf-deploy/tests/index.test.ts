import { describe, it, expect } from 'vitest';
import {
  generateWranglerConfig,
  createQueueProducer,
  createQueueConsumer,
  createBatchQueueConsumer,
  DurableObjectBase,
} from '../src/index';

describe('exports', () => {
  it('should export generateWranglerConfig', () => {
    expect(generateWranglerConfig).toBeDefined();
    expect(typeof generateWranglerConfig).toBe('function');
  });

  it('should export createQueueProducer', () => {
    expect(createQueueProducer).toBeDefined();
    expect(typeof createQueueProducer).toBe('function');
  });

  it('should export createQueueConsumer', () => {
    expect(createQueueConsumer).toBeDefined();
    expect(typeof createQueueConsumer).toBe('function');
  });

  it('should export createBatchQueueConsumer', () => {
    expect(createBatchQueueConsumer).toBeDefined();
    expect(typeof createBatchQueueConsumer).toBe('function');
  });

  it('should export DurableObjectBase', () => {
    expect(DurableObjectBase).toBeDefined();
    expect(typeof DurableObjectBase).toBe('function');
  });
});
