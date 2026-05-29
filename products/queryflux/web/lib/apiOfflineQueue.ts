/**
 * Offline request queue — buffers requests when the device is offline
 */

import { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import type { QueuedRequest } from './apiClientTypes';

export class OfflineRequestQueue {
  public isOnline = navigator.onLine;
  private items: QueuedRequest[] = [];

  setupListeners(getClient: () => AxiosInstance): void {
    window.addEventListener('online', () => {
      this.isOnline = true;
      console.log('Connection restored. Processing offline queue...');
      this.process(getClient());
    });
    window.addEventListener('offline', () => {
      this.isOnline = false;
      console.log('Connection lost. Queuing requests...');
    });
    this.isOnline = navigator.onLine;
    this.load();
  }

  enqueue(config: InternalAxiosRequestConfig): Promise<unknown> {
    return new Promise((resolve, reject) => {
      this.items.push({ config, resolve, reject, timestamp: Date.now() });
      console.log(`Request queued: ${config.method?.toUpperCase()} ${config.url}`);
      this.save();
    });
  }

  async process(client: AxiosInstance): Promise<void> {
    if (!this.items.length) return;
    console.log(`Processing ${this.items.length} queued requests...`);
    const batch = [...this.items];
    this.items = [];
    for (const req of batch) {
      try { req.resolve(await client.request(req.config)); }
      catch (err) { req.reject(err); }
    }
    this.save();
  }

  private save(): void {
    const keep = ['post', 'put', 'delete'];
    const persistent = this.items.filter(r => keep.includes(r.config.method?.toLowerCase() ?? ''));
    localStorage.setItem('offline_queue', JSON.stringify(persistent));
  }

  load(): void {
    const saved = localStorage.getItem('offline_queue');
    if (!saved) return;
    try {
      this.items = JSON.parse(saved) as QueuedRequest[];
      console.log(`Loaded ${this.items.length} queued requests from storage`);
    } catch { console.error('Failed to load offline queue'); }
  }
}
