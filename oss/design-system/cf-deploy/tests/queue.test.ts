import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createQueueProducer } from '../src/queue/producer';
import {
  createQueueConsumer,
  createBatchQueueConsumer,
} from '../src/queue/consumer';
import type { Queue } from '../src/queue/producer';

describe('queue producer', () => {
  let mockQueue: Partial<Queue>;

  beforeEach(() => {
    mockQueue = {
      send: vi.fn().mockResolvedValue(undefined),
      sendBatch: vi.fn().mockResolvedValue(undefined),
    };
  });

  it('should publish single message', async () => {
    const producer = createQueueProducer(mockQueue as Queue);
    await producer.publish({ test: 'data' });

    expect(mockQueue.send).toHaveBeenCalledWith(
      expect.objectContaining({
        body: { test: 'data' },
      }),
    );
  });

  it('should add timestamp to published message', async () => {
    const producer = createQueueProducer(mockQueue as Queue);
    const before = Date.now();
    await producer.publish('test');
    const after = Date.now();

    const call = (mockQueue.send as any).mock.calls[0][0];
    expect(call.timestamp).toBeGreaterThanOrEqual(before);
    expect(call.timestamp).toBeLessThanOrEqual(after);
  });

  it('should publish batch of messages', async () => {
    const producer = createQueueProducer(mockQueue as Queue);
    const messages = ['msg1', 'msg2', 'msg3'];
    await producer.publishBatch(messages);

    expect(mockQueue.sendBatch).toHaveBeenCalled();
    const call = (mockQueue.sendBatch as any).mock.calls[0][0];
    expect(call).toHaveLength(3);
    expect(call[0].body).toBe('msg1');
  });

  it('should handle different message types', async () => {
    const producer = createQueueProducer(mockQueue as Queue);
    await producer.publish(123);
    await producer.publish(true);
    await producer.publish({ nested: { data: 'value' } });

    expect(mockQueue.send).toHaveBeenCalledTimes(3);
  });
});

describe('queue consumer', () => {
  it('should handle message with provided handler', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    const consumer = createQueueConsumer(handler);

    await consumer.handleMessage({ body: { test: 'data' } });

    expect(handler).toHaveBeenCalledWith({ test: 'data' });
  });

  it('should pass message body to handler', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    const consumer = createQueueConsumer(handler);

    const message = { body: 'test-message', timestamp: 123 };
    await consumer.handleMessage(message);

    expect(handler).toHaveBeenCalledWith('test-message');
  });

  it('should propagate handler errors', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('Handler error'));
    const consumer = createQueueConsumer(handler);

    await expect(
      consumer.handleMessage({ body: 'test' }),
    ).rejects.toThrow('Handler error');
  });

  it('should log handler errors', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('Test error'));
    const consumer = createQueueConsumer(handler);
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation();

    try {
      await consumer.handleMessage({ body: 'test' });
    } catch {
      // Expected
    }

    expect(consoleSpy).toHaveBeenCalledWith(
      'Queue handler error:',
      expect.any(Error),
    );
    consoleSpy.mockRestore();
  });
});

describe('batch queue consumer', () => {
  it('should handle batch of messages', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    const consumer = createBatchQueueConsumer(handler);

    const messages = [
      { body: 'msg1' },
      { body: 'msg2' },
      { body: 'msg3' },
    ];
    await consumer(messages);

    expect(handler).toHaveBeenCalledWith(['msg1', 'msg2', 'msg3']);
  });

  it('should extract bodies from queue messages', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    const consumer = createBatchQueueConsumer(handler);

    const messages = [
      { body: { id: 1 }, timestamp: 100 },
      { body: { id: 2 }, timestamp: 101 },
    ];
    await consumer(messages);

    expect(handler).toHaveBeenCalledWith([{ id: 1 }, { id: 2 }]);
  });

  it('should propagate batch handler errors', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('Batch error'));
    const consumer = createBatchQueueConsumer(handler);

    await expect(consumer([])).rejects.toThrow('Batch error');
  });
});
