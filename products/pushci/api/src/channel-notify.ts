// Pipeline notifications: send run status updates to all active channels for a user.

import type { Env } from "./types";
import type { ChannelConnection } from "./channel-types";
import { dispatch } from "./channel-dispatch";

type RunStatus = "pending" | "running" | "passed" | "failed" | "cancelled";

interface RunEvent {
  runId: string;
  repo: string;
  branch: string;
  status: RunStatus;
  duration?: string;
  error?: string;
}

const STATUS_ICONS: Record<RunStatus, string> = {
  pending: "[PENDING]",
  running: "[RUNNING]",
  passed: "[PASSED]",
  failed: "[FAILED]",
  cancelled: "[CANCELLED]",
};

export async function notifyChannels(env: Env, userSub: string, event: RunEvent): Promise<void> {
  const connections = await env.DB.prepare(
    `SELECT * FROM channel_connections WHERE user_id=? AND status='active'`
  ).bind(userSub).all<ChannelConnection>();

  if (!connections.results.length) return;

  const message = formatNotification(event);
  const sends = connections.results.map((conn) =>
    dispatch(conn, message, conn.external_id ?? "notification").catch(() => {})
  );
  await Promise.allSettled(sends);
}

function formatNotification(event: RunEvent): string {
  const icon = STATUS_ICONS[event.status];
  const lines = [`${icon} *${event.repo}* (${event.branch})`];

  switch (event.status) {
    case "running":
      lines.push(`Run ${event.runId.slice(0, 8)} started.`);
      break;
    case "passed":
      lines.push(`Run ${event.runId.slice(0, 8)} passed.${event.duration ? ` (${event.duration})` : ""}`);
      break;
    case "failed":
      lines.push(`Run ${event.runId.slice(0, 8)} failed.`);
      if (event.error) lines.push(`Error: ${event.error.slice(0, 300)}`);
      break;
    case "cancelled":
      lines.push(`Run ${event.runId.slice(0, 8)} cancelled.`);
      break;
    default:
      lines.push(`Run ${event.runId.slice(0, 8)} is ${event.status}.`);
  }

  lines.push(`Dashboard: https://app.pushci.dev/runs/${event.runId}`);
  return lines.join("\n");
}
