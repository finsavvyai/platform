import type { QueueMessage } from '../types';

export interface Queue {
  send(message: QueueMessage): Promise<void>;
  sendBatch(messages: QueueMessage[]): Promise<void>;
}

export interface QueueProducer {
  publish(message: unknown): Promise<void>;
  publishBatch(messages: unknown[]): Promise<void>;
}

export function createQueueProducer(queue: Queue): QueueProducer {
  return {
    async publish(message: unknown): Promise<void> {
      const queueMessage: QueueMessage = {
        body: message,
        timestamp: Date.now(),
      };
      await queue.send(queueMessage);
    },

    async publishBatch(messages: unknown[]): Promise<void> {
      const queueMessages: QueueMessage[] = messages.map((msg) => ({
        body: msg,
        timestamp: Date.now(),
      }));
      await queue.sendBatch(queueMessages);
    },
  };
}
