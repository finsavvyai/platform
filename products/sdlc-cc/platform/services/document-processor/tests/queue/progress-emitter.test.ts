/**
 * Day 11: progress-emitter unit test.
 *
 * The emitter must publish a sequenced ProgressEvent stream to the
 * tenant-scoped Redis pub/sub channel for every checkpoint of a doc's
 * processing run. We use an in-test fake Redis so the assertion is on
 * the exact channel + payload — no ioredis-mock dependency required.
 */

import { describe, it, expect } from "@jest/globals";
import {
  ProgressEmitter,
  channelForTenant,
  type ProgressStage,
} from "../../app/queue/progress-emitter";

class FakeRedis {
  public published: Array<{ channel: string; payload: string }> = [];
  async publish(channel: string, payload: string): Promise<number> {
    this.published.push({ channel, payload });
    return 1;
  }
}

const tenantId = "11111111-1111-1111-1111-111111111111";
const docId = "22222222-2222-2222-2222-222222222222";

describe("ProgressEmitter", () => {
  it("publishes to the tenant-scoped channel", async () => {
    const fake = new FakeRedis();
    const emitter = new ProgressEmitter(fake as unknown as never);

    await emitter.emit({
      tenant_id: tenantId,
      document_id: docId,
      stage: "extracting",
      percent: 25,
    });

    expect(fake.published).toHaveLength(1);
    expect(fake.published[0]!.channel).toBe(channelForTenant(tenantId));
    const payload = JSON.parse(fake.published[0]!.payload);
    expect(payload.stage).toBe("extracting");
    expect(payload.percent).toBe(25);
    expect(payload.tenant_id).toBe(tenantId);
    expect(payload.document_id).toBe(docId);
    expect(typeof payload.emitted_at).toBe("string");
  });

  it("emits the canonical stage sequence in order for a happy-path run", async () => {
    const fake = new FakeRedis();
    const emitter = new ProgressEmitter(fake as unknown as never);

    const stages: Array<{ stage: ProgressStage; percent: number }> = [
      { stage: "queued", percent: 0 },
      { stage: "extracting", percent: 25 },
      { stage: "chunking", percent: 50 },
      { stage: "embedding", percent: 75 },
      { stage: "indexing", percent: 90 },
    ];
    for (const s of stages) {
      await emitter.emit({
        tenant_id: tenantId,
        document_id: docId,
        ...s,
      });
    }
    await emitter.emitComplete(tenantId, docId);

    const events = fake.published.map((p) => JSON.parse(p.payload));
    expect(events.map((e) => e.stage)).toEqual([
      "queued",
      "extracting",
      "chunking",
      "embedding",
      "indexing",
      "complete",
    ]);
    expect(events[events.length - 1].percent).toBe(100);
  });

  it("clamps out-of-range percent values into [0,100]", async () => {
    const fake = new FakeRedis();
    const emitter = new ProgressEmitter(fake as unknown as never);

    await emitter.emit({
      tenant_id: tenantId,
      document_id: docId,
      stage: "extracting",
      percent: -10,
    });
    await emitter.emit({
      tenant_id: tenantId,
      document_id: docId,
      stage: "embedding",
      percent: 9999,
    });

    const a = JSON.parse(fake.published[0]!.payload);
    const b = JSON.parse(fake.published[1]!.payload);
    expect(a.percent).toBe(0);
    expect(b.percent).toBe(100);
  });

  it("emitFailed sets stage=failed, percent=0, and includes the error message", async () => {
    const fake = new FakeRedis();
    const emitter = new ProgressEmitter(fake as unknown as never);

    await emitter.emitFailed(tenantId, docId, "OCR timed out");
    const evt = JSON.parse(fake.published[0]!.payload);
    expect(evt.stage).toBe("failed");
    expect(evt.percent).toBe(0);
    expect(evt.error).toBe("OCR timed out");
  });

  it("publish failures are swallowed so the pipeline never blocks", async () => {
    const broken = {
      publish: async () => {
        throw new Error("redis down");
      },
    };
    const emitter = new ProgressEmitter(broken as unknown as never);

    await expect(
      emitter.emit({
        tenant_id: tenantId,
        document_id: docId,
        stage: "indexing",
        percent: 80,
      }),
    ).resolves.toBeUndefined();
  });
});
