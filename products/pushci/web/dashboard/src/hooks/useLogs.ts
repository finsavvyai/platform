import { useEffect, useState } from 'react';
import { api } from './useApi';

export interface LogLine {
  id: string;
  time: string;
  text: string;
  level: 'info' | 'error' | 'success';
}

const BASE_INTERVAL_MS = 2_000;
const MAX_INTERVAL_MS = 30_000;

function classify(line: string): LogLine['level'] {
  const lower = line.toLowerCase();
  if (/(error|fail|✗|fatal)/.test(lower)) return 'error';
  if (/(success|pass|✓)/.test(lower)) return 'success';
  return 'info';
}

function toLines(output: string): LogLine[] {
  return output
    .split('\n')
    .filter((line) => line.length > 0)
    .map((text, i) => ({
      id: `${i}:${text.slice(0, 32)}`,
      time: new Date().toISOString(),
      text,
      level: classify(text),
    }));
}

export function useLogs(runId: string | null): {
  logs: LogLine[];
  connected: boolean;
  clear: () => void;
} {
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!runId) {
      setLogs([]);
      setConnected(false);
      return;
    }
    const activeRunId = runId;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let consecutiveErrors = 0;

    function schedule(delay: number) {
      timer = setTimeout(() => void refresh(), delay);
    }

    async function refresh() {
      if (cancelled) return;
      try {
        const output = await api.getRunLogs(activeRunId);
        if (cancelled) return;
        consecutiveErrors = 0;
        setLogs(toLines(output));
        setConnected(true);
        schedule(BASE_INTERVAL_MS);
      } catch {
        if (cancelled) return;
        setConnected(false);
        consecutiveErrors += 1;
        // Exponential backoff: 2s, 4s, 8s, 16s, 30s (capped).
        const delay = Math.min(
          BASE_INTERVAL_MS * 2 ** Math.min(consecutiveErrors - 1, 4),
          MAX_INTERVAL_MS,
        );
        schedule(delay);
      }
    }

    void refresh();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [runId]);

  return { logs, connected, clear: () => setLogs([]) };
}
