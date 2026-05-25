/**
 * `WebhookSink` — bridges the refresh handler to the webhook store
 * + dispatcher. Looks up matching subscriptions for the (app, event)
 * pair and delivers each via `deliverWebhook`.
 *
 * Phase 7 awaits delivery inline (best-effort). Phase 7.1 will swap
 * the body of `emit` to enqueue onto Cloudflare Queues so the refresh
 * path doesn't block on the receiver's response time.
 */

import { deliverWebhook } from './dispatcher.js';
import type { WebhookEvent, WebhookStore } from './store.js';

export interface WebhookSinkOptions {
  store: WebhookStore;
  fetchImpl?: typeof globalThis.fetch;
}

export class WebhookSink {
  constructor(private readonly opts: WebhookSinkOptions) {}

  async emit(event: string, payload: Record<string, unknown>, appId: string): Promise<void> {
    const subs = await this.opts.store.listForApp(appId);
    const matching = subs.filter(
      (w) => w.enabled && w.events.includes(event as WebhookEvent),
    );
    await Promise.allSettled(
      matching.map((w) =>
        deliverWebhook({
          url: w.url,
          secret: w.secret,
          event,
          body: { event, ...payload },
          fetchImpl: this.opts.fetchImpl,
        }),
      ),
    );
  }
}
