// GitHub Actions → PushCI status normaliser. Split out of the client so
// github-actions-client.ts stays under the 200-line portfolio cap.
//
// See https://docs.github.com/en/rest/actions/workflow-runs for the
// upstream (status, conclusion) enum pair. License: Apache-2.0

import type { PushCIStatus } from "./github-actions-client";

/**
 * Normalise GitHub Actions (status, conclusion) → PushCI run vocabulary.
 * `status` is the lifecycle state; `conclusion` is only populated once
 * the run enters the `completed` state.
 */
export function githubStatusToPushCI(
  status: string | null | undefined,
  conclusion: string | null | undefined
): PushCIStatus {
  if (!status) return "unknown";
  if (status === "completed") {
    switch (conclusion) {
      case "success":         return "passed";
      case "failure":
      case "timed_out":
      case "startup_failure":
      case "action_required": return "failed";
      case "cancelled":
      case "stale":           return "stopped";
      case "skipped":
      case "neutral":         return "passed";
      default:                return "unknown";
    }
  }
  switch (status) {
    case "in_progress": return "running";
    case "queued":
    case "waiting":
    case "requested":
    case "pending":     return "pending";
    default:            return "unknown";
  }
}
