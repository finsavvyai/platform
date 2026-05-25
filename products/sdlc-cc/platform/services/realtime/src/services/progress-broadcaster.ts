/**
 * Subscribes to Redis pub/sub for document-processing progress and
 * broadcasts each event to authenticated WebSocket clients filtered
 * by the recipient's tenant.
 *
 * Day 11 of the production-ready roadmap.
 *
 * Channel pattern (matches services/document-processor/app/queue/progress-emitter.ts):
 *
 *   sdlc:doc-progress:<tenantId>
 */

import type Redis from "ioredis";
import type { WebSocket } from "ws";

export interface AuthedClient {
  socket: WebSocket;
  tenantId: string;
  userId: string;
}

export interface ClientRegistry {
  forTenant(tenantId: string): Iterable<AuthedClient>;
}

export const CHANNEL_PATTERN = "sdlc:doc-progress:*";

export interface ProgressBroadcasterOptions {
  redisSub: Redis;
  registry: ClientRegistry;
  /** Optional log sink so production can wire structured logging. */
  log?: (level: "info" | "warn", msg: string, data?: unknown) => void;
}

/**
 * ProgressBroadcaster subscribes once at startup. Each pmessage event
 * decodes the payload and fans out to every WS client whose tenantId
 * matches. Errors per-client are logged but never thrown — one bad
 * client must not interrupt the broadcast loop.
 */
export class ProgressBroadcaster {
  private subscribed = false;

  constructor(private readonly opts: ProgressBroadcasterOptions) {}

  async start(): Promise<void> {
    if (this.subscribed) return;
    const { redisSub } = this.opts;

    redisSub.on("pmessage", (_pattern: string, channel: string, message: string) => {
      this.dispatch(channel, message);
    });

    await redisSub.psubscribe(CHANNEL_PATTERN);
    this.subscribed = true;
    this.log("info", "progress broadcaster subscribed", { pattern: CHANNEL_PATTERN });
  }

  /** Stop subscribing — used for graceful shutdown + tests. */
  async stop(): Promise<void> {
    if (!this.subscribed) return;
    await this.opts.redisSub.punsubscribe(CHANNEL_PATTERN);
    this.subscribed = false;
  }

  private dispatch(channel: string, raw: string): void {
    const tenantId = tenantFromChannel(channel);
    if (!tenantId) {
      this.log("warn", "skip event with no tenant in channel", { channel });
      return;
    }

    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch (err) {
      this.log("warn", "skip non-JSON progress payload", { err: (err as Error).message });
      return;
    }

    const frame = JSON.stringify({ type: "doc.progress", payload });
    for (const client of this.opts.registry.forTenant(tenantId)) {
      try {
        if (client.socket.readyState === client.socket.OPEN) {
          client.socket.send(frame);
        }
      } catch (err) {
        this.log("warn", "broadcast to client failed", {
          tenantId,
          userId: client.userId,
          err: (err as Error).message,
        });
      }
    }
  }

  private log(level: "info" | "warn", msg: string, data?: unknown): void {
    if (this.opts.log) {
      this.opts.log(level, msg, data);
      return;
    }
    // eslint-disable-next-line no-console
    console[level](`[realtime/progress] ${msg}`, data ?? "");
  }
}

/**
 * Extract the tenant id from a pub/sub channel. Returns "" when the
 * channel doesn't follow the expected `sdlc:doc-progress:<tenant>`
 * shape so dispatch can drop the message without throwing.
 */
export function tenantFromChannel(channel: string): string {
  const prefix = "sdlc:doc-progress:";
  if (!channel.startsWith(prefix)) return "";
  return channel.slice(prefix.length);
}
