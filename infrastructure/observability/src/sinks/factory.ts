/**
 * Sink factory — reads env vars and returns the configured sink.
 *
 * Env contract (per round-3 mesh consensus §2):
 *   FINSAVVY_AUDIT_SINK    = "stdout" | "r2" | "datadog"   (default: "stdout")
 *   FINSAVVY_AUDIT_R2_BUCKET    = R2 binding lookup hint (informational)
 *   FINSAVVY_AUDIT_DD_API_KEY   = Datadog API key
 *   FINSAVVY_AUDIT_DD_SITE      = "us" | "us3" | "us5" | "eu" | "ap1"
 *
 * For R2, we cannot reach the binding from a plain env map — the caller must
 * inject the R2 bucket via `options.r2Bucket`. The env var is documented
 * but enforcement is at the call-site.
 */

import type { AuditSink, R2BucketLike } from "../types.js";
import { createStdoutSink } from "./stdout.js";
import { createR2Sink, type R2SinkHandle } from "./r2.js";
import {
  createDatadogSink,
  type DatadogSinkHandle,
  type DatadogSite,
} from "./datadog.js";

export type SinkKind = "stdout" | "r2" | "datadog";

const VALID_KINDS: ReadonlySet<string> = new Set(["stdout", "r2", "datadog"]);
const VALID_SITES: ReadonlySet<string> = new Set([
  "us",
  "us3",
  "us5",
  "eu",
  "ap1",
]);

export type SinkFactoryEnv = Readonly<Record<string, string | undefined>>;

export type SinkFactoryOptions = {
  readonly env?: SinkFactoryEnv;
  /** Required when env selects "r2". */
  readonly r2Bucket?: R2BucketLike;
};

export type SinkFactoryResult = {
  readonly kind: SinkKind;
  readonly sink: AuditSink;
  /** Present when kind has internal buffering. Caller can force-flush. */
  readonly flush?: () => Promise<void>;
};

const resolveEnv = (env?: SinkFactoryEnv): SinkFactoryEnv => {
  if (env) return env;
  const proc = (globalThis as { process?: { env?: SinkFactoryEnv } }).process;
  return proc?.env ?? {};
};

export const createSinkFromEnv = (
  options: SinkFactoryOptions = {},
): SinkFactoryResult => {
  const env = resolveEnv(options.env);
  const rawKind = (env["FINSAVVY_AUDIT_SINK"] ?? "stdout").toLowerCase();
  if (!VALID_KINDS.has(rawKind)) {
    throw new Error(
      `FINSAVVY_AUDIT_SINK invalid: "${rawKind}". Must be one of: stdout, r2, datadog.`,
    );
  }
  const kind = rawKind as SinkKind;

  if (kind === "stdout") {
    return { kind, sink: createStdoutSink() };
  }

  if (kind === "r2") {
    if (!options.r2Bucket) {
      throw new Error(
        "FINSAVVY_AUDIT_SINK=r2 requires options.r2Bucket (injected R2 binding).",
      );
    }
    const bucketName = env["FINSAVVY_AUDIT_R2_BUCKET"];
    if (!bucketName || bucketName.length === 0) {
      throw new Error(
        "FINSAVVY_AUDIT_SINK=r2 requires FINSAVVY_AUDIT_R2_BUCKET to be set.",
      );
    }
    const r2: R2SinkHandle = createR2Sink({ bucket: options.r2Bucket });
    return { kind, sink: r2, flush: () => r2.flush() };
  }

  // datadog
  const apiKey = env["FINSAVVY_AUDIT_DD_API_KEY"];
  if (!apiKey || apiKey.length === 0) {
    throw new Error(
      "FINSAVVY_AUDIT_SINK=datadog requires FINSAVVY_AUDIT_DD_API_KEY.",
    );
  }
  const rawSite = (env["FINSAVVY_AUDIT_DD_SITE"] ?? "us").toLowerCase();
  if (!VALID_SITES.has(rawSite)) {
    throw new Error(
      `FINSAVVY_AUDIT_DD_SITE invalid: "${rawSite}". Must be one of: us, us3, us5, eu, ap1.`,
    );
  }
  const dd: DatadogSinkHandle = createDatadogSink({
    apiKey,
    site: rawSite as DatadogSite,
  });
  return { kind, sink: dd, flush: () => dd.flush() };
};
