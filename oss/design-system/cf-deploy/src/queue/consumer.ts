import type { QueueMessage } from '../types';

export interface QueueHandler {
  (message: unknown): Promise<void>;
}

export interface QueueConsumer {
  handleMessage(message: QueueMessage): Promise<void>;
}

export function createQueueConsumer(handler: QueueHandler): QueueConsumer {
  return {
    async handleMessage(message: QueueMessage): Promise<void> {
      try {
        await handler(message.body);
      } catch (error) {
        console.error('Queue handler error:', error);
        throw error;
      }
    },
  };
}

export function createBatchQueueConsumer(
  handler: (messages: unknown[]) => Promise<void>,
): (messages: QueueMessage[]) => Promise<void> {
  return async (messages: QueueMessage[]): Promise<void> => {
    try {
      const bodies = messages.map((msg) => msg.body);
      await handler(bodies);
    } catch (error) {
      console.error('Batch queue handler error:', error);
      throw error;
    }
  };
}
