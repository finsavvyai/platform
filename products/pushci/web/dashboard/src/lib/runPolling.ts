// Long-poll helper for async chat actions (currently only run_pipeline).
// Polls /api/chat/run/:runId every intervalMs until the run reaches a
// terminal state (succeeded / failed / cancelled) or timeoutMs elapses.

import { API_BASE_URL } from '../config';

export interface PollResult {
  status: string;
  run: unknown;
}

const TERMINAL_STATES = new Set(['succeeded', 'failed', 'cancelled']);

export async function pollRunStatus(
  runId: string,
  token: string,
  opts: { intervalMs?: number; timeoutMs?: number } = {},
): Promise<PollResult> {
  const intervalMs = opts.intervalMs ?? 2000;
  const timeoutMs = opts.timeoutMs ?? 5 * 60 * 1000;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const res = await fetch(`${API_BASE_URL}/api/chat/run/${runId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const run = (await res.json()) as { status?: string };
      const status = run.status ?? 'unknown';
      if (TERMINAL_STATES.has(status)) {
        return { status, run };
      }
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return { status: 'timeout', run: null };
}
