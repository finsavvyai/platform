import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

export interface Capability {
  name: string;
  version: string;
  description: string;
}

export interface Message {
  id: string;
  from: string;
  to: string;
  type: 'request' | 'response' | 'event';
  payload: Record<string, unknown>;
  timestamp: number;
  correlationId?: string;
}

export class Agent extends EventEmitter {
  public readonly id: string;
  private capabilities: Map<string, Capability> = new Map();
  private messageHistory: Message[] = [];
  private handlers: Map<string, (msg: Message) => Promise<void>> = new Map();

  constructor(id?: string) {
    super();
    this.id = id || uuidv4();
  }

  public registerCapability(cap: Capability): void {
    if (!cap.name || !cap.version) {
      throw new Error('Invalid capability: missing name or version');
    }
    this.capabilities.set(cap.name, cap);
  }

  public getCapabilities(): Capability[] {
    return Array.from(this.capabilities.values());
  }

  public hasCapability(name: string): boolean {
    return this.capabilities.has(name);
  }

  public registerHandler(
    type: string,
    handler: (msg: Message) => Promise<void>
  ): void {
    this.handlers.set(type, handler);
  }

  public async receiveMessage(msg: Message): Promise<void> {
    this.messageHistory.push(msg);
    const handler = this.handlers.get(msg.type);
    if (handler) {
      await handler(msg);
    } else {
      this.emit('message', msg);
    }
  }

  public async sendMessage(
    to: string,
    type: string,
    payload: Record<string, unknown>
  ): Promise<Message> {
    const msg: Message = {
      id: uuidv4(),
      from: this.id,
      to,
      type: type as 'request' | 'response' | 'event',
      payload,
      timestamp: Date.now(),
    };
    this.messageHistory.push(msg);
    this.emit('send', msg);
    return msg;
  }

  public getMessageHistory(limit: number = 100): Message[] {
    return this.messageHistory.slice(-limit);
  }

  public clearMessageHistory(): void {
    this.messageHistory = [];
  }
}
