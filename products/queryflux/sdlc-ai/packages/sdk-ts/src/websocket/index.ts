// WebSocket client for the SDLC.ai JavaScript SDK

import { EventEmitter } from "eventemitter3";
import {
  WebSocketMessage,
  WebSocketEventMap,
  Notification,
  RAGQueryUpdate,
} from "../types";
import { isNode, isBrowser } from "../utils";

export class WebSocketClient extends EventEmitter {
  private ws?: WebSocket;
  private url?: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 1000;
  private isConnecting = false;
  private pingInterval?: any;

  constructor(private client: any) {
    super();
  }

  async connect(url?: string): Promise<void> {
    if (
      this.isConnecting ||
      (this.ws && this.ws.readyState === WebSocket.OPEN)
    ) {
      return;
    }

    this.isConnecting = true;
    this.url = url || this.getWebSocketUrl();

    try {
      if (isNode) {
        const WebSocket = require("ws");
        this.ws = new WebSocket(this.url, {
          headers: {
            Authorization: `Bearer ${this.client.auth?.getAccessToken()}`,
          },
        });
      } else {
        this.ws = new WebSocket(this.url);
      }

      this.setupEventHandlers();

      await new Promise<void>((resolve, reject) => {
        if (this.ws) {
          this.ws.onopen = () => {
            this.isConnecting = false;
            this.reconnectAttempts = 0;
            this.startPing();
            this.emit("connected");
            resolve();
          };

          this.ws.onerror = (error) => {
            this.isConnecting = false;
            this.emit("error", error);
            reject(error);
          };
        }
      });
    } catch (error) {
      this.isConnecting = false;
      throw error;
    }
  }

  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        this.emit("error", new Error("Invalid WebSocket message"));
      }
    };

    this.ws.onclose = (event) => {
      this.stopPing();
      this.emit("disconnected", event.code, event.reason);

      if (
        event.code !== 1000 &&
        this.reconnectAttempts < this.maxReconnectAttempts
      ) {
        this.scheduleReconnect();
      }
    };
  }

  private handleMessage(message: WebSocketMessage): void {
    this.emit("message", message);

    switch (message.type) {
      case "notification":
        this.emit("notification", message.data as Notification);
        break;
      case "rag_query_update":
        this.emit("ragQueryUpdate", message.data as RAGQueryUpdate);
        break;
      case "pong":
        // Ping response received
        break;
      default:
        this.emit(message.type, message.data);
    }
  }

  private getWebSocketUrl(): string {
    const baseURL = this.client.config.baseURL;
    const wsURL = baseURL.replace(/^http/, "ws");
    return `${wsURL}/ws`;
  }

  private startPing(): void {
    this.pingInterval = setInterval(() => {
      this.send({
        type: "ping",
        data: null,
        timestamp: new Date().toISOString(),
      });
    }, 30000);
  }

  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = undefined;
    }
  }

  private scheduleReconnect(): void {
    setTimeout(
      () => {
        this.reconnectAttempts++;
        this.connect().catch(() => {
          // Reconnect failed, will retry
        });
      },
      this.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1),
    );
  }

  send(message: WebSocketMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      throw new Error("WebSocket is not connected");
    }
  }

  disconnect(): void {
    this.stopPing();
    if (this.ws) {
      this.ws.close(1000, "Client disconnect");
      this.ws = undefined;
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  close(): void {
    this.disconnect();
    this.removeAllListeners();
  }
}
