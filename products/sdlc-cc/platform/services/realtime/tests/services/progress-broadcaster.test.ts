import { describe, it, expect, vi } from "vitest";
import {
  ProgressBroadcaster,
  type AuthedClient,
  type ClientRegistry,
  tenantFromChannel,
} from "../../src/services/progress-broadcaster";

class FakeSocket {
  public readyState = 1; // OPEN
  public OPEN = 1;
  public sent: string[] = [];
  send(frame: string): void {
    this.sent.push(frame);
  }
}

class FakeRegistry implements ClientRegistry {
  constructor(private readonly byTenant: Record<string, AuthedClient[]> = {}) {}
  forTenant(tenantId: string): Iterable<AuthedClient> {
    return this.byTenant[tenantId] ?? [];
  }
}

class FakeRedis {
  public listeners: Record<string, Function[]> = {};
  public subscribed: string[] = [];

  on(event: string, fn: Function): void {
    this.listeners[event] = this.listeners[event] ?? [];
    this.listeners[event].push(fn);
  }

  psubscribe(pattern: string): Promise<number> {
    this.subscribed.push(pattern);
    return Promise.resolve(1);
  }

  punsubscribe(_pattern: string): Promise<number> {
    return Promise.resolve(1);
  }

  emitMessage(pattern: string, channel: string, message: string): void {
    for (const fn of this.listeners.pmessage ?? []) {
      fn(pattern, channel, message);
    }
  }
}

describe("tenantFromChannel", () => {
  it("extracts the tenant id", () => {
    expect(tenantFromChannel("sdlc:doc-progress:t-1")).toBe("t-1");
  });
  it("returns empty for the wrong prefix", () => {
    expect(tenantFromChannel("foo:bar")).toBe("");
  });
});

describe("ProgressBroadcaster", () => {
  it("subscribes to the channel pattern on start", async () => {
    const redis = new FakeRedis();
    const reg = new FakeRegistry();
    const b = new ProgressBroadcaster({ redisSub: redis as never, registry: reg });
    await b.start();
    expect(redis.subscribed).toEqual(["sdlc:doc-progress:*"]);
  });

  it("delivers the event only to clients of the matching tenant", async () => {
    const redis = new FakeRedis();
    const sockA = new FakeSocket();
    const sockB = new FakeSocket();
    const reg = new FakeRegistry({
      "tenant-a": [{ socket: sockA as never, tenantId: "tenant-a", userId: "u1" }],
      "tenant-b": [{ socket: sockB as never, tenantId: "tenant-b", userId: "u2" }],
    });
    const b = new ProgressBroadcaster({ redisSub: redis as never, registry: reg });
    await b.start();

    const evt = JSON.stringify({
      tenant_id: "tenant-a",
      document_id: "d1",
      stage: "extracting",
      percent: 25,
      emitted_at: "2026-04-25T00:00:00Z",
    });
    redis.emitMessage("sdlc:doc-progress:*", "sdlc:doc-progress:tenant-a", evt);

    expect(sockA.sent).toHaveLength(1);
    expect(sockB.sent).toHaveLength(0);
    const decoded = JSON.parse(sockA.sent[0]);
    expect(decoded.type).toBe("doc.progress");
    expect(decoded.payload.document_id).toBe("d1");
  });

  it("skips closed sockets without throwing", async () => {
    const redis = new FakeRedis();
    const sockA = new FakeSocket();
    sockA.readyState = 3; // CLOSED
    const reg = new FakeRegistry({
      "tenant-a": [{ socket: sockA as never, tenantId: "tenant-a", userId: "u1" }],
    });
    const b = new ProgressBroadcaster({ redisSub: redis as never, registry: reg });
    await b.start();

    redis.emitMessage(
      "sdlc:doc-progress:*",
      "sdlc:doc-progress:tenant-a",
      JSON.stringify({ tenant_id: "tenant-a", document_id: "d1", stage: "queued", percent: 0 }),
    );

    expect(sockA.sent).toHaveLength(0);
  });

  it("logs and drops malformed JSON instead of throwing", async () => {
    const redis = new FakeRedis();
    const log = vi.fn();
    const b = new ProgressBroadcaster({
      redisSub: redis as never,
      registry: new FakeRegistry(),
      log,
    });
    await b.start();
    redis.emitMessage("sdlc:doc-progress:*", "sdlc:doc-progress:t", "not json");
    expect(log).toHaveBeenCalledWith(
      "warn",
      expect.stringContaining("non-JSON"),
      expect.anything(),
    );
  });

  it("drops events on a malformed channel", async () => {
    const redis = new FakeRedis();
    const log = vi.fn();
    const b = new ProgressBroadcaster({
      redisSub: redis as never,
      registry: new FakeRegistry(),
      log,
    });
    await b.start();
    redis.emitMessage("sdlc:doc-progress:*", "wrong:channel", "{}");
    expect(log).toHaveBeenCalledWith("warn", expect.stringContaining("no tenant"), expect.anything());
  });
});
