export interface QueueMessage {
  id?: string;
  body: any;
  delay?: number;
  priority?: number;
  metadata?: Record<string, any>;
}

export class QueueService {
  private queues: Map<string, QueueMessage[]>;
  private messageId: number;

  constructor() {
    this.queues = new Map();
    this.messageId = 0;
  }

  async sendMessage(queueName: string, body: any, options: any = {}): Promise<string> {
    const messageId = this.generateMessageId();
    
    const message: QueueMessage = {
      id: messageId,
      body,
      delay: options.delay || 0,
      priority: options.priority || 0,
      metadata: options.metadata || {}
    };

    if (!this.queues.has(queueName)) {
      this.queues.set(queueName, []);
    }
    
    const queue = this.queues.get(queueName)!;
    queue.push(message);

    console.log(`[QueueService] Message queued: ${messageId} -> ${queueName}`);
    
    return messageId;
  }

  async receiveMessage(queueName: string): Promise<QueueMessage | null> {
    const queue = this.queues.get(queueName);
    
    if (!queue || queue.length === 0) {
      return null;
    }
    
    const message = queue.shift();
    
    if (message) {
      console.log(`[QueueService] Message received: ${message.id} <- ${queueName}`);
    }
    
    return message || null;
  }

  getQueueStats(queueName: string): { size: number } {
    const queue = this.queues.get(queueName);
    
    if (!queue) {
      return { size: 0 };
    }
    
    return { size: queue.length };
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${++this.messageId}`;
  }
}
