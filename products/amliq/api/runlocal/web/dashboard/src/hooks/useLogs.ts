import { useEffect, useRef, useState } from 'react';

interface LogLine {
  time: string;
  text: string;
  level: 'info' | 'error' | 'success';
}

const WS_URL = import.meta.env.VITE_WS_URL || 'wss://pushci-api.workers.dev/ws';

export function useLogs(runId: string | null) {
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [connected, setConnected] = useState(false);
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!runId) return;

    const socket = new WebSocket(`${WS_URL}/runs/${runId}/logs`);
    ws.current = socket;

    socket.onopen = () => setConnected(true);
    socket.onclose = () => setConnected(false);

    socket.onmessage = (event) => {
      try {
        const line: LogLine = JSON.parse(event.data);
        setLogs(prev => [...prev, line]);
      } catch {
        setLogs(prev => [...prev, {
          time: new Date().toISOString(),
          text: event.data,
          level: 'info',
        }]);
      }
    };

    return () => {
      socket.close();
      ws.current = null;
    };
  }, [runId]);

  return { logs, connected, clear: () => setLogs([]) };
}
