import { EventEmitter } from "events";
import { attachProgressBridge } from "../../app/queue/progress-bridge";
import type { ProgressEmitter } from "../../app/queue/progress-emitter";
import type { Job } from "bull";
import type { ProcessingJobData } from "../../app/core/queue-manager";

class FakeEmitter {
  events: any[] = [];
  async emit(evt: any): Promise<void> {
    this.events.push(evt);
  }
}

function fakeJob(data: Partial<ProcessingJobData>): Job<ProcessingJobData> {
  return { data: data as ProcessingJobData } as Job<ProcessingJobData>;
}

describe("attachProgressBridge", () => {
  test("emits queued on jobStarted with tenantId+documentId", async () => {
    const qm = new EventEmitter();
    const emitter = new FakeEmitter();
    attachProgressBridge(qm as any, emitter as unknown as ProgressEmitter);

    qm.emit("jobStarted", {
      queueName: "document",
      job: fakeJob({ tenantId: "t1", documentId: "d1" }),
    });

    // emit is fire-and-forget; await the next tick.
    await new Promise((r) => setImmediate(r));

    expect(emitter.events).toHaveLength(1);
    expect(emitter.events[0]).toMatchObject({
      tenant_id: "t1",
      document_id: "d1",
      stage: "queued",
      percent: 10,
    });
  });

  test("emits complete on jobCompleted", async () => {
    const qm = new EventEmitter();
    const emitter = new FakeEmitter();
    attachProgressBridge(qm as any, emitter as unknown as ProgressEmitter);

    qm.emit("jobCompleted", {
      queueName: "document",
      job: fakeJob({ tenantId: "t1", documentId: "d1" }),
    });
    await new Promise((r) => setImmediate(r));

    expect(emitter.events[0]).toMatchObject({
      stage: "complete",
      percent: 100,
    });
  });

  test("emits failed on jobFailed with error message", async () => {
    const qm = new EventEmitter();
    const emitter = new FakeEmitter();
    attachProgressBridge(qm as any, emitter as unknown as ProgressEmitter);

    qm.emit("jobFailed", {
      queueName: "document",
      job: fakeJob({ tenantId: "t1", documentId: "d1" }),
      error: new Error("boom"),
    });
    await new Promise((r) => setImmediate(r));

    expect(emitter.events[0]).toMatchObject({
      stage: "failed",
      percent: 100,
      error: "boom",
    });
  });

  test("skips emit when tenantId is missing", async () => {
    const qm = new EventEmitter();
    const emitter = new FakeEmitter();
    attachProgressBridge(qm as any, emitter as unknown as ProgressEmitter);

    qm.emit("jobStarted", {
      queueName: "document",
      job: fakeJob({ documentId: "d1" }),
    });
    await new Promise((r) => setImmediate(r));

    expect(emitter.events).toHaveLength(0);
  });

  test("returned detach hook stops further emits", async () => {
    const qm = new EventEmitter();
    const emitter = new FakeEmitter();
    const detach = attachProgressBridge(qm as any, emitter as unknown as ProgressEmitter);

    detach();
    qm.emit("jobStarted", {
      queueName: "document",
      job: fakeJob({ tenantId: "t1", documentId: "d1" }),
    });
    await new Promise((r) => setImmediate(r));

    expect(emitter.events).toHaveLength(0);
  });
});
