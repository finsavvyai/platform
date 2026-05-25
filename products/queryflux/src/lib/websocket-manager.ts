/**
 * WebSocket Manager — handles real-time connection with auto-reconnect
 */

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private url: string;
  private token: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private messageHandlers: Map<string, (data: any) => void> = new Map();
  private isIntentionallyClosed = false;

  constructor(url: string, token: string | null = null) {
    this.url = url;
    this.token = token;
  }

  public connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    try {
      const wsUrl = this.token ? `${this.url}?token=${this.token}` : this.url;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
      };

      this.ws.onmessage = (event) => {
        try {
          this.handleMessage(JSON.parse(event.data));
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => { console.error('WebSocket error:', error); };

      this.ws.onclose = () => {
        console.log('WebSocket closed');
        if (!this.isIntentionallyClosed && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnect();
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
    }
  }

  public disconnect(): void {
    this.isIntentionallyClosed = true;
    if (this.ws) { this.ws.close(); this.ws = null; }
  }

  private reconnect(): void {
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    console.log(`Reconnecting WebSocket in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    setTimeout(() => this.connect(), delay);
  }

  public send(type: string, data: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, data }));
    } else {
      console.warn('WebSocket is not connected. Message not sent:', { type, data });
    }
  }

  public on(type: string, handler: (data: any) => void): void {
    this.messageHandlers.set(type, handler);
  }

  public off(type: string): void {
    this.messageHandlers.delete(type);
  }

  private handleMessage(message: { type: string; data: any }): void {
    const handler = this.messageHandlers.get(message.type);
    if (handler) {
      handler(message.data);
    } else {
      console.warn('No handler for WebSocket message type:', message.type);
    }
  }

  public updateToken(token: string): void {
    this.token = token;
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.disconnect();
      this.isIntentionallyClosed = false;
      this.connect();
    }
  }
}
