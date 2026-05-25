/**
 * Real-time progress events for document processing.
 *
 * Day 11 of the production-ready roadmap.
 *
 * Each progress checkpoint is published to Redis pub/sub on a channel
 * keyed by tenant so the realtime service can broadcast to that
 * tenant's WebSocket clients only. Channel format:
 *
 *   sdlc:doc-progress:<tenantId>
 *
 * The realtime side calls SUBSCRIBE on the same channel pattern.
 */

import type Redis from "ioredis";

export type ProgressStage =
  | "queued"
  | "extracting"
  | "chunking"
  | "embedding"
  | "dlp_scan"
  | "indexing"
  | "complete"
  | "failed";

export interface ProgressEvent {
  tenant_id: string;
  document_id: string;
  stage: ProgressStage;
  percent: number; // 0..100
  message?: string;
  error?: string;
  emitted_at: string; // ISO-8601
}

export const channelForTenant = (tenantId: string): string =>
  `sdlc:doc-progress:${tenantId}`;

export class ProgressEmitter {
  constructor(private readonly redis: Redis) {}

  /**
   * Publish one progress event for a document. Failure to publish must
   * NOT fail the underlying processing — log + swallow so the pipeline
   * is observable but never blocked by a Redis hiccup.
   */
  async emit(evt: Omit<ProgressEvent, "emitted_at">): Promise<void> {
    const payload: ProgressEvent = {
      ...evt,
      percent: clamp(evt.percent, 0, 100),
      emitted_at: new Date().toISOString(),
    };
    const channel = channelForTenant(evt.tenant_id);
    try {
      await this.redis.publish(channel, JSON.stringify(payload));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(
        `[progress] publish failed for tenant ${evt.tenant_id}, doc ${evt.document_id}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Convenience helper for the "complete" terminal event so callers
   * don't have to remember to set percent=100 + stage=complete.
   */
  async emitComplete(tenantId: string, documentId: string): Promise<void> {
    return this.emit({
      tenant_id: tenantId,
      document_id: documentId,
      stage: "complete",
      percent: 100,
    });
  }

  /**
   * Convenience helper for the "failed" terminal event.
   */
  async emitFailed(
    tenantId: string,
    documentId: string,
    error: string,
  ): Promise<void> {
    return this.emit({
      tenant_id: tenantId,
      document_id: documentId,
      stage: "failed",
      percent: 0,
      error,
    });
  }
}

function clamp(n: number, lo: number, hi: number): number {
  if (Number.isNaN(n)) return lo;
  if (n < lo) return lo;
  if (n > hi) return hi;
  return n;
}
