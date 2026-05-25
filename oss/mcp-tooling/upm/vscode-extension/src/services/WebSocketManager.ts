import * as vscode from 'vscode';
import * as WebSocket from 'ws';
import { EventEmitter } from 'events';
import { Disposable } from '../utils/Disposable';
import { Logger } from '../utils/Logger';
import { UPMService } from './UPMService';
import { WebSocketMessage } from '../types';

const log = Logger.createLogger('WebSocketManager');

export class WebSocketManager extends Disposable {
    private ws?: WebSocket;
    private eventEmitter = new EventEmitter();
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private reconnectDelay = 1000;
    private isInitialized = false;

    constructor(
        private upmService: UPMService,
        private configurationManager: any
    ) {
        super();
    }

    public async initialize(): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        try {
            await this.connect();
            this.isInitialized = true;
            log.info('WebSocketManager initialized');
        } catch (error) {
            log.error('Failed to initialize WebSocketManager', error);
            throw error;
        }
    }

    private async connect(): Promise<void> {
        const serverUrl = this.configurationManager.get<string>('serverUrl', 'http://localhost:8040');
        const wsUrl = serverUrl.replace('http', 'ws') + '/ws';

        log.info(`Connecting to WebSocket: ${wsUrl}`);

        this.ws = new WebSocket(wsUrl);

        this.ws.on('open', () => {
            log.info('WebSocket connection established');
            this.reconnectAttempts = 0;

            // Send authentication if API key is configured
            const apiKey = this.configurationManager.get<string>('apiKey');
            if (apiKey) {
                this.send({
                    type: 'auth',
                    data: { apiKey },
                    timestamp: new Date().toISOString()
                });
            }
        });

        this.ws.on('message', (data: WebSocket.Data) => {
            try {
                const message: WebSocketMessage = JSON.parse(data.toString());
                this.handleMessage(message);
            } catch (error) {
                log.error('Failed to parse WebSocket message', error);
            }
        });

        this.ws.on('close', () => {
            log.warn('WebSocket connection closed');
            this.scheduleReconnect();
        });

        this.ws.on('error', (error) => {
            log.error('WebSocket error', error);
        });
    }

    private handleMessage(message: WebSocketMessage): void {
        log.debug(`Received WebSocket message: ${message.type}`);
        this.eventEmitter.emit(message.type, message.data);
    }

    public send(message: WebSocketMessage): void {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        } else {
            log.warn('WebSocket not connected, cannot send message');
        }
    }

    public on(event: string, listener: (data: any) => void): void {
        this.eventEmitter.on(event, listener);
    }

    public off(event: string, listener: (data: any) => void): void {
        this.eventEmitter.off(event, listener);
    }

    private scheduleReconnect(): void {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            log.error('Max reconnection attempts reached');
            return;
        }

        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

        log.info(`Scheduling reconnection attempt ${this.reconnectAttempts} in ${delay}ms`);

        setTimeout(() => {
            this.connect().catch(error => {
                log.error('Reconnection failed', error);
            });
        }, delay);
    }

    public isConnected(): boolean {
        return this.ws?.readyState === WebSocket.OPEN;
    }

    public isInitializedManager(): boolean {
        return this.isInitialized;
    }

    public async dispose(): Promise<void> {
        log.info('Disposing WebSocketManager...');

        if (this.ws) {
            this.ws.close();
            this.ws = undefined;
        }

        this.eventEmitter.removeAllListeners();
        await super.dispose();
        log.info('WebSocketManager disposed');
    }
}
