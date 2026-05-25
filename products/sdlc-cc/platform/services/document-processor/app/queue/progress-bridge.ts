/**
 * Bridge from QueueManager lifecycle events to ProgressEmitter pub/sub.
 *
 * BEAT-PLAN Day 11. The QueueManager emits jobStarted / jobCompleted /
 * jobFailed events; the realtime service subscribes to a Redis channel
 * keyed by tenant. This file connects the two so a tenant's WebSocket
 * clients see live progress without each handler hand-rolling a publish.
 *
 * Stage mapping:
 *   jobStarted    -> "queued"        percent=10
 *   processDocument (in-flight) -> per-handler emit (extracting / chunking / ...)
 *   jobCompleted  -> "complete"      percent=100
 *   jobFailed     -> "failed"        percent=100 + error
 *
 * Mid-flight transitions (extracting/chunking/embedding/dlp_scan/indexing)
 * are owned by the per-handler code; this bridge only covers the Bull-
 * level lifecycle so coverage is automatic for every queue.
 */

import type { Job } from "bull";
import type { QueueManager, ProcessingJobData } from "../core/queue-manager";
import type { ProgressEmitter, ProgressStage } from "./progress-emitter";

export interface BridgeOptions {
  /**
   * Optional logger for swallowed errors. Defaults to console.error.
   */
  onError?: (msg: string, err: unknown) => void;
}

export function attachProgressBridge(
  qm: QueueManager,
  emitter: ProgressEmitter,
  opts: BridgeOptions = {},
): () => void {
  const onError =
    opts.onError ?? ((msg, err) => console.error(`[progress-bridge] ${msg}`, err));

  const onStarted = (payload: {
    queueName: string;
    job: Job<ProcessingJobData>;
  }) => {
    void emit(emitter, payload.job, "queued", 10).catch((e) =>
      onError("emit queued failed", e),
    );
  };

  const onCompleted = (payload: {
    queueName: string;
    job: Job<ProcessingJobData>;
  }) => {
    void emit(emitter, payload.job, "complete", 100).catch((e) =>
      onError("emit complete failed", e),
    );
  };

  const onFailed = (payload: {
    queueName: string;
    job: Job<ProcessingJobData>;
    error: Error;
  }) => {
    void emit(emitter, payload.job, "failed", 100, {
      error: payload.error?.message ?? String(payload.error),
    }).catch((e) => onError("emit failed failed", e));
  };

  qm.on("jobStarted", onStarted);
  qm.on("jobCompleted", onCompleted);
  qm.on("jobFailed", onFailed);

  // Detach hook for tests + clean shutdown.
  return () => {
    qm.off("jobStarted", onStarted);
    qm.off("jobCompleted", onCompleted);
    qm.off("jobFailed", onFailed);
  };
}

async function emit(
  emitter: ProgressEmitter,
  job: Job<ProcessingJobData>,
  stage: ProgressStage,
  percent: number,
  extra: { error?: string; message?: string } = {},
): Promise<void> {
  const data = job.data;
  const tenantId = data?.tenantId ?? "";
  const documentId = data?.documentId ?? "";
  if (!tenantId || !documentId) {
    // Legacy job missing the routing keys — skip silently, don't fail.
    return;
  }
  await emitter.emit({
    tenant_id: tenantId,
    document_id: documentId,
    stage,
    percent,
    ...extra,
  });
}
